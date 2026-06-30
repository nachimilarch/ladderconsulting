const db = require('../config/db');
const { logAction } = require('../utils/auditLog');

const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || null;

const getEmployeeId = async (userId) => {
    const [[emp]] = await db.query(
        'SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL', [userId]
    );
    return emp?.id ?? null;
};

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) {
        console.error('[notify]', err.message);
    }
};

// ── GET /tasks — role-scoped list ─────────────────────────────────────────────
exports.getAll = async (req, res) => {
    const { assigned_to, status, priority, due_from, due_to } = req.query;
    const filters = ['t.deleted_at IS NULL'];
    const params = [];

    if (req.user.role === 'hr_staff') {
        const empId = await getEmployeeId(req.user.id);
        filters.push('t.assigned_to = ?');
        params.push(empId);
    } else if (assigned_to) {
        filters.push('t.assigned_to = ?');
        params.push(assigned_to);
    }

    if (status) { filters.push('t.status = ?'); params.push(status); }
    if (priority) { filters.push('t.priority = ?'); params.push(priority); }
    if (due_from) { filters.push('DATE(t.due_date) >= ?'); params.push(due_from); }
    if (due_to) { filters.push('DATE(t.due_date) <= ?'); params.push(due_to); }

    try {
        const [rows] = await db.query(
            `SELECT t.*,
                    ua.name AS assigned_to_name,
                    ub.name AS assigned_by_name
             FROM tasks t
             LEFT JOIN employees ea ON t.assigned_to = ea.id
             LEFT JOIN users ua ON ua.id = ea.user_id
             LEFT JOIN employees eb ON t.assigned_by = eb.id
             LEFT JOIN users ub ON ub.id = eb.user_id
             WHERE ${filters.join(' AND ')}
             ORDER BY t.due_date ASC, t.priority DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[task.getAll]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /tasks/:id ────────────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
    try {
        const [[task]] = await db.query(
            `SELECT t.*,
                    ua.name AS assigned_to_name,
                    ub.name AS assigned_by_name
             FROM tasks t
             LEFT JOIN employees ea ON t.assigned_to = ea.id
             LEFT JOIN users ua ON ua.id = ea.user_id
             LEFT JOIN employees eb ON t.assigned_by = eb.id
             LEFT JOIN users ub ON ub.id = eb.user_id
             WHERE t.id = ? AND t.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

        if (req.user.role === 'hr_staff') {
            const empId = await getEmployeeId(req.user.id);
            if (task.assigned_to !== empId) return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const [notes] = await db.query(
            `SELECT tn.*, u.name AS author_name
             FROM task_notes tn
             LEFT JOIN employees e ON tn.author_id = e.id
             LEFT JOIN users u ON u.id = e.user_id
             WHERE tn.task_id = ? ORDER BY tn.created_at ASC`,
            [req.params.id]
        );

        res.json({ success: true, data: { ...task, notes } });
    } catch (err) {
        console.error('[task.getOne]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /tasks — admin only ──────────────────────────────────────────────────
exports.create = async (req, res) => {
    const { assigned_to, title, description, priority, due_date } = req.body;
    if (!title) return res.status(422).json({ success: false, message: 'Title is required.' });
    if (priority && !VALID_PRIORITIES.includes(priority)) {
        return res.status(422).json({ success: false, message: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    try {
        const assignedBy = await getEmployeeId(req.user.id);
        const [result] = await db.query(
            `INSERT INTO tasks (assigned_to, assigned_by, title, description, priority, due_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [assigned_to || null, assignedBy, title,
             description || null, priority || 'medium', due_date || null]
        );

        // Notify assignee
        if (assigned_to) {
            const [[assignee]] = await db.query(
                'SELECT u.id AS user_id, u.name FROM employees e JOIN users u ON u.id = e.user_id WHERE e.id = ?',
                [assigned_to]
            );
            if (assignee) {
                await notify(assignee.user_id, 'task_assigned', 'New Task Assigned',
                    `You have been assigned a new task: "${title}"`,
                    { task_id: result.insertId }
                );
            }
        }

        logAction(req.user.id, 'create_task', 'task', result.insertId, { title, assigned_to, priority }, ip(req));
        res.status(201).json({ success: true, message: 'Task created.', id: result.insertId });
    } catch (err) {
        console.error('[task.create]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PATCH /tasks/:id/status ───────────────────────────────────────────────────
exports.updateStatus = async (req, res) => {
    const { status, time_logged_hrs } = req.body;
    if (!VALID_STATUSES.includes(status)) {
        return res.status(422).json({ success: false, message: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` });
    }
    try {
        const [[task]] = await db.query(
            `SELECT t.*, ub.user_id AS assigned_by_user_id
             FROM tasks t
             LEFT JOIN employees eb ON t.assigned_by = eb.id
             LEFT JOIN users ub ON ub.id = eb.user_id
             WHERE t.id = ? AND t.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

        if (req.user.role === 'hr_staff') {
            const empId = await getEmployeeId(req.user.id);
            if (task.assigned_to !== empId) return res.status(403).json({ success: false, message: 'You can only update your own tasks.' });
        }

        const completedAt = status === 'completed' ? new Date() : null;
        await db.query(
            'UPDATE tasks SET status=?, completed_at=?, time_logged_hrs=? WHERE id=? AND deleted_at IS NULL',
            [status, completedAt, time_logged_hrs ?? task.time_logged_hrs, req.params.id]
        );

        // Notify assigned_by on completion
        if (status === 'completed' && task.assigned_by_user_id) {
            await notify(task.assigned_by_user_id, 'task_completed', 'Task Completed',
                `Task "${task.title}" has been marked as completed.`,
                { task_id: req.params.id }
            );
        }

        res.json({ success: true, message: 'Task status updated.' });
    } catch (err) {
        console.error('[task.updateStatus]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /tasks/:id/notes ─────────────────────────────────────────────────────
exports.addNote = async (req, res) => {
    const { note } = req.body;
    if (!note?.trim()) return res.status(422).json({ success: false, message: 'Note content is required.' });
    try {
        const [[task]] = await db.query(
            'SELECT id, assigned_to FROM tasks WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

        if (req.user.role === 'hr_staff') {
            const empId = await getEmployeeId(req.user.id);
            if (task.assigned_to !== empId) return res.status(403).json({ success: false, message: 'You can only add notes to your own tasks.' });
        }

        const authorId = await getEmployeeId(req.user.id);
        await db.query(
            'INSERT INTO task_notes (task_id, author_id, note) VALUES (?, ?, ?)',
            [req.params.id, authorId, note.trim()]
        );
        res.status(201).json({ success: true, message: 'Note added.' });
    } catch (err) {
        console.error('[task.addNote]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /tasks/:id/notes ──────────────────────────────────────────────────────
exports.getNotes = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT tn.*, u.name AS author_name
             FROM task_notes tn
             LEFT JOIN employees e ON tn.author_id = e.id
             LEFT JOIN users u ON u.id = e.user_id
             WHERE tn.task_id = ? ORDER BY tn.created_at ASC`,
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[task.getNotes]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── DELETE /tasks/:id — admin only ───────────────────────────────────────────
exports.remove = async (req, res) => {
    try {
        const [[task]] = await db.query(
            'SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

        await db.query('UPDATE tasks SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        logAction(req.user.id, 'delete_task', 'task', req.params.id, {}, ip(req));
        res.json({ success: true, message: 'Task deleted.' });
    } catch (err) {
        console.error('[task.remove]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

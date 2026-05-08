const db = require('../config/db');

exports.getAll = async (req, res) => {
    const { assigned_to, status } = req.query;
    const filters = ['t.deleted_at IS NULL'];
    const params = [];

    if (assigned_to) { filters.push('t.assigned_to = ?'); params.push(assigned_to); }
    if (status) { filters.push('t.status = ?'); params.push(status); }

    try {
        const [rows] = await db.query(
            `SELECT t.*, e.name AS assigned_to_name, u.name AS created_by_name
       FROM tasks t
       LEFT JOIN employees e ON t.assigned_to = e.id
       LEFT JOIN users u ON t.created_by = u.id
       WHERE ${filters.join(' AND ')}
       ORDER BY t.due_date ASC, t.priority DESC`,
            params
        );
        res.json({ tasks: rows });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.create = async (req, res) => {
    const { assigned_to, title, description, priority, due_date } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required.' });
    try {
        const [result] = await db.query(
            `INSERT INTO tasks (assigned_to, created_by, title, description, priority, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [assigned_to || null, req.user.id, title, description || null, priority || 'medium', due_date || null]
        );
        res.status(201).json({ message: 'Task created.', id: result.insertId });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.update = async (req, res) => {
    const { title, description, priority, due_date, assigned_to, status } = req.body;
    const completedAt = status === 'done' ? new Date() : null;
    try {
        await db.query(
            `UPDATE tasks SET title=?, description=?, priority=?, due_date=?, assigned_to=?, status=?, completed_at=?
       WHERE id=? AND deleted_at IS NULL`,
            [title, description || null, priority || 'medium', due_date || null,
                assigned_to || null, status || 'pending', completedAt, req.params.id]
        );
        res.json({ message: 'Task updated.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.updateStatus = async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'done'];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status.' });
    const completedAt = status === 'done' ? new Date() : null;
    try {
        await db.query(
            'UPDATE tasks SET status=?, completed_at=? WHERE id=? AND deleted_at IS NULL',
            [status, completedAt, req.params.id]
        );
        res.json({ message: 'Task status updated.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.addNote = async (req, res) => {
    const { note } = req.body;
    if (!note) return res.status(400).json({ message: 'Note content is required.' });
    try {
        await db.query(
            'INSERT INTO task_notes (task_id, author_id, note) VALUES (?, ?, ?)',
            [req.params.id, req.user.id, note]
        );
        res.status(201).json({ message: 'Note added.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getNotes = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT tn.*, u.name AS author_name
       FROM task_notes tn
       LEFT JOIN users u ON tn.author_id = u.id
       WHERE tn.task_id = ?
       ORDER BY tn.created_at ASC`,
            [req.params.id]
        );
        res.json({ notes: rows });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.remove = async (req, res) => {
    try {
        await db.query('UPDATE tasks SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        res.json({ message: 'Task deleted.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};
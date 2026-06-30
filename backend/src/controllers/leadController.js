const db = require('../config/db');
const { logAction } = require('../utils/auditLog');

const VALID_STAGES = ['new', 'contacted', 'interested', 'proposal', 'converted', 'lost'];

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

// ── GET /leads — role-scoped list ─────────────────────────────────────────────
exports.getAll = async (req, res) => {
    const { stage, assigned_to, search } = req.query;
    const filters = ['l.deleted_at IS NULL'];
    const params = [];

    // hr_staff sees only their own leads
    if (req.user.role === 'hr_staff') {
        const empId = await getEmployeeId(req.user.id);
        filters.push('l.assigned_to = ?');
        params.push(empId);
    } else if (assigned_to) {
        filters.push('l.assigned_to = ?');
        params.push(assigned_to);
    }

    if (stage) { filters.push('l.stage = ?'); params.push(stage); }
    if (search) {
        filters.push('(l.company_name LIKE ? OR l.contact_name LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }

    try {
        const [rows] = await db.query(
            `SELECT l.*, u.name AS assigned_to_name
             FROM leads l
             LEFT JOIN employees e ON l.assigned_to = e.id
             LEFT JOIN users u ON u.id = e.user_id
             WHERE ${filters.join(' AND ')}
             ORDER BY l.updated_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[lead.getAll]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /leads/:id ─────────────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
    try {
        const [[row]] = await db.query(
            `SELECT l.*, u.name AS assigned_to_name
             FROM leads l
             LEFT JOIN employees e ON l.assigned_to = e.id
             LEFT JOIN users u ON u.id = e.user_id
             WHERE l.id = ? AND l.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Lead not found.' });

        // hr_staff can only view their own leads
        if (req.user.role === 'hr_staff') {
            const empId = await getEmployeeId(req.user.id);
            if (row.assigned_to !== empId) {
                return res.status(403).json({ success: false, message: 'Access denied.' });
            }
        }

        // Fetch related call logs
        const [calls] = await db.query(
            `SELECT cl.*, u.name AS employee_name
             FROM call_logs cl
             LEFT JOIN employees e ON cl.employee_id = e.id
             LEFT JOIN users u ON u.id = e.user_id
             WHERE cl.lead_id = ? AND cl.deleted_at IS NULL
             ORDER BY cl.called_at DESC LIMIT 20`,
            [req.params.id]
        );

        res.json({ success: true, data: { ...row, calls } });
    } catch (err) {
        console.error('[lead.getOne]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /leads ────────────────────────────────────────────────────────────────
exports.create = async (req, res) => {
    const { company_name, contact_name, contact_email, contact_phone, source, assigned_to, notes, stage } = req.body;
    if (!company_name) return res.status(422).json({ success: false, message: 'company_name is required.' });

    // hr_staff automatically assigned to self
    let assignedTo = assigned_to || null;
    if (req.user.role === 'hr_staff') {
        assignedTo = await getEmployeeId(req.user.id);
    }

    try {
        const [result] = await db.query(
            `INSERT INTO leads (company_name, contact_name, contact_email, contact_phone, source, assigned_to, notes, stage)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [company_name, contact_name || null, contact_email || null,
             contact_phone || null, source || null, assignedTo, notes || null, stage || 'new']
        );
        res.status(201).json({ success: true, message: 'Lead created.', id: result.insertId });
    } catch (err) {
        console.error('[lead.create]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /leads/:id ────────────────────────────────────────────────────────────
exports.update = async (req, res) => {
    const { company_name, contact_name, contact_email, contact_phone, source, assigned_to, notes } = req.body;
    try {
        const [[existing]] = await db.query(
            'SELECT id, assigned_to FROM leads WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!existing) return res.status(404).json({ success: false, message: 'Lead not found.' });

        if (req.user.role === 'hr_staff') {
            const empId = await getEmployeeId(req.user.id);
            if (existing.assigned_to !== empId) return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        await db.query(
            `UPDATE leads SET company_name=?, contact_name=?, contact_email=?, contact_phone=?,
             source=?, assigned_to=?, notes=?
             WHERE id=? AND deleted_at IS NULL`,
            [company_name, contact_name || null, contact_email || null,
             contact_phone || null, source || null,
             req.user.role === 'hr_staff' ? existing.assigned_to : (assigned_to || null),
             notes || null, req.params.id]
        );
        res.json({ success: true, message: 'Lead updated.' });
    } catch (err) {
        console.error('[lead.update]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /leads/:id/stage ──────────────────────────────────────────────────────
exports.updateStage = async (req, res) => {
    const { stage } = req.body;
    if (!VALID_STAGES.includes(stage)) {
        return res.status(422).json({ success: false, message: `Invalid stage. Valid: ${VALID_STAGES.join(', ')}` });
    }
    try {
        const [[row]] = await db.query(
            'SELECT id, assigned_to FROM leads WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Lead not found.' });

        if (req.user.role === 'hr_staff') {
            const empId = await getEmployeeId(req.user.id);
            if (row.assigned_to !== empId) return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        await db.query('UPDATE leads SET stage = ?, updated_at = NOW() WHERE id = ?', [stage, req.params.id]);
        res.json({ success: true, message: 'Lead stage updated.' });
    } catch (err) {
        console.error('[lead.updateStage]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /leads/:id/assign — admin only ───────────────────────────────────────
exports.assign = async (req, res) => {
    const { assigned_to } = req.body;
    if (!assigned_to) return res.status(422).json({ success: false, message: 'assigned_to (employee id) is required.' });
    try {
        const [[lead]] = await db.query(
            'SELECT id, company_name FROM leads WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

        const [[emp]] = await db.query(
            `SELECT e.id, u.id AS user_id, u.name FROM employees e
             JOIN users u ON u.id = e.user_id
             WHERE e.id = ? AND e.deleted_at IS NULL`,
            [assigned_to]
        );
        if (!emp) return res.status(404).json({ success: false, message: 'Assignee employee not found.' });

        await db.query(
            'UPDATE leads SET assigned_to = ?, updated_at = NOW() WHERE id = ?',
            [assigned_to, req.params.id]
        );

        // Notify new assignee
        await notify(emp.user_id, 'lead_assigned', 'Lead Assigned to You',
            `Lead "${lead.company_name}" has been assigned to you.`,
            { lead_id: req.params.id }
        );

        logAction(req.user.id, 'reassign_lead', 'lead', req.params.id,
            { assigned_to, assignee_name: emp.name }, ip(req));

        res.json({ success: true, message: 'Lead assigned.' });
    } catch (err) {
        console.error('[lead.assign]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── DELETE /leads/:id ─────────────────────────────────────────────────────────
exports.remove = async (req, res) => {
    try {
        const [[lead]] = await db.query(
            'SELECT id FROM leads WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

        await db.query('UPDATE leads SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        logAction(req.user.id, 'delete_lead', 'lead', req.params.id, {}, ip(req));
        res.json({ success: true, message: 'Lead deleted.' });
    } catch (err) {
        console.error('[lead.remove]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

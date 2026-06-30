const db = require('../config/db');

const VALID_OUTCOMES = ['no_answer', 'voicemail', 'callback_scheduled', 'interested', 'not_interested', 'converted'];

const getEmployeeId = async (userId) => {
    const [[emp]] = await db.query(
        'SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL', [userId]
    );
    return emp?.id ?? null;
};

// ── POST /calls — log a new call ──────────────────────────────────────────────
exports.logCall = async (req, res) => {
    let { employee_id, lead_id, outcome, notes, callback_at, called_at, duration_secs } = req.body;

    if (!lead_id || !outcome) {
        return res.status(422).json({ success: false, message: 'lead_id and outcome are required.' });
    }
    if (!VALID_OUTCOMES.includes(outcome)) {
        return res.status(422).json({ success: false, message: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}` });
    }
    if (outcome === 'callback_scheduled' && !callback_at) {
        return res.status(422).json({ success: false, message: 'callback_at is required when outcome is callback_scheduled.' });
    }

    try {
        // hr_staff always log against their own employee record
        if (req.user.role === 'hr_staff') {
            employee_id = await getEmployeeId(req.user.id);
            if (!employee_id) return res.status(400).json({ success: false, message: 'No employee record found for your account.' });
        } else if (!employee_id) {
            return res.status(422).json({ success: false, message: 'employee_id is required for admin.' });
        }

        // Verify lead exists
        const [[lead]] = await db.query('SELECT id FROM leads WHERE id = ? AND deleted_at IS NULL', [lead_id]);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

        const [result] = await db.query(
            `INSERT INTO call_logs (employee_id, lead_id, outcome, notes, callback_at, called_at, duration_secs)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [employee_id, lead_id, outcome, notes || null,
             callback_at || null, called_at || new Date(), duration_secs || null]
        );

        // If converted, update lead stage
        if (outcome === 'converted') {
            await db.query('UPDATE leads SET stage = ? WHERE id = ?', ['converted', lead_id]);
        }

        res.status(201).json({ success: true, message: 'Call logged.', id: result.insertId });
    } catch (err) {
        console.error('[call.logCall]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /calls — list with role scoping ───────────────────────────────────────
exports.getCalls = async (req, res) => {
    const { outcome, date_from, date_to, page = 1, limit = 20, employee_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const filters = ['c.deleted_at IS NULL'];
    const params = [];

    // hr_staff sees only their own calls
    if (req.user.role === 'hr_staff') {
        const empId = await getEmployeeId(req.user.id);
        if (empId) { filters.push('c.employee_id = ?'); params.push(empId); }
    } else if (employee_id) {
        filters.push('c.employee_id = ?'); params.push(employee_id);
    }

    if (outcome) { filters.push('c.outcome = ?'); params.push(outcome); }
    if (date_from) { filters.push('DATE(c.called_at) >= ?'); params.push(date_from); }
    if (date_to) { filters.push('DATE(c.called_at) <= ?'); params.push(date_to); }

    const where = 'WHERE ' + filters.join(' AND ');

    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM call_logs c ${where}`, params
        );
        const [rows] = await db.query(
            `SELECT c.*, u.name AS employee_name, l.company_name AS lead_company, l.contact_name
             FROM call_logs c
             LEFT JOIN employees e ON c.employee_id = e.id
             LEFT JOIN users u ON u.id = e.user_id
             LEFT JOIN leads l ON l.id = c.lead_id
             ${where} ORDER BY c.called_at DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('[call.getCalls]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /calls/:id ────────────────────────────────────────────────────────────
exports.updateCall = async (req, res) => {
    const { outcome, notes, callback_at, duration_secs } = req.body;
    try {
        const [[call]] = await db.query(
            'SELECT id, employee_id FROM call_logs WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!call) return res.status(404).json({ success: false, message: 'Call not found.' });

        if (req.user.role === 'hr_staff') {
            const empId = await getEmployeeId(req.user.id);
            if (call.employee_id !== empId) return res.status(403).json({ success: false, message: 'Cannot edit another employee\'s call.' });
        }

        if (outcome && !VALID_OUTCOMES.includes(outcome)) {
            return res.status(422).json({ success: false, message: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}` });
        }

        const fields = [];
        const vals = [];
        if (outcome !== undefined) { fields.push('outcome = ?'); vals.push(outcome); }
        if (notes !== undefined) { fields.push('notes = ?'); vals.push(notes); }
        if (callback_at !== undefined) { fields.push('callback_at = ?'); vals.push(callback_at); }
        if (duration_secs !== undefined) { fields.push('duration_secs = ?'); vals.push(duration_secs); }
        if (!fields.length) return res.status(422).json({ success: false, message: 'No fields to update.' });

        vals.push(req.params.id);
        await db.query(`UPDATE call_logs SET ${fields.join(', ')} WHERE id = ?`, vals);
        res.json({ success: true, message: 'Call updated.' });
    } catch (err) {
        console.error('[call.updateCall]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── DELETE /calls/:id ─────────────────────────────────────────────────────────
exports.deleteCall = async (req, res) => {
    try {
        const [[call]] = await db.query(
            'SELECT id, employee_id FROM call_logs WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!call) return res.status(404).json({ success: false, message: 'Call not found.' });

        if (req.user.role === 'hr_staff') {
            const empId = await getEmployeeId(req.user.id);
            if (call.employee_id !== empId) return res.status(403).json({ success: false, message: 'Cannot delete another employee\'s call.' });
        }

        await db.query('UPDATE call_logs SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Call deleted.' });
    } catch (err) {
        console.error('[call.deleteCall]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

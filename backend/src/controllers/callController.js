const db = require('../config/db');

exports.logCall = async (req, res) => {
    const { employee_id, contact_name, contact_phone, contact_company, outcome, notes, callback_at, called_at } = req.body;
    if (!employee_id || !contact_name || !outcome) {
        return res.status(400).json({ message: 'employee_id, contact_name, and outcome are required.' });
    }
    try {
        const [result] = await db.query(
            `INSERT INTO call_logs (employee_id, contact_name, contact_phone, contact_company, outcome, notes, callback_at, called_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [employee_id, contact_name, contact_phone || null, contact_company || null,
                outcome, notes || null, callback_at || null, called_at || new Date()]
        );
        res.status(201).json({ message: 'Call logged.', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getCalls = async (req, res) => {
    const { employee_id, outcome, date_from, date_to, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const filters = [];
    const params = [];

    if (employee_id) { filters.push('c.employee_id = ?'); params.push(employee_id); }
    if (outcome) { filters.push('c.outcome = ?'); params.push(outcome); }
    if (date_from) { filters.push('DATE(c.called_at) >= ?'); params.push(date_from); }
    if (date_to) { filters.push('DATE(c.called_at) <= ?'); params.push(date_to); }

    const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM call_logs c ${where}`, params
        );
        const [rows] = await db.query(
            `SELECT c.*, e.name AS employee_name
       FROM call_logs c
       LEFT JOIN employees e ON c.employee_id = e.id
       ${where} ORDER BY c.called_at DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ calls: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
};
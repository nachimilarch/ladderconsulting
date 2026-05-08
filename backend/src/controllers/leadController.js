const db = require('../config/db');

exports.getAll = async (req, res) => {
    const { stage, assigned_to } = req.query;
    const filters = ['l.deleted_at IS NULL'];
    const params = [];

    if (stage) { filters.push('l.stage = ?'); params.push(stage); }
    if (assigned_to) { filters.push('l.assigned_to = ?'); params.push(assigned_to); }

    try {
        const [rows] = await db.query(
            `SELECT l.*, e.name AS assigned_to_name
       FROM leads l
       LEFT JOIN employees e ON l.assigned_to = e.id
       WHERE ${filters.join(' AND ')}
       ORDER BY l.updated_at DESC`,
            params
        );
        res.json({ leads: rows });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.create = async (req, res) => {
    const { company_name, contact_person, contact_email, contact_phone, source, assigned_to, notes, expected_value } = req.body;
    if (!company_name) return res.status(400).json({ message: 'Company name is required.' });
    try {
        const [result] = await db.query(
            `INSERT INTO leads (company_name, contact_person, contact_email, contact_phone, source, assigned_to, notes, expected_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [company_name, contact_person || null, contact_email || null, contact_phone || null,
                source || null, assigned_to || null, notes || null, expected_value || null]
        );

        // Log initial stage
        await db.query(
            `INSERT INTO lead_stage_history (lead_id, changed_by, from_stage, to_stage) VALUES (?, ?, NULL, 'new')`,
            [result.insertId, req.user.id]
        );

        res.status(201).json({ message: 'Lead created.', id: result.insertId });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.update = async (req, res) => {
    const { company_name, contact_person, contact_email, contact_phone, source, assigned_to, notes, expected_value } = req.body;
    try {
        await db.query(
            `UPDATE leads SET company_name=?, contact_person=?, contact_email=?, contact_phone=?,
       source=?, assigned_to=?, notes=?, expected_value=?
       WHERE id=? AND deleted_at IS NULL`,
            [company_name, contact_person || null, contact_email || null, contact_phone || null,
                source || null, assigned_to || null, notes || null, expected_value || null, req.params.id]
        );
        res.json({ message: 'Lead updated.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.updateStage = async (req, res) => {
    const { stage } = req.body;
    const validStages = ['new', 'contacted', 'warm', 'converted', 'lost'];
    if (!validStages.includes(stage)) return res.status(400).json({ message: 'Invalid stage.' });

    try {
        const [rows] = await db.query('SELECT stage FROM leads WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!rows.length) return res.status(404).json({ message: 'Lead not found.' });

        const fromStage = rows[0].stage;
        await db.query('UPDATE leads SET stage = ? WHERE id = ?', [stage, req.params.id]);
        await db.query(
            `INSERT INTO lead_stage_history (lead_id, changed_by, from_stage, to_stage) VALUES (?, ?, ?, ?)`,
            [req.params.id, req.user.id, fromStage, stage]
        );

        res.json({ message: 'Lead stage updated.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.remove = async (req, res) => {
    try {
        await db.query('UPDATE leads SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        res.json({ message: 'Lead deleted.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};
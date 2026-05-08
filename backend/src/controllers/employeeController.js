const db = require('../config/db');

exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.*, u.email AS user_email
       FROM employees e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.deleted_at IS NULL
       ORDER BY e.created_at DESC`
        );
        res.json({ employees: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.getOne = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Employee not found.' });
        res.json({ employee: rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.create = async (req, res) => {
    const { name, email, phone, department, designation, date_joined, user_id } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required.' });
    try {
        const [result] = await db.query(
            `INSERT INTO employees (name, email, phone, department, designation, date_joined, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, email, phone || null, department || null, designation || null, date_joined || null, user_id || null]
        );
        res.status(201).json({ message: 'Employee created.', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already exists.' });
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.update = async (req, res) => {
    const { name, email, phone, department, designation, date_joined, status } = req.body;
    try {
        await db.query(
            `UPDATE employees SET name=?, email=?, phone=?, department=?, designation=?, date_joined=?, status=?
       WHERE id=? AND deleted_at IS NULL`,
            [name, email, phone || null, department || null, designation || null, date_joined || null, status || 'active', req.params.id]
        );
        res.json({ message: 'Employee updated.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.remove = async (req, res) => {
    try {
        await db.query(
            `UPDATE employees SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );
        res.json({ message: 'Employee deleted.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};
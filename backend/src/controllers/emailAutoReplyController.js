const db = require('../config/db');

// ── GET /outreach/email/auto-replies ─────────────────────────────────────────
exports.listFlows = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT f.*, u.name AS creator_name
             FROM email_auto_reply_flows f
             LEFT JOIN users u ON u.id = f.created_by
             WHERE f.deleted_at IS NULL
             ORDER BY f.id ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[emailAutoReply.list]', err);
        res.status(500).json({ success: false, message: 'Failed to load flows.' });
    }
};

// ── POST /outreach/email/auto-replies ────────────────────────────────────────
exports.createFlow = async (req, res) => {
    const { flow_name, trigger_type, trigger_keywords, match_type,
            response_subject, response_body, is_active } = req.body;
    if (!flow_name) return res.status(422).json({ success: false, message: 'flow_name is required.' });
    if (!response_body) return res.status(422).json({ success: false, message: 'response_body is required.' });

    try {
        const [result] = await db.query(
            `INSERT INTO email_auto_reply_flows
               (created_by, flow_name, trigger_type, trigger_keywords, match_type,
                response_subject, response_body, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                flow_name,
                trigger_type || 'keyword',
                JSON.stringify(trigger_keywords || []),
                match_type || 'contains',
                response_subject || null,
                response_body,
                is_active !== undefined ? (is_active ? 1 : 0) : 1,
            ]
        );
        const [[flow]] = await db.query(
            'SELECT * FROM email_auto_reply_flows WHERE id = ?', [result.insertId]
        );
        res.status(201).json({ success: true, data: flow });
    } catch (err) {
        console.error('[emailAutoReply.create]', err);
        res.status(500).json({ success: false, message: 'Failed to create flow.' });
    }
};

// ── PUT /outreach/email/auto-replies/:id ─────────────────────────────────────
exports.updateFlow = async (req, res) => {
    try {
        const [[flow]] = await db.query(
            'SELECT * FROM email_auto_reply_flows WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!flow) return res.status(404).json({ success: false, message: 'Flow not found.' });

        const fields = {};
        const allowed = ['flow_name','trigger_type','trigger_keywords','match_type',
                         'response_subject','response_body','is_active'];
        for (const k of allowed) {
            if (req.body[k] !== undefined) {
                fields[k] = k === 'trigger_keywords'
                    ? JSON.stringify(req.body[k])
                    : k === 'is_active' ? (req.body[k] ? 1 : 0)
                    : req.body[k];
            }
        }
        if (!Object.keys(fields).length)
            return res.status(422).json({ success: false, message: 'No fields to update.' });

        const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        await db.query(
            `UPDATE email_auto_reply_flows SET ${setClauses} WHERE id = ?`,
            [...Object.values(fields), req.params.id]
        );
        const [[updated]] = await db.query(
            'SELECT * FROM email_auto_reply_flows WHERE id = ?', [req.params.id]
        );
        res.json({ success: true, data: updated });
    } catch (err) {
        console.error('[emailAutoReply.update]', err);
        res.status(500).json({ success: false, message: 'Failed to update flow.' });
    }
};

// ── DELETE /outreach/email/auto-replies/:id ──────────────────────────────────
exports.deleteFlow = async (req, res) => {
    try {
        const [[flow]] = await db.query(
            'SELECT id FROM email_auto_reply_flows WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!flow) return res.status(404).json({ success: false, message: 'Flow not found.' });
        await db.query(
            'UPDATE email_auto_reply_flows SET deleted_at = NOW() WHERE id = ?', [req.params.id]
        );
        res.json({ success: true, message: 'Flow deleted.' });
    } catch (err) {
        console.error('[emailAutoReply.delete]', err);
        res.status(500).json({ success: false, message: 'Failed to delete flow.' });
    }
};

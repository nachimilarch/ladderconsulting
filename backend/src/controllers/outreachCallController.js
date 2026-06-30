const db = require('../config/db');
const { createLeadFromContact } = require('../services/leadConverter');

const VALID_OUTCOMES = ['no_answer','voicemail','callback_scheduled','interested','not_interested','converted'];

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) {
        console.error('[notify:call]', err.message);
    }
};

// ── GET /outreach/calls ───────────────────────────────────────────────────────
exports.getCalls = async (req, res) => {
    const { outcome, contact_id, campaign_id, page = 1, limit = 20, date_from, date_to } = req.query;
    const offset  = (parseInt(page) - 1) * parseInt(limit);
    const filters = ['ocl.deleted_at IS NULL'];
    const params  = [];

    if (req.user.role === 'hr_staff') {
        filters.push('ocl.called_by = ?');
        params.push(req.user.id);
    }
    if (outcome)    { filters.push('ocl.outcome = ?');           params.push(outcome); }
    if (contact_id) { filters.push('ocl.contact_id = ?');        params.push(contact_id); }
    if (campaign_id){ filters.push('ocl.campaign_id = ?');       params.push(campaign_id); }
    if (date_from)  { filters.push('DATE(ocl.called_at) >= ?');  params.push(date_from); }
    if (date_to)    { filters.push('DATE(ocl.called_at) <= ?');  params.push(date_to); }

    const where = filters.join(' AND ');
    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM outreach_call_logs ocl WHERE ${where}`, params
        );
        const [rows] = await db.query(
            `SELECT ocl.*, u.name AS called_by_name,
                    ct.full_name AS contact_name, ct.company_name, ct.email AS contact_email,
                    c.campaign_name
             FROM outreach_call_logs ocl
             JOIN users u ON u.id = ocl.called_by
             JOIN outreach_contacts ct ON ct.id = ocl.contact_id
             LEFT JOIN outreach_campaigns c ON c.id = ocl.campaign_id
             WHERE ${where}
             ORDER BY ocl.called_at DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('[outreachCall.getCalls]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /outreach/calls ──────────────────────────────────────────────────────
exports.logCall = async (req, res) => {
    const { contact_id, campaign_id, outcome, notes, callback_at, called_at, duration_secs } = req.body;
    if (!contact_id || !outcome) {
        return res.status(422).json({ success: false, message: 'contact_id and outcome are required.' });
    }
    if (!VALID_OUTCOMES.includes(outcome)) {
        return res.status(422).json({ success: false, message: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}` });
    }
    if (outcome === 'callback_scheduled' && !callback_at) {
        return res.status(422).json({ success: false, message: 'callback_at required for callback_scheduled outcome.' });
    }

    try {
        const [[contact]] = await db.query(
            'SELECT * FROM outreach_contacts WHERE id = ? AND deleted_at IS NULL', [contact_id]
        );
        if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });

        const [result] = await db.query(
            `INSERT INTO outreach_call_logs
               (campaign_id, contact_id, called_by, called_at, duration_secs, outcome, notes, callback_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [campaign_id || null, contact_id, req.user.id,
             called_at || new Date(), duration_secs || 0, outcome,
             notes || null, callback_at || null]
        );
        const callLogId = result.insertId;

        // Auto-create lead if converted
        if (outcome === 'converted') {
            try {
                await createLeadFromContact({
                    contactId: contact_id,
                    source: 'cold_call',
                    campaignId: campaign_id || null,
                    executiveUserId: req.user.id,
                    callLogId,
                });
            } catch (e) {
                console.error('[outreachCall.createLead]', e.message);
            }
        }

        // Callback reminder notification
        if (outcome === 'callback_scheduled' && callback_at) {
            await notify(
                req.user.id,
                'callback_scheduled',
                'Callback Reminder Scheduled',
                `Callback scheduled with ${contact.full_name || contact.company_name || 'contact'} for ${new Date(callback_at).toLocaleString('en-IN')}.`,
                { call_log_id: callLogId, contact_id, callback_at }
            );
        }

        res.status(201).json({ success: true, message: 'Call logged.', id: callLogId });
    } catch (err) {
        console.error('[outreachCall.logCall]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /outreach/calls/:id ───────────────────────────────────────────────────
exports.updateCall = async (req, res) => {
    const { outcome, notes, callback_at, duration_secs } = req.body;
    try {
        const [[call]] = await db.query(
            'SELECT id, called_by FROM outreach_call_logs WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!call) return res.status(404).json({ success: false, message: 'Call log not found.' });
        if (req.user.role === 'hr_staff' && call.called_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (outcome && !VALID_OUTCOMES.includes(outcome)) {
            return res.status(422).json({ success: false, message: `Invalid outcome.` });
        }

        const fields = [], vals = [];
        if (outcome      !== undefined) { fields.push('outcome = ?');      vals.push(outcome); }
        if (notes        !== undefined) { fields.push('notes = ?');        vals.push(notes); }
        if (callback_at  !== undefined) { fields.push('callback_at = ?');  vals.push(callback_at || null); }
        if (duration_secs !== undefined){ fields.push('duration_secs = ?');vals.push(duration_secs); }
        if (!fields.length) return res.status(422).json({ success: false, message: 'Nothing to update.' });

        vals.push(req.params.id);
        await db.query(`UPDATE outreach_call_logs SET ${fields.join(', ')} WHERE id = ?`, vals);
        res.json({ success: true, message: 'Call updated.' });
    } catch (err) {
        console.error('[outreachCall.updateCall]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

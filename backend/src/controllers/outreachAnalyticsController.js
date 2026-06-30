const db = require('../config/db');

// ── GET /outreach/analytics/campaigns ────────────────────────────────────────
exports.campaignStats = async (req, res) => {
    const filters = ['c.deleted_at IS NULL'];
    const params  = [];

    if (req.user.role === 'hr_staff') {
        filters.push('c.created_by = ?');
        params.push(req.user.id);
    }

    try {
        const [campaigns] = await db.query(
            `SELECT c.id, c.campaign_name, c.campaign_type, c.status, c.sent_at,
                    c.total_recipients, c.sent_count, c.failed_count, c.reply_count,
                    u.name AS created_by_name,
                    ROUND(CASE WHEN c.sent_count > 0 THEN c.reply_count / c.sent_count * 100 ELSE 0 END, 1) AS reply_rate,
                    COUNT(DISTINCT l.id) AS leads_generated
             FROM outreach_campaigns c
             JOIN users u ON u.id = c.created_by
             LEFT JOIN outreach_contacts ct ON ct.list_id = c.list_id AND ct.lead_id IS NOT NULL
             LEFT JOIN leads l ON l.outreach_campaign_id = c.id AND l.deleted_at IS NULL
             WHERE ${filters.join(' AND ')}
             GROUP BY c.id
             ORDER BY c.created_at DESC`,
            params
        );

        // Overall summary for this user/scope
        const [summary] = await db.query(
            `SELECT
               COUNT(DISTINCT c.id) AS total_campaigns,
               SUM(c.sent_count)    AS total_sent,
               SUM(c.reply_count)   AS total_replies,
               COUNT(DISTINCT l.id) AS total_leads_generated
             FROM outreach_campaigns c
             LEFT JOIN leads l ON l.outreach_campaign_id = c.id AND l.deleted_at IS NULL
             WHERE ${filters.join(' AND ')}`,
            params
        );

        const [[contactStats]] = await db.query(
            `SELECT COUNT(*) AS total_contacts
             FROM outreach_contacts oc
             JOIN outreach_contact_lists ocl ON ocl.id = oc.list_id
             WHERE ocl.uploaded_by ${req.user.role === 'hr_staff' ? '= ?' : 'IS NOT NULL'}
               AND oc.deleted_at IS NULL AND ocl.deleted_at IS NULL`,
            req.user.role === 'hr_staff' ? [req.user.id] : []
        );

        res.json({
            success: true,
            data: campaigns,
            summary: { ...summary[0], total_contacts: contactStats.total_contacts },
        });
    } catch (err) {
        console.error('[outreachAnalytics.campaignStats]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /outreach/analytics/conversions ──────────────────────────────────────
exports.conversionStats = async (req, res) => {
    const filters = ['l.deleted_at IS NULL', "l.source_type IN ('cold_email','cold_call','whatsapp')"];
    const params  = [];

    if (req.user.role === 'hr_staff') {
        // Get employee id
        const [[emp]] = await db.query(
            'SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL', [req.user.id]
        );
        if (emp) {
            filters.push('l.assigned_to = ?');
            params.push(emp.id);
        }
    }

    try {
        const [leads] = await db.query(
            `SELECT l.id, l.company_name, l.contact_name, l.stage, l.source_type,
                    l.created_at, l.outreach_campaign_id, c.campaign_name,
                    u.name AS assigned_to_name
             FROM leads l
             LEFT JOIN outreach_campaigns c ON c.id = l.outreach_campaign_id
             LEFT JOIN employees e ON e.id = l.assigned_to
             LEFT JOIN users u ON u.id = e.user_id
             WHERE ${filters.join(' AND ')}
             ORDER BY l.created_at DESC LIMIT 100`,
            params
        );

        // Grouped by source_type
        const [[grouped]] = await db.query(
            `SELECT
               SUM(source_type = 'cold_email') AS from_email,
               SUM(source_type = 'cold_call')  AS from_call,
               SUM(source_type = 'whatsapp')   AS from_whatsapp,
               SUM(stage = 'converted')         AS converted
             FROM leads l
             WHERE ${filters.join(' AND ')}`,
            params
        );

        res.json({ success: true, data: leads, grouped });
    } catch (err) {
        console.error('[outreachAnalytics.conversions]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── Admin: GET /api/admin/outreach/campaigns ──────────────────────────────────
exports.adminCampaigns = async (req, res) => {
    const { executive_id, type, status } = req.query;
    const filters = ['c.deleted_at IS NULL'];
    const params  = [];

    if (executive_id) { filters.push('c.created_by = ?');     params.push(executive_id); }
    if (type)         { filters.push('c.campaign_type = ?');   params.push(type); }
    if (status)       { filters.push('c.status = ?');          params.push(status); }

    try {
        const [rows] = await db.query(
            `SELECT c.*, u.name AS created_by_name, l.list_name,
                    ROUND(CASE WHEN c.sent_count > 0 THEN c.reply_count / c.sent_count * 100 ELSE 0 END, 1) AS reply_rate
             FROM outreach_campaigns c
             JOIN users u ON u.id = c.created_by
             LEFT JOIN outreach_contact_lists l ON l.id = c.list_id
             WHERE ${filters.join(' AND ')}
             ORDER BY c.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[outreachAnalytics.adminCampaigns]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── Admin: GET /api/admin/outreach/replies ────────────────────────────────────
exports.adminReplies = async (req, res) => {
    const { assigned_to, status, unmatched } = req.query;
    const filters = ['r.deleted_at IS NULL'];
    const params  = [];

    if (assigned_to)        { filters.push('r.assigned_to = ?');    params.push(assigned_to); }
    if (status)             { filters.push('r.reply_status = ?');   params.push(status); }
    if (unmatched === 'true') { filters.push('r.campaign_id IS NULL'); }

    try {
        const [rows] = await db.query(
            `SELECT r.*, c.campaign_name, u.name AS assigned_to_name,
                    ct.full_name AS contact_name
             FROM outreach_email_replies r
             LEFT JOIN outreach_campaigns c ON c.id = r.campaign_id
             LEFT JOIN users u ON u.id = r.assigned_to
             LEFT JOIN outreach_contacts ct ON ct.id = r.contact_id
             WHERE ${filters.join(' AND ')}
             ORDER BY r.received_at DESC LIMIT 100`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[outreachAnalytics.adminReplies]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

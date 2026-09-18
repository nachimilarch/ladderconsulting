const db = require('../config/db');
const { logAction } = require('../utils/auditLog');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;

const PREMIUM_PLACEMENT_FEE_PERCENT = 8.33;

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) { console.error('[notify]', err.message); }
};

const parseMeta = (m) => (typeof m === 'string' ? JSON.parse(m) : m) || {};

// ── GET /api/hr/premium-requests ──────────────────────────────────────────────
exports.listPremiumRequests = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT n.id, n.type, n.title, n.body, n.is_read, n.metadata, n.created_at,
                    c.id AS company_id, c.company_name, c.company_tier, c.placement_fee_percent,
                    c.premium_requested_at
             FROM notifications n
             LEFT JOIN companies c
               ON c.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.company_id')) AS UNSIGNED)
               AND c.deleted_at IS NULL
             WHERE n.user_id = ?
               AND n.type = 'company_premium_request'
               AND n.deleted_at IS NULL
             ORDER BY n.is_read ASC, n.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[companyPremium.list]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/hr/premium-requests/:id/approve ─────────────────────────────────
// Approving is free — it just flips the tier. Money only changes hands at hire
// time, via the existing placement-fee mechanism (companies.placement_fee_percent),
// which this unconditionally sets to the Premium rate.
exports.approvePremiumRequest = async (req, res) => {
    const notificationId = parseInt(req.params.id);
    try {
        const [[notif]] = await db.query(
            `SELECT id, type, metadata FROM notifications WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
            [notificationId, req.user.id]
        );
        if (!notif) return res.status(404).json({ message: 'Request not found.' });
        if (notif.type !== 'company_premium_request') {
            return res.status(400).json({ message: 'Not a Premium tier request.' });
        }

        const { company_id } = parseMeta(notif.metadata);
        const [[company]] = await db.query(
            `SELECT id, company_name, user_id, company_tier FROM companies WHERE id = ? AND deleted_at IS NULL`,
            [company_id]
        );
        if (!company) return res.status(404).json({ message: 'Company not found.' });
        if (company.company_tier === 'premium') {
            return res.status(409).json({ message: `${company.company_name} is already on the Premium tier.` });
        }

        await db.query(
            `UPDATE companies
             SET company_tier = 'premium',
                 placement_fee_percent = ?,
                 premium_approved_at = NOW(),
                 premium_approved_by = ?
             WHERE id = ?`,
            [PREMIUM_PLACEMENT_FEE_PERCENT, req.user.id, company_id]
        );

        await db.query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notificationId]);

        await notify(
            company.user_id,
            'premium_tier_approved',
            'Premium Tier Approved',
            `Your account has been moved to the Premium tier. You can now post jobs and browse the full candidate pool (including Premium candidates) with no listing fee — every hire is charged a ${PREMIUM_PLACEMENT_FEE_PERCENT}% placement fee at hire time.`,
            { company_id }
        );

        logAction(req.user.id, 'approve_premium_tier', 'company', company_id,
            { placement_fee_percent: PREMIUM_PLACEMENT_FEE_PERCENT }, ip(req));

        res.json({ success: true, message: `${company.company_name} moved to the Premium tier.` });
    } catch (err) {
        console.error('[companyPremium.approve]', err);
        res.status(500).json({ message: 'Failed to approve request.' });
    }
};

// ── POST /api/hr/premium-requests/:id/dismiss ─────────────────────────────────
exports.dismissPremiumRequest = async (req, res) => {
    const notificationId = parseInt(req.params.id);
    const { reason } = req.body;
    try {
        const [[notif]] = await db.query(
            `SELECT id, type, metadata FROM notifications WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
            [notificationId, req.user.id]
        );
        if (!notif) return res.status(404).json({ message: 'Request not found.' });

        const meta = parseMeta(notif.metadata);
        await db.query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notificationId]);

        const [[company]] = await db.query(
            `SELECT id, company_name, user_id FROM companies WHERE id = ? AND deleted_at IS NULL`,
            [meta.company_id]
        );
        if (company && reason) {
            await notify(
                company.user_id,
                'premium_tier_rejected',
                'Premium Tier Request — Update',
                `Your Premium tier request could not be processed: ${reason} Please contact your executive for details.`,
                { company_id: company.id }
            );
        }

        res.json({ success: true, message: 'Request dismissed.' });
    } catch (err) {
        console.error('[companyPremium.dismiss]', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

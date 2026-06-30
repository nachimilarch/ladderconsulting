const db = require('../config/db');
const { logAction } = require('../utils/auditLog');
const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress;

const PACKAGE_CONFIG = {
    single: { credits: 1, amount: 999,  label: 'Single Resume Unlock' },
    pack_4: { credits: 4, amount: 3999, label: '4-Resume Pack'         },
};

const parseMeta = (m) => (typeof m === 'string' ? JSON.parse(m) : m) || {};

// GET /api/hr/package-requests
exports.listPackageRequests = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT n.id, n.type, n.title, n.body, n.is_read, n.metadata, n.created_at,
                    c.id AS company_id, c.company_name, c.placement_fee_percent
             FROM notifications n
             LEFT JOIN companies c
               ON c.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.company_id')) AS UNSIGNED)
               AND c.deleted_at IS NULL
             WHERE n.user_id = ?
               AND n.type IN ('package_request', 'platinum_interest')
               AND n.deleted_at IS NULL
             ORDER BY n.is_read ASC, n.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[hrPackage.list]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// POST /api/hr/package-requests/:id/activate
// Activates a Single or 4-Pack for the company (offline payment confirmed).
// Platinum requests cannot be activated here — admin sets the rate via CompanyApprovals.
exports.activatePackage = async (req, res) => {
    const notificationId = parseInt(req.params.id);
    try {
        const [[notif]] = await db.query(
            `SELECT id, type, metadata FROM notifications WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
            [notificationId, req.user.id]
        );
        if (!notif) return res.status(404).json({ message: 'Request not found.' });
        if (notif.type !== 'package_request') {
            return res.status(400).json({ message: 'Platinum requests must be handled by an admin via Company Approvals (set Platinum rate).' });
        }

        const meta = parseMeta(notif.metadata);
        const { company_id, tier } = meta;
        if (!PACKAGE_CONFIG[tier]) return res.status(400).json({ message: 'Invalid tier in request.' });

        const [[company]] = await db.query(
            `SELECT id, company_name, user_id FROM companies WHERE id = ? AND deleted_at IS NULL`,
            [company_id]
        );
        if (!company) return res.status(404).json({ message: 'Company not found.' });

        const { credits, amount, label } = PACKAGE_CONFIG[tier];
        const { nextInvoiceNumber } = require('../utils/placementFee');

        const conn = await db.getConnection();
        let invoiceId, invoiceNumber;
        try {
            await conn.beginTransaction();

            invoiceNumber = await nextInvoiceNumber(conn);
            const [invResult] = await conn.query(
                `INSERT INTO invoices
                    (invoice_number, company_id, raised_by, invoice_type, amount, amount_paid, status, description, paid_at)
                 VALUES (?, ?, ?, 'resume_unlock', ?, ?, 'paid', ?, NOW())`,
                [invoiceNumber, company_id, req.user.id, amount, amount,
                 `${label} — activated by LadderStep (offline payment)`]
            );
            invoiceId = invResult.insertId;

            await conn.query(
                `INSERT INTO resume_unlock_orders (company_id, order_type, credits_total, credits_used, invoice_id)
                 VALUES (?, ?, ?, 0, ?)`,
                [company_id, tier, credits, invoiceId]
            );

            await conn.query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notificationId]);
            await conn.commit();
        } catch (e) {
            await conn.rollback(); throw e;
        } finally { conn.release(); }

        await db.query(
            `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, 'package_activated', ?, ?, ?)`,
            [company.user_id,
             `Package Activated — ${label}`,
             `Your ${label} package has been activated. You now have ${credits} resume unlock credit${credits !== 1 ? 's' : ''} to use in the Talent Pool.`,
             JSON.stringify({ company_id, tier, credits, invoice_id: invoiceId })]
        );

        logAction(req.user.id, 'activate_package', 'company', company_id,
            { tier, credits, amount, invoice_id: invoiceId, invoice_number: invoiceNumber }, ip(req));

        res.json({ success: true, message: `${label} activated for ${company.company_name}.` });
    } catch (err) {
        console.error('[hrPackage.activate]', err);
        res.status(500).json({ message: 'Failed to activate package.' });
    }
};

// POST /api/hr/package-requests/:id/dismiss
// Marks the request as handled (read) and optionally notifies the company.
exports.dismissRequest = async (req, res) => {
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
            const isPlatinum = notif.type === 'platinum_interest';
            await db.query(
                `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, 'package_rejected', ?, ?, ?)`,
                [company.user_id,
                 isPlatinum ? 'Platinum Request — Update' : 'Package Request — Update',
                 `${isPlatinum ? 'Platinum pricing request' : 'Package request'} could not be processed: ${reason} Please contact your executive for details.`,
                 JSON.stringify({ company_id: company.id })]
            );
        }

        res.json({ success: true, message: 'Request dismissed.' });
    } catch (err) {
        console.error('[hrPackage.dismiss]', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

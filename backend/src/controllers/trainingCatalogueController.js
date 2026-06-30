const db = require('../config/db');
const { sendEmail } = require('../utils/email');

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)`,
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) { console.error('[notify]', err.message); }
};

const generateInvoiceNumber = async () => {
    const now = new Date();
    const prefix = `LC-INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [[{ cnt }]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM invoices WHERE invoice_number LIKE ?`, [`${prefix}%`]
    );
    const seq = String(parseInt(cnt) + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
};

// ── GET /api/training-services/catalogue ─────────────────────────────────────
exports.listCatalogue = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, title, description, category, duration_days, price_per_user, is_active
             FROM training_catalogue
             ORDER BY id ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[trainingCatalogue.list]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch training catalogue.' });
    }
};

// ── POST /api/training-services/request ──────────────────────────────────────
exports.requestTraining = async (req, res) => {
    const { catalogue_id, num_users } = req.body;
    if (!catalogue_id || !num_users || num_users < 1) {
        return res.status(400).json({ success: false, message: 'catalogue_id and num_users (≥1) are required.' });
    }
    try {
        // Resolve company
        const [[company]] = await db.query(
            `SELECT id, company_name, assigned_executive_id FROM companies WHERE user_id = ? AND deleted_at IS NULL`,
            [req.user.id]
        );
        if (!company) return res.status(400).json({ success: false, message: 'Company profile not found.' });

        // Verify catalogue item
        const [[item]] = await db.query(
            `SELECT id, title FROM training_catalogue WHERE id = ? AND is_active = 1`, [catalogue_id]
        );
        if (!item) return res.status(404).json({ success: false, message: 'Training topic not found or inactive.' });

        const [result] = await db.query(
            `INSERT INTO company_training_requests
             (company_id, catalogue_id, num_users, requested_by)
             VALUES (?, ?, ?, ?)`,
            [company.id, catalogue_id, num_users, req.user.id]
        );

        // Notify admin
        const [[admin]] = await db.query(
            `SELECT u.id FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE r.name = 'admin' AND u.deleted_at IS NULL
             LIMIT 1`
        );
        if (admin) {
            await notify(
                admin.id,
                'training_request',
                'New Training Request',
                `${company.company_name} requested "${item.title}" for ${num_users} user(s).`,
                { requestId: result.insertId, companyId: company.id }
            );
        }

        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        console.error('[trainingCatalogue.request]', err);
        res.status(500).json({ success: false, message: 'Failed to submit training request.' });
    }
};

// ── GET /api/training-services/my-requests ───────────────────────────────────
exports.listCompanyRequests = async (req, res) => {
    try {
        const [[company]] = await db.query(
            `SELECT id FROM companies WHERE user_id = ? AND deleted_at IS NULL`, [req.user.id]
        );
        if (!company) return res.json({ success: true, data: [] });

        const [rows] = await db.query(
            `SELECT ctr.id, ctr.num_users, ctr.status, ctr.rejection_reason,
                    ctr.approved_at, ctr.created_at,
                    tc.title AS topic_title, tc.category, tc.price_per_user, tc.duration_days,
                    inv.invoice_number, inv.amount, inv.amount_paid, inv.status AS invoice_status,
                    inv.due_date
             FROM company_training_requests ctr
             JOIN training_catalogue tc ON tc.id = ctr.catalogue_id
             LEFT JOIN invoices inv ON inv.id = ctr.invoice_id
             WHERE ctr.company_id = ? AND ctr.deleted_at IS NULL
             ORDER BY ctr.created_at DESC`,
            [company.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[trainingCatalogue.myRequests]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch training requests.' });
    }
};

// ── GET /api/training-services/admin ─────────────────────────────────────────
exports.listAdminRequests = async (req, res) => {
    const { status } = req.query;
    try {
        let where = 'ctr.deleted_at IS NULL';
        const params = [];
        if (status) { where += ' AND ctr.status = ?'; params.push(status); }

        const [rows] = await db.query(
            `SELECT ctr.id, ctr.num_users, ctr.status, ctr.rejection_reason,
                    ctr.approved_at, ctr.created_at,
                    co.company_name, co.id AS company_id,
                    tc.title AS topic_title, tc.category, tc.price_per_user, tc.duration_days,
                    u.name AS requested_by_name, u.email AS requested_by_email,
                    inv.invoice_number, inv.amount, inv.amount_paid, inv.status AS invoice_status
             FROM company_training_requests ctr
             JOIN companies co ON co.id = ctr.company_id
             JOIN training_catalogue tc ON tc.id = ctr.catalogue_id
             JOIN users u ON u.id = ctr.requested_by
             LEFT JOIN invoices inv ON inv.id = ctr.invoice_id
             WHERE ${where}
             ORDER BY FIELD(ctr.status, 'pending', 'approved', 'rejected', 'completed'), ctr.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[trainingCatalogue.adminList]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch training requests.' });
    }
};

// ── PUT /api/training-services/admin/:id/approve ─────────────────────────────
exports.approveRequest = async (req, res) => {
    const { id } = req.params;
    const { admin_notes, due_days = 14 } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [[req_row]] = await conn.query(
            `SELECT ctr.*, tc.title, tc.price_per_user, co.company_name, co.user_id AS company_user_id
             FROM company_training_requests ctr
             JOIN training_catalogue tc ON tc.id = ctr.catalogue_id
             JOIN companies co ON co.id = ctr.company_id
             WHERE ctr.id = ? AND ctr.deleted_at IS NULL`,
            [id]
        );
        if (!req_row) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Request not found.' });
        }
        if (req_row.status !== 'pending') {
            await conn.rollback();
            return res.status(400).json({ success: false, message: `Request is already ${req_row.status}.` });
        }

        // Create invoice
        const invoice_number = await generateInvoiceNumber();
        const amount = parseFloat(req_row.price_per_user) * req_row.num_users;
        const due_date = new Date();
        due_date.setDate(due_date.getDate() + Number(due_days));

        const [invResult] = await conn.query(
            `INSERT INTO invoices
             (invoice_number, company_id, raised_by, invoice_type, amount, amount_paid, status, due_date)
             VALUES (?, ?, ?, 'training_fee', ?, 0, 'pending', ?)`,
            [invoice_number, req_row.company_id, req.user.id, amount, due_date]
        );
        const invoice_id = invResult.insertId;

        // Update request
        await conn.query(
            `UPDATE company_training_requests
             SET status = 'approved', invoice_id = ?, approved_by = ?, approved_at = NOW(),
                 admin_notes = ?
             WHERE id = ?`,
            [invoice_id, req.user.id, admin_notes || null, id]
        );

        await conn.commit();

        // Notify company user
        await notify(
            req_row.company_user_id,
            'training_approved',
            'Training Request Approved',
            `Your request for "${req_row.title}" (${req_row.num_users} users) has been approved. Invoice ${invoice_number} raised for ₹${amount.toLocaleString('en-IN')}.`,
            { requestId: id, invoiceId: invoice_id, invoice_number }
        );

        try {
            const [[compUser]] = await db.query(`SELECT email, name FROM users WHERE id = ?`, [req_row.company_user_id]);
            if (compUser) {
                await sendEmail({
                    to: compUser.email,
                    subject: `Training Request Approved — Invoice ${invoice_number}`,
                    html: `<p>Hi ${compUser.name},</p>
                           <p>Your training request for <strong>"${req_row.title}"</strong> (${req_row.num_users} user(s)) has been approved.</p>
                           <p>Invoice <strong>${invoice_number}</strong> for <strong>₹${amount.toLocaleString('en-IN')}</strong> has been raised. Please log in to your company portal to view and pay the invoice.</p>
                           <p>Due date: ${due_date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                           <p>— LadderStep Human Consulting</p>`,
                });
            }
        } catch (emailErr) { console.error('[Email]', emailErr.message); }

        res.json({ success: true, data: { invoice_number, invoice_id, amount } });
    } catch (err) {
        await conn.rollback();
        console.error('[trainingCatalogue.approve]', err);
        res.status(500).json({ success: false, message: 'Failed to approve request.' });
    } finally { conn.release(); }
};

// ── PUT /api/training-services/admin/:id/reject ───────────────────────────────
exports.rejectRequest = async (req, res) => {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    try {
        const [[req_row]] = await db.query(
            `SELECT ctr.*, tc.title, co.user_id AS company_user_id
             FROM company_training_requests ctr
             JOIN training_catalogue tc ON tc.id = ctr.catalogue_id
             JOIN companies co ON co.id = ctr.company_id
             WHERE ctr.id = ? AND ctr.deleted_at IS NULL`,
            [id]
        );
        if (!req_row) return res.status(404).json({ success: false, message: 'Request not found.' });
        if (req_row.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Request is already ${req_row.status}.` });
        }

        await db.query(
            `UPDATE company_training_requests SET status = 'rejected', rejection_reason = ? WHERE id = ?`,
            [rejection_reason || null, id]
        );

        await notify(
            req_row.company_user_id,
            'training_rejected',
            'Training Request Not Approved',
            `Your request for "${req_row.title}" was not approved.${rejection_reason ? ` Reason: ${rejection_reason}` : ''}`,
            { requestId: id }
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[trainingCatalogue.reject]', err);
        res.status(500).json({ success: false, message: 'Failed to reject request.' });
    }
};

// ── POST /api/training-services/admin/catalogue ───────────────────────────────
exports.createCatalogueItem = async (req, res) => {
    const { title, description, category, duration_days, price_per_user } = req.body;
    if (!title || !price_per_user) {
        return res.status(400).json({ success: false, message: 'title and price_per_user are required.' });
    }
    try {
        const [result] = await db.query(
            `INSERT INTO training_catalogue (title, description, category, duration_days, price_per_user)
             VALUES (?, ?, ?, ?, ?)`,
            [title, description || null, category || null, duration_days || null, price_per_user]
        );
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        console.error('[trainingCatalogue.create]', err);
        res.status(500).json({ success: false, message: 'Failed to create catalogue item.' });
    }
};

// ── PATCH /api/training-services/admin/catalogue/:id/toggle ──────────────────
exports.toggleCatalogueItem = async (req, res) => {
    try {
        await db.query(`UPDATE training_catalogue SET is_active = NOT is_active WHERE id = ?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[trainingCatalogue.toggle]', err);
        res.status(500).json({ success: false, message: 'Failed to update catalogue item.' });
    }
};

// ── PUT /api/training-services/admin/catalogue/:id ───────────────────────────
exports.updateCatalogueItem = async (req, res) => {
    const { title, description, category, duration_days, price_per_user } = req.body;
    try {
        await db.query(
            `UPDATE training_catalogue
             SET title = COALESCE(?, title),
                 description = COALESCE(?, description),
                 category = COALESCE(?, category),
                 duration_days = COALESCE(?, duration_days),
                 price_per_user = COALESCE(?, price_per_user)
             WHERE id = ?`,
            [title, description, category, duration_days, price_per_user, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[trainingCatalogue.updateItem]', err);
        res.status(500).json({ success: false, message: 'Failed to update catalogue item.' });
    }
};

const db = require('../config/db');
const { sendEmail } = require('../utils/email');
const { syncPlacementFeeStatus } = require('../utils/placementFee');
const { generateInvoicePDF } = require('../utils/invoicePdf');

const safeEmail = (opts) => sendEmail(opts).catch(e => console.error('[Email]', e.message));

const notify = (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    db.query(
        `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)`,
        [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
    ).catch(e => console.error('[notify]', e.message));
};

const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Generate invoice number: LC-INV-YYYYMM-XXXX
const generateInvoiceNumber = async () => {
    const now = new Date();
    const prefix = `LC-INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [[{ cnt }]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM invoices WHERE invoice_number LIKE ?`, [`${prefix}%`]
    );
    const seq = String(parseInt(cnt) + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
};

const getExecutiveCompanyIds = async (executiveUserId) => {
    const [rows] = await db.query(
        `SELECT id FROM companies WHERE assigned_executive_id = ? AND deleted_at IS NULL`,
        [executiveUserId]
    );
    return rows.map(r => r.id);
};

// ── GET /api/invoices/exec/companies ─────────────────────────────────────────
// Companies the current user may raise invoices for, selectable by name.
// Executives see their assigned companies; admins see all active companies.
exports.listExecCompanies = async (req, res) => {
    try {
        let rows;
        if (req.user.role === 'admin') {
            [rows] = await db.query(
                `SELECT id, company_name, industry, headquarters
                 FROM companies WHERE deleted_at IS NULL
                 ORDER BY company_name`
            );
        } else {
            [rows] = await db.query(
                `SELECT id, company_name, industry, headquarters
                 FROM companies WHERE assigned_executive_id = ? AND deleted_at IS NULL
                 ORDER BY company_name`,
                [req.user.id]
            );
        }
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[invoice.execCompanies]', err);
        res.status(500).json({ message: 'Failed to fetch companies.' });
    }
};

// ── POST /api/hr/invoices ─────────────────────────────────────────────────────
exports.createInvoice = async (req, res) => {
    const {
        company_id, candidate_id, job_posting_id, application_id,
        invoice_type, amount, description, due_date, notes,
    } = req.body;

    if (!company_id || !invoice_type || !amount) {
        return res.status(400).json({ message: 'company_id, invoice_type, and amount are required.' });
    }
    if (!['placement_fee', 'partial_payment', 'other_fee'].includes(invoice_type)) {
        return res.status(400).json({ message: 'invoice_type must be placement_fee, partial_payment, or other_fee.' });
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
        return res.status(400).json({ message: 'amount must be a positive number.' });
    }

    try {
        // Executive can only raise invoices for their assigned companies
        if (req.user.role !== 'admin') {
            const [cCheck] = await db.query(
                `SELECT id FROM companies WHERE id = ? AND assigned_executive_id = ? AND deleted_at IS NULL`,
                [company_id, req.user.id]
            );
            if (!cCheck.length) {
                return res.status(403).json({ message: 'You can only raise invoices for your assigned companies.' });
            }
        }

        // Get company user for notification
        const [[companyUser]] = await db.query(
            `SELECT u.id AS user_id, u.email, u.name FROM companies c JOIN users u ON u.id = c.user_id
             WHERE c.id = ? AND c.deleted_at IS NULL`, [company_id]
        );
        if (!companyUser) return res.status(404).json({ message: 'Company not found.' });

        const invoice_number = await generateInvoiceNumber();

        const [result] = await db.query(
            `INSERT INTO invoices
                (invoice_number, company_id, candidate_id, job_posting_id, application_id,
                 raised_by, invoice_type, amount, description, due_date, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [invoice_number, company_id, candidate_id || null, job_posting_id || null,
             application_id || null, req.user.id, invoice_type, amtNum,
             description || null, due_date || null, notes || null]
        );

        notify(
            companyUser.user_id,
            'invoice_raised',
            `New Invoice — ${invoice_number}`,
            `A new invoice of ${fmtINR(amtNum)} has been raised by LadderStep Human Consulting.${due_date ? ` Due: ${due_date}.` : ''} Please log in to view and pay.`,
            { invoice_id: result.insertId, company_id }
        );

        if (companyUser.email) {
            safeEmail({
                to: companyUser.email,
                subject: `Invoice ${invoice_number} — LadderStep Human Consulting`,
                html: `
                    <p>Hi ${companyUser.name},</p>
                    <p>A new invoice has been raised by your LadderStep Human Consulting executive.</p>
                    <table style="border-collapse:collapse;margin:16px 0;">
                        <tr><td style="padding:4px 16px 4px 0;font-weight:600;">Invoice #</td><td>${invoice_number}</td></tr>
                        <tr><td style="padding:4px 16px 4px 0;font-weight:600;">Amount</td><td>${fmtINR(amtNum)}</td></tr>
                        <tr><td style="padding:4px 16px 4px 0;font-weight:600;">Type</td><td>${invoice_type.replace(/_/g, ' ')}</td></tr>
                        ${due_date ? `<tr><td style="padding:4px 16px 4px 0;font-weight:600;">Due Date</td><td>${due_date}</td></tr>` : ''}
                    </table>
                    ${description ? `<p>${description}</p>` : ''}
                    <p>Please log in to your <strong>Company Portal → Payments</strong> to view and pay.</p>
                    <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                `,
            });
        }

        res.status(201).json({
            message: 'Invoice created.',
            invoice_id: result.insertId,
            invoice_number,
        });
    } catch (err) {
        console.error('[invoice.create]', err);
        res.status(500).json({ message: 'Failed to create invoice.' });
    }
};

// ── GET /api/hr/invoices ─────────────────────────────────────────────────────
exports.listExecInvoices = async (req, res) => {
    const { status, company_id } = req.query;
    const isAdmin = req.user.role === 'admin';
    const conditions = ['inv.deleted_at IS NULL'];
    const params = [];

    if (!isAdmin) {
        const companyIds = await getExecutiveCompanyIds(req.user.id);
        if (!companyIds.length) return res.json({ success: true, data: [] });
        conditions.push(`inv.company_id IN (${companyIds.map(() => '?').join(',')})`);
        params.push(...companyIds);
    }
    if (status) { conditions.push('inv.status = ?'); params.push(status); }
    if (company_id) { conditions.push('inv.company_id = ?'); params.push(company_id); }

    try {
        const [rows] = await db.query(
            `SELECT inv.id, inv.invoice_number, inv.invoice_type, inv.amount, inv.amount_paid,
                    inv.status, inv.due_date, inv.paid_at, inv.created_at,
                    co.company_name,
                    cand_u.name AS candidate_name,
                    jp.title AS job_title,
                    exec_u.name AS raised_by_name
             FROM invoices inv
             JOIN companies co ON co.id = inv.company_id
             LEFT JOIN candidates cand ON cand.id = inv.candidate_id
             LEFT JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN job_postings jp ON jp.id = inv.job_posting_id
             LEFT JOIN users exec_u ON exec_u.id = inv.raised_by
             WHERE ${conditions.join(' AND ')}
             ORDER BY inv.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[invoice.listExec]', err);
        res.status(500).json({ message: 'Failed to fetch invoices.' });
    }
};

// ── GET /api/hr/invoices/:id ─────────────────────────────────────────────────
exports.getInvoiceDetail = async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    try {
        let query;
        let params;
        if (isAdmin) {
            query = `SELECT inv.*, co.company_name, exec_u.name AS raised_by_name,
                     cand_u.name AS candidate_name, jp.title AS job_title
                     FROM invoices inv
                     JOIN companies co ON co.id = inv.company_id
                     LEFT JOIN candidates cand ON cand.id = inv.candidate_id
                     LEFT JOIN users cand_u ON cand_u.id = cand.user_id
                     LEFT JOIN job_postings jp ON jp.id = inv.job_posting_id
                     LEFT JOIN users exec_u ON exec_u.id = inv.raised_by
                     WHERE inv.id = ? AND inv.deleted_at IS NULL`;
            params = [req.params.id];
        } else {
            const companyIds = await getExecutiveCompanyIds(req.user.id);
            query = `SELECT inv.*, co.company_name, exec_u.name AS raised_by_name,
                     cand_u.name AS candidate_name, jp.title AS job_title
                     FROM invoices inv
                     JOIN companies co ON co.id = inv.company_id
                     LEFT JOIN candidates cand ON cand.id = inv.candidate_id
                     LEFT JOIN users cand_u ON cand_u.id = cand.user_id
                     LEFT JOIN job_postings jp ON jp.id = inv.job_posting_id
                     LEFT JOIN users exec_u ON exec_u.id = inv.raised_by
                     WHERE inv.id = ? AND inv.company_id IN (${companyIds.map(() => '?').join(',') || 'NULL'}) AND inv.deleted_at IS NULL`;
            params = [req.params.id, ...companyIds];
        }
        const [[invoice]] = await db.query(query, params);
        if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });

        const [transactions] = await db.query(
            `SELECT id, amount, payment_method, transaction_id, cashfree_order_id,
                    cashfree_payment_id, status, payment_note, initiated_at, completed_at
             FROM payment_transactions WHERE invoice_id = ? ORDER BY initiated_at DESC`,
            [req.params.id]
        );

        res.json({ success: true, data: { ...invoice, transactions } });
    } catch (err) {
        console.error('[invoice.detail]', err);
        res.status(500).json({ message: 'Failed to fetch invoice.' });
    }
};

// ── PUT /api/hr/invoices/:id ─────────────────────────────────────────────────
exports.updateInvoice = async (req, res) => {
    const { amount, description, due_date, notes } = req.body;
    const isAdmin = req.user.role === 'admin';
    try {
        const [[inv]] = await db.query(
            `SELECT id, company_id, status FROM invoices WHERE id = ? AND deleted_at IS NULL`, [req.params.id]
        );
        if (!inv) return res.status(404).json({ message: 'Invoice not found.' });
        if (inv.status !== 'pending') return res.status(400).json({ message: 'Only pending invoices can be edited.' });

        if (!isAdmin) {
            const companyIds = await getExecutiveCompanyIds(req.user.id);
            if (!companyIds.includes(inv.company_id)) {
                return res.status(403).json({ message: 'Access denied.' });
            }
        }

        const updates = [];
        const params = [];
        if (amount !== undefined) { updates.push('amount = ?'); params.push(parseFloat(amount)); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (due_date !== undefined) { updates.push('due_date = ?'); params.push(due_date); }
        if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

        if (!updates.length) return res.status(400).json({ message: 'No fields to update.' });
        params.push(req.params.id);

        await db.query(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ message: 'Invoice updated.' });
    } catch (err) {
        console.error('[invoice.update]', err);
        res.status(500).json({ message: 'Failed to update invoice.' });
    }
};

// ── DELETE /api/hr/invoices/:id ─────────────────────────────────────────────
exports.deleteInvoice = async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    try {
        const [[inv]] = await db.query(
            `SELECT id, company_id, status FROM invoices WHERE id = ? AND deleted_at IS NULL`, [req.params.id]
        );
        if (!inv) return res.status(404).json({ message: 'Invoice not found.' });
        if (inv.status !== 'pending') return res.status(400).json({ message: 'Only pending invoices can be deleted.' });

        if (!isAdmin) {
            const companyIds = await getExecutiveCompanyIds(req.user.id);
            if (!companyIds.includes(inv.company_id)) return res.status(403).json({ message: 'Access denied.' });
        }

        await db.query(`UPDATE invoices SET deleted_at = NOW() WHERE id = ?`, [req.params.id]);
        res.json({ message: 'Invoice deleted.' });
    } catch (err) {
        console.error('[invoice.delete]', err);
        res.status(500).json({ message: 'Failed to delete invoice.' });
    }
};

// ── PUT /api/hr/invoices/:id/mark-paid ────────────────────────────────────────
exports.markPaid = async (req, res) => {
    const { payment_method = 'bank_transfer', payment_note } = req.body;
    const isAdmin = req.user.role === 'admin';
    try {
        const [[inv]] = await db.query(
            `SELECT id, company_id, application_id, invoice_type, amount, amount_paid
             FROM invoices WHERE id = ? AND deleted_at IS NULL`, [req.params.id]
        );
        if (!inv) return res.status(404).json({ message: 'Invoice not found.' });

        if (!isAdmin) {
            const companyIds = await getExecutiveCompanyIds(req.user.id);
            if (!companyIds.includes(inv.company_id)) return res.status(403).json({ message: 'Access denied.' });
        }

        const remaining = parseFloat(inv.amount) - parseFloat(inv.amount_paid);
        if (remaining <= 0) return res.status(409).json({ message: 'Invoice is already fully paid.' });

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `INSERT INTO payment_transactions
                    (invoice_id, company_id, amount, payment_method, status, payment_note, completed_at)
                 VALUES (?, ?, ?, ?, 'success', ?, NOW())`,
                [req.params.id, inv.company_id, remaining, payment_method, payment_note || null]
            );
            await conn.query(
                `UPDATE invoices SET amount_paid = amount, status = 'paid', paid_at = NOW() WHERE id = ?`,
                [req.params.id]
            );
            // Mirror onto placement_fee_invoices when this is a placement-fee invoice
            if (inv.invoice_type === 'placement_fee') {
                await syncPlacementFeeStatus(inv.application_id, conn);
            }
            await conn.commit();
        } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

        res.json({ message: 'Invoice marked as paid.' });
    } catch (err) {
        console.error('[invoice.markPaid]', err);
        res.status(500).json({ message: 'Failed to mark invoice as paid.' });
    }
};

// ── PUT /api/hr/invoices/:id/mark-partial ────────────────────────────────────
exports.markPartial = async (req, res) => {
    const { amount, payment_method = 'bank_transfer', payment_note } = req.body;
    const partialAmt = parseFloat(amount);
    if (isNaN(partialAmt) || partialAmt <= 0) {
        return res.status(400).json({ message: 'amount must be a positive number.' });
    }
    const isAdmin = req.user.role === 'admin';
    try {
        const [[inv]] = await db.query(
            `SELECT id, company_id, application_id, invoice_type, amount, amount_paid
             FROM invoices WHERE id = ? AND deleted_at IS NULL`, [req.params.id]
        );
        if (!inv) return res.status(404).json({ message: 'Invoice not found.' });

        if (!isAdmin) {
            const companyIds = await getExecutiveCompanyIds(req.user.id);
            if (!companyIds.includes(inv.company_id)) return res.status(403).json({ message: 'Access denied.' });
        }

        const remaining = parseFloat(inv.amount) - parseFloat(inv.amount_paid);
        if (remaining <= 0) return res.status(409).json({ message: 'Invoice is already fully paid.' });
        if (partialAmt > remaining) {
            return res.status(400).json({ message: `Amount exceeds outstanding balance of ${fmtINR(remaining)}.` });
        }

        const newPaid = parseFloat(inv.amount_paid) + partialAmt;
        const newStatus = newPaid >= parseFloat(inv.amount) ? 'paid' : 'partially_paid';

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `INSERT INTO payment_transactions
                    (invoice_id, company_id, amount, payment_method, status, payment_note, completed_at)
                 VALUES (?, ?, ?, ?, 'success', ?, NOW())`,
                [req.params.id, inv.company_id, partialAmt, payment_method, payment_note || null]
            );
            await conn.query(
                `UPDATE invoices SET amount_paid = ?, status = ?${newStatus === 'paid' ? ', paid_at = NOW()' : ''} WHERE id = ?`,
                [newPaid, newStatus, req.params.id]
            );
            // Mirror onto placement_fee_invoices when this is a placement-fee invoice
            if (inv.invoice_type === 'placement_fee') {
                await syncPlacementFeeStatus(inv.application_id, conn);
            }
            await conn.commit();
        } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

        res.json({ message: `Payment recorded. New status: ${newStatus}.`, new_amount_paid: newPaid, status: newStatus });
    } catch (err) {
        console.error('[invoice.markPartial]', err);
        res.status(500).json({ message: 'Failed to record partial payment.' });
    }
};

// ── GET /api/invoices/company/placement-fees/summary ─────────────────────────
// Outstanding placement fees broken down per selected candidate — the company
// sees the due grow with each candidate they hire (monthly CTC × multiplier),
// and how far each invoice has been paid (partial OR full via Cashfree).
exports.companyPlacementFeeSummary = async (req, res) => {
    try {
        const [[comp]] = await db.query(
            `SELECT id, company_name FROM companies WHERE user_id = ? AND deleted_at IS NULL`,
            [req.user.id]
        );
        if (!comp) return res.status(404).json({ message: 'Company not found.' });

        // One row per placement-fee invoice — the candidate it was raised for,
        // the offered CTC the fee is based on, and the current payment progress.
        const [rows] = await db.query(
            `SELECT inv.id AS invoice_id, inv.invoice_number,
                    inv.amount, inv.amount_paid, inv.status, inv.due_date, inv.paid_at, inv.created_at,
                    pfi.offered_ctc,
                    cand_u.name AS candidate_name,
                    jp.title AS job_title
             FROM invoices inv
             LEFT JOIN candidates cand ON cand.id = inv.candidate_id
             LEFT JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN job_postings jp ON jp.id = inv.job_posting_id
             LEFT JOIN placement_fee_invoices pfi
                    ON pfi.application_id = inv.application_id AND pfi.deleted_at IS NULL
             WHERE inv.company_id = ?
               AND inv.invoice_type = 'placement_fee'
               AND inv.deleted_at IS NULL
             ORDER BY inv.created_at DESC`,
            [comp.id]
        );

        const summary = rows.reduce((s, r) => {
            const amt = parseFloat(r.amount);
            const paid = parseFloat(r.amount_paid);
            s.candidates_selected += 1;
            s.total_due += amt;
            s.total_paid += paid;
            s.outstanding += Math.max(amt - paid, 0);
            if (r.status === 'paid') s.paid_count += 1;
            else if (r.status === 'partially_paid') s.partially_paid_count += 1;
            else s.pending_count += 1;
            return s;
        }, {
            candidates_selected: 0, total_due: 0, total_paid: 0, outstanding: 0,
            paid_count: 0, partially_paid_count: 0, pending_count: 0,
        });

        res.json({ success: true, data: { summary, invoices: rows } });
    } catch (err) {
        console.error('[invoice.companyPlacementFeeSummary]', err);
        res.status(500).json({ message: 'Failed to fetch placement-fee summary.' });
    }
};

// ── GET /api/company/invoices ────────────────────────────────────────────────
exports.companyListInvoices = async (req, res) => {
    try {
        const [[comp]] = await db.query(
            `SELECT id FROM companies WHERE user_id = ? AND deleted_at IS NULL`, [req.user.id]
        );
        if (!comp) return res.status(404).json({ message: 'Company not found.' });

        const [rows] = await db.query(
            `SELECT inv.id, inv.invoice_number, inv.invoice_type, inv.amount, inv.amount_paid,
                    inv.status, inv.due_date, inv.paid_at, inv.description, inv.created_at,
                    cand_u.name AS candidate_name, jp.title AS job_title,
                    exec_u.name AS raised_by_name
             FROM invoices inv
             LEFT JOIN candidates cand ON cand.id = inv.candidate_id
             LEFT JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN job_postings jp ON jp.id = inv.job_posting_id
             LEFT JOIN users exec_u ON exec_u.id = inv.raised_by
             WHERE inv.company_id = ? AND inv.invoice_type != 'placement_fee' AND inv.deleted_at IS NULL
             ORDER BY inv.created_at DESC`,
            [comp.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[invoice.companyList]', err);
        res.status(500).json({ message: 'Failed to fetch invoices.' });
    }
};

// ── GET /api/company/invoices/:id ────────────────────────────────────────────
exports.companyGetInvoice = async (req, res) => {
    try {
        const [[comp]] = await db.query(
            `SELECT id FROM companies WHERE user_id = ? AND deleted_at IS NULL`, [req.user.id]
        );
        if (!comp) return res.status(404).json({ message: 'Company not found.' });

        const [[invoice]] = await db.query(
            `SELECT inv.*, exec_u.name AS raised_by_name,
                    cand_u.name AS candidate_name, jp.title AS job_title
             FROM invoices inv
             LEFT JOIN candidates cand ON cand.id = inv.candidate_id
             LEFT JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN job_postings jp ON jp.id = inv.job_posting_id
             LEFT JOIN users exec_u ON exec_u.id = inv.raised_by
             WHERE inv.id = ? AND inv.company_id = ? AND inv.deleted_at IS NULL`,
            [req.params.id, comp.id]
        );
        if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });

        const [transactions] = await db.query(
            `SELECT id, amount, payment_method, cashfree_order_id, cashfree_payment_id,
                    status, payment_note, initiated_at, completed_at
             FROM payment_transactions WHERE invoice_id = ? ORDER BY initiated_at DESC`,
            [req.params.id]
        );

        res.json({ success: true, data: { ...invoice, transactions } });
    } catch (err) {
        console.error('[invoice.companyGet]', err);
        res.status(500).json({ message: 'Failed to fetch invoice.' });
    }
};

// ── GET /api/admin/invoices ──────────────────────────────────────────────────
exports.adminListInvoices = async (req, res) => {
    const { status, company_id, date_from, date_to } = req.query;
    const conditions = ['inv.deleted_at IS NULL'];
    const params = [];

    if (status) { conditions.push('inv.status = ?'); params.push(status); }
    if (company_id) { conditions.push('inv.company_id = ?'); params.push(company_id); }
    if (date_from) { conditions.push('DATE(inv.created_at) >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('DATE(inv.created_at) <= ?'); params.push(date_to); }

    try {
        const [rows] = await db.query(
            `SELECT inv.id, inv.invoice_number, inv.invoice_type, inv.amount, inv.amount_paid,
                    inv.status, inv.due_date, inv.paid_at, inv.created_at,
                    co.company_name, exec_u.name AS raised_by_name,
                    cand_u.name AS candidate_name, jp.title AS job_title
             FROM invoices inv
             JOIN companies co ON co.id = inv.company_id
             LEFT JOIN candidates cand ON cand.id = inv.candidate_id
             LEFT JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN job_postings jp ON jp.id = inv.job_posting_id
             LEFT JOIN users exec_u ON exec_u.id = inv.raised_by
             WHERE ${conditions.join(' AND ')}
             ORDER BY inv.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[invoice.adminList]', err);
        res.status(500).json({ message: 'Failed to fetch invoices.' });
    }
};

// ── GET /api/admin/invoices/summary ─────────────────────────────────────────
exports.adminInvoiceSummary = async (req, res) => {
    try {
        const [[stats]] = await db.query(
            `SELECT
               SUM(amount) AS total_invoiced,
               SUM(amount_paid) AS total_collected,
               SUM(amount - amount_paid) AS total_outstanding,
               SUM(status = 'pending') AS pending_count,
               SUM(status = 'partially_paid') AS partial_count,
               SUM(status = 'paid') AS paid_count,
               SUM(status = 'overdue') AS overdue_count
             FROM invoices WHERE deleted_at IS NULL`
        );
        res.json({ success: true, data: stats });
    } catch (err) {
        console.error('[invoice.adminSummary]', err);
        res.status(500).json({ message: 'Failed to fetch summary.' });
    }
};

// ── GET /api/invoices/exec/:id/pdf  (hr_staff, admin) ───────────────────────
exports.downloadExecInvoicePDF = async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        let params, query;

        if (isAdmin) {
            query = `SELECT inv.*, co.company_name, co.user_id AS company_user_id,
                            u_exec.email AS company_email,
                            cand_u.name AS candidate_name, jp.title AS job_title
                     FROM invoices inv
                     JOIN companies co ON co.id = inv.company_id
                     JOIN users u_exec ON u_exec.id = co.user_id
                     LEFT JOIN candidates cand ON cand.id = inv.candidate_id
                     LEFT JOIN users cand_u ON cand_u.id = cand.user_id
                     LEFT JOIN job_postings jp ON jp.id = inv.job_posting_id
                     WHERE inv.id = ? AND inv.deleted_at IS NULL`;
            params = [req.params.id];
        } else {
            const companyIds = await getExecutiveCompanyIds(req.user.id);
            if (!companyIds.length) return res.status(404).json({ message: 'Invoice not found.' });
            query = `SELECT inv.*, co.company_name,
                            u_exec.email AS company_email,
                            cand_u.name AS candidate_name, jp.title AS job_title
                     FROM invoices inv
                     JOIN companies co ON co.id = inv.company_id
                     JOIN users u_exec ON u_exec.id = co.user_id
                     LEFT JOIN candidates cand ON cand.id = inv.candidate_id
                     LEFT JOIN users cand_u ON cand_u.id = cand.user_id
                     LEFT JOIN job_postings jp ON jp.id = inv.job_posting_id
                     WHERE inv.id = ? AND inv.company_id IN (${companyIds.map(() => '?').join(',')}) AND inv.deleted_at IS NULL`;
            params = [req.params.id, ...companyIds];
        }

        const [[invoice]] = await db.query(query, params);
        if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });

        const [transactions] = await db.query(
            `SELECT amount, payment_method, transaction_id, cashfree_order_id, cashfree_payment_id,
                    status, payment_note, initiated_at, completed_at
             FROM payment_transactions WHERE invoice_id = ? ORDER BY initiated_at DESC`,
            [req.params.id]
        );

        const pdf = await generateInvoicePDF({ ...invoice, transactions });
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`,
            'Content-Length': pdf.length,
        });
        res.end(pdf);
    } catch (err) {
        console.error('[invoice.execPDF]', err.message);
        res.status(500).json({ message: 'Failed to generate invoice PDF.' });
    }
};

// ── GET /api/invoices/company/:id/pdf  (company) ────────────────────────────
exports.downloadCompanyInvoicePDF = async (req, res) => {
    try {
        const [[comp]] = await db.query(
            `SELECT id, company_name FROM companies WHERE user_id = ? AND deleted_at IS NULL`,
            [req.user.id]
        );
        if (!comp) return res.status(404).json({ message: 'Company not found.' });

        const [[invoice]] = await db.query(
            `SELECT inv.*, ? AS company_name, u.email AS company_email,
                    cand_u.name AS candidate_name, jp.title AS job_title
             FROM invoices inv
             JOIN companies co ON co.id = inv.company_id
             JOIN users u ON u.id = co.user_id
             LEFT JOIN candidates cand ON cand.id = inv.candidate_id
             LEFT JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN job_postings jp ON jp.id = inv.job_posting_id
             WHERE inv.id = ? AND inv.company_id = ? AND inv.deleted_at IS NULL`,
            [comp.company_name, req.params.id, comp.id]
        );
        if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });

        const [transactions] = await db.query(
            `SELECT amount, payment_method, transaction_id, cashfree_order_id, cashfree_payment_id,
                    status, payment_note, initiated_at, completed_at
             FROM payment_transactions WHERE invoice_id = ? ORDER BY initiated_at DESC`,
            [req.params.id]
        );

        const pdf = await generateInvoicePDF({ ...invoice, transactions });
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`,
            'Content-Length': pdf.length,
        });
        res.end(pdf);
    } catch (err) {
        console.error('[invoice.companyPDF]', err.message);
        res.status(500).json({ message: 'Failed to generate invoice PDF.' });
    }
};

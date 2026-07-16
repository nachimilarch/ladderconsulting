const db = require('../config/db');
const { logAction } = require('../utils/auditLog');
const { sendEmail } = require('../utils/email');
const { nextInvoiceNumber } = require('../utils/placementFee');
const wa = require('../utils/whatsappNotify');

const safeEmail = (opts) => sendEmail(opts).catch(e => console.error('[Email]', e.message));
const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || null;

const getCompanyRow = async (userId) => {
    const [[row]] = await db.query(
        `SELECT c.id, c.company_name, c.assigned_executive_id, c.placement_fee_percent,
                u.email AS executive_email, u.name AS executive_name
         FROM companies c
         LEFT JOIN users u ON u.id = c.assigned_executive_id
         WHERE c.user_id = ? AND c.deleted_at IS NULL`,
        [userId]
    );
    return row || null;
};

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    db.query(
        `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)`,
        [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
    ).catch(e => console.error('[notify]', e.message));
};

// ── POST /api/offer-requests ─────────────────────────────────────────────────
// Company submits an offer letter release request
exports.submitOfferRequest = async (req, res) => {
    const { application_id, offered_ctc, request_note } = req.body;
    if (!application_id || !offered_ctc) {
        return res.status(400).json({ message: 'application_id and offered_ctc are required.' });
    }
    const ctc = parseFloat(offered_ctc);
    if (isNaN(ctc) || ctc <= 0) {
        return res.status(400).json({ message: 'offered_ctc must be a positive number.' });
    }

    try {
        const company = await getCompanyRow(req.user.id);
        if (!company) return res.status(403).json({ message: 'Company profile not found.' });

        // Verify application belongs to this company and outcome = selected
        const [[app]] = await db.query(
            `SELECT a.id AS app_id, a.candidate_id, a.job_id,
                    io.result AS outcome,
                    u.name AS candidate_name, u.id AS candidate_user_id
             FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             LEFT JOIN interview_slots is2 ON is2.application_id = a.id AND is2.deleted_at IS NULL
             LEFT JOIN interview_outcomes io ON io.interview_id = is2.id AND io.deleted_at IS NULL
             WHERE a.id = ? AND jp.company_id = ? AND a.deleted_at IS NULL`,
            [application_id, company.id]
        );
        if (!app) return res.status(404).json({ message: 'Application not found.' });
        if (app.outcome !== 'selected') {
            return res.status(400).json({ message: 'Offer letter release can only be requested after the candidate is marked as selected.' });
        }

        // Block if offer_letter_grants already exists (already approved)
        const [[existingGrant]] = await db.query(
            `SELECT id FROM offer_letter_grants WHERE application_id = ? AND deleted_at IS NULL`,
            [application_id]
        );
        if (existingGrant) {
            return res.status(409).json({ message: 'Offer letter has already been approved for this candidate.' });
        }

        // Block duplicate active (non-rejected) requests
        const [[existing]] = await db.query(
            `SELECT id FROM company_requests
             WHERE company_id = ? AND application_id = ? AND request_type = 'offer_letter_release'
               AND status NOT IN ('rejected', 'cancelled') AND deleted_at IS NULL
             LIMIT 1`,
            [company.id, application_id]
        );
        if (existing) {
            return res.status(409).json({ message: 'An active offer letter request already exists for this candidate.' });
        }

        // `ctc` is the ANNUAL CTC the company is offering the candidate.
        // Platinum companies (admin-set contracted rate, from their onboarding
        // agreement) override the platform-wide default multiplier. The contracted
        // rate is a % of this annual figure directly — the industry-standard
        // framing (8.33% = 1/12 = exactly one month's salary, 6.5% ≈ 0.78 months).
        // The default (no contracted rate) multiplier is expressed in months of
        // CTC, so it's applied against the monthly equivalent (annual / 12).
        let placementFee;
        if (company.placement_fee_percent != null) {
            placementFee = ctc * (parseFloat(company.placement_fee_percent) / 100);
        } else {
            const [[multiplierRow]] = await db.query(
                `SELECT value FROM platform_settings WHERE setting_key = 'placement_fee_multiplier'`
            );
            const multiplier = parseFloat(multiplierRow?.value || '1');
            placementFee = (ctc / 12) * multiplier;
        }

        // If the company is on Package A (Single ₹999) or Package B (4-Pack ₹3,999),
        // placement fees are fully waived for ALL candidates — the package price IS
        // Ladder's fee. Platinum (%) companies pay a % placement fee + 18% GST per hire.
        // Companies with no package at all (direct applicants only, pre-package era)
        // continue paying the default fee.
        let isPrepaid = false;
        if (company.placement_fee_percent == null) {
            const [[pkgRow]] = await db.query(
                `SELECT ruo.id FROM resume_unlock_orders ruo
                 JOIN invoices i ON i.id = ruo.invoice_id AND i.status = 'paid'
                 WHERE ruo.company_id = ? LIMIT 1`,
                [company.id]
            );
            isPrepaid = !!pkgRow;
        }

        if (!company.assigned_executive_id) {
            return res.status(400).json({ message: 'No LadderStep Human Consulting executive is assigned to your account yet. Please contact support.' });
        }

        // Get admin user_id for notifications
        const [[adminRow]] = await db.query(
            `SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id
             WHERE ro.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1`
        );

        const conn = await db.getConnection();
        let requestId, invoiceId;
        try {
            await conn.beginTransaction();

            // Create placement_fee_invoices record
            const [invResult] = await conn.query(
                `INSERT INTO placement_fee_invoices
                    (company_id, candidate_id, job_posting_id, application_id,
                     fee_type, offered_ctc, placement_fee_amount, status, raised_by, notes)
                 VALUES (?, ?, ?, ?, 'placement', ?, ?, ?, ?, ?)`,
                [company.id, app.candidate_id, app.job_id, application_id,
                 ctc, placementFee, isPrepaid ? 'waived' : 'pending', company.assigned_executive_id, request_note || null]
            );
            invoiceId = invResult.insertId;

            // Create company_requests record
            const [reqResult] = await conn.query(
                `INSERT INTO company_requests
                    (company_id, application_id, candidate_id, request_type,
                     status, assigned_executive_id, requested_by, company_notes, invoice_id)
                 VALUES (?, ?, ?, 'offer_letter_release', 'pending', ?, ?, ?, ?)`,
                [company.id, application_id, app.candidate_id,
                 company.assigned_executive_id, req.user.id, request_note || null, invoiceId]
            );
            requestId = reqResult.insertId;

            // Back-fill invoice with request_id link isn't needed since placement_fee_invoices
            // doesn't have a request_id column — company_requests.invoice_id is the link

            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        // Notify executive — prepaid (single/pack) requests omit fee/payment language
        // entirely; the company's existing resume-unlock invoice already covers this.
        const fmtFee = `₹${placementFee.toLocaleString('en-IN')}`;
        notify(
            company.assigned_executive_id,
            'offer_request',
            `Offer Letter Request — ${company.company_name}`,
            isPrepaid
                ? `${company.company_name} has requested offer letter release for ${app.candidate_name}. Please review.`
                : `${company.company_name} has requested offer letter release for ${app.candidate_name}. Placement fee: ${fmtFee}. Please review.`,
            { request_id: requestId, company_id: company.id, application_id }
        );

        if (company.executive_email) {
            safeEmail({
                to: company.executive_email,
                subject: `New Offer Letter Request — ${company.company_name}`,
                html: `
                    <p>Hi ${company.executive_name},</p>
                    <p><strong>${company.company_name}</strong> has requested offer letter release for candidate <strong>${app.candidate_name}</strong>.</p>
                    <p><strong>Offered Annual CTC:</strong> ₹${ctc.toLocaleString('en-IN')}</p>
                    ${isPrepaid ? '' : `<p><strong>Placement Fee:</strong> ${fmtFee}${company.placement_fee_percent != null ? ` (${parseFloat(company.placement_fee_percent)}% of annual CTC, contracted rate)` : ' (1× monthly CTC)'}</p>`}
                    ${request_note ? `<p><strong>Company Note:</strong> ${request_note}</p>` : ''}
                    <p>Please log in to your <strong>Executive Dashboard → Offer Requests</strong> to review and approve.</p>
                    <br/><p>LadderStep Human Consulting System</p>
                `,
            });
        }

        const gstOnFee   = Math.round(placementFee * 0.18 * 100) / 100;
        const totalOnFee = Math.round((placementFee + gstOnFee) * 100) / 100;
        res.status(201).json({
            message: isPrepaid
                ? 'Request submitted. Your executive will review and the offer letter will be enabled on approval.'
                : 'Request submitted. The offer letter will be enabled once our team confirms the payment.',
            request_id: requestId,
            placement_fee: placementFee,
            gst_amount:    isPrepaid ? 0 : gstOnFee,
            total_amount:  isPrepaid ? 0 : totalOnFee,
        });
    } catch (err) {
        console.error('[offerRequest.submit]', err);
        res.status(500).json({ message: 'Failed to submit offer request.' });
    }
};

// ── GET /api/offer-requests/:applicationId/status ────────────────────────────
// Company checks status for a specific application
exports.getRequestStatus = async (req, res) => {
    const { applicationId } = req.params;
    try {
        const [[company]] = await db.query(
            `SELECT c.id FROM companies c WHERE c.user_id = ? AND c.deleted_at IS NULL`, [req.user.id]
        );
        if (!company) return res.status(404).json({ message: 'Company not found.' });

        // Verify ownership
        const [[appCheck]] = await db.query(
            `SELECT a.id FROM applications a JOIN job_postings jp ON jp.id = a.job_id
             WHERE a.id = ? AND jp.company_id = ? AND a.deleted_at IS NULL`,
            [applicationId, company.id]
        );
        if (!appCheck) return res.status(404).json({ message: 'Application not found.' });

        // Check for approved grant
        const [[grant]] = await db.query(
            `SELECT olg.id, olg.granted_at, pfi.offered_ctc, pfi.placement_fee_amount, pfi.status AS pfi_status
             FROM offer_letter_grants olg
             LEFT JOIN company_requests cr ON cr.id = olg.request_id
             LEFT JOIN placement_fee_invoices pfi ON pfi.id = cr.invoice_id AND pfi.deleted_at IS NULL
             WHERE olg.application_id = ? AND olg.deleted_at IS NULL`,
            [applicationId]
        );
        if (grant) {
            return res.json({
                status: 'approved',
                grant_id: grant.id,
                granted_at: grant.granted_at,
                offered_ctc: grant.offered_ctc,
                // Prepaid (Single/4-Pack) candidates: no fee was ever charged here —
                // omit it entirely rather than show "0" or "waived".
                ...(grant.pfi_status !== 'waived' ? { placement_fee: grant.placement_fee_amount } : {}),
            });
        }

        // Check for active request
        const [[request]] = await db.query(
            `SELECT cr.id, cr.status, cr.rejection_reason, cr.created_at,
                    pfi.offered_ctc, pfi.placement_fee_amount, pfi.status AS pfi_status
             FROM company_requests cr
             LEFT JOIN placement_fee_invoices pfi ON pfi.id = cr.invoice_id AND pfi.deleted_at IS NULL
             WHERE cr.company_id = ? AND cr.application_id = ? AND cr.request_type = 'offer_letter_release'
               AND cr.deleted_at IS NULL
             ORDER BY cr.created_at DESC LIMIT 1`,
            [company.id, applicationId]
        );

        if (!request) return res.json({ status: 'none' });

        res.json({
            status: request.status,
            request_id: request.id,
            rejection_reason: request.rejection_reason || null,
            created_at: request.created_at,
            offered_ctc: request.offered_ctc,
            ...(request.pfi_status !== 'waived' ? { placement_fee: request.placement_fee_amount } : {}),
        });
    } catch (err) {
        console.error('[offerRequest.status]', err);
        res.status(500).json({ message: 'Failed to fetch request status.' });
    }
};

// ── GET /api/offer-requests/executive ────────────────────────────────────────
// Executive lists all offer requests assigned to them
exports.listExecRequests = async (req, res) => {
    const { status } = req.query;
    const isAdmin = req.user.role === 'admin';
    // Scope by the company's CURRENT assigned executive (not the snapshot copied
    // onto the request at submit time) so reassignment is honoured. Admin sees all.
    const conditions = ["cr.request_type = 'offer_letter_release'", 'cr.deleted_at IS NULL'];
    const params = [];
    if (!isAdmin) { conditions.push('co.assigned_executive_id = ?'); params.push(req.user.id); }

    if (status) { conditions.push('cr.status = ?'); params.push(status); }

    try {
        const [rows] = await db.query(
            `SELECT cr.id, cr.status, cr.company_notes AS request_note, cr.rejection_reason,
                    cr.created_at, cr.resolved_at,
                    co.company_name,
                    co_u.name AS company_contact,
                    cand_u.name AS candidate_name,
                    jp.title AS job_title,
                    pfi.offered_ctc, pfi.placement_fee_amount, pfi.status AS invoice_status,
                    olg.id AS grant_id,
                    payable.id AS payable_id,
                    payable.invoice_number AS payable_invoice_number,
                    payable.amount AS payable_amount,
                    payable.amount_paid AS payable_amount_paid,
                    payable.status AS payable_status,
                    payable.due_date AS payable_due_date
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN users co_u ON co_u.id = co.user_id
             JOIN applications a ON a.id = cr.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates cand ON cand.id = a.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN placement_fee_invoices pfi ON pfi.id = cr.invoice_id AND pfi.deleted_at IS NULL
             LEFT JOIN offer_letter_grants olg ON olg.request_id = cr.id AND olg.deleted_at IS NULL
             LEFT JOIN invoices payable ON payable.application_id = cr.application_id
                                       AND payable.invoice_type = 'placement_fee'
                                       AND payable.deleted_at IS NULL
             WHERE ${conditions.join(' AND ')}
             ORDER BY cr.created_at DESC`,
            params
        );
        const data = rows.map(r => ({
            ...r,
            payable: r.payable_id ? {
                invoice_id: r.payable_id,
                invoice_number: r.payable_invoice_number,
                amount: r.payable_amount,
                amount_paid: r.payable_amount_paid,
                status: r.payable_status,
                due_date: r.payable_due_date,
            } : null,
        }));
        res.json({ success: true, data });
    } catch (err) {
        console.error('[offerRequest.listExec]', err);
        res.status(500).json({ message: 'Failed to fetch offer requests.' });
    }
};

// ── GET /api/offer-requests/executive/:id ────────────────────────────────────
// Executive views full detail of one request
exports.getRequestDetail = async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    try {
        const [[row]] = await db.query(
            `SELECT cr.id, cr.status, cr.company_notes AS request_note, cr.rejection_reason,
                    cr.created_at, cr.resolved_at,
                    co.id AS company_id, co.company_name, co.industry,
                    co_u.name AS company_contact, co_u.email AS company_email,
                    cand_u.name AS candidate_name,
                    jp.title AS job_title, jp.id AS job_id,
                    a.id AS application_id,
                    pfi.id AS pfi_id, pfi.offered_ctc, pfi.placement_fee_amount,
                    pfi.status AS pfi_status, pfi.paid_at AS pfi_paid_at,
                    olg.id AS grant_id, olg.granted_at,
                    payable.id AS payable_invoice_id,
                    payable.invoice_number AS payable_invoice_number,
                    payable.amount AS payable_amount,
                    payable.amount_paid AS payable_amount_paid,
                    payable.status AS payable_status,
                    payable.due_date AS payable_due_date
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN users co_u ON co_u.id = co.user_id
             JOIN applications a ON a.id = cr.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates cand ON cand.id = a.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN placement_fee_invoices pfi ON pfi.id = cr.invoice_id AND pfi.deleted_at IS NULL
             LEFT JOIN offer_letter_grants olg ON olg.request_id = cr.id AND olg.deleted_at IS NULL
             LEFT JOIN invoices payable ON payable.application_id = cr.application_id
                                       AND payable.invoice_type = 'placement_fee'
                                       AND payable.deleted_at IS NULL
             WHERE cr.id = ? AND cr.deleted_at IS NULL
               AND (? OR co.assigned_executive_id = ?)`,
            [req.params.id, isAdmin, req.user.id]
        );
        if (!row) return res.status(404).json({ message: 'Request not found.' });

        // Load payment transactions if there's a payable invoice
        let transactions = [];
        if (row.payable_invoice_id) {
            const [txns] = await db.query(
                `SELECT amount, payment_method, payment_note, status, completed_at
                 FROM payment_transactions WHERE invoice_id = ? ORDER BY completed_at DESC`,
                [row.payable_invoice_id]
            );
            transactions = txns;
        }

        res.json({ success: true, data: { ...row, transactions } });
    } catch (err) {
        console.error('[offerRequest.detail]', err);
        res.status(500).json({ message: 'Failed to fetch request detail.' });
    }
};

// ── PUT /api/offer-requests/executive/:id/approve ────────────────────────────
// Executive marks payment received + approves + creates grant
exports.approveRequest = async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    try {
        const [[cr]] = await db.query(
            `SELECT cr.id, cr.company_id, cr.application_id, cr.candidate_id,
                    cr.invoice_id, cr.status,
                    co.company_name,
                    cand_u.name AS candidate_name, co_u.id AS company_user_id, co_u.email AS company_email,
                    jp.id AS job_id, jp.title AS job_title,
                    pfi.placement_fee_amount, pfi.offered_ctc, pfi.status AS pfi_status
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN users co_u ON co_u.id = co.user_id
             JOIN applications a ON a.id = cr.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates cand ON cand.id = cr.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN placement_fee_invoices pfi ON pfi.id = cr.invoice_id
             WHERE cr.id = ? AND cr.deleted_at IS NULL
               AND (? OR co.assigned_executive_id = ?)`,
            [req.params.id, isAdmin, req.user.id]
        );
        if (!cr) return res.status(404).json({ message: 'Request not found.' });
        if (cr.status === 'resolved') return res.status(409).json({ message: 'Request is already approved.' });
        if (cr.status === 'rejected') return res.status(409).json({ message: 'Cannot approve a rejected request.' });

        // Optional due date for the company-payable invoice (defaults to +14 days)
        const dueDate = req.body?.due_date
            ? new Date(req.body.due_date).toISOString().slice(0, 10)
            : new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

        // Prepaid (single/pack-unlocked) candidates skip charging — invoice is
        // created already 'waived' so reporting stays consistent, but nothing
        // is shown as due to the company.
        const isWaived = cr.pfi_status === 'waived';

        let invoiceNumber, payableInvoiceId;
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // Mark request as resolved
            await conn.query(
                `UPDATE company_requests
                 SET status = 'resolved', resolved_at = NOW(), resolved_by = ?
                 WHERE id = ?`,
                [req.user.id, cr.id]
            );

            // Create offer_letter_grants — unlocks the company's "Generate Offer Letter"
            // button immediately on approval. The placement fee is then collected via
            // the company-payable invoice raised below (partial payments allowed).
            await conn.query(
                `INSERT INTO offer_letter_grants
                    (application_id, company_id, candidate_id, invoice_id, request_id, granted_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [cr.application_id, cr.company_id, cr.candidate_id,
                 cr.invoice_id, cr.id, req.user.id]
            );

            // Raise the company-payable invoice (paid via existing Cashfree flow on
            // /api/invoices/company/:id/pay). Partial payments are supported by the
            // invoices table (amount_paid / status='partially_paid'). Prepaid
            // (single/pack-unlocked) candidates skip this entirely — no invoice is
            // created at all, so nothing fee-related ever appears on the company's
            // own Payments/Requests pages; their resume-unlock invoice from purchase
            // is the only money record that exists for this candidate. The internal
            // placement_fee_invoices row (created at submit time, status='waived')
            // still stands for admin/exec bookkeeping — a separate table the company
            // never sees.
            if (!isWaived) {
                invoiceNumber = await nextInvoiceNumber(conn);
                // Placement fee invoices (Platinum % model) carry 18% GST on top.
                // placement_fee_invoices.placement_fee_amount stores the BASE fee for
                // Ladder's internal bookkeeping; the company-payable invoice amount
                // is the total including GST.
                const baseFee    = Math.round(parseFloat(cr.placement_fee_amount) * 100) / 100;
                const gstAmount  = Math.round(baseFee * 0.18 * 100) / 100;
                const totalAmount = Math.round((baseFee + gstAmount) * 100) / 100;
                const description = `Placement fee for ${cr.candidate_name} (${cr.job_title}) + 18% GST`;
                const [invResult] = await conn.query(
                    `INSERT INTO invoices
                        (invoice_number, company_id, candidate_id, job_posting_id, application_id,
                         raised_by, invoice_type, amount, status, description, due_date)
                     VALUES (?, ?, ?, ?, ?, ?, 'placement_fee', ?, 'pending', ?, ?)`,
                    [invoiceNumber, cr.company_id, cr.candidate_id, cr.job_id, cr.application_id,
                     req.user.id, totalAmount, description, dueDate]
                );
                payableInvoiceId = invResult.insertId;
            }

            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        const baseFee    = parseFloat(cr.placement_fee_amount || 0);
        const gstAmount  = Math.round(baseFee * 0.18 * 100) / 100;
        const totalAmount = Math.round((baseFee + gstAmount) * 100) / 100;
        const fmtBase    = `₹${baseFee.toLocaleString('en-IN')}`;
        const fmtGst     = `₹${gstAmount.toLocaleString('en-IN')}`;
        const fmtTotal   = `₹${totalAmount.toLocaleString('en-IN')}`;

        // Notify company — they need to act (pay), unless prepaid (no fee mention at all)
        notify(
            cr.company_user_id,
            'offer_approved',
            `Offer Letter Approved — ${cr.candidate_name}`,
            isWaived
                ? `Offer letter for ${cr.candidate_name} is unlocked. You can generate it now from Company Portal → Interviews.`
                : `Offer letter for ${cr.candidate_name} is unlocked. Invoice ${invoiceNumber} for ${fmtTotal} (incl. 18% GST) raised — pay via Company Portal → Payments.`,
            { application_id: cr.application_id, company_id: cr.company_id, invoice_id: payableInvoiceId, invoice_number: invoiceNumber }
        );

        // Notify admins for visibility (internal only — never shown to the company)
        const [admins] = await db.query(
            `SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id
             WHERE ro.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL`
        );
        const [[execUser]] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
        for (const admin of admins) {
            notify(
                admin.id,
                'placement_fee_invoiced',
                isWaived ? `Placement Fee Waived (Prepaid) — ${cr.company_name}` : `Placement Fee Invoice Raised — ${cr.company_name}`,
                isWaived
                    ? `${fmtBase} placement fee waived for ${cr.candidate_name} at ${cr.company_name} — candidate was unlocked via a prepaid package. Approved by ${execUser?.name || 'Executive'}.`
                    : `Invoice ${invoiceNumber} raised against ${cr.company_name} for ${cr.candidate_name}. Fee: ${fmtBase} + GST: ${fmtGst} = Total: ${fmtTotal}. Approved by ${execUser?.name || 'Executive'}.`,
                { request_id: cr.id, company_id: cr.company_id, invoice_id: payableInvoiceId, amount: totalAmount, base_fee: baseFee, gst_amount: gstAmount }
            );
        }

        // WhatsApp — offer approved for company
        db.query('SELECT phone FROM users WHERE id = ?', [cr.company_user_id]).then(([[coUser]]) => {
            wa.notifyOfferRequestApproved(coUser?.phone, cr.candidate_name, cr.job_title);
        }).catch(() => {});

        if (cr.company_email) {
            safeEmail({
                to: cr.company_email,
                subject: isWaived ? `Offer Letter Approved — ${cr.candidate_name}` : `Offer Letter Approved · Invoice ${invoiceNumber}`,
                html: `
                    <p>Hi,</p>
                    <p>Your offer-letter release for <strong>${cr.candidate_name}</strong> (${cr.job_title}) has been approved by your LadderStep Human Consulting executive.</p>
                    ${isWaived ? '' : `
                    <table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif;font-size:14px;">
                      <tr><td style="padding:6px 16px 6px 0;color:#374151;font-weight:600;">Invoice</td><td>${invoiceNumber}</td></tr>
                      <tr><td style="padding:6px 16px 6px 0;color:#374151;font-weight:600;">Placement Fee</td><td>${fmtBase}</td></tr>
                      <tr><td style="padding:6px 16px 6px 0;color:#374151;font-weight:600;">GST (18%)</td><td>${fmtGst}</td></tr>
                      <tr style="border-top:2px solid #e5e7eb;">
                        <td style="padding:8px 16px 6px 0;color:#111827;font-weight:700;">Total Payable</td>
                        <td style="font-weight:700;color:#111827;">${fmtTotal}</td>
                      </tr>
                      <tr><td style="padding:6px 16px 6px 0;color:#374151;font-weight:600;">Due By</td><td>${new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
                    </table>
                    <p>Please complete the payment via <strong>Company Portal → Payments</strong> — partial or full payments via Cashfree are accepted.</p>
                    `}
                    <p>You can generate the offer letter right away from <strong>Company Portal → Interviews</strong>.</p>
                    <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                `,
            });
        }

        await logAction(req.user.id, 'approve_offer_request', 'company_request', cr.id,
            { company_id: cr.company_id, candidate_id: cr.candidate_id, base_fee: baseFee, gst_amount: gstAmount, total_amount: totalAmount, invoice_id: payableInvoiceId, fee_waived: isWaived }, ip(req));

        res.json({
            message: isWaived
                ? 'Offer letter unlocked.'
                : 'Offer letter unlocked and placement fee invoice raised for the company.',
            invoice_id: payableInvoiceId,
            invoice_number: invoiceNumber,
            amount: cr.placement_fee_amount,
            due_date: dueDate,
        });
    } catch (err) {
        console.error('[offerRequest.approve]', err);
        res.status(500).json({ message: 'Failed to approve request.' });
    }
};

// ── PUT /api/offer-requests/executive/:id/reject ──────────────────────────────
// Executive rejects a request with a reason
exports.rejectRequest = async (req, res) => {
    const { rejection_reason } = req.body;
    if (!rejection_reason?.trim()) {
        return res.status(400).json({ message: 'rejection_reason is required.' });
    }
    const isAdmin = req.user.role === 'admin';
    try {
        const [[cr]] = await db.query(
            `SELECT cr.id, cr.company_id, cr.candidate_id, cr.status,
                    co_u.id AS company_user_id, co_u.email AS company_email,
                    cand_u.name AS candidate_name
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN users co_u ON co_u.id = co.user_id
             JOIN candidates cand ON cand.id = cr.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             WHERE cr.id = ? AND cr.deleted_at IS NULL
               AND (? OR co.assigned_executive_id = ?)`,
            [req.params.id, isAdmin, req.user.id]
        );
        if (!cr) return res.status(404).json({ message: 'Request not found.' });
        if (['resolved', 'rejected'].includes(cr.status)) {
            return res.status(409).json({ message: 'Request is already finalized.' });
        }

        await db.query(
            `UPDATE company_requests
             SET status = 'rejected', rejection_reason = ?, resolved_at = NOW(), resolved_by = ?
             WHERE id = ?`,
            [rejection_reason, req.user.id, cr.id]
        );

        // Mark invoice as rejected
        await db.query(
            `UPDATE placement_fee_invoices pfi
             JOIN company_requests cr ON cr.invoice_id = pfi.id
             SET pfi.status = 'rejected'
             WHERE cr.id = ? AND pfi.deleted_at IS NULL`,
            [cr.id]
        );

        notify(
            cr.company_user_id,
            'offer_rejected',
            `Offer Letter Request Not Approved — ${cr.candidate_name}`,
            `Your offer letter request for ${cr.candidate_name} was not approved. Reason: ${rejection_reason}. Please contact your executive for next steps.`,
            { request_id: cr.id }
        );

        if (cr.company_email) {
            safeEmail({
                to: cr.company_email,
                subject: `Offer Letter Request — ${cr.candidate_name}`,
                html: `
                    <p>Hi,</p>
                    <p>Your offer letter request for <strong>${cr.candidate_name}</strong> could not be approved at this time.</p>
                    <p><strong>Reason:</strong> ${rejection_reason}</p>
                    <p>Please contact your LadderStep Human Consulting executive to resolve this and re-submit when ready.</p>
                    <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                `,
            });
        }

        // WhatsApp — offer rejected for company
        db.query(
            `SELECT jp.title AS job_title FROM company_requests cr
             JOIN applications a ON a.id = cr.application_id
             JOIN job_postings jp ON jp.id = a.job_id WHERE cr.id = ?`, [cr.id]
        ).then(async ([[jobRow]]) => {
            const [[coUser]] = await db.query('SELECT phone FROM users WHERE id = ?', [cr.company_user_id]);
            wa.notifyOfferRequestRejected(coUser?.phone, cr.candidate_name, jobRow?.job_title || '');
        }).catch(() => {});

        await logAction(req.user.id, 'reject_offer_request', 'company_request', cr.id,
            { reason: rejection_reason, candidate_id: cr.candidate_id }, ip(req));

        res.json({ message: 'Request rejected.' });
    } catch (err) {
        console.error('[offerRequest.reject]', err);
        res.status(500).json({ message: 'Failed to reject request.' });
    }
};

// ── GET /api/admin/offer-requests ────────────────────────────────────────────
// Admin sees all offer requests
exports.adminListAll = async (req, res) => {
    const { status, company_id, executive_id } = req.query;
    const conditions = ["cr.request_type = 'offer_letter_release'", 'cr.deleted_at IS NULL'];
    const params = [];

    if (status) { conditions.push('cr.status = ?'); params.push(status); }
    if (company_id) { conditions.push('cr.company_id = ?'); params.push(company_id); }
    if (executive_id) { conditions.push('cr.assigned_executive_id = ?'); params.push(executive_id); }

    try {
        const [rows] = await db.query(
            `SELECT cr.id, cr.status, cr.rejection_reason, cr.created_at, cr.resolved_at,
                    co.company_name,
                    cand_u.name AS candidate_name,
                    jp.title AS job_title,
                    exec_u.name AS executive_name,
                    pfi.offered_ctc, pfi.placement_fee_amount, pfi.status AS invoice_status, pfi.paid_at,
                    olg.id AS grant_id
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN applications a ON a.id = cr.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates cand ON cand.id = a.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN users exec_u ON exec_u.id = cr.assigned_executive_id
             LEFT JOIN placement_fee_invoices pfi ON pfi.id = cr.invoice_id AND pfi.deleted_at IS NULL
             LEFT JOIN offer_letter_grants olg ON olg.request_id = cr.id AND olg.deleted_at IS NULL
             WHERE ${conditions.join(' AND ')}
             ORDER BY cr.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[offerRequest.adminListAll]', err);
        res.status(500).json({ message: 'Failed to fetch offer requests.' });
    }
};

// ── GET /api/admin/placement-fees ────────────────────────────────────────────
// Admin sees all placement fee invoices
exports.adminListFees = async (req, res) => {
    const { status, date_from, date_to } = req.query;
    const conditions = ['pfi.deleted_at IS NULL'];
    const params = [];

    if (status) { conditions.push('pfi.status = ?'); params.push(status); }
    if (date_from) { conditions.push('DATE(pfi.created_at) >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('DATE(pfi.created_at) <= ?'); params.push(date_to); }

    try {
        const [rows] = await db.query(
            `SELECT pfi.id, pfi.offered_ctc, pfi.placement_fee_amount, pfi.status,
                    pfi.paid_at, pfi.created_at,
                    co.company_name,
                    cand_u.name AS candidate_name,
                    jp.title AS job_title,
                    exec_u.name AS executive_name
             FROM placement_fee_invoices pfi
             JOIN companies co ON co.id = pfi.company_id
             JOIN candidates cand ON cand.id = pfi.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             JOIN job_postings jp ON jp.id = pfi.job_posting_id
             LEFT JOIN users exec_u ON exec_u.id = pfi.raised_by
             WHERE ${conditions.join(' AND ')}
             ORDER BY pfi.created_at DESC`,
            params
        );

        // Summary stats
        const [[stats]] = await db.query(
            `SELECT
               SUM(CASE WHEN status = 'pending' THEN placement_fee_amount ELSE 0 END) AS pending_total,
               SUM(CASE WHEN status = 'paid' THEN placement_fee_amount ELSE 0 END) AS collected_total,
               SUM(CASE WHEN status = 'paid' AND MONTH(paid_at) = MONTH(NOW())
                         AND YEAR(paid_at) = YEAR(NOW()) THEN placement_fee_amount ELSE 0 END) AS collected_this_month,
               COUNT(*) AS total_count,
               SUM(status = 'pending') AS pending_count,
               SUM(status = 'paid') AS paid_count
             FROM placement_fee_invoices WHERE deleted_at IS NULL`
        );

        res.json({ success: true, data: rows, summary: stats });
    } catch (err) {
        console.error('[offerRequest.adminListFees]', err);
        res.status(500).json({ message: 'Failed to fetch placement fees.' });
    }
};

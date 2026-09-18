const db = require('../config/db');
const cashfree = require('../services/cashfreeService');
const { nextInvoiceNumber } = require('../utils/placementFee');
const { logAction } = require('../utils/auditLog');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
const PREMIUM_FEE_AMOUNT = 999;
const MIN_ANNUAL_CTC = 600000;

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) { console.error('[notify]', err.message); }
};

const getCandidateId = async (userId) => {
    await db.query('INSERT IGNORE INTO candidates (user_id) VALUES (?)', [userId]);
    const [[row]] = await db.query('SELECT id, is_premium FROM candidates WHERE user_id = ?', [userId]);
    return row;
};

// ── GET /api/candidates/premium/status ────────────────────────────────────────
exports.getPremiumStatus = async (req, res) => {
    try {
        const candidate = await getCandidateId(req.user.id);

        const [[latestRequest]] = await db.query(
            `SELECT id, declared_annual_ctc, status, review_note, reviewed_at, created_at
             FROM candidate_premium_requests
             WHERE candidate_id = ? AND deleted_at IS NULL
             ORDER BY created_at DESC LIMIT 1`,
            [candidate.id]
        );

        const [[payslipCount]] = await db.query(
            `SELECT COUNT(*) AS n FROM candidate_documents
             WHERE candidate_id = ? AND doc_type = 'payslip' AND deleted_at IS NULL`,
            [candidate.id]
        );

        res.json({
            success: true,
            is_premium: !!candidate.is_premium,
            payslip_count: payslipCount.n,
            request: latestRequest || null,
        });
    } catch (err) {
        console.error('[candidatePremium.status]', err.message);
        res.status(500).json({ message: 'Failed to fetch premium status.' });
    }
};

// ── POST /api/candidates/premium/request ──────────────────────────────────────
exports.submitPremiumRequest = async (req, res) => {
    try {
        const candidate = await getCandidateId(req.user.id);
        if (candidate.is_premium) {
            return res.status(409).json({ message: 'You are already a Premium candidate.' });
        }

        const declaredCtc = parseFloat(req.body?.declared_annual_ctc);
        if (isNaN(declaredCtc) || declaredCtc < MIN_ANNUAL_CTC) {
            return res.status(400).json({ message: `Declared annual CTC must be at least ₹${MIN_ANNUAL_CTC.toLocaleString('en-IN')}.` });
        }

        const [[payslipCount]] = await db.query(
            `SELECT COUNT(*) AS n FROM candidate_documents
             WHERE candidate_id = ? AND doc_type = 'payslip' AND deleted_at IS NULL`,
            [candidate.id]
        );
        if (payslipCount.n < 1) {
            return res.status(400).json({ message: 'Upload at least one recent payslip before submitting.' });
        }

        const [[pending]] = await db.query(
            `SELECT id FROM candidate_premium_requests
             WHERE candidate_id = ? AND status = 'pending' AND deleted_at IS NULL LIMIT 1`,
            [candidate.id]
        );
        if (pending) {
            return res.status(409).json({ message: 'A Premium verification request is already pending review.' });
        }

        const [result] = await db.query(
            `INSERT INTO candidate_premium_requests (candidate_id, declared_annual_ctc, status)
             VALUES (?, ?, 'pending')`,
            [candidate.id, declaredCtc]
        );

        const [[user]] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
        const [[admin]] = await db.query(
            `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
             WHERE r.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1`
        );
        await notify(
            admin?.id,
            'candidate_premium_request',
            `Premium Candidate Verification — ${user?.name || 'Candidate'}`,
            `${user?.name || 'A candidate'} has requested Premium verification, declaring an annual CTC of ₹${declaredCtc.toLocaleString('en-IN')}. Review their uploaded payslips before approving.`,
            { candidate_id: candidate.id, request_id: result.insertId }
        );

        logAction(req.user.id, 'submit_premium_request', 'candidate', candidate.id, { declared_annual_ctc: declaredCtc }, ip(req));

        res.status(201).json({ success: true, message: 'Premium verification request submitted for review.' });
    } catch (err) {
        console.error('[candidatePremium.request]', err.message);
        res.status(500).json({ message: 'Failed to submit request.' });
    }
};

// ── POST /api/candidates/premium/pay ──────────────────────────────────────────
// Creates a ₹999 Cashfree order for the candidate premium-profile fee. Only
// reachable once an executive/admin has approved the verification request —
// approval alone does not activate Premium status, paying this fee does.
exports.payPremiumFee = async (req, res) => {
    try {
        const candidate = await getCandidateId(req.user.id);
        if (candidate.is_premium) {
            return res.status(409).json({ message: 'You are already a Premium candidate.' });
        }

        const [[approved]] = await db.query(
            `SELECT id FROM candidate_premium_requests
             WHERE candidate_id = ? AND status = 'approved' AND deleted_at IS NULL
             ORDER BY created_at DESC LIMIT 1`,
            [candidate.id]
        );
        if (!approved) {
            return res.status(409).json({ message: 'Your Premium verification has not been approved yet.' });
        }

        const [[userRow]] = await db.query('SELECT name, email, phone FROM users WHERE id = ?', [req.user.id]);

        const conn = await db.getConnection();
        let invoiceId, invoiceNumber;
        try {
            await conn.beginTransaction();
            invoiceNumber = await nextInvoiceNumber(conn);
            const [invResult] = await conn.query(
                `INSERT INTO invoices (invoice_number, candidate_id, raised_by, invoice_type, amount, status, description, due_date)
                 VALUES (?, ?, ?, 'premium_profile_fee', ?, 'pending', 'Premium Profile Fee — LadderStep Human Consulting', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
                [invoiceNumber, candidate.id, req.user.id, PREMIUM_FEE_AMOUNT]
            );
            invoiceId = invResult.insertId;
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        const orderId = `LC-PF-${Date.now()}-${invoiceId}`;
        const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/^http:\/\//, 'https://');
        const returnUrl = `${frontendBase}/candidate/payment-callback?invoiceId=${invoiceId}&txnOrderId=${orderId}`;

        await db.query(
            `INSERT INTO payment_transactions (invoice_id, candidate_id, amount, payment_method, cashfree_order_id, status)
             VALUES (?, ?, ?, 'cashfree', ?, 'initiated')`,
            [invoiceId, candidate.id, PREMIUM_FEE_AMOUNT, orderId]
        );

        const cfOrder = await cashfree.createOrder({
            orderId,
            amount: PREMIUM_FEE_AMOUNT,
            customerName: userRow.name || 'Candidate',
            customerEmail: userRow.email,
            customerPhone: userRow.phone || '9999999999',
            orderNote: 'Premium Profile Fee — LadderStep Human Consulting',
            returnUrl,
        }).catch(async (cfErr) => {
            await db.query(`UPDATE payment_transactions SET status = 'failed' WHERE cashfree_order_id = ?`, [orderId]);
            console.error('[Cashfree] premium fee createOrder failed:', cfErr.response?.data || cfErr.message);
            throw Object.assign(new Error('Payment gateway unavailable.'), { gatewayError: true });
        });

        res.json({
            success: true,
            payment_session_id: cfOrder.payment_session_id,
            cashfree_env: cashfree.getEnv(),
            order_id: orderId,
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
            amount: PREMIUM_FEE_AMOUNT,
        });
    } catch (err) {
        if (err.gatewayError) return res.status(502).json({ message: err.message });
        console.error('[candidatePremium.pay]', err.message);
        res.status(500).json({ message: 'Failed to initiate payment.' });
    }
};

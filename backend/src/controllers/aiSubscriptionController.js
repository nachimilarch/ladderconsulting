const db = require('../config/db');
const cashfree = require('../services/cashfreeService');
const { nextInvoiceNumber } = require('../utils/placementFee');
const { logAction } = require('../utils/auditLog');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;

const getSetting = async (key, fallback) => {
    const [[row]] = await db.query('SELECT value FROM platform_settings WHERE setting_key = ?', [key]);
    return row ? row.value : fallback;
};

// Resolves the requesting user to their payer identity — a company or a candidate,
// the two supported AI-subscription payer types.
const resolvePayer = async (req) => {
    if (req.user.role === 'company') {
        const [[row]] = await db.query('SELECT id, company_name FROM companies WHERE user_id = ? AND deleted_at IS NULL', [req.user.id]);
        return row ? { payerType: 'company', payerId: row.id, displayName: row.company_name } : null;
    }
    if (req.user.role === 'candidate') {
        const [[row]] = await db.query(
            `SELECT c.id, u.name FROM candidates c JOIN users u ON u.id = c.user_id WHERE c.user_id = ? AND c.deleted_at IS NULL`,
            [req.user.id]
        );
        return row ? { payerType: 'candidate', payerId: row.id, displayName: row.name } : null;
    }
    return null;
};

// ── GET /api/ai-subscription/status ───────────────────────────────────────────
exports.getStatus = async (req, res) => {
    try {
        const payer = await resolvePayer(req);
        if (!payer) return res.status(404).json({ message: 'Account not found.' });

        const column = payer.payerType === 'candidate' ? 'candidate_id' : 'company_id';
        const [[sub]] = await db.query(
            `SELECT id, status, current_period_start, current_period_end, grace_until, last_invoice_id
             FROM ai_subscriptions WHERE ${column} = ? AND deleted_at IS NULL LIMIT 1`,
            [payer.payerId]
        );

        // The invoice from the most recent billing cycle, if it's still unpaid —
        // this is what payInvoice() would charge.
        let outstandingInvoice = null;
        if (sub) {
            const [[inv]] = await db.query(
                `SELECT id, invoice_number, amount, amount_paid, status, due_date
                 FROM invoices
                 WHERE ${column} = ? AND invoice_type = 'ai_subscription'
                   AND status IN ('pending', 'partially_paid', 'overdue') AND deleted_at IS NULL
                 ORDER BY created_at DESC LIMIT 1`,
                [payer.payerId]
            );
            outstandingInvoice = inv || null;
        }

        const amount = await getSetting('ai_subscription_amount', '299');

        res.json({
            success: true,
            subscribed: !!sub,
            amount: parseFloat(amount),
            subscription: sub || null,
            outstanding_invoice: outstandingInvoice,
        });
    } catch (err) {
        console.error('[aiSubscription.status]', err.message);
        res.status(500).json({ message: 'Failed to fetch subscription status.' });
    }
};

// ── POST /api/ai-subscription/subscribe ───────────────────────────────────────
// Creates the first cycle's invoice + a Cashfree order. The ai_subscriptions row
// itself is only created once that invoice is actually paid (see
// paymentController.processSuccessfulPayment's 'ai_subscription' branch) — same
// "payment activates, not the initiating action" discipline as the listing fee
// and the candidate premium-profile fee.
exports.subscribe = async (req, res) => {
    try {
        const payer = await resolvePayer(req);
        if (!payer) return res.status(404).json({ message: 'Account not found.' });

        const column = payer.payerType === 'candidate' ? 'candidate_id' : 'company_id';
        const [[existing]] = await db.query(
            `SELECT id, status FROM ai_subscriptions WHERE ${column} = ? AND deleted_at IS NULL LIMIT 1`,
            [payer.payerId]
        );
        if (existing && ['active', 'grace'].includes(existing.status)) {
            return res.status(409).json({ message: 'You already have an active AI subscription.' });
        }

        const [[userRow]] = await db.query('SELECT name, email, phone FROM users WHERE id = ?', [req.user.id]);
        const amount = parseFloat(await getSetting('ai_subscription_amount', '299'));

        const conn = await db.getConnection();
        let invoiceId, invoiceNumber;
        try {
            await conn.beginTransaction();
            invoiceNumber = await nextInvoiceNumber(conn);
            const [invResult] = await conn.query(
                `INSERT INTO invoices (invoice_number, ${column}, raised_by, invoice_type, amount, status, description, due_date)
                 VALUES (?, ?, ?, 'ai_subscription', ?, 'pending', 'AI Assistant Subscription — LadderStep Human Consulting', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
                [invoiceNumber, payer.payerId, req.user.id, amount]
            );
            invoiceId = invResult.insertId;
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        const orderId = `LC-AI-${Date.now()}-${invoiceId}`;
        const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/^http:\/\//, 'https://');
        const returnUrl = `${frontendBase}/${payer.payerType === 'candidate' ? 'candidate' : 'company'}/payment-callback?invoiceId=${invoiceId}&txnOrderId=${orderId}`;

        await db.query(
            `INSERT INTO payment_transactions (invoice_id, ${column}, amount, payment_method, cashfree_order_id, status)
             VALUES (?, ?, ?, 'cashfree', ?, 'initiated')`,
            [invoiceId, payer.payerId, amount, orderId]
        );

        const cfOrder = await cashfree.createOrder({
            orderId,
            amount,
            customerName: userRow.name || payer.displayName,
            customerEmail: userRow.email,
            customerPhone: userRow.phone || '9999999999',
            orderNote: 'AI Assistant Subscription — LadderStep Human Consulting',
            returnUrl,
        }).catch(async (cfErr) => {
            await db.query(`UPDATE payment_transactions SET status = 'failed' WHERE cashfree_order_id = ?`, [orderId]);
            console.error('[Cashfree] ai_subscription createOrder failed:', cfErr.response?.data || cfErr.message);
            throw Object.assign(new Error('Payment gateway unavailable.'), { gatewayError: true });
        });

        res.json({
            success: true,
            payment_session_id: cfOrder.payment_session_id,
            cashfree_env: cashfree.getEnv(),
            order_id: orderId,
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
            amount,
        });
    } catch (err) {
        if (err.gatewayError) return res.status(502).json({ message: err.message });
        console.error('[aiSubscription.subscribe]', err.message);
        res.status(500).json({ message: 'Failed to initiate subscription.' });
    }
};

// ── POST /api/ai-subscription/pay-invoice ─────────────────────────────────────
// Pays the payer's current outstanding ai_subscription invoice (a renewal cycle
// generated by subscriptionBiller, or a first invoice that failed/was abandoned).
exports.payInvoice = async (req, res) => {
    try {
        const payer = await resolvePayer(req);
        if (!payer) return res.status(404).json({ message: 'Account not found.' });

        const column = payer.payerType === 'candidate' ? 'candidate_id' : 'company_id';
        const [[inv]] = await db.query(
            `SELECT id, invoice_number, amount, amount_paid
             FROM invoices
             WHERE ${column} = ? AND invoice_type = 'ai_subscription'
               AND status IN ('pending', 'partially_paid', 'overdue') AND deleted_at IS NULL
             ORDER BY created_at DESC LIMIT 1`,
            [payer.payerId]
        );
        if (!inv) return res.status(404).json({ message: 'No outstanding AI subscription invoice found.' });

        const [[userRow]] = await db.query('SELECT name, email, phone FROM users WHERE id = ?', [req.user.id]);
        const outstanding = parseFloat(inv.amount) - parseFloat(inv.amount_paid);

        const orderId = `LC-AI-${Date.now()}-${inv.id}`;
        const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/^http:\/\//, 'https://');
        const returnUrl = `${frontendBase}/${payer.payerType === 'candidate' ? 'candidate' : 'company'}/payment-callback?invoiceId=${inv.id}&txnOrderId=${orderId}`;

        await db.query(
            `INSERT INTO payment_transactions (invoice_id, ${column}, amount, payment_method, cashfree_order_id, status)
             VALUES (?, ?, ?, 'cashfree', ?, 'initiated')`,
            [inv.id, payer.payerId, outstanding, orderId]
        );

        const cfOrder = await cashfree.createOrder({
            orderId,
            amount: outstanding,
            customerName: userRow.name || payer.displayName,
            customerEmail: userRow.email,
            customerPhone: userRow.phone || '9999999999',
            orderNote: `AI Assistant Subscription — Invoice ${inv.invoice_number}`,
            returnUrl,
        }).catch(async (cfErr) => {
            await db.query(`UPDATE payment_transactions SET status = 'failed' WHERE cashfree_order_id = ?`, [orderId]);
            console.error('[Cashfree] ai_subscription payInvoice createOrder failed:', cfErr.response?.data || cfErr.message);
            throw Object.assign(new Error('Payment gateway unavailable.'), { gatewayError: true });
        });

        res.json({
            success: true,
            payment_session_id: cfOrder.payment_session_id,
            cashfree_env: cashfree.getEnv(),
            order_id: orderId,
            invoice_id: inv.id,
            invoice_number: inv.invoice_number,
            amount: outstanding,
        });
    } catch (err) {
        if (err.gatewayError) return res.status(502).json({ message: err.message });
        console.error('[aiSubscription.payInvoice]', err.message);
        res.status(500).json({ message: 'Failed to initiate payment.' });
    }
};

// ── POST /api/ai-subscription/cancel ──────────────────────────────────────────
exports.cancel = async (req, res) => {
    try {
        const payer = await resolvePayer(req);
        if (!payer) return res.status(404).json({ message: 'Account not found.' });

        const column = payer.payerType === 'candidate' ? 'candidate_id' : 'company_id';
        const [[sub]] = await db.query(
            `SELECT id, status FROM ai_subscriptions WHERE ${column} = ? AND deleted_at IS NULL LIMIT 1`,
            [payer.payerId]
        );
        if (!sub || sub.status === 'cancelled') {
            return res.status(409).json({ message: 'No active subscription to cancel.' });
        }

        await db.query(
            `UPDATE ai_subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?`,
            [sub.id]
        );

        logAction(req.user.id, 'cancel_ai_subscription', payer.payerType, payer.payerId, {}, ip(req));

        res.json({ success: true, message: 'AI subscription cancelled.' });
    } catch (err) {
        console.error('[aiSubscription.cancel]', err.message);
        res.status(500).json({ message: 'Failed to cancel subscription.' });
    }
};

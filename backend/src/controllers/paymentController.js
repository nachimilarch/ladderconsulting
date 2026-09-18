const db = require('../config/db');
const cashfree = require('../services/cashfreeService');
const { sendEmail } = require('../utils/email');
const { syncPlacementFeeStatus } = require('../utils/placementFee');
const { fulfillResumeUnlockOrder } = require('../utils/resumeUnlock');

const safeEmail = (opts) => sendEmail(opts).catch(e => console.error('[Email]', e.message));

const notify = (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    db.query(
        `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)`,
        [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
    ).catch(e => console.error('[notify]', e.message));
};

const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Called after successful payment — updates invoice + notifies parties
const processSuccessfulPayment = async (txn, paymentId, conn) => {
    const c = conn || db;
    const [[inv]] = await c.query(
        `SELECT id, company_id, candidate_id, application_id, amount, amount_paid, invoice_number, invoice_type
         FROM invoices WHERE id = ? AND deleted_at IS NULL`,
        [txn.invoice_id]
    );
    if (!inv) return;

    const newPaid = parseFloat(inv.amount_paid) + parseFloat(txn.amount);
    const newStatus = newPaid >= parseFloat(inv.amount) ? 'paid' : 'partially_paid';

    await c.query(
        `UPDATE invoices SET amount_paid = ?, status = ?${newStatus === 'paid' ? ', paid_at = NOW()' : ''} WHERE id = ?`,
        [newPaid, newStatus, inv.id]
    );

    await c.query(
        `UPDATE payment_transactions SET status = 'success', cashfree_payment_id = ?, completed_at = NOW() WHERE id = ?`,
        [paymentId || null, txn.id]
    );

    // For placement-fee invoices, mirror the status onto placement_fee_invoices
    // so the executive's queue + the offer_letter_grants ledger stay consistent.
    if (inv.invoice_type === 'placement_fee') {
        try { await syncPlacementFeeStatus(inv.application_id, c); }
        catch (e) { console.error('[syncPlacementFeeStatus]', e.message); }
    }

    // Resume unlock purchases grant access once the invoice is fully paid.
    if (inv.invoice_type === 'resume_unlock' && newStatus === 'paid') {
        try { await fulfillResumeUnlockOrder(inv.id, c); }
        catch (e) { console.error('[fulfillResumeUnlockOrder]', e.message); }
    }

    // Listing fee activates the company's account.
    if (inv.invoice_type === 'listing_fee' && newStatus === 'paid') {
        try {
            await c.query(
                `UPDATE companies SET listing_fee_paid = 1, listing_fee_invoice_id = ? WHERE id = ? AND deleted_at IS NULL`,
                [inv.id, inv.company_id]
            );
        } catch (e) { console.error('[listingFeeActivate]', e.message); }
    }

    // Premium profile fee activates the candidate's Premium status. Approval
    // (candidate_premium_requests.status='approved') alone does NOT activate it —
    // paying this fee is the deliberate final step.
    if (inv.invoice_type === 'premium_profile_fee' && newStatus === 'paid') {
        try {
            await c.query(
                `UPDATE candidates SET is_premium = 1, premium_activated_at = NOW(), premium_invoice_id = ? WHERE id = ? AND deleted_at IS NULL`,
                [inv.id, inv.candidate_id]
            );
        } catch (e) { console.error('[premiumProfileActivate]', e.message); }
    }

    // AI subscription: create the ai_subscriptions row on first payment, or
    // extend the existing one's period on a renewal payment — same row either
    // way, found by payer. Extends from whichever is later (old period end or
    // today) so a very-late payment doesn't stack backdated free time.
    if (inv.invoice_type === 'ai_subscription' && newStatus === 'paid') {
        try {
            const column = inv.candidate_id ? 'candidate_id' : 'company_id';
            const payerId = inv.candidate_id || inv.company_id;
            const [[existingSub]] = await c.query(
                `SELECT id FROM ai_subscriptions WHERE ${column} = ? AND deleted_at IS NULL LIMIT 1`,
                [payerId]
            );
            if (existingSub) {
                await c.query(
                    `UPDATE ai_subscriptions
                     SET status = 'active', grace_until = NULL, last_invoice_id = ?,
                         current_period_start = GREATEST(current_period_end, CURDATE()),
                         current_period_end = DATE_ADD(GREATEST(current_period_end, CURDATE()), INTERVAL 1 MONTH)
                     WHERE id = ?`,
                    [inv.id, existingSub.id]
                );
            } else {
                await c.query(
                    `INSERT INTO ai_subscriptions (${column}, status, current_period_start, current_period_end, last_invoice_id)
                     VALUES (?, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 MONTH), ?)`,
                    [payerId, inv.id]
                );
            }
        } catch (e) { console.error('[aiSubscriptionActivate]', e.message); }
    }

    const [[admin]] = await c.query(
        `SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id
         WHERE ro.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1`
    );
    const notifMsg = `Payment of ${fmtINR(txn.amount)} received for Invoice ${inv.invoice_number}. Invoice is now ${newStatus.replace('_', ' ')}.`;

    if (inv.company_id) {
        // Get executive user_id for notification
        const [[compInfo]] = await c.query(
            `SELECT c.assigned_executive_id, co_u.id AS company_user_id, u_exec.id AS exec_id
             FROM companies c
             JOIN users co_u ON co_u.id = c.user_id
             LEFT JOIN users u_exec ON u_exec.id = c.assigned_executive_id
             WHERE c.id = ? AND c.deleted_at IS NULL`, [inv.company_id]
        );
        if (compInfo?.exec_id) notify(compInfo.exec_id, 'payment_received', `Payment Received — ${inv.invoice_number}`, notifMsg, { invoice_id: inv.id });
    } else if (inv.candidate_id) {
        const [[candInfo]] = await c.query(
            `SELECT u.id AS user_id FROM candidates cd JOIN users u ON u.id = cd.user_id WHERE cd.id = ? AND cd.deleted_at IS NULL`,
            [inv.candidate_id]
        );
        if (candInfo?.user_id) notify(candInfo.user_id, 'payment_received', `Payment Received — ${inv.invoice_number}`, notifMsg, { invoice_id: inv.id });
    }

    if (admin?.id) notify(admin.id, 'payment_received', `Payment Received — ${inv.invoice_number}`, notifMsg, { invoice_id: inv.id });
};

// ── POST /api/company/invoices/:id/pay ───────────────────────────────────────
// Company initiates Cashfree payment for an invoice
exports.initiatePayment = async (req, res) => {
    const { amount } = req.body;
    const payAmt = parseFloat(amount);
    if (isNaN(payAmt) || payAmt <= 0) {
        return res.status(400).json({ message: 'amount must be a positive number.' });
    }

    try {
        const [[comp]] = await db.query(
            `SELECT c.id, u.name, u.email, u.phone FROM companies c JOIN users u ON u.id = c.user_id
             WHERE c.user_id = ? AND c.deleted_at IS NULL`, [req.user.id]
        );
        if (!comp) return res.status(404).json({ message: 'Company not found.' });

        const [[inv]] = await db.query(
            `SELECT id, invoice_number, amount, amount_paid, status
             FROM invoices WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
            [req.params.id, comp.id]
        );
        if (!inv) return res.status(404).json({ message: 'Invoice not found.' });
        if (['paid', 'cancelled', 'waived'].includes(inv.status)) {
            return res.status(409).json({ message: `Invoice is already ${inv.status}.` });
        }

        const outstanding = parseFloat(inv.amount) - parseFloat(inv.amount_paid);
        if (payAmt > outstanding + 0.01) {
            return res.status(400).json({ message: `Amount exceeds outstanding balance of ${fmtINR(outstanding)}.` });
        }

        const orderId = `LC-TXN-${Date.now()}-${inv.id}`;
        // FRONTEND_URL may be comma-separated (CORS list) — take only the first value.
        // Cashfree requires https:// on return_url even in sandbox mode.
        const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/^http:\/\//, 'https://');
        const returnUrl = `${frontendBase}/company/payments/${inv.id}/callback?txnOrderId=${orderId}`;

        // Create transaction record
        const [txnResult] = await db.query(
            `INSERT INTO payment_transactions
                (invoice_id, company_id, amount, payment_method, cashfree_order_id, status)
             VALUES (?, ?, ?, 'cashfree', ?, 'initiated')`,
            [inv.id, comp.id, payAmt, orderId]
        );

        // Call Cashfree
        let cfOrder;
        try {
            cfOrder = await cashfree.createOrder({
                orderId,
                amount: payAmt,
                customerName: comp.name,
                customerEmail: comp.email,
                customerPhone: comp.phone || '9999999999',
                orderNote: `Payment for Invoice ${inv.invoice_number} — LadderStep Human Consulting`,
                returnUrl,
            });
        } catch (cfErr) {
            // Mark transaction as failed if Cashfree API is unavailable
            await db.query(`UPDATE payment_transactions SET status = 'failed' WHERE id = ?`, [txnResult.insertId]);
            console.error('[Cashfree] createOrder failed:', cfErr.response?.data || cfErr.message);
            return res.status(502).json({ message: 'Payment gateway unavailable. Please try again.' });
        }

        res.json({
            payment_session_id: cfOrder.payment_session_id,
            order_id: orderId,
            cashfree_env: cashfree.getEnv(),
            transaction_id: txnResult.insertId,
            invoice_number: inv.invoice_number,
        });
    } catch (err) {
        console.error('[payment.initiate]', err);
        res.status(500).json({ message: 'Failed to initiate payment.' });
    }
};

// ── GET /api/payments/verify/:cashfreeOrderId ─────────────────────────────────
// Called from frontend after Cashfree redirects back
exports.verifyPayment = async (req, res) => {
    const { cashfreeOrderId } = req.params;

    try {
        const [[txn]] = await db.query(
            `SELECT pt.id, pt.invoice_id, pt.company_id, pt.candidate_id, pt.amount, pt.status, pt.cashfree_payment_id
             FROM payment_transactions pt
             WHERE pt.cashfree_order_id = ? LIMIT 1`,
            [cashfreeOrderId]
        );
        if (!txn) return res.status(404).json({ message: 'Transaction not found.' });

        // Idempotency: already processed
        if (txn.status === 'success') {
            return res.json({ status: 'success', already_processed: true });
        }

        let cfStatus = 'PENDING';
        let cfPaymentId = null;
        try {
            const orderData = await cashfree.getOrderStatus(cashfreeOrderId);
            cfStatus = orderData.order_status || 'PENDING';

            // Get payment details if paid
            if (cfStatus === 'PAID') {
                const payments = await cashfree.getOrderPayments(cashfreeOrderId);
                const successPay = Array.isArray(payments) ? payments.find(p => p.payment_status === 'SUCCESS') : null;
                cfPaymentId = successPay?.cf_payment_id || null;
            }
        } catch (cfErr) {
            console.error('[Cashfree] getOrderStatus failed:', cfErr.message);
            return res.status(502).json({ message: 'Could not verify payment status. Please refresh.' });
        }

        if (cfStatus === 'PAID') {
            await processSuccessfulPayment(txn, cfPaymentId);
            return res.json({ status: 'success' });
        } else if (cfStatus === 'EXPIRED' || cfStatus === 'CANCELLED') {
            await db.query(
                `UPDATE payment_transactions SET status = 'failed' WHERE id = ?`, [txn.id]
            );
            return res.json({ status: 'failed', cashfree_status: cfStatus });
        } else {
            return res.json({ status: 'pending', cashfree_status: cfStatus });
        }
    } catch (err) {
        console.error('[payment.verify]', err);
        res.status(500).json({ message: 'Failed to verify payment.' });
    }
};

// ── POST /api/payments/webhook/cashfree ──────────────────────────────────────
// Webhook from Cashfree — no auth, signature verified
exports.cashfreeWebhook = async (req, res) => {
    // Verify signature
    const signature = req.headers['x-webhook-signature'];
    const rawBody = req.rawBody; // set by express middleware
    if (!cashfree.verifyWebhookSignature(rawBody, signature)) {
        console.warn('[Webhook] Invalid Cashfree signature');
        return res.status(400).json({ message: 'Invalid webhook signature.' });
    }

    const event = req.body;
    const eventType = event?.type;
    const orderId = event?.data?.order?.order_id;
    const cfPaymentId = event?.data?.payment?.cf_payment_id;

    try {
        if (!orderId) return res.status(200).json({ received: true });

        const [[txn]] = await db.query(
            `SELECT id, invoice_id, company_id, candidate_id, amount, status, cashfree_payment_id
             FROM payment_transactions WHERE cashfree_order_id = ? LIMIT 1`,
            [orderId]
        );

        if (!txn) return res.status(200).json({ received: true });

        if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
            // Idempotency check
            if (txn.status === 'success') return res.status(200).json({ received: true });

            await processSuccessfulPayment(txn, cfPaymentId);
        } else if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
            if (txn.status !== 'success') {
                await db.query(
                    `UPDATE payment_transactions SET status = 'failed' WHERE id = ?`, [txn.id]
                );
                // Notify the payer of failure — company or candidate
                if (txn.company_id) {
                    const [[comp]] = await db.query(
                        `SELECT u.id AS user_id FROM companies c JOIN users u ON u.id = c.user_id WHERE c.id = ?`, [txn.company_id]
                    );
                    if (comp) {
                        notify(comp.user_id, 'payment_failed', 'Payment Failed', 'Your payment attempt failed. Please try again from the Payments section.', { invoice_id: txn.invoice_id });
                    }
                } else if (txn.candidate_id) {
                    const [[cand]] = await db.query(
                        `SELECT u.id AS user_id FROM candidates c JOIN users u ON u.id = c.user_id WHERE c.id = ?`, [txn.candidate_id]
                    );
                    if (cand) {
                        notify(cand.user_id, 'payment_failed', 'Payment Failed', 'Your payment attempt failed. Please try again.', { invoice_id: txn.invoice_id });
                    }
                }
            }
        }

        res.status(200).json({ received: true });
    } catch (err) {
        console.error('[webhook.cashfree]', err);
        res.status(200).json({ received: true }); // Always return 200 to Cashfree
    }
};

/**
 * AI Subscription Biller — generates the next ₹299 monthly invoice when a
 * cycle ends, and moves overdue subscriptions through active -> grace ->
 * suspended. Billing here is "manual invoice, manual pay" (the payer clicks
 * Pay from their side, same as the listing fee / premium-profile fee) — this
 * service only ever creates invoice rows, never a Cashfree order itself,
 * since there's no live browser session in a background job to redirect.
 *
 * Started once from server.js: startSubscriptionBiller()
 * Never throws unhandled exceptions — all errors are caught and logged.
 * Mirrors the setInterval pattern in services/mailPoller.js — this codebase
 * has no cron/job-scheduler dependency, so that's the established way to do
 * recurring background work here.
 */

const db = require('../config/db');
const { nextInvoiceNumber } = require('../utils/placementFee');

const BILL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let billingActive = false;
let billTimer = null;

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) { console.error('[subscriptionBiller.notify]', err.message); }
};

const getSetting = async (key, fallback) => {
    const [[row]] = await db.query('SELECT value FROM platform_settings WHERE setting_key = ?', [key]);
    return row ? row.value : fallback;
};

const payerUserId = async (sub) => {
    if (sub.company_id) {
        const [[row]] = await db.query('SELECT user_id FROM companies WHERE id = ? AND deleted_at IS NULL', [sub.company_id]);
        return row?.user_id || null;
    }
    const [[row]] = await db.query('SELECT user_id FROM candidates WHERE id = ? AND deleted_at IS NULL', [sub.candidate_id]);
    return row?.user_id || null;
};

// Step 1: active subscriptions whose period has ended and have no outstanding
// ai_subscription invoice yet -> generate the next cycle's invoice.
const generateRenewalInvoices = async (amount) => {
    const [rows] = await db.query(
        `SELECT s.id, s.company_id, s.candidate_id, s.current_period_end
         FROM ai_subscriptions s
         WHERE s.status = 'active' AND s.current_period_end <= CURDATE() AND s.deleted_at IS NULL
           AND NOT EXISTS (
               SELECT 1 FROM invoices i
               WHERE i.invoice_type = 'ai_subscription' AND i.deleted_at IS NULL
                 AND i.status IN ('pending', 'partially_paid', 'overdue')
                 AND ((s.company_id IS NOT NULL AND i.company_id = s.company_id)
                   OR (s.candidate_id IS NOT NULL AND i.candidate_id = s.candidate_id))
           )`
    );

    for (const sub of rows) {
        try {
            const invoiceNumber = await nextInvoiceNumber(db);
            const [invResult] = await db.query(
                `INSERT INTO invoices (invoice_number, company_id, candidate_id, raised_by, invoice_type, amount, status, description, due_date)
                 VALUES (?, ?, ?, NULL, 'ai_subscription', ?, 'pending', 'AI Assistant Subscription — LadderStep Human Consulting', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
                [invoiceNumber, sub.company_id, sub.candidate_id, amount]
            );
            await db.query(`UPDATE ai_subscriptions SET last_invoice_id = ? WHERE id = ?`, [invResult.insertId, sub.id]);

            const userId = await payerUserId(sub);
            await notify(userId, 'ai_subscription_renewal', 'AI Subscription Renewal Due',
                `Your ₹${amount} monthly AI Assistant subscription is due for renewal (Invoice ${invoiceNumber}). Pay within 7 days to keep access uninterrupted.`,
                { subscription_id: sub.id, invoice_id: invResult.insertId });
        } catch (e) {
            console.error('[subscriptionBiller] renewal invoice failed for sub', sub.id, e.message);
        }
    }
    return rows.length;
};

// Step 2: active subscriptions whose outstanding invoice has passed its due
// date -> move into a grace period (access still allowed, see
// utils/aiSubscription.hasActiveAiSubscription).
const moveOverdueToGrace = async (graceDays) => {
    const [rows] = await db.query(
        `SELECT s.id, s.company_id, s.candidate_id, i.due_date
         FROM ai_subscriptions s
         JOIN invoices i ON i.id = s.last_invoice_id
         WHERE s.status = 'active' AND i.invoice_type = 'ai_subscription' AND i.deleted_at IS NULL
           AND i.status IN ('pending', 'partially_paid') AND i.due_date < NOW()
           AND s.deleted_at IS NULL`
    );

    for (const sub of rows) {
        try {
            await db.query(
                `UPDATE ai_subscriptions SET status = 'grace', grace_until = DATE_ADD(?, INTERVAL ? DAY) WHERE id = ?`,
                [sub.due_date, graceDays, sub.id]
            );
            const userId = await payerUserId(sub);
            await notify(userId, 'ai_subscription_grace', 'AI Subscription Payment Overdue',
                `Your AI Assistant subscription payment is overdue. You have ${graceDays} more day(s) of access before it's suspended — pay to keep it active.`,
                { subscription_id: sub.id });
        } catch (e) {
            console.error('[subscriptionBiller] grace transition failed for sub', sub.id, e.message);
        }
    }
    return rows.length;
};

// Step 3: subscriptions past their grace period -> suspend (chatbot access
// revoked until they pay).
const suspendExpiredGrace = async () => {
    const [rows] = await db.query(
        `SELECT id, company_id, candidate_id FROM ai_subscriptions
         WHERE status = 'grace' AND grace_until < CURDATE() AND deleted_at IS NULL`
    );

    for (const sub of rows) {
        try {
            await db.query(`UPDATE ai_subscriptions SET status = 'suspended' WHERE id = ?`, [sub.id]);
            const userId = await payerUserId(sub);
            await notify(userId, 'ai_subscription_suspended', 'AI Subscription Suspended',
                'Your AI Assistant subscription has been suspended due to non-payment. Pay your outstanding invoice to reactivate.',
                { subscription_id: sub.id });
        } catch (e) {
            console.error('[subscriptionBiller] suspend failed for sub', sub.id, e.message);
        }
    }
    return rows.length;
};

const runBillingCycle = async () => {
    const amount = parseFloat(await getSetting('ai_subscription_amount', '299'));
    const graceDays = parseInt(await getSetting('ai_subscription_grace_days', '7'), 10);

    const renewed = await generateRenewalInvoices(amount);
    const graced = await moveOverdueToGrace(graceDays);
    const suspended = await suspendExpiredGrace();

    if (renewed || graced || suspended) {
        console.log(`[subscriptionBiller] cycle complete — invoiced:${renewed} grace:${graced} suspended:${suspended}`);
    }
};

const startSubscriptionBiller = () => {
    if (billingActive) return;
    billingActive = true;
    console.log('[subscriptionBiller] AI subscription biller started — interval: 6h');

    setTimeout(async () => {
        await runBillingCycle().catch(e => console.error('[subscriptionBiller] Initial cycle error:', e.message));
    }, 15000);

    billTimer = setInterval(async () => {
        await runBillingCycle().catch(e => console.error('[subscriptionBiller] Cycle error:', e.message));
    }, BILL_INTERVAL_MS);
};

const stopSubscriptionBiller = () => {
    if (billTimer) clearInterval(billTimer);
    billingActive = false;
};

module.exports = { startSubscriptionBiller, stopSubscriptionBiller, runBillingCycle };

const db = require('../config/db');

// Called from paymentController.processSuccessfulPayment once a resume_unlock
// invoice is fully paid. Grants the resume_unlocks row(s) implied by the order:
// a 'single' order bought WITH a target candidate (TalentPool paywall) unlocks
// that candidate instantly. A 'single' order bought with NO target yet (the
// Profile/package-selection screen, before browsing) — or any pack order
// ('pack_4', legacy 'pack_5') — just goes active; its credit(s) get consumed
// later, one per candidate, via consumePackCredit() on demand.
async function fulfillResumeUnlockOrder(invoiceId, runner = db) {
    const [[order]] = await runner.query(
        `SELECT id, company_id, order_type, candidate_id, credits_total, credits_used
         FROM resume_unlock_orders WHERE invoice_id = ? AND deleted_at IS NULL`,
        [invoiceId]
    );
    if (!order) return;

    if (order.order_type === 'single' && order.candidate_id && order.credits_used < order.credits_total) {
        const [[inv]] = await runner.query(`SELECT raised_by FROM invoices WHERE id = ?`, [invoiceId]);
        await runner.query(
            `INSERT INTO resume_unlocks (company_id, candidate_id, order_id, granted_via, unlocked_by)
             VALUES (?, ?, ?, 'single', ?)
             ON DUPLICATE KEY UPDATE order_id = order_id`,
            [order.company_id, order.candidate_id, order.id, inv?.raised_by || null]
        );
        await runner.query(`UPDATE resume_unlock_orders SET credits_used = 1 WHERE id = ?`, [order.id]);
    }
    // Targetless orders (single bought with no candidate yet, or any pack) need
    // no action here — paid status alone makes their credits available;
    // consumePackCredit() draws them down on demand.
}

// Draws one credit from the company's oldest order with capacity remaining.
// Covers pack orders and targetless 'single' orders alike — a 'single' order
// bought WITH a target candidate is already fully consumed by the time payment
// completes (see above), so it never shows up here regardless of type.
// Returns the order id consumed, or null if no credit was available.
async function consumePackCredit(companyId, runner = db) {
    const [[order]] = await runner.query(
        `SELECT ruo.id FROM resume_unlock_orders ruo
         JOIN invoices i ON i.id = ruo.invoice_id
         WHERE ruo.company_id = ? AND ruo.deleted_at IS NULL
           AND i.status = 'paid' AND ruo.credits_used < ruo.credits_total
         ORDER BY ruo.created_at ASC LIMIT 1`,
        [companyId]
    );
    if (!order) return null;
    await runner.query(`UPDATE resume_unlock_orders SET credits_used = credits_used + 1 WHERE id = ?`, [order.id]);
    return order.id;
}

module.exports = { fulfillResumeUnlockOrder, consumePackCredit };

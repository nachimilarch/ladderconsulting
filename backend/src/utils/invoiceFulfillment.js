const { syncPlacementFeeStatus } = require('./placementFee');
const { fulfillResumeUnlockOrder } = require('./resumeUnlock');
const jobController = require('../controllers/jobController');

// Side effects of an invoice becoming (partially) paid — shared by the gateway
// path (paymentController.processSuccessfulPayment) and manual "Mark Paid"
// (invoiceController.markPaid) so an offline payment activates exactly what an
// online one does. `inv` needs id, company_id, candidate_id, application_id,
// job_posting_id, invoice_type; `c` is a connection or the pool.
const fulfillPaidInvoice = async (inv, newStatus, c) => {
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

    // Job-posting fee: ₹3,999 per JD for Standard-tier companies (not a
    // one-time account activation — every new job costs this again). The
    // same payment still activates Talent Pool access (listing_fee_paid),
    // it just no longer buys future free job posts.
    if (inv.invoice_type === 'job_posting_fee' && newStatus === 'paid') {
        try {
            await jobController.activateJobPosting(inv.job_posting_id, c);
            await c.query(
                `UPDATE companies SET listing_fee_paid = 1, listing_fee_invoice_id = ? WHERE id = ? AND deleted_at IS NULL`,
                [inv.id, inv.company_id]
            );
        } catch (e) { console.error('[jobPostingFeeActivate]', e.message); }
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
};

module.exports = { fulfillPaidInvoice };

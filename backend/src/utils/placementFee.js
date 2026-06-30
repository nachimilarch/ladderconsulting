const db = require('../config/db');

// Generate the next invoice_number for the invoices table. Same prefix scheme
// used by invoiceController so HRInvoices and placement-fee invoices coexist.
async function nextInvoiceNumber(runner = db) {
    const now = new Date();
    const prefix = `LC-INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [[{ cnt }]] = await runner.query(
        `SELECT COUNT(*) AS cnt FROM invoices WHERE invoice_number LIKE ?`,
        [`${prefix}%`]
    );
    return `${prefix}-${String(parseInt(cnt) + 1).padStart(4, '0')}`;
}

// Mirror the placement_fee_invoices.status to whatever the company-payable
// sibling `invoices` row says. Called whenever an `invoices` row of
// type='placement_fee' changes payment state — Cashfree success, manual
// mark-paid, mark-partial. Safe to call when no PFI exists for the application.
async function syncPlacementFeeStatus(applicationId, runner = db) {
    if (!applicationId) return;
    const [[inv]] = await runner.query(
        `SELECT status, amount, amount_paid FROM invoices
         WHERE application_id = ? AND invoice_type = 'placement_fee' AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [applicationId]
    );
    if (!inv) return;

    // Map invoices.status → placement_fee_invoices.status
    let pfiStatus = 'pending';
    let setPaidAt = false;
    if (inv.status === 'paid') { pfiStatus = 'paid'; setPaidAt = true; }
    else if (inv.status === 'partially_paid') pfiStatus = 'pending'; // still owed
    else if (inv.status === 'overdue') pfiStatus = 'overdue';
    else if (inv.status === 'cancelled' || inv.status === 'waived') pfiStatus = 'waived';

    await runner.query(
        `UPDATE placement_fee_invoices
         SET status = ?${setPaidAt ? ', paid_at = NOW()' : ''}
         WHERE application_id = ? AND deleted_at IS NULL`,
        [pfiStatus, applicationId]
    );
}

module.exports = { nextInvoiceNumber, syncPlacementFeeStatus };

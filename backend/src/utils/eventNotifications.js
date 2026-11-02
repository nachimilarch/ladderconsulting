// Email + WhatsApp + in-app alerts for application and payment events.
// Every function is fire-and-forget: it never throws and never blocks the request.
const db = require('../config/db');
const { sendEmail } = require('./email');
const wa = require('./whatsappNotify');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const mail = (opts) => sendEmail(opts).catch(e => console.error('[Email]', e.message));
const inApp = (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    db.query('INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
        [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
    ).catch(e => console.error('[notify]', e.message));
};
const wrap = (inner) => `${inner}<br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>`;

// A candidate applied to a job.
async function notifyApplicationReceived(applicationId) {
    try {
        const [[r]] = await db.query(
            `SELECT jp.id AS job_id, jp.title AS job_title, c.company_name,
                    cu.id AS co_user_id, cu.name AS co_name, cu.email AS co_email, cu.phone AS co_phone,
                    au.id AS cand_user_id, au.name AS cand_name, au.email AS cand_email, au.phone AS cand_phone,
                    ex.id AS ex_id, ex.name AS ex_name, ex.email AS ex_email, ex.phone AS ex_phone
             FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies c ON c.id = jp.company_id
             JOIN users cu ON cu.id = c.user_id
             JOIN candidates cd ON cd.id = a.candidate_id
             JOIN users au ON au.id = cd.user_id
             LEFT JOIN users ex ON ex.id = c.assigned_executive_id AND ex.deleted_at IS NULL
             WHERE a.id = ? AND a.deleted_at IS NULL`,
            [applicationId]
        );
        if (!r) return;
        const meta = { application_id: applicationId, job_id: r.job_id };

        // Candidate: confirmation
        if (r.cand_email) {
            mail({
                to: r.cand_email,
                subject: `Application received — ${r.job_title}`,
                html: wrap(`<p>Hi ${esc(r.cand_name || 'there')},</p>
                    <p>We have received your application for <strong>${esc(r.job_title)}</strong> at <strong>${esc(r.company_name)}</strong>.</p>
                    <p>You can track its progress in your <strong>Candidate Portal → Applications</strong>. We will let you know as it moves forward.</p>`),
            });
        }
        wa.notifyApplicationReceivedCand(r.cand_phone, r.cand_name || 'there', r.job_title, r.company_name);

        // Company: new applicant (no candidate name — full details are shown in the portal per activation rules)
        inApp(r.co_user_id, 'new_application', `New application — ${r.job_title}`,
            `A new candidate has applied for ${r.job_title}. Open Job Postings to review.`, meta);
        if (r.co_email) {
            mail({
                to: r.co_email,
                subject: `New application for ${r.job_title}`,
                html: wrap(`<p>Hi ${esc(r.co_name || 'there')},</p>
                    <p>A new candidate has applied for your job posting <strong>${esc(r.job_title)}</strong>.</p>
                    <p>Log in to your <strong>Company Portal → Job Postings</strong> to review the application.</p>`),
            });
        }
        wa.notifyNewApplicantCompany(r.co_phone, r.co_name || 'there', r.job_title);

        // Executive: assigned company got an applicant
        if (r.ex_id) {
            inApp(r.ex_id, 'new_application', `New application — ${r.job_title}`,
                `${r.cand_name || 'A candidate'} applied for ${r.job_title} at ${r.company_name}.`, meta);
            if (r.ex_email) {
                mail({
                    to: r.ex_email,
                    subject: `New application: ${r.job_title} at ${r.company_name}`,
                    html: wrap(`<p>Hi ${esc(r.ex_name || 'there')},</p>
                        <p><strong>${esc(r.cand_name || 'A candidate')}</strong> has applied for <strong>${esc(r.job_title)}</strong> at <strong>${esc(r.company_name)}</strong>, one of your assigned companies.</p>`),
                });
            }
            wa.notifyNewApplicantExec(r.ex_phone, r.ex_name || 'there', r.cand_name || 'A candidate', r.job_title, r.company_name);
        }
    } catch (err) {
        console.error('[notifyApplicationReceived]', err.message);
    }
}

// A payment succeeded. `inv` = invoices row, `amount` = amount of this payment.
async function notifyPaymentReceivedEvent(inv, amount, newStatus) {
    try {
        let payer = null;
        if (inv.company_id) {
            [[payer]] = await db.query(
                `SELECT u.id, u.name, u.email, u.phone, c.company_name AS label
                 FROM companies c JOIN users u ON u.id = c.user_id WHERE c.id = ? AND c.deleted_at IS NULL`, [inv.company_id]);
        } else if (inv.candidate_id) {
            [[payer]] = await db.query(
                `SELECT u.id, u.name, u.email, u.phone, u.name AS label
                 FROM candidates cd JOIN users u ON u.id = cd.user_id WHERE cd.id = ? AND cd.deleted_at IS NULL`, [inv.candidate_id]);
        }
        const amt = fmtINR(amount);
        const statusText = String(newStatus || '').replace('_', ' ');

        if (payer) {
            if (payer.email) {
                mail({
                    to: payer.email,
                    subject: `Payment received — ${inv.invoice_number}`,
                    html: wrap(`<p>Hi ${esc(payer.name || 'there')},</p>
                        <p>We have received your payment of <strong>${esc(amt)}</strong> for invoice <strong>${esc(inv.invoice_number)}</strong>. The invoice is now <strong>${esc(statusText)}</strong>.</p>
                        <p>Thank you!</p>`),
                });
            }
            inApp(payer.id, 'payment_received', `Payment received — ${inv.invoice_number}`,
                `We received your payment of ${amt} for invoice ${inv.invoice_number}.`, { invoice_id: inv.id });
            wa.notifyPaymentReceived(payer.phone, payer.name || 'there', amt, inv.invoice_number);
        }

        const [admins] = await db.query(
            `SELECT u.name, u.email, u.phone FROM users u JOIN roles ro ON ro.id = u.role_id
             WHERE ro.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL`
        );
        const who = payer?.label || payer?.name || 'A customer';
        for (const a of admins) {
            if (a.email) {
                mail({
                    to: a.email,
                    subject: `Payment received — ${inv.invoice_number} (${amt})`,
                    html: wrap(`<p>Hi ${esc(a.name || 'there')},</p>
                        <p><strong>${esc(who)}</strong> paid <strong>${esc(amt)}</strong> for invoice <strong>${esc(inv.invoice_number)}</strong> (${esc(inv.invoice_type || 'invoice')}). The invoice is now <strong>${esc(statusText)}</strong>.</p>`),
                });
            }
            wa.notifyPaymentAdmin(a.phone, who, amt, inv.invoice_number);
        }
    } catch (err) {
        console.error('[notifyPaymentReceived]', err.message);
    }
}

module.exports = { notifyApplicationReceived, notifyPaymentReceivedEvent };

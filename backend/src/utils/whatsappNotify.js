/**
 * WhatsApp transactional notifications via Vaartabot.
 * All functions are fire-and-forget — they never throw or reject.
 *
 * Templates must be APPROVED by Meta before messages go through.
 * Run scripts/createWATemplates.js once to submit them, then sync
 * via Admin → Platform Settings → WhatsApp Webhook after approval.
 */

const axios = require('axios');
const db    = require('../config/db');

const VB_BASE = 'https://vaartabot.com/api/v1';

// Normalise phone to E.164 digits (no +). Returns null if invalid.
function toE164(raw) {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    if (digits.length >= 10) return digits;
    return null;
}

/**
 * Send a single WhatsApp template notification.
 * Silently skips if: no phone, template not approved, or API key missing.
 *
 * @param {string|null} phone   Raw phone number
 * @param {string}      name    Template name (must match whatsapp_templates.template_name)
 * @param {string[]}    vars    Positional variable values for {{1}}, {{2}} …
 */
async function sendWANotification(phone, name, vars = []) {
    try {
        const apiKey = process.env.VAARTABOT_API_KEY;
        if (!apiKey) return;

        const to = toE164(phone);
        if (!to) return;

        // Only send if template is marked approved in our DB
        const [[tpl]] = await db.query(
            `SELECT template_name FROM whatsapp_templates
             WHERE template_name = ? AND is_active = 1 AND deleted_at IS NULL`,
            [name]
        );
        if (!tpl) return; // not approved yet — skip silently

        await axios.post(
            `${VB_BASE}/messages/bulk-send`,
            {
                templateName: name,
                recipients: [{ to, ...(vars.length > 0 && { variables: vars }) }],
            },
            { headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }, timeout: 8000 }
        );
    } catch (err) {
        console.warn(`[whatsappNotify] ${name} to ${phone}: ${err.message}`);
    }
}

// ── Named helpers (one per notification event) ────────────────────────────────

/** Company: account approved by admin */
exports.notifyCompanyApproved = (phone, companyName) =>
    sendWANotification(phone, 'ladderstep_company_approved', [companyName]);

/** Company: interview request approved, slot created */
exports.notifyInterviewRequestApproved = (phone, candidateName, jobTitle, slotTime) =>
    sendWANotification(phone, 'ladderstep_interview_req_approved', [candidateName, jobTitle, slotTime]);

/** Company: interview request rejected */
exports.notifyInterviewRequestRejected = (phone, candidateName, jobTitle) =>
    sendWANotification(phone, 'ladderstep_interview_req_rejected', [candidateName, jobTitle]);

/** Company: offer request approved */
exports.notifyOfferRequestApproved = (phone, candidateName, jobTitle) =>
    sendWANotification(phone, 'ladderstep_offer_approved_co', [candidateName, jobTitle]);

/** Company: offer request rejected */
exports.notifyOfferRequestRejected = (phone, candidateName, jobTitle) =>
    sendWANotification(phone, 'ladderstep_offer_rejected_co', [candidateName, jobTitle]);

/** Company: candidate confirmed interview */
exports.notifyInterviewConfirmedCo = (phone, candidateName, jobTitle, slotTime) =>
    sendWANotification(phone, 'ladderstep_interview_confirmed_co', [candidateName, jobTitle, slotTime]);

/** Candidate: interview slot scheduled */
exports.notifyInterviewScheduledCand = (phone, candidateName, jobTitle, companyName, slotTime, mode) =>
    sendWANotification(phone, 'ladderstep_interview_scheduled_cand', [candidateName, jobTitle, companyName, slotTime, mode]);

/** Candidate: interview cancelled */
exports.notifyInterviewCancelledCand = (phone, candidateName, jobTitle, companyName) =>
    sendWANotification(phone, 'ladderstep_interview_cancelled', [candidateName, jobTitle, companyName]);

/** Candidate: shortlisted for a job */
exports.notifyShortlistedCand = (phone, candidateName, jobTitle, companyName) =>
    sendWANotification(phone, 'ladderstep_shortlisted_cand', [candidateName, jobTitle, companyName]);

/** Candidate: offer received */
exports.notifyOfferReceivedCand = (phone, candidateName, companyName, jobTitle) =>
    sendWANotification(phone, 'ladderstep_offer_received_cand', [candidateName, companyName, jobTitle]);

/** Candidate: offer letter ready to download */
exports.notifyOfferLetterReadyCand = (phone, candidateName, jobTitle, companyName) =>
    sendWANotification(phone, 'ladderstep_offer_letter_ready', [candidateName, jobTitle, companyName]);

/** Candidate: application status updated */
exports.notifyAppStatusCand = (phone, candidateName, jobTitle, companyName, status) =>
    sendWANotification(phone, 'ladderstep_app_status_update', [candidateName, jobTitle, companyName, status]);

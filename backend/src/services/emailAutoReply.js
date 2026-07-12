/**
 * Email Auto-Reply Service
 * Called from mailPoller.js after saving each inbound email reply.
 * Checks active email_auto_reply_flows and sends a matching auto-reply.
 */

const db = require('../config/db');
const { getTransporter, getDefaultFrom } = require('../utils/outreachEmail');

// ── Helpers ──────────────────────────────────────────────────────────────────

function matchesKeywords(text, keywords, matchType) {
    const haystack = text.toLowerCase();
    const kws = (Array.isArray(keywords) ? keywords : JSON.parse(keywords || '[]'))
        .map(k => k.toLowerCase().trim())
        .filter(Boolean);
    if (!kws.length) return false;

    return kws.some(kw => {
        if (matchType === 'exact')       return haystack === kw;
        if (matchType === 'starts_with') return haystack.startsWith(kw);
        return haystack.includes(kw); // contains (default)
    });
}

async function hasEmailedBefore(fromEmail) {
    const [[row]] = await db.query(
        `SELECT id FROM outreach_campaign_logs ocl
         JOIN outreach_contacts c ON c.id = ocl.contact_id
         WHERE c.email = ? AND ocl.channel = 'email' LIMIT 1`,
        [fromEmail]
    );
    return !!row;
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * @param {object} reply  — the just-inserted outreach_email_replies row fields:
 *   { id, from_email, from_name, subject, body_text, campaign_id, message_id }
 */
async function fireEmailAutoReply(reply) {
    try {
        const [flows] = await db.query(
            `SELECT * FROM email_auto_reply_flows
             WHERE is_active = 1 AND deleted_at IS NULL
             ORDER BY id ASC`
        );
        if (!flows.length) return;

        const combinedText = `${reply.subject || ''} ${reply.body_text || ''}`.toLowerCase();
        const firstContact = !(await hasEmailedBefore(reply.from_email));

        let matchedFlow = null;
        for (const flow of flows) {
            if (flow.trigger_type === 'first_contact') {
                if (firstContact) { matchedFlow = flow; break; }
            } else if (flow.trigger_type === 'any') {
                matchedFlow = flow; break;
            } else if (flow.trigger_type === 'keyword') {
                const keywords = Array.isArray(flow.trigger_keywords)
                    ? flow.trigger_keywords
                    : JSON.parse(flow.trigger_keywords || '[]');
                if (matchesKeywords(combinedText, keywords, flow.match_type)) {
                    matchedFlow = flow; break;
                }
            }
        }

        if (!matchedFlow) return;

        const fromEmail = getDefaultFrom();
        const fromName  = 'LadderStep Human Consulting';
        const replySubject = matchedFlow.response_subject
            || `Re: ${reply.subject || 'Your enquiry'}`;

        const transporter = getTransporter();
        await transporter.sendMail({
            from:      `"${fromName}" <${fromEmail}>`,
            to:        reply.from_email,
            subject:   replySubject,
            text:      matchedFlow.response_body,
            html:      matchedFlow.response_body.replace(/\n/g, '<br>'),
            inReplyTo: reply.message_id || undefined,
            references: reply.message_id ? [reply.message_id] : undefined,
        });

        await db.query(
            'UPDATE outreach_email_replies SET auto_reply_sent = 1 WHERE id = ?',
            [reply.id]
        );

        console.log(`[emailAutoReply] Sent flow "${matchedFlow.flow_name}" to ${reply.from_email}`);
    } catch (err) {
        console.error('[emailAutoReply] Error:', err.message);
    }
}

module.exports = { fireEmailAutoReply };

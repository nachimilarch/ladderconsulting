/**
 * Email Auto-Reply Service
 * Called from mailPoller.js after saving each inbound email reply.
 * Checks active email_auto_reply_flows and sends a matching auto-reply.
 */

const db = require('../config/db');
const { getTransporter, getDefaultFrom } = require('../utils/outreachEmail');

const AUTO_REPLY_COOLDOWN_HOURS = 24;

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
        `SELECT ocl.id FROM outreach_campaign_logs ocl
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
const SKIP_ADDR = /^(microsoftexchange[0-9a-f]*|postmaster|mailer-daemon|noreply|no-reply|bounce|delivery|auto-?reply|donotreply|do-not-reply|daemon)[@+]/i;

async function fireEmailAutoReply(reply) {
    try {
        // Never auto-reply to system/bounce addresses
        if (!reply.from_email || SKIP_ADDR.test(reply.from_email)) return;
        if (reply.suppress) return; // bulk/list mail, or the sender asked not to be auto-answered

        // Never answer our own mailbox or anyone on our own domain: an auto-reply that lands
        // back in this inbox would be answered again, and again, every poll (a mail loop).
        const ownUser = String(getDefaultFrom() || '').toLowerCase();
        const ownDomain = ownUser.includes('@') ? ownUser.split('@')[1] : '';
        const sender = reply.from_email.toLowerCase();
        if (sender === ownUser || (ownDomain && sender.endsWith(`@${ownDomain}`))) return;

        // Last line of defence against any loop we have not thought of: at most one
        // auto-reply per sender per day.
        const [[recent]] = await db.query(
            `SELECT id FROM outreach_email_replies
             WHERE from_email = ? AND auto_reply_sent = 1 AND id <> ?
               AND created_at > DATE_SUB(NOW(), INTERVAL ${AUTO_REPLY_COOLDOWN_HOURS} HOUR) LIMIT 1`,
            [reply.from_email, reply.id]
        );
        if (recent) return;

        // Skip if we already sent an auto-reply for this inbound message
        const [[alreadySent]] = await db.query(
            'SELECT auto_reply_sent FROM outreach_email_replies WHERE id = ? AND auto_reply_sent = 1 LIMIT 1',
            [reply.id]
        );
        if (alreadySent) return;

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
            // Tell other mail systems (and our own poller) this is automatic: do not answer it.
            headers: {
                'Auto-Submitted': 'auto-replied',
                'X-Auto-Response-Suppress': 'All',
                Precedence: 'auto_reply',
            },
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

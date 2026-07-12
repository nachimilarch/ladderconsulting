/**
 * Mail Poller Service — polls the Microsoft 365 inbox via Graph API every
 * N minutes, identifies replies to outreach campaigns, and stores them as
 * outreach_email_replies records.
 *
 * Replaces the old IMAP-based poller. Requires:
 *   MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
 *   Mail.Read + Mail.Send application permissions granted in Azure AD.
 *
 * Started once from server.js: startMailPoller()
 * Never throws unhandled exceptions — all errors are caught and logged.
 */

const axios = require('axios');
const db    = require('../config/db');
const { getGraphToken }        = require('../utils/graphMail');
const { parseReplyToTag }      = require('../utils/outreachEmail');
const { createLeadFromContact } = require('./leadConverter');
const { fireEmailAutoReply }    = require('./emailAutoReply');

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let pollingActive = false;
let pollTimer     = null;
let lastPolledAt  = null;

// ── Notification helper ───────────────────────────────────────────────────────
const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) {
        console.error('[mailPoller:notify]', err.message);
    }
};

// ── Find admin user for unmatched emails ──────────────────────────────────────
const getAdminUserId = async () => {
    const [[row]] = await db.query(
        "SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1"
    );
    return row?.id ?? null;
};

// ── Process one parsed email ──────────────────────────────────────────────────
// (Identical logic to the former IMAP poller — only the data source changed.)
const processMail = async (parsed) => {
    const fromAddr  = parsed.from?.value?.[0]?.address || '';
    const fromName  = parsed.from?.value?.[0]?.name    || '';
    const subject   = parsed.subject || '';
    const bodyText  = parsed.text    || '';
    const bodyHtml  = parsed.html    || '';
    const messageId = parsed.messageId || null;
    const inReplyTo = parsed.inReplyTo || null;
    const receivedAt = parsed.date ? new Date(parsed.date) : new Date();

    // Deduplicate by message_id
    if (messageId) {
        const [[dup]] = await db.query(
            'SELECT id FROM outreach_email_replies WHERE message_id = ? LIMIT 1', [messageId]
        );
        if (dup) return;
    }

    let campaignId  = null;
    let executiveId = null;
    let contactId   = null;
    let logId       = null;

    // Strategy 1: Parse tagged Reply-To / To address
    const allAddresses = [
        ...(parsed.to?.value  || []),
        ...(parsed.cc?.value  || []),
    ].map(a => a.address);

    for (const addr of allAddresses) {
        const tag = parseReplyToTag(addr);
        if (tag) {
            campaignId  = tag.campaignId;
            executiveId = tag.executiveId;
            break;
        }
    }

    // Strategy 2: Match via In-Reply-To against campaign_logs.email_message_id
    if (!campaignId && inReplyTo) {
        const [[logRow]] = await db.query(
            `SELECT ocl.id, ocl.campaign_id, ocl.contact_id, oc.created_by
             FROM outreach_campaign_logs ocl
             JOIN outreach_campaigns oc ON oc.id = ocl.campaign_id
             WHERE ocl.email_message_id = ? LIMIT 1`,
            [inReplyTo]
        );
        if (logRow) {
            campaignId  = logRow.campaign_id;
            executiveId = logRow.created_by;
            contactId   = logRow.contact_id;
            logId       = logRow.id;
        }
    }

    // Strategy 3: Match via sender email against campaign contacts
    if (!campaignId && fromAddr) {
        const [[logRow]] = await db.query(
            `SELECT ocl.id, ocl.campaign_id, ocl.contact_id, oc.created_by
             FROM outreach_campaign_logs ocl
             JOIN outreach_campaigns oc ON oc.id = ocl.campaign_id
             JOIN outreach_contacts ct ON ct.id = ocl.contact_id
             WHERE ct.email = ? AND ocl.status = 'sent'
             ORDER BY ocl.sent_at DESC LIMIT 1`,
            [fromAddr]
        );
        if (logRow) {
            campaignId  = logRow.campaign_id;
            executiveId = logRow.created_by;
            contactId   = logRow.contact_id;
            logId       = logRow.id;
        }
    }

    // Resolve campaign contact if not yet found
    if (campaignId && !contactId && fromAddr) {
        const [[logRow]] = await db.query(
            `SELECT ocl.id, ocl.contact_id
             FROM outreach_campaign_logs ocl
             JOIN outreach_contacts ct ON ct.id = ocl.contact_id
             WHERE ocl.campaign_id = ? AND ct.email = ? LIMIT 1`,
            [campaignId, fromAddr]
        );
        if (logRow) {
            contactId = logRow.contact_id;
            logId     = logRow.id;
        }
    }

    const assignedTo = executiveId || (await getAdminUserId());

    const [insertResult] = await db.query(
        `INSERT INTO outreach_email_replies
           (campaign_id, campaign_log_id, contact_id, assigned_to, channel,
            from_email, from_name, subject, body_text, body_html,
            received_at, in_reply_to, message_id, reply_status)
         VALUES (?, ?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, 'unread')`,
        [
            campaignId || null, logId || null, contactId || null, assignedTo,
            fromAddr, fromName, subject, bodyText, bodyHtml,
            receivedAt, inReplyTo, messageId,
        ]
    );
    const replyId = insertResult.insertId;

    if (campaignId) {
        if (logId) {
            await db.query(
                "UPDATE outreach_campaign_logs SET status = 'replied', replied_at = NOW() WHERE id = ?",
                [logId]
            );
        }
        await db.query(
            'UPDATE outreach_campaigns SET reply_count = reply_count + 1 WHERE id = ?',
            [campaignId]
        );

        if (contactId && assignedTo) {
            try {
                await createLeadFromContact({
                    contactId, source: 'cold_email', campaignId,
                    executiveUserId: assignedTo, replyId,
                });
            } catch (e) {
                console.error('[mailPoller:createLead]', e.message);
            }
        }

        if (assignedTo) {
            const [[campaign]] = await db.query(
                'SELECT campaign_name FROM outreach_campaigns WHERE id = ? LIMIT 1', [campaignId]
            );
            await notify(
                assignedTo, 'outreach_reply', 'New Reply Received',
                `New reply from ${fromName || fromAddr} to campaign "${campaign?.campaign_name || 'unknown'}".`,
                { reply_id: replyId, campaign_id: campaignId }
            );
        }
    } else {
        const adminId = await getAdminUserId();
        if (adminId) {
            await notify(
                adminId, 'outreach_unmatched', 'Unmatched Email Received',
                `Email from ${fromAddr} could not be matched to any campaign. Manual review needed.`,
                { reply_id: replyId }
            );
        }
    }

    // Fire email auto-reply (non-blocking — errors are caught inside)
    fireEmailAutoReply({
        id: replyId, from_email: fromAddr, from_name: fromName,
        subject, body_text: bodyText, campaign_id: campaignId, message_id: messageId,
    }).catch(e => console.error('[mailPoller:autoReply]', e.message));
};

// Token is managed by graphMail.js (shared with email sending)

// Strip HTML tags to produce plain text
const htmlToText = (html) => {
    if (!html) return '';
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const getHeader = (headers, name) =>
    headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || null;

// Transform a Graph API message into the shape processMail() expects
const graphToMailParsed = (msg) => {
    const headers  = msg.internetMessageHeaders || [];
    const bodyHtml = msg.body?.contentType === 'html' ? msg.body.content : null;
    const bodyText = msg.body?.contentType === 'text'
        ? msg.body.content
        : htmlToText(bodyHtml);

    return {
        from: {
            value: [{
                address: msg.from?.emailAddress?.address || '',
                name:    msg.from?.emailAddress?.name    || '',
            }],
        },
        to:  { value: (msg.toRecipients  || []).map(r => ({ address: r.emailAddress.address })) },
        cc:  { value: (msg.ccRecipients  || []).map(r => ({ address: r.emailAddress.address })) },
        subject:   msg.subject || '',
        text:      bodyText,
        html:      bodyHtml || bodyText,
        messageId: getHeader(headers, 'message-id'),
        inReplyTo: getHeader(headers, 'in-reply-to'),
        date:      msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date(),
    };
};

// ── One poll cycle via Graph API ──────────────────────────────────────────────
const runPollCycle = async () => {
    const tenantId     = process.env.MICROSOFT_TENANT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!tenantId || !clientSecret) {
        return;
    }

    const userEmail = process.env.GODADDY_IMAP_USER || process.env.SMTP_USER;
    if (!userEmail) {
        console.log('[mailPoller] No mailbox email configured — skipping poll.');
        return;
    }

    try {
        const [[setting]] = await db.query(
            "SELECT value FROM platform_settings WHERE setting_key = 'mail_poller_enabled'"
        );
        if (setting?.value === 'false') {
            console.log('[mailPoller] Polling disabled via platform_settings.');
            return;
        }
    } catch { /* table not ready yet — proceed */ }

    try {
        const token = await getGraphToken();
        const { data } = await axios.get(
            `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/mailFolders/inbox/messages`,
            {
                params: {
                    '$filter': 'isRead eq false',
                    '$select': 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,internetMessageHeaders',
                    '$top':    50,
                },
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        const messages = data.value || [];
        console.log(`[mailPoller] Found ${messages.length} unread message(s) via Graph API.`);

        for (const msg of messages) {
            try {
                await processMail(graphToMailParsed(msg));
                // Mark as read so we don't re-process it
                await axios.patch(
                    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/messages/${msg.id}`,
                    { isRead: true },
                    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
                );
            } catch (err) {
                console.error('[mailPoller] Error processing message:', err.message);
            }
        }

        lastPolledAt = new Date();
    } catch (err) {
        const errData = err.response?.data?.error;
        const detail  = errData?.message || err.message;
        const code    = errData?.code    || err.response?.status || '';
        console.error(`[mailPoller] Graph API error [${code}]:`, detail);
    }
};

// ── Public API ────────────────────────────────────────────────────────────────
const startMailPoller = () => {
    if (pollingActive) return;

    const tenantId     = process.env.MICROSOFT_TENANT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!tenantId || !clientSecret) {
        console.log('[mailPoller] MICROSOFT_TENANT_ID / MICROSOFT_CLIENT_SECRET not set — mail polling disabled.');
        return;
    }

    pollingActive = true;
    console.log('[mailPoller] Mail poller started — interval: 2 min');

    setTimeout(async () => {
        await runPollCycle().catch(e => console.error('[mailPoller] Initial cycle error:', e.message));
    }, 10000);

    pollTimer = setInterval(async () => {
        await runPollCycle().catch(e => console.error('[mailPoller] Cycle error:', e.message));
    }, POLL_INTERVAL_MS);
};

const stopMailPoller = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollingActive = false;
};

module.exports = { startMailPoller, stopMailPoller };

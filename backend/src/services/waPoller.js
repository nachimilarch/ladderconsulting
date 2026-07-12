/**
 * WhatsApp Inbox Poller — polls GET /messages/inbox from Vaartabot every
 * N minutes, saves new inbound messages as outreach_email_replies records.
 *
 * Runs alongside mailPoller. Handles cases where webhook is not registered
 * or delivery fails. Deduplicates by message_id.
 *
 * Started once from server.js: startWAPoller()
 */

const axios  = require('axios');
const db     = require('../config/db');
const { createLeadFromContact } = require('./leadConverter');

const POLL_INTERVAL_MS = 2 * 60 * 1000;
const VB_BASE = 'https://vaartabot.com/api/v1';

const vbHeaders = () => ({
    'X-API-Key':    process.env.VAARTABOT_API_KEY,
    'Content-Type': 'application/json',
});

const notify = async (userId, type, title, body, metadata = null) => {
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (e) { /* fire-and-forget */ }
};

const toDigits = (phone) => (phone || '').replace(/\D/g, '');

async function getAdminUserId() {
    const [[row]] = await db.query(
        `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'admin' AND u.deleted_at IS NULL LIMIT 1`
    );
    return row?.id || null;
}

async function processInboundMessage(msg) {
    const fromPhone   = String(msg.from || msg.phone || '');
    const waMessageId = String(msg.message_id || msg.messageId || msg.id || '');
    // Coerce to plain string — the API might return a nested object for rich messages
    const rawText    = msg.text || msg.body || msg.message || '';
    const bodyText   = typeof rawText === 'object' ? JSON.stringify(rawText) : String(rawText || '');
    const tsRaw      = msg.received_at || msg.timestamp || msg.created_at;
    const receivedAt = tsRaw ? new Date(tsRaw) : new Date();
    const safeDate   = isNaN(receivedAt.getTime()) ? new Date() : receivedAt;

    if (!fromPhone) return;

    // Deduplicate by message_id
    if (waMessageId) {
        const [[exists]] = await db.query(
            'SELECT id FROM outreach_email_replies WHERE message_id = ? AND deleted_at IS NULL LIMIT 1',
            [waMessageId]
        );
        if (exists) return; // already processed
    }

    const digitsPhone = toDigits(fromPhone);

    // Find most recent sent campaign log for this phone number
    const [[logRow]] = await db.query(
        `SELECT ocl.id, ocl.campaign_id, ocl.contact_id, oc.created_by
         FROM outreach_campaign_logs ocl
         JOIN outreach_campaigns oc ON oc.id = ocl.campaign_id
         JOIN outreach_contacts ct  ON ct.id = ocl.contact_id
         WHERE (REPLACE(ct.whatsapp_number,'+','') = ? OR REPLACE(ct.phone,'+','') = ?)
           AND ocl.channel = 'whatsapp' AND ocl.status = 'sent'
         ORDER BY ocl.sent_at DESC LIMIT 1`,
        [digitsPhone, digitsPhone]
    );

    const campaignId  = logRow?.campaign_id || null;
    const contactId   = logRow?.contact_id  || null;
    const executiveId = logRow?.created_by  || null;
    const logId       = logRow?.id          || null;
    const assignedTo  = executiveId || (await getAdminUserId());

    // Insert reply
    const [result] = await db.query(
        `INSERT INTO outreach_email_replies
           (campaign_id, campaign_log_id, contact_id, assigned_to, channel,
            from_phone, body_text, received_at, message_id, reply_status)
         VALUES (?, ?, ?, ?, 'whatsapp', ?, ?, ?, ?, 'unread')`,
        [
            campaignId  || null,
            logId       || null,
            contactId   || null,
            assignedTo  || null,
            fromPhone,
            bodyText,
            safeDate,
            waMessageId || null,
        ]
    );
    const replyId = result.insertId;

    if (logId) {
        await db.query(
            "UPDATE outreach_campaign_logs SET status='replied', replied_at=NOW(), whatsapp_message_id=? WHERE id=?",
            [waMessageId, logId]
        );
    }
    if (campaignId) {
        await db.query('UPDATE outreach_campaigns SET reply_count = reply_count + 1 WHERE id = ?', [campaignId]);
    }

    if (contactId && assignedTo) {
        await createLeadFromContact({
            contactId, source: 'whatsapp', campaignId,
            executiveUserId: assignedTo, replyId,
        }).catch(e => console.error('[waPoller:createLead]', e.message));
    }

    if (assignedTo) {
        const [[campaign]] = await db.query(
            'SELECT campaign_name FROM outreach_campaigns WHERE id = ? LIMIT 1', [campaignId]
        ).catch(() => [[null]]);
        await notify(
            assignedTo, 'whatsapp_reply', 'New WhatsApp Reply',
            `New WhatsApp reply from ${fromPhone}${campaign?.campaign_name ? ` re: "${campaign.campaign_name}"` : ''}.`,
            { reply_id: replyId, campaign_id: campaignId }
        );
    }

    console.log(`[waPoller] Saved reply from ${fromPhone} (msgId: ${waMessageId})`);
}

async function runPollCycle() {
    const apiKey = process.env.VAARTABOT_API_KEY;
    if (!apiKey) return;
    // Vaartabot message log/inbox endpoints currently return server errors.
    // Rely on webhook delivery instead; this poller is a no-op until fixed upstream.
    return;

    try {
        // /messages/inbox has a server-side bug on Vaartabot; use /messages/logs instead
        // and filter to inbound only (type = 'inbound' or direction = 'received')
        const response = await axios.get(`${VB_BASE}/messages/logs`, { headers: vbHeaders() });
        const raw = response.data;
        const allMessages = Array.isArray(raw?.data) ? raw.data
            : Array.isArray(raw?.messages) ? raw.messages
            : Array.isArray(raw?.logs) ? raw.logs
            : Array.isArray(raw) ? raw : [];
        // Only process inbound/received messages
        const messages = allMessages.filter(m =>
            m.direction === 'inbound' || m.direction === 'received' ||
            m.type === 'inbound' || m.type === 'received' ||
            m.from !== undefined   // heuristic: outbound messages usually have 'to', inbound have 'from'
        );

        if (!Array.isArray(messages) || messages.length === 0) return;

        for (const msg of messages) {
            await processInboundMessage(msg).catch(e =>
                console.error('[waPoller] Error processing message:', e.message)
            );
        }
    } catch (err) {
        console.error('[waPoller]', err.response?.data?.error || err.message);
    }
}

let pollTimer = null;

function startWAPoller() {
    if (pollTimer) return;
    console.log('[waPoller] Starting WhatsApp inbox poller (interval: 2 min)');
    // Run immediately on start, then on interval
    runPollCycle();
    pollTimer = setInterval(runPollCycle, POLL_INTERVAL_MS);
}

function stopWAPoller() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

module.exports = { startWAPoller, stopWAPoller };

/**
 * Mail Poller Service — polls the GoDaddy IMAP inbox every N minutes,
 * identifies replies to outreach campaigns, and stores them as
 * outreach_email_replies records.
 *
 * Started once from server.js: startMailPoller()
 * Never throws unhandled exceptions — all errors are caught and logged.
 */

const Imap        = require('imap-simple');
const { simpleParser } = require('mailparser');
const db          = require('../config/db');
const { parseReplyToTag } = require('../utils/outreachEmail');
const { createLeadFromContact } = require('./leadConverter');

const POLL_INTERVAL_MS = 2 * 60 * 1000; // default 2 minutes

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

// ── Find admin user to assign unmatched emails ────────────────────────────────
const getAdminUserId = async () => {
    const [[row]] = await db.query(
        "SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1"
    );
    return row?.id ?? null;
};

// ── Process one parsed email ──────────────────────────────────────────────────
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
        if (dup) return; // already processed
    }

    // --- Try to identify campaign ---
    let campaignId   = null;
    let executiveId  = null;
    let contactId    = null;
    let logId        = null;

    // Strategy 1: Parse tagged Reply-To / To address
    const allAddresses = [
        ...(parsed.to?.value || []),
        ...(parsed.cc?.value || []),
    ].map(a => a.address);

    for (const addr of allAddresses) {
        const tag = parseReplyToTag(addr);
        if (tag) {
            campaignId  = tag.campaignId;
            executiveId = tag.executiveId;
            break;
        }
    }

    // Strategy 2: Match via In-Reply-To header against campaign_logs.email_message_id
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

    // Strategy 3: Match via from_email against contacts in the campaign
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

    // Resolve assigned_to user_id
    let assignedTo = null;
    if (executiveId) {
        assignedTo = executiveId;
    } else {
        assignedTo = await getAdminUserId();
    }

    // Insert reply record
    const [insertResult] = await db.query(
        `INSERT INTO outreach_email_replies
           (campaign_id, campaign_log_id, contact_id, assigned_to, channel,
            from_email, from_name, subject, body_text, body_html,
            received_at, in_reply_to, message_id, reply_status)
         VALUES (?, ?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, 'unread')`,
        [
            campaignId  || null,
            logId       || null,
            contactId   || null,
            assignedTo,
            fromAddr, fromName, subject, bodyText, bodyHtml,
            receivedAt, inReplyTo, messageId,
        ]
    );
    const replyId = insertResult.insertId;

    if (campaignId) {
        // Update campaign log
        if (logId) {
            await db.query(
                "UPDATE outreach_campaign_logs SET status = 'replied', replied_at = NOW() WHERE id = ?",
                [logId]
            );
        }
        // Increment campaign reply count
        await db.query(
            'UPDATE outreach_campaigns SET reply_count = reply_count + 1 WHERE id = ?',
            [campaignId]
        );

        // Auto-create lead from reply
        if (contactId && assignedTo) {
            try {
                await createLeadFromContact({
                    contactId,
                    source: 'cold_email',
                    campaignId,
                    executiveUserId: assignedTo,
                    replyId,
                });
            } catch (e) {
                console.error('[mailPoller:createLead]', e.message);
            }
        }

        // Notify assigned executive
        if (assignedTo) {
            const [[campaign]] = await db.query(
                'SELECT campaign_name FROM outreach_campaigns WHERE id = ? LIMIT 1', [campaignId]
            );
            await notify(
                assignedTo,
                'outreach_reply',
                'New Reply Received',
                `New reply from ${fromName || fromAddr} to campaign "${campaign?.campaign_name || 'unknown'}".`,
                { reply_id: replyId, campaign_id: campaignId }
            );
        }
    } else {
        // Unmatched — notify admin
        const adminId = await getAdminUserId();
        if (adminId) {
            await notify(
                adminId,
                'outreach_unmatched',
                'Unmatched Email Received',
                `Email from ${fromAddr} could not be matched to any campaign. Manual review needed.`,
                { reply_id: replyId }
            );
        }
    }
};

// ── One poll cycle ────────────────────────────────────────────────────────────
const runPollCycle = async () => {
    if (!process.env.GODADDY_IMAP_HOST && !process.env.SMTP_HOST) {
        console.log('[mailPoller] IMAP host not configured, skipping poll.');
        return;
    }

    // Check if poller is enabled in platform_settings
    try {
        const [[setting]] = await db.query(
            "SELECT value FROM platform_settings WHERE setting_key = 'mail_poller_enabled'"
        );
        if (setting?.value === 'false') {
            console.log('[mailPoller] Polling disabled via platform_settings.');
            return;
        }
    } catch { /* ignore — proceed if table not ready */ }

    const imapConfig = {
        imap: {
            host:     process.env.GODADDY_IMAP_HOST || 'imap.secureserver.net',
            port:     parseInt(process.env.GODADDY_IMAP_PORT || '993'),
            tls:      (process.env.GODADDY_IMAP_SECURE || 'true') === 'true',
            user:     process.env.GODADDY_IMAP_USER || process.env.SMTP_USER || '',
            password: process.env.GODADDY_IMAP_PASS || process.env.SMTP_PASS || '',
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 15000,
        },
    };

    let connection;
    try {
        connection = await Imap.connect(imapConfig);
        await connection.openBox('INBOX');

        // Search for UNSEEN messages
        const searchCriteria = ['UNSEEN'];
        const fetchOptions   = { bodies: ['HEADER', 'TEXT', ''], markSeen: false };

        const messages = await connection.search(searchCriteria, fetchOptions);
        console.log(`[mailPoller] Found ${messages.length} unseen messages.`);

        for (const msg of messages) {
            try {
                const allParts = msg.parts || [];
                // Use the full raw body (part '')
                const rawPart  = allParts.find(p => p.which === '') || allParts[0];
                if (!rawPart) continue;
                const parsed = await simpleParser(rawPart.body);
                await processMail(parsed);
                // Mark as read
                await connection.addFlags(msg.attributes.uid, ['\\Seen']);
            } catch (err) {
                console.error('[mailPoller] Error processing message:', err.message);
            }
        }

        lastPolledAt = new Date();
    } catch (err) {
        console.error('[mailPoller] IMAP error:', err.message);
    } finally {
        if (connection) {
            try { connection.end(); } catch { /* ignore */ }
        }
    }
};

// ── Public API ────────────────────────────────────────────────────────────────
const startMailPoller = () => {
    if (pollingActive) return;
    pollingActive = true;
    console.log('[mailPoller] Mail poller started — interval: 2 min');

    // Initial run after 10s delay (let DB stabilise on startup)
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

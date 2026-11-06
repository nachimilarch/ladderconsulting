const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');
const { getTransporter, getDefaultFrom, getDomain, replaceMergeTags, buildReplyToAddress } = require('../utils/outreachEmail');
const { logAction } = require('../utils/auditLog');
const { checkUploadedFile, classifyCampaignUpload, copyStoredFile, safeUnlink, linkBlockHtml } = require('../utils/attachments');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || null;

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) {
        console.error('[notify]', err.message);
    }
};

// Global map to track which campaigns are currently pausing (prevents new batch sends)
const pausedCampaigns = new Set();

// A schedule arrives as an ISO instant from the browser (or a Date). Stored as UTC.
// Returns { when: Date|null } or { error } for junk.
const parseWhen = (v) => {
    if (v === undefined || v === null || v === '') return { when: null };
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? { error: 'scheduled_at is not a valid date and time.' } : { when: d };
};
const isFuture = (d) => !!d && d.getTime() > Date.now() + 60 * 1000;

// Creates an email campaign for `user` and returns { id } or throws { status, message }.
// A campaign with a future schedule starts as 'scheduled' (the scheduler sends it), else 'draft'.
async function createEmailCampaignRecord(user, body) {
    const { campaign_name, list_id, subject, message_body, from_name, scheduled_at, template_id } = body;
    const fail = (status, message) => Object.assign(new Error(message), { status, userFacing: true });
    if (!campaign_name || !list_id || !subject || !message_body) throw fail(422, 'campaign_name, list_id, subject, message_body required.');
    const parsed = parseWhen(scheduled_at);
    if (parsed.error) throw fail(422, parsed.error);

    // Verify list exists and is accessible
    const [[list]] = await db.query(
        'SELECT id, uploaded_by FROM outreach_contact_lists WHERE id = ? AND deleted_at IS NULL', [list_id]
    );
    if (!list) throw fail(404, 'Contact list not found.');
    if (user.role === 'hr_staff' && list.uploaded_by !== user.id) throw fail(403, 'You do not own this contact list.');

    // Resolve executive's from_email
    const [[emp]] = await db.query(
        'SELECT outreach_email, outreach_email_name FROM employees WHERE user_id = ? AND deleted_at IS NULL',
        [user.id]
    );
    const fromEmail = emp?.outreach_email || getDefaultFrom();
    const resolvedFromName = from_name || emp?.outreach_email_name || process.env.GODADDY_DEFAULT_FROM_NAME || 'LadderStep Human Consulting';

    const [result] = await db.query(
        `INSERT INTO outreach_campaigns
           (created_by, campaign_name, campaign_type, list_id, subject, message_body,
            from_email, from_name, status, scheduled_at)
         VALUES (?, ?, 'email', ?, ?, ?, ?, ?, ?, ?)`,
        [user.id, campaign_name, list_id, subject, message_body,
         fromEmail, resolvedFromName, isFuture(parsed.when) ? 'scheduled' : 'draft', parsed.when]
    );

    // Created from a template: carry its attachments over (own copy of each file).
    if (template_id) {
        try {
            const [tplFiles] = await db.query(
                'SELECT file_name, file_path, mime_type, file_size FROM email_template_attachments WHERE template_id = ? AND deleted_at IS NULL ORDER BY id ASC',
                [template_id]
            );
            for (const f of tplFiles) {
                const dest = copyStoredFile(f.file_path);
                if (!dest) continue;
                await db.query(
                    'INSERT INTO outreach_campaign_attachments (campaign_id, file_name, file_path, mime_type, file_size) VALUES (?, ?, ?, ?, ?)',
                    [result.insertId, f.file_name, dest, f.mime_type, f.file_size]
                );
            }
        } catch (err) {
            console.error('[createEmailCampaignRecord] template attachments:', err.message);
        }
    }
    return { id: result.insertId };
}

// ── POST /outreach/email-campaigns ───────────────────────────────────────────
exports.createEmailCampaign = async (req, res) => {
    try {
        const { id } = await createEmailCampaignRecord(req.user, req.body);
        res.status(201).json({ success: true, message: 'Campaign created.', id });
    } catch (err) {
        if (err.userFacing) return res.status(err.status).json({ success: false, message: err.message });
        console.error('[outreachCampaign.create]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
exports.createEmailCampaignRecord = createEmailCampaignRecord;
exports.parseWhen = parseWhen;
exports.isFuture = isFuture;

// ── GET /outreach/email-campaigns ────────────────────────────────────────────
exports.listEmailCampaigns = async (req, res) => {
    const filters = ["c.campaign_type = 'email'", 'c.deleted_at IS NULL'];
    const params  = [];
    if (req.user.role === 'hr_staff') {
        filters.push('c.created_by = ?');
        params.push(req.user.id);
    }
    try {
        const [rows] = await db.query(
            `SELECT c.*, u.name AS created_by_name, l.list_name
             FROM outreach_campaigns c
             JOIN users u ON u.id = c.created_by
             LEFT JOIN outreach_contact_lists l ON l.id = c.list_id
             WHERE ${filters.join(' AND ')}
             ORDER BY c.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[outreachCampaign.list]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /outreach/email-campaigns/:id ────────────────────────────────────────
exports.getEmailCampaign = async (req, res) => {
    try {
        const [[row]] = await db.query(
            `SELECT c.*, u.name AS created_by_name, l.list_name
             FROM outreach_campaigns c
             JOIN users u ON u.id = c.created_by
             LEFT JOIN outreach_contact_lists l ON l.id = c.list_id
             WHERE c.id = ? AND c.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Campaign not found.' });
        if (req.user.role === 'hr_staff' && row.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        // Fetch summary stats
        const [[stats]] = await db.query(
            `SELECT
               COUNT(*) AS total,
               SUM(status = 'sent') AS sent,
               SUM(status = 'failed') AS failed,
               SUM(status = 'replied') AS replied
             FROM outreach_campaign_logs WHERE campaign_id = ?`,
            [req.params.id]
        );
        res.json({ success: true, data: { ...row, stats } });
    } catch (err) {
        console.error('[outreachCampaign.get]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /outreach/email-campaigns/:id ────────────────────────────────────────
exports.updateEmailCampaign = async (req, res) => {
    const { campaign_name, subject, message_body, from_name, scheduled_at } = req.body;
    try {
        const [[row]] = await db.query(
            "SELECT id, created_by, status FROM outreach_campaigns WHERE id = ? AND deleted_at IS NULL AND campaign_type = 'email'",
            [req.params.id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Campaign not found.' });
        if (row.status !== 'draft' && row.status !== 'scheduled') {
            return res.status(422).json({ success: false, message: 'Only draft or scheduled campaigns can be edited.' });
        }
        if (req.user.role === 'hr_staff' && row.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const fields = [], vals = [];
        if (campaign_name !== undefined) { fields.push('campaign_name = ?'); vals.push(campaign_name); }
        if (subject       !== undefined) { fields.push('subject = ?');       vals.push(subject); }
        if (message_body  !== undefined) { fields.push('message_body = ?');  vals.push(message_body); }
        if (from_name     !== undefined) { fields.push('from_name = ?');     vals.push(from_name); }
        if (scheduled_at  !== undefined) {
            const parsed = parseWhen(scheduled_at);
            if (parsed.error) return res.status(422).json({ success: false, message: parsed.error });
            fields.push('scheduled_at = ?'); vals.push(parsed.when);
            // A future time hands the campaign to the scheduler; clearing it makes it a draft again.
            fields.push('status = ?'); vals.push(isFuture(parsed.when) ? 'scheduled' : 'draft');
        }
        if (!fields.length) return res.status(422).json({ success: false, message: 'Nothing to update.' });

        vals.push(req.params.id);
        await db.query(`UPDATE outreach_campaigns SET ${fields.join(', ')} WHERE id = ?`, vals);
        res.json({ success: true, message: 'Campaign updated.' });
    } catch (err) {
        console.error('[outreachCampaign.update]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /outreach/email-campaigns/:id/send ───────────────────────────────────
exports.sendEmailCampaign = async (req, res) => {
    const campaignId = parseInt(req.params.id);
    try {
        const [[campaign]] = await db.query(
            "SELECT * FROM outreach_campaigns WHERE id = ? AND deleted_at IS NULL AND campaign_type = 'email'",
            [campaignId]
        );
        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });

        if (req.user.role === 'hr_staff' && campaign.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (!['draft','scheduled','paused'].includes(campaign.status)) {
            return res.status(422).json({ success: false, message: `Cannot send a campaign with status '${campaign.status}'.` });
        }

        const { total } = await beginEmailSend(campaign, req.user.id);
        res.json({
            success: true,
            message: `Sending started for ${total} recipients.`,
            total_recipients: total,
        });
    } catch (err) {
        console.error('[outreachCampaign.send]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// Marks the campaign as sending, works out who is left to email and sends in the background.
// Used by the Send button and by the scheduler. Returns { total }.
async function beginEmailSend(campaign, senderUserId) {
    const campaignId = campaign.id;
    await db.query(
        "UPDATE outreach_campaigns SET status = 'sending', sent_at = NOW() WHERE id = ?",
        [campaignId]
    );
    pausedCampaigns.delete(campaignId);

    // Fetch contacts that haven't been sent to yet
    const [contacts] = await db.query(
        `SELECT c.* FROM outreach_contacts c
         LEFT JOIN outreach_campaign_logs cl ON cl.campaign_id = ? AND cl.contact_id = c.id
         WHERE c.list_id = ? AND c.deleted_at IS NULL AND c.is_unsubscribed = 0
           AND c.email IS NOT NULL AND cl.id IS NULL`,
        [campaignId, campaign.list_id]
    );

    await db.query(
        'UPDATE outreach_campaigns SET total_recipients = ? WHERE id = ?',
        [contacts.length, campaignId]
    );

    // Run send in background
    setImmediate(() => sendEmailBatch(campaign, contacts, senderUserId).catch(e =>
        console.error('[outreachCampaign.sendBatch]', e.message)
    ));
    return { total: contacts.length };
}
exports.beginEmailSend = beginEmailSend;

// ── Background email send ─────────────────────────────────────────────────────
async function sendEmailBatch(campaign, contacts, senderUserId) {
    const transporter = getTransporter();
    const domain      = getDomain();
    const replyToAddr = buildReplyToAddress(campaign.id, senderUserId);
    const BATCH_SIZE  = 4;    // Graph API throttles ~4 concurrent sendMail per user
    const BATCH_DELAY = 2500; // ms between batches (~1.6 emails/sec, well within Graph limits)

    let sent = 0, failed = 0;

    // Resolve executor name for merge tags
    const [[execUser]] = await db.query('SELECT name FROM users WHERE id = ? LIMIT 1', [senderUserId]);
    const executiveName = execUser?.name || '';

    // Load attachments once for the whole campaign send
    const [attachRows] = await db.query(
        'SELECT file_name, file_path, mime_type, file_size, delivery, share_token FROM outreach_campaign_attachments WHERE campaign_id = ? AND deleted_at IS NULL',
        [campaign.id]
    );
    // Big files / video / audio travel as a download link at the bottom of the email.
    const linkBlock = linkBlockHtml(attachRows.filter(a => a.delivery === 'link' && a.share_token && fs.existsSync(a.file_path)));
    const graphAttachments = attachRows
        .filter(a => a.delivery !== 'link' && fs.existsSync(a.file_path))
        .map(a => ({
            name:         a.file_name,
            contentType:  a.mime_type,
            contentBytes: fs.readFileSync(a.file_path).toString('base64'),
        }));

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        // Check pause flag
        const [[freshStatus]] = await db.query(
            'SELECT status FROM outreach_campaigns WHERE id = ?', [campaign.id]
        );
        if (pausedCampaigns.has(campaign.id) || freshStatus?.status === 'paused') {
            console.log(`[sendEmailBatch] Campaign ${campaign.id} paused at index ${i}`);
            break;
        }

        const batch = contacts.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(contact => sendOneEmail(
            transporter, campaign, contact, replyToAddr, domain, executiveName, graphAttachments, linkBlock
        ).then(async (msgId) => {
            sent++;
            await db.query(
                `INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, sent_at, email_message_id)
                 VALUES (?, ?, 'email', 'sent', NOW(), ?)`,
                [campaign.id, contact.id, msgId || null]
            );
        }).catch(async (err) => {
            failed++;
            await db.query(
                `INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, error_message)
                 VALUES (?, ?, 'email', 'failed', ?)`,
                [campaign.id, contact.id, err.message?.slice(0, 500) || 'Unknown error']
            );
        })));

        if (i + BATCH_SIZE < contacts.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY));
        }
    }

    // Final status update
    const [[freshStatus]] = await db.query(
        'SELECT status FROM outreach_campaigns WHERE id = ?', [campaign.id]
    );
    const finalStatus = (freshStatus?.status === 'paused') ? 'paused' : 'sent';
    await db.query(
        `UPDATE outreach_campaigns
         SET status = ?, sent_count = sent_count + ?, failed_count = failed_count + ?
         WHERE id = ?`,
        [finalStatus, sent, failed, campaign.id]
    );
    pausedCampaigns.delete(campaign.id);

    // Notify campaign creator
    await notify(
        campaign.created_by,
        'campaign_sent',
        'Campaign Send Complete',
        `Campaign "${campaign.campaign_name}" finished. Sent: ${sent}, Failed: ${failed}.`,
        { campaign_id: campaign.id, sent, failed }
    );
}

// Extract the first syntactically valid email from a raw cell that may contain
// multiple addresses separated by commas, semicolons, spaces, or run together.
function extractFirstEmail(raw) {
    if (!raw) return null;
    // Pull every token that looks like a valid email
    const matches = String(raw).match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
    return matches?.[0] ?? null;
}

async function sendOneEmail(transporter, campaign, contact, replyToAddr, domain, executiveName, attachments = [], linkBlock = '') {
    const toEmail = extractFirstEmail(contact.email);
    if (!toEmail) throw new Error(`No valid email address for contact ${contact.id}: "${contact.email}"`);

    const timestamp = Date.now();
    const msgId     = `<lc-${campaign.id}-${contact.id}-${timestamp}@${domain}>`;

    const subjectFinal = replaceMergeTags(campaign.subject,      contact, executiveName);
    const bodyFinal    = replaceMergeTags(campaign.message_body, contact, executiveName);

    // Preserve plain-text formatting: if the body has no HTML tags, convert
    // newlines to <br> so the email client renders line breaks correctly.
    const hasHtml = /<[a-z][^>]*>/i.test(bodyFinal);
    const htmlBody = hasHtml ? bodyFinal : bodyFinal.replace(/\r?\n/g, '<br>\n');

    await transporter.sendMail({
        from:     `"${campaign.from_name}" <${campaign.from_email}>`,
        to:       toEmail,
        subject:  subjectFinal,
        html:     htmlBody + linkBlock,
        messageId: msgId,
        replyTo:  replyToAddr,
        headers: {
            'X-LC-Campaign-ID':  String(campaign.id),
            'X-LC-Executive-ID': String(campaign.created_by),
            'X-LC-Contact-ID':   String(contact.id),
            'List-Unsubscribe':  `<mailto:${campaign.from_email}?subject=unsubscribe>`,
        },
        attachments,
    });
    return msgId;
}

// ── POST /outreach/email-campaigns/:id/pause ──────────────────────────────────
exports.pauseEmailCampaign = async (req, res) => {
    const campaignId = parseInt(req.params.id);
    try {
        const [[campaign]] = await db.query(
            "SELECT id, created_by, status FROM outreach_campaigns WHERE id = ? AND deleted_at IS NULL",
            [campaignId]
        );
        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
        if (req.user.role === 'hr_staff' && campaign.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (campaign.status !== 'sending') {
            return res.status(422).json({ success: false, message: 'Campaign is not currently sending.' });
        }

        pausedCampaigns.add(campaignId);
        await db.query(
            "UPDATE outreach_campaigns SET status = 'paused' WHERE id = ?", [campaignId]
        );
        res.json({ success: true, message: 'Campaign paused.' });
    } catch (err) {
        console.error('[outreachCampaign.pause]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── DELETE /outreach/email-campaigns/:id  and  /whatsapp-campaigns/:id ───────
// Any campaign can be deleted except one that is sending right now (a send that
// has been stuck for more than 2 hours counts as dead and may be deleted).
// It is a soft delete: the campaign disappears from the lists, but replies, leads
// and the send log are kept, and replies still show the campaign name.
const makeDeleteCampaign = (type, auditAction) => async (req, res) => {
    try {
        const [[campaign]] = await db.query(
            `SELECT id, created_by, status, campaign_name,
                    (sent_at IS NOT NULL AND sent_at < (NOW() - INTERVAL 2 HOUR)) AS stale
             FROM outreach_campaigns WHERE id = ? AND deleted_at IS NULL AND campaign_type = ?`,
            [req.params.id, type]
        );
        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
        if (req.user.role === 'hr_staff' && campaign.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (campaign.status === 'sending' && !campaign.stale) {
            return res.status(422).json({ success: false, message: 'This campaign is sending right now. Wait for it to finish (or pause it) before deleting.' });
        }
        await db.query('UPDATE outreach_campaigns SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        logAction(req.user.id, auditAction, 'outreach_campaign', req.params.id, { name: campaign.campaign_name, status: campaign.status }, null);
        res.json({ success: true, message: 'Campaign deleted.' });
    } catch (err) {
        console.error('[outreachCampaign.delete]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
exports.deleteEmailCampaign = makeDeleteCampaign('email', 'delete_email_campaign');
exports.deleteWACampaign    = makeDeleteCampaign('whatsapp', 'delete_whatsapp_campaign');

// ── GET /outreach/email-templates — read-only list for hr_staff/admin ─────────
exports.listEmailTemplatesForOutreach = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, name, description, subject, body_html
             FROM email_templates
             WHERE is_active = 1 AND deleted_at IS NULL
             ORDER BY name ASC`
        );
        if (rows.length) {
            const [atts] = await db.query(
                `SELECT id, template_id, file_name, mime_type, file_size FROM email_template_attachments
                 WHERE deleted_at IS NULL AND template_id IN (?) ORDER BY id ASC`,
                [rows.map(r => r.id)]
            );
            rows.forEach(r => { r.attachments = atts.filter(a => a.template_id === r.id); });
        }
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[outreachCampaign.listEmailTemplates]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};


// ── GET /outreach/whatsapp-campaigns/:id/failed ────────────────────────────────
exports.getWAFailedLogs = async (req, res) => {
    try {
        const [[camp]] = await db.query(
            'SELECT id, created_by FROM outreach_campaigns WHERE id = ? AND campaign_type = ? AND deleted_at IS NULL',
            [req.params.id, 'whatsapp']
        );
        if (!camp) return res.status(404).json({ success: false, message: 'Campaign not found.' });
        if (req.user.role === 'hr_staff' && camp.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const [rows] = await db.query(
            `SELECT cl.id, cl.contact_id, cl.error_message, cl.sent_at,
                    c.full_name, c.phone, c.whatsapp_number, c.company_name
             FROM outreach_campaign_logs cl
             JOIN outreach_contacts c ON c.id = cl.contact_id
             WHERE cl.campaign_id = ? AND cl.status = 'failed' AND cl.channel = 'whatsapp'
             ORDER BY cl.id ASC`,
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[getWAFailedLogs]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /outreach/email-campaigns/:id/failed — failed send log ────────────────
exports.getFailedLogs = async (req, res) => {
    try {
        const [[camp]] = await db.query(
            'SELECT id, created_by FROM outreach_campaigns WHERE id = ? AND campaign_type = ? AND deleted_at IS NULL',
            [req.params.id, 'email']
        );
        if (!camp) return res.status(404).json({ success: false, message: 'Campaign not found.' });
        if (req.user.role === 'hr_staff' && camp.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const [rows] = await db.query(
            `SELECT cl.id, cl.contact_id, cl.error_message, cl.sent_at,
                    c.full_name, c.email, c.company_name
             FROM outreach_campaign_logs cl
             JOIN outreach_contacts c ON c.id = cl.contact_id
             WHERE cl.campaign_id = ? AND cl.status = 'failed'
             ORDER BY cl.id ASC`,
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[getFailedLogs]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── Campaign Attachment endpoints ─────────────────────────────────────────────

async function getCampOrFail(id, userId, role, res) {
    const [[camp]] = await db.query(
        'SELECT id, created_by FROM outreach_campaigns WHERE id = ? AND campaign_type = ? AND deleted_at IS NULL',
        [id, 'email']
    );
    if (!camp) { res.status(404).json({ success: false, message: 'Campaign not found.' }); return null; }
    if (role === 'hr_staff' && camp.created_by !== userId) {
        res.status(403).json({ success: false, message: 'Access denied.' }); return null;
    }
    return camp;
}

exports.listCampaignAttachments = async (req, res) => {
    try {
        const camp = await getCampOrFail(req.params.id, req.user.id, req.user.role, res);
        if (!camp) return;
        const [rows] = await db.query(
            'SELECT id, file_name, mime_type, file_size, delivery, created_at FROM outreach_campaign_attachments WHERE campaign_id = ? AND deleted_at IS NULL ORDER BY id ASC',
            [camp.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[listCampaignAttachments]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.uploadCampaignAttachment = async (req, res) => {
    try {
        const camp = await getCampOrFail(req.params.id, req.user.id, req.user.role, res);
        if (!camp) { if (req.file) safeUnlink(req.file.path); return; }
        if (!req.file) return res.status(422).json({ success: false, message: 'No file uploaded.' });

        const [[tot]] = await db.query(
            `SELECT COALESCE(SUM(CASE WHEN delivery = 'attach' THEN file_size ELSE 0 END), 0) AS bytes,
                    COALESCE(SUM(delivery = 'link'), 0) AS links
             FROM outreach_campaign_attachments WHERE campaign_id = ? AND deleted_at IS NULL`,
            [camp.id]
        );
        const check = classifyCampaignUpload(req.file, { attachBytes: Number(tot.bytes), linkCount: Number(tot.links) });
        if (check.error) return res.status(422).json({ success: false, message: check.error });

        const token = check.delivery === 'link' ? crypto.randomBytes(24).toString('base64url') : null;
        const [result] = await db.query(
            'INSERT INTO outreach_campaign_attachments (campaign_id, file_name, file_path, mime_type, file_size, delivery, share_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [camp.id, req.file.originalname, req.file.path, check.mime, req.file.size, check.delivery, token]
        );
        res.json({ success: true, data: { id: result.insertId, file_name: req.file.originalname, mime_type: check.mime, file_size: req.file.size, delivery: check.delivery } });
    } catch (err) {
        if (req.file) safeUnlink(req.file.path);
        console.error('[uploadCampaignAttachment]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.deleteCampaignAttachment = async (req, res) => {
    try {
        const camp = await getCampOrFail(req.params.id, req.user.id, req.user.role, res);
        if (!camp) return;

        const [[att]] = await db.query(
            'SELECT id, file_path FROM outreach_campaign_attachments WHERE id = ? AND campaign_id = ? AND deleted_at IS NULL',
            [req.params.attId, camp.id]
        );
        if (!att) return res.status(404).json({ success: false, message: 'Attachment not found.' });

        await db.query('UPDATE outreach_campaign_attachments SET deleted_at = NOW() WHERE id = ?', [att.id]);
        // Delete file from disk
        try { if (fs.existsSync(att.file_path)) fs.unlinkSync(att.file_path); } catch {}

        res.json({ success: true, message: 'Attachment removed.' });
    } catch (err) {
        console.error('[deleteCampaignAttachment]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};


// ── GET /api/outreach/files/:token — download link inside a campaign email (no sign-in) ─────────
// The token is long and random. The link stops working when the file or the campaign is deleted.
exports.serveEmailFile = async (req, res) => {
    try {
        const token = String(req.params.token || '');
        if (!/^[\w-]{20,64}$/.test(token)) return res.status(404).send('Not found');
        let [[row]] = await db.query(
            `SELECT a.file_name, a.file_path, a.mime_type
             FROM outreach_campaign_attachments a
             JOIN outreach_campaigns c ON c.id = a.campaign_id AND c.deleted_at IS NULL
             WHERE a.share_token = ? AND a.delivery = 'link' AND a.deleted_at IS NULL`, [token]);
        // Not an email file? It may be the header media of a WhatsApp campaign.
        if (!row) {
            [[row]] = await db.query(
                `SELECT header_media_name AS file_name, header_media_path AS file_path, header_media_mime AS mime_type
                 FROM outreach_campaigns WHERE header_media_token = ? AND deleted_at IS NULL`, [token]);
        }
        if (!row || !fs.existsSync(row.file_path)) return res.status(404).send('This file is no longer available.');
        const inline = /^(video|audio|image)\//.test(row.mime_type) || row.mime_type === 'application/pdf';
        const safeName = path.basename(row.file_name).replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'file';
        res.setHeader('Content-Type', row.mime_type);
        res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
        res.setHeader('Cache-Control', 'private, max-age=600');
        res.sendFile(path.resolve(row.file_path));   // supports Range requests, so video can be played and skipped through
    } catch (err) {
        console.error('[serveEmailFile]', err.message);
        if (!res.headersSent) res.status(500).send('Server error');
    }
};

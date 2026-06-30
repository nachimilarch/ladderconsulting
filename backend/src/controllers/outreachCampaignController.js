const db = require('../config/db');
const { getTransporter, getDefaultFrom, getDomain, replaceMergeTags, buildReplyToAddress } = require('../utils/outreachEmail');
const { logAction } = require('../utils/auditLog');

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

// ── POST /outreach/email-campaigns ───────────────────────────────────────────
exports.createEmailCampaign = async (req, res) => {
    const { campaign_name, list_id, subject, message_body, from_name, scheduled_at } = req.body;
    if (!campaign_name || !list_id || !subject || !message_body) {
        return res.status(422).json({ success: false, message: 'campaign_name, list_id, subject, message_body required.' });
    }

    try {
        // Verify list exists and is accessible
        const [[list]] = await db.query(
            'SELECT id, uploaded_by FROM outreach_contact_lists WHERE id = ? AND deleted_at IS NULL', [list_id]
        );
        if (!list) return res.status(404).json({ success: false, message: 'Contact list not found.' });
        if (req.user.role === 'hr_staff' && list.uploaded_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'You do not own this contact list.' });
        }

        // Resolve executive's from_email
        const [[emp]] = await db.query(
            'SELECT outreach_email, outreach_email_name FROM employees WHERE user_id = ? AND deleted_at IS NULL',
            [req.user.id]
        );
        const fromEmail = emp?.outreach_email || getDefaultFrom();
        const resolvedFromName = from_name || emp?.outreach_email_name || process.env.GODADDY_DEFAULT_FROM_NAME || 'LadderStep Human Consulting';

        const [result] = await db.query(
            `INSERT INTO outreach_campaigns
               (created_by, campaign_name, campaign_type, list_id, subject, message_body,
                from_email, from_name, status, scheduled_at)
             VALUES (?, ?, 'email', ?, ?, ?, ?, ?, 'draft', ?)`,
            [req.user.id, campaign_name, list_id, subject, message_body,
             fromEmail, resolvedFromName, scheduled_at || null]
        );
        res.status(201).json({ success: true, message: 'Campaign created.', id: result.insertId });
    } catch (err) {
        console.error('[outreachCampaign.create]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

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
        if (scheduled_at  !== undefined) { fields.push('scheduled_at = ?');  vals.push(scheduled_at || null); }
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

        // Mark as sending immediately
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

        res.json({
            success: true,
            message: `Sending started for ${contacts.length} recipients.`,
            total_recipients: contacts.length,
        });

        // Run send in background
        setImmediate(() => sendEmailBatch(campaign, contacts, req.user.id).catch(e =>
            console.error('[outreachCampaign.sendBatch]', e.message)
        ));
    } catch (err) {
        console.error('[outreachCampaign.send]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── Background email send ─────────────────────────────────────────────────────
async function sendEmailBatch(campaign, contacts, senderUserId) {
    const transporter = getTransporter();
    const domain      = getDomain();
    const replyToAddr = buildReplyToAddress(campaign.id, senderUserId);
    const BATCH_SIZE  = 20;
    const BATCH_DELAY = 1000; // ms

    let sent = 0, failed = 0;

    // Resolve executor name for merge tags
    const [[execUser]] = await db.query('SELECT name FROM users WHERE id = ? LIMIT 1', [senderUserId]);
    const executiveName = execUser?.name || '';

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
            transporter, campaign, contact, replyToAddr, domain, executiveName
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

async function sendOneEmail(transporter, campaign, contact, replyToAddr, domain, executiveName) {
    const timestamp = Date.now();
    const msgId     = `<lc-${campaign.id}-${contact.id}-${timestamp}@${domain}>`;

    const subjectFinal = replaceMergeTags(campaign.subject,      contact, executiveName);
    const bodyFinal    = replaceMergeTags(campaign.message_body, contact, executiveName);

    await transporter.sendMail({
        from:     `"${campaign.from_name}" <${campaign.from_email}>`,
        to:       contact.email,
        subject:  subjectFinal,
        html:     bodyFinal,
        messageId: msgId,
        replyTo:  replyToAddr,
        headers: {
            'X-LC-Campaign-ID':  String(campaign.id),
            'X-LC-Executive-ID': String(campaign.created_by),
            'X-LC-Contact-ID':   String(contact.id),
            'List-Unsubscribe':  `<mailto:${campaign.from_email}?subject=unsubscribe>`,
        },
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

// ── DELETE /outreach/email-campaigns/:id ─────────────────────────────────────
exports.deleteEmailCampaign = async (req, res) => {
    try {
        const [[campaign]] = await db.query(
            "SELECT id, created_by, status FROM outreach_campaigns WHERE id = ? AND deleted_at IS NULL AND campaign_type = 'email'",
            [req.params.id]
        );
        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
        if (req.user.role === 'hr_staff' && campaign.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (!['draft','scheduled'].includes(campaign.status)) {
            return res.status(422).json({ success: false, message: 'Only draft or scheduled campaigns can be deleted.' });
        }
        await db.query('UPDATE outreach_campaigns SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        logAction(req.user.id, 'delete_email_campaign', 'outreach_campaign', req.params.id, {}, null);
        res.json({ success: true, message: 'Campaign deleted.' });
    } catch (err) {
        console.error('[outreachCampaign.delete]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

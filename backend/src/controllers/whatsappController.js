const db     = require('../config/db');
const axios  = require('axios');
const crypto = require('crypto');
const { createLeadFromContact } = require('../services/leadConverter');

const VB_BASE = 'https://vaartabot.com/api/v1';
const vbHeaders = () => ({ 'X-API-Key': process.env.VAARTABOT_API_KEY, 'Content-Type': 'application/json' });

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) {
        console.error('[notify:whatsapp]', err.message);
    }
};

const getAdminUserId = async () => {
    const [[row]] = await db.query(
        "SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1"
    );
    return row?.id ?? null;
};

// Convert phone number to E.164 format — default country India (+91)
const toE164 = (phone, defaultCountry = '91') => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) return `+${defaultCountry}${digits.slice(1)}`;
    if (digits.length === 10)   return `+${defaultCountry}${digits}`;
    if (!digits.startsWith(defaultCountry)) return `+${digits}`;
    return `+${digits}`;
};

// ── WhatsApp Templates ───────────────────────────────────────────────────────

exports.listTemplates = async (req, res) => {
    const filters = ['t.deleted_at IS NULL'];
    const params  = [];
    if (req.user.role === 'hr_staff') {
        filters.push('created_by = ?');
        params.push(req.user.id);
    }
    try {
        const [rows] = await db.query(
            `SELECT t.*, u.name AS created_by_name FROM whatsapp_templates t
             JOIN users u ON u.id = t.created_by
             WHERE ${filters.join(' AND ')} ORDER BY t.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[whatsapp.listTemplates]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.createTemplate = async (req, res) => {
    const { template_name, language_code, category, header_type, header_content, body_text, footer_text, variable_count } = req.body;
    if (!template_name || !body_text) {
        return res.status(422).json({ success: false, message: 'template_name and body_text are required.' });
    }
    try {
        const [result] = await db.query(
            `INSERT INTO whatsapp_templates
               (created_by, template_name, language_code, category, header_type, header_content, body_text, footer_text, variable_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, template_name, language_code || 'en', category || 'MARKETING',
             header_type || 'none', header_content || null, body_text,
             footer_text || null, variable_count || 0]
        );
        res.status(201).json({ success: true, message: 'Template created.', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.updateTemplate = async (req, res) => {
    const { template_name, language_code, category, header_type, header_content, body_text, footer_text, variable_count, is_active } = req.body;
    try {
        const [[tmpl]] = await db.query(
            'SELECT id, created_by FROM whatsapp_templates WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!tmpl) return res.status(404).json({ success: false, message: 'Template not found.' });
        if (req.user.role === 'hr_staff' && tmpl.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const fields = [], vals = [];
        const add = (f, v) => { fields.push(`${f} = ?`); vals.push(v); };
        if (template_name  !== undefined) add('template_name', template_name);
        if (language_code  !== undefined) add('language_code', language_code);
        if (category       !== undefined) add('category', category);
        if (header_type    !== undefined) add('header_type', header_type);
        if (header_content !== undefined) add('header_content', header_content);
        if (body_text      !== undefined) add('body_text', body_text);
        if (footer_text    !== undefined) add('footer_text', footer_text);
        if (variable_count !== undefined) add('variable_count', variable_count);
        if (is_active      !== undefined) add('is_active', is_active ? 1 : 0);
        if (!fields.length) return res.status(422).json({ success: false, message: 'Nothing to update.' });

        vals.push(req.params.id);
        await db.query(`UPDATE whatsapp_templates SET ${fields.join(', ')} WHERE id = ?`, vals);
        res.json({ success: true, message: 'Template updated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const [[tmpl]] = await db.query(
            'SELECT id, created_by FROM whatsapp_templates WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!tmpl) return res.status(404).json({ success: false, message: 'Template not found.' });
        if (req.user.role === 'hr_staff' && tmpl.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        await db.query('UPDATE whatsapp_templates SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Template deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── WhatsApp Campaigns ────────────────────────────────────────────────────────

exports.createWACampaign = async (req, res) => {
    const { campaign_name, list_id, whatsapp_template_id, variable_mapping } = req.body;
    if (!campaign_name || !list_id || !whatsapp_template_id) {
        return res.status(422).json({ success: false, message: 'campaign_name, list_id, whatsapp_template_id required.' });
    }
    try {
        const [[list]] = await db.query(
            'SELECT id, uploaded_by FROM outreach_contact_lists WHERE id = ? AND deleted_at IS NULL', [list_id]
        );
        if (!list) return res.status(404).json({ success: false, message: 'Contact list not found.' });
        if (req.user.role === 'hr_staff' && list.uploaded_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'You do not own this contact list.' });
        }

        const [result] = await db.query(
            `INSERT INTO outreach_campaigns
               (created_by, campaign_name, campaign_type, list_id, whatsapp_template_id, variable_mapping, status)
             VALUES (?, ?, 'whatsapp', ?, ?, ?, 'draft')`,
            [req.user.id, campaign_name, list_id, whatsapp_template_id,
             variable_mapping ? JSON.stringify(variable_mapping) : null]
        );
        res.status(201).json({ success: true, message: 'WhatsApp campaign created.', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.listWACampaigns = async (req, res) => {
    const filters = ["c.campaign_type = 'whatsapp'", 'c.deleted_at IS NULL'];
    const params  = [];
    if (req.user.role === 'hr_staff') {
        filters.push('c.created_by = ?');
        params.push(req.user.id);
    }
    try {
        const [rows] = await db.query(
            `SELECT c.*, u.name AS created_by_name, l.list_name, t.template_name, t.body_text AS template_body
             FROM outreach_campaigns c
             JOIN users u ON u.id = c.created_by
             LEFT JOIN outreach_contact_lists l ON l.id = c.list_id
             LEFT JOIN whatsapp_templates t ON t.id = c.whatsapp_template_id
             WHERE ${filters.join(' AND ')} ORDER BY c.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.getWACampaign = async (req, res) => {
    try {
        const [[row]] = await db.query(
            `SELECT c.*, u.name AS created_by_name, l.list_name, t.template_name, t.body_text AS template_body, t.variable_count
             FROM outreach_campaigns c
             JOIN users u ON u.id = c.created_by
             LEFT JOIN outreach_contact_lists l ON l.id = c.list_id
             LEFT JOIN whatsapp_templates t ON t.id = c.whatsapp_template_id
             WHERE c.id = ? AND c.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Campaign not found.' });
        if (req.user.role === 'hr_staff' && row.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        res.json({ success: true, data: row });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /outreach/whatsapp-campaigns/:id/send ────────────────────────────────
exports.sendWACampaign = async (req, res) => {
    const campaignId = parseInt(req.params.id);
    try {
        const [[campaign]] = await db.query(
            "SELECT * FROM outreach_campaigns WHERE id = ? AND deleted_at IS NULL AND campaign_type = 'whatsapp'",
            [campaignId]
        );
        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
        if (req.user.role === 'hr_staff' && campaign.created_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (!['draft','scheduled'].includes(campaign.status)) {
            return res.status(422).json({ success: false, message: `Cannot send campaign with status '${campaign.status}'.` });
        }

        const [[template]] = await db.query(
            'SELECT * FROM whatsapp_templates WHERE id = ? AND deleted_at IS NULL', [campaign.whatsapp_template_id]
        );
        if (!template) return res.status(422).json({ success: false, message: 'WhatsApp template not found.' });

        const [contacts] = await db.query(
            `SELECT c.* FROM outreach_contacts c
             LEFT JOIN outreach_campaign_logs cl ON cl.campaign_id = ? AND cl.contact_id = c.id
             WHERE c.list_id = ? AND c.deleted_at IS NULL AND c.is_unsubscribed = 0
               AND (c.phone IS NOT NULL OR c.whatsapp_number IS NOT NULL)
               AND cl.id IS NULL`,
            [campaignId, campaign.list_id]
        );

        await db.query(
            "UPDATE outreach_campaigns SET status = 'sending', total_recipients = ?, sent_at = NOW() WHERE id = ?",
            [contacts.length, campaignId]
        );

        res.json({ success: true, message: `WhatsApp send started for ${contacts.length} contacts.`, total_recipients: contacts.length });

        setImmediate(() => sendWABatch(campaign, template, contacts).catch(e =>
            console.error('[whatsapp.sendBatch]', e.message)
        ));
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// Resolve a template variable value from the contact record
const resolveVar = (contact, field) => {
    if (field === 'first_name') return (contact.full_name || '').split(' ')[0];
    return String(contact[field] || '');
};

// Chunk array into slices of size n
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function sendWABatch(campaign, template, contacts) {
    const apiKey     = process.env.VAARTABOT_API_KEY;
    const baseUrl    = VB_BASE;
    const varMapping = campaign.variable_mapping
        ? (typeof campaign.variable_mapping === 'string' ? JSON.parse(campaign.variable_mapping) : campaign.variable_mapping)
        : {};

    // Separate valid contacts from ones with no phone number
    const valid = [], invalid = [];
    for (const contact of contacts) {
        const phone = toE164(contact.whatsapp_number || contact.phone);
        if (phone) {
            valid.push({ contact, phone });
        } else {
            invalid.push(contact);
        }
    }

    // Log invalid contacts immediately
    for (const contact of invalid) {
        await db.query(
            "INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, error_message) VALUES (?, ?, 'whatsapp', 'failed', ?)",
            [campaign.id, contact.id, 'No valid phone number']
        );
    }

    let sent = 0, failed = invalid.length;

    // Vaartabot bulk-send: up to 500 recipients per request
    for (const batch of chunk(valid, 500)) {
        const recipients = batch.map(({ contact, phone }) => {
            const variables = Object.keys(varMapping).sort().map(ph => resolveVar(contact, varMapping[ph]));
            return { to: phone.replace('+', ''), ...(variables.length > 0 && { variables }) };
        });

        // Build a contact lookup by phone for logging results
        const byPhone = {};
        for (const { contact, phone } of batch) byPhone[phone.replace('+', '')] = contact;

        try {
            const response = await axios.post(
                `${baseUrl}/messages/bulk-send`,
                { templateName: template.template_name, recipients },
                { headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' } }
            );

            const results = response.data?.data?.results || [];
            for (const r of results) {
                const contact = byPhone[r.to] || byPhone[r.to?.replace(/^\+/, '')];
                if (!contact) continue;
                if (r.status === 'sent' || r.status === 'queued') {
                    sent++;
                    await db.query(
                        "INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, sent_at, whatsapp_message_id) VALUES (?, ?, 'whatsapp', 'sent', NOW(), ?)",
                        [campaign.id, contact.id, r.messageId || null]
                    );
                } else {
                    failed++;
                    await db.query(
                        "INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, error_message) VALUES (?, ?, 'whatsapp', 'failed', ?)",
                        [campaign.id, contact.id, String(r.error || r.status).slice(0, 500)]
                    );
                }
            }

            // If API returns fewer results than recipients, log the remainder as sent
            // (some providers only return failures)
            if (results.length === 0 && response.data?.data?.sent > 0) {
                const apiSent = response.data.data.sent;
                for (const { contact } of batch.slice(0, apiSent)) {
                    sent++;
                    await db.query(
                        "INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, sent_at) VALUES (?, ?, 'whatsapp', 'sent', NOW())",
                        [campaign.id, contact.id]
                    );
                }
                for (const { contact } of batch.slice(apiSent)) {
                    failed++;
                    await db.query(
                        "INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, error_message) VALUES (?, ?, 'whatsapp', 'failed', 'Send failed')",
                        [campaign.id, contact.id]
                    );
                }
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
            console.error('[whatsapp.bulkSend]', errMsg);
            failed += batch.length;
            for (const { contact } of batch) {
                await db.query(
                    "INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, error_message) VALUES (?, ?, 'whatsapp', 'failed', ?)",
                    [campaign.id, contact.id, String(errMsg).slice(0, 500)]
                );
            }
        }
    }

    await db.query(
        "UPDATE outreach_campaigns SET status = 'sent', sent_count = sent_count + ?, failed_count = failed_count + ? WHERE id = ?",
        [sent, failed, campaign.id]
    );

    await notify(
        campaign.created_by,
        'campaign_sent',
        'WhatsApp Campaign Complete',
        `Campaign "${campaign.campaign_name}" done. Sent: ${sent}, Failed: ${failed}.`,
        { campaign_id: campaign.id, sent, failed }
    );
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

// GET /api/outreach/webhooks/whatsapp — verification for Meta-style hub.challenge
exports.verifyWebhook = (req, res) => {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.sendStatus(200);
};

// POST /api/outreach/webhooks/whatsapp — handles Vaartabot webhook events
exports.handleWebhook = async (req, res) => {
    // ── Signature verification ────────────────────────────────────────────────
    // Vaartabot sends: X-Vaartabot-Signature: sha256=<hex>
    // Secret is stored per-webhook; we store it in VAARTABOT_WEBHOOK_SECRET env
    const sigHeader = req.headers['x-vaartabot-signature'];
    const secret    = process.env.VAARTABOT_WEBHOOK_SECRET;
    if (secret && sigHeader) {
        // req.rawBody is set by express.json({ verify }) in server.js
        const rawBody  = req.rawBody || Buffer.alloc(0);
        const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        const sigBuf   = Buffer.from(sigHeader);
        const expBuf   = Buffer.from(expected);
        const valid    = sigBuf.length === expBuf.length &&
                         crypto.timingSafeEqual(sigBuf, expBuf);
        if (!valid) {
            console.warn('[webhook] Invalid Vaartabot signature — rejected');
            return res.sendStatus(401);
        }
    }

    res.sendStatus(200); // Respond within 8 seconds as required

    const body = req.body;
    if (!body) return;

    try {
        // ── Vaartabot webhook format ──────────────────────────────────────────
        // { event, tenant_id, timestamp, data: { message_id, from, type, text, received_at } }
        if (body.event) {
            const event = body.event;
            const data  = body.data || {};

            if (event === 'message.received') {
                const from      = data.from || '';
                // Correct field names from Vaartabot docs: data.text, data.message_id, data.received_at
                const msgId     = data.message_id || data.messageId || '';
                const text      = data.text || data.message || data.body || '';
                // received_at is ISO string; pass as-is — handleIncomingWAMessage accepts ISO or unix timestamp
                const timestamp = data.received_at || body.timestamp || null;
                if (from) await handleIncomingWAMessage(from, msgId, text, timestamp);

            } else if (event === 'message.delivered' || event === 'message.read') {
                const msgId = data.message_id || data.messageId;
                if (msgId) {
                    await db.query(
                        "UPDATE outreach_campaign_logs SET status='sent' WHERE whatsapp_message_id=? AND status='pending'",
                        [msgId]
                    ).catch(() => {});
                }

            } else if (event === 'message.failed') {
                const msgId  = data.message_id || data.messageId;
                const reason = data.error || data.reason || 'Delivery failed';
                if (msgId) {
                    await db.query(
                        "UPDATE outreach_campaign_logs SET status='failed', error_message=? WHERE whatsapp_message_id=?",
                        [String(reason).slice(0, 500), msgId]
                    ).catch(() => {});
                }
            }
            return;
        }

        // ── Meta/WhatsApp Cloud API format (legacy compatibility) ─────────────
        if (body.object !== 'whatsapp_business_account') return;
        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value;
                if (!value) continue;
                for (const msg of value.messages || []) {
                    if (msg.type === 'text') {
                        await handleIncomingWAMessage(msg.from, msg.id, msg.text?.body || '', msg.timestamp);
                    }
                }
                for (const status of value.statuses || []) {
                    if (['delivered','read'].includes(status.status)) {
                        await db.query(
                            "UPDATE outreach_campaign_logs SET status='sent' WHERE whatsapp_message_id=? AND status='pending'",
                            [status.id]
                        ).catch(() => {});
                    }
                }
            }
        }
    } catch (err) {
        console.error('[whatsapp.webhook]', err.message);
    }
};

async function handleIncomingWAMessage(fromPhone, waMessageId, bodyText, timestamp) {
    // Accept ISO string (Vaartabot) or unix timestamp seconds (Meta)
    const receivedAt = timestamp
        ? (typeof timestamp === 'string' ? new Date(timestamp) : new Date(parseInt(timestamp) * 1000))
        : new Date();
    const e164Phone  = toE164(fromPhone);

    // Find campaign log by phone number
    const [[logRow]] = await db.query(
        `SELECT ocl.id, ocl.campaign_id, ocl.contact_id, oc.created_by
         FROM outreach_campaign_logs ocl
         JOIN outreach_campaigns oc ON oc.id = ocl.campaign_id
         JOIN outreach_contacts ct ON ct.id = ocl.contact_id
         WHERE (ct.whatsapp_number = ? OR ct.phone = ?) AND ocl.channel = 'whatsapp' AND ocl.status = 'sent'
         ORDER BY ocl.sent_at DESC LIMIT 1`,
        [e164Phone, e164Phone]
    );

    const campaignId  = logRow?.campaign_id  || null;
    const contactId   = logRow?.contact_id   || null;
    const executiveId = logRow?.created_by   || null;
    const logId       = logRow?.id           || null;

    let assignedTo = executiveId || (await getAdminUserId());

    // Insert reply
    const [result] = await db.query(
        `INSERT INTO outreach_email_replies
           (campaign_id, campaign_log_id, contact_id, assigned_to, channel,
            from_phone, body_text, received_at, message_id, reply_status)
         VALUES (?, ?, ?, ?, 'whatsapp', ?, ?, ?, ?, 'unread')`,
        [campaignId, logId, contactId, assignedTo, fromPhone, bodyText, receivedAt, waMessageId]
    );
    const replyId = result.insertId;

    if (logId) {
        await db.query(
            "UPDATE outreach_campaign_logs SET status = 'replied', replied_at = NOW(), whatsapp_message_id = ? WHERE id = ?",
            [waMessageId, logId]
        );
    }
    if (campaignId) {
        await db.query(
            'UPDATE outreach_campaigns SET reply_count = reply_count + 1 WHERE id = ?', [campaignId]
        );
    }

    if (contactId && assignedTo) {
        await createLeadFromContact({
            contactId,
            source: 'whatsapp',
            campaignId,
            executiveUserId: assignedTo,
            replyId,
        }).catch(e => console.error('[wa:createLead]', e.message));
    }

    if (assignedTo) {
        const [[campaign]] = await db.query(
            'SELECT campaign_name FROM outreach_campaigns WHERE id = ? LIMIT 1', [campaignId]
        ).catch(() => [[null]]);
        await notify(
            assignedTo,
            'whatsapp_reply',
            'New WhatsApp Reply',
            `New WhatsApp reply from ${fromPhone}${campaign?.campaign_name ? ` re: "${campaign.campaign_name}"` : ''}.`,
            { reply_id: replyId, campaign_id: campaignId }
        );
    }

    // Fire auto-reply flows in background (don't await — never block incoming handler)
    fireAutoReply(e164Phone || fromPhone, bodyText).catch(e => console.error('[autoReply]', e.message));
}

// ── GET /api/outreach/whatsapp/credits ────────────────────────────────────────
exports.getCredits = async (req, res) => {
    try {
        const response = await axios.get(`${VB_BASE}/credits/balance`, { headers: vbHeaders() });
        res.json({ success: true, data: response.data?.data || response.data });
    } catch (err) {
        console.error('[vaartabot.credits]', err.response?.data || err.message);
        res.status(502).json({ success: false, message: 'Could not fetch credit balance.' });
    }
};

// ── Auto-Reply Flows ──────────────────────────────────────────────────────────

exports.listAutoReplyFlows = async (req, res) => {
    const filters = ['f.deleted_at IS NULL'];
    const params  = [];
    if (req.user.role === 'hr_staff') { filters.push('f.created_by = ?'); params.push(req.user.id); }
    try {
        const [rows] = await db.query(
            `SELECT f.*, u.name AS created_by_name, t.template_name
             FROM whatsapp_auto_reply_flows f
             JOIN users u ON u.id = f.created_by
             LEFT JOIN whatsapp_templates t ON t.id = f.template_id
             WHERE ${filters.join(' AND ')} ORDER BY f.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[autoReply.list]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.createAutoReplyFlow = async (req, res) => {
    const { flow_name, trigger_type, trigger_keywords, match_type, response_type, template_id, response_text } = req.body;
    if (!flow_name) return res.status(422).json({ success: false, message: 'flow_name is required.' });
    if (response_type === 'template' && !template_id) return res.status(422).json({ success: false, message: 'template_id required for template response.' });
    if (response_type === 'text' && !response_text) return res.status(422).json({ success: false, message: 'response_text required for text response.' });
    try {
        const [result] = await db.query(
            `INSERT INTO whatsapp_auto_reply_flows
               (created_by, flow_name, trigger_type, trigger_keywords, match_type, response_type, template_id, response_text)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, flow_name, trigger_type || 'keyword',
             trigger_keywords ? JSON.stringify(trigger_keywords) : null,
             match_type || 'contains', response_type || 'template',
             template_id || null, response_text || null]
        );
        res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('[autoReply.create]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.updateAutoReplyFlow = async (req, res) => {
    const { flow_name, trigger_type, trigger_keywords, match_type, response_type, template_id, response_text, is_active } = req.body;
    try {
        const [[flow]] = await db.query('SELECT id, created_by FROM whatsapp_auto_reply_flows WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!flow) return res.status(404).json({ success: false, message: 'Flow not found.' });
        if (req.user.role === 'hr_staff' && flow.created_by !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied.' });

        const fields = [], vals = [];
        const add = (f, v) => { fields.push(`${f}=?`); vals.push(v); };
        if (flow_name         !== undefined) add('flow_name', flow_name);
        if (trigger_type      !== undefined) add('trigger_type', trigger_type);
        if (trigger_keywords  !== undefined) add('trigger_keywords', JSON.stringify(trigger_keywords));
        if (match_type        !== undefined) add('match_type', match_type);
        if (response_type     !== undefined) add('response_type', response_type);
        if (template_id       !== undefined) add('template_id', template_id);
        if (response_text     !== undefined) add('response_text', response_text);
        if (is_active         !== undefined) add('is_active', is_active ? 1 : 0);
        if (!fields.length) return res.status(422).json({ success: false, message: 'Nothing to update.' });

        vals.push(req.params.id);
        await db.query(`UPDATE whatsapp_auto_reply_flows SET ${fields.join(',')} WHERE id=?`, vals);
        res.json({ success: true, message: 'Flow updated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.deleteAutoReplyFlow = async (req, res) => {
    try {
        const [[flow]] = await db.query('SELECT id, created_by FROM whatsapp_auto_reply_flows WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!flow) return res.status(404).json({ success: false, message: 'Flow not found.' });
        if (req.user.role === 'hr_staff' && flow.created_by !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied.' });
        await db.query('UPDATE whatsapp_auto_reply_flows SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Flow deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// Internal: check active flows and send auto-reply if a rule matches
async function fireAutoReply(fromPhone, messageText) {
    const apiKey = process.env.VAARTABOT_API_KEY;
    if (!apiKey) return;

    const [flows] = await db.query(
        `SELECT f.*, t.template_name, t.language_code FROM whatsapp_auto_reply_flows f
         LEFT JOIN whatsapp_templates t ON t.id = f.template_id
         WHERE f.is_active = 1 AND f.deleted_at IS NULL ORDER BY f.id ASC`
    );
    if (!flows.length) return;

    const msgLower = (messageText || '').toLowerCase().trim();

    for (const flow of flows) {
        let matched = false;

        if (flow.trigger_type === 'any') {
            matched = true;
        } else if (flow.trigger_type === 'first_contact') {
            // Only reply if this phone has never been seen before in campaign logs
            const [[seen]] = await db.query(
                `SELECT id FROM outreach_campaign_logs l
                 JOIN outreach_contacts c ON c.id = l.contact_id
                 WHERE (c.phone = ? OR c.whatsapp_number = ?) AND l.channel = 'whatsapp' LIMIT 1`,
                [fromPhone, fromPhone]
            );
            matched = !seen;
        } else {
            // keyword
            const keywords = Array.isArray(flow.trigger_keywords) ? flow.trigger_keywords
                : (typeof flow.trigger_keywords === 'string' ? JSON.parse(flow.trigger_keywords || '[]') : []);
            for (const kw of keywords) {
                const k = kw.toLowerCase().trim();
                if (flow.match_type === 'exact'       && msgLower === k) { matched = true; break; }
                if (flow.match_type === 'contains'    && msgLower.includes(k)) { matched = true; break; }
                if (flow.match_type === 'starts_with' && msgLower.startsWith(k)) { matched = true; break; }
            }
        }

        if (!matched) continue;

        // Send the reply
        const phone = fromPhone.replace('+', '');
        if (flow.response_type === 'template' && flow.template_name) {
            await axios.post(`${VB_BASE}/messages/send`,
                { to: phone, templateName: flow.template_name, language: flow.language_code || 'en' },
                { headers: vbHeaders() }
            ).catch(e => console.error('[autoReply.send]', e.response?.data || e.message));
        } else if (flow.response_type === 'text' && flow.response_text) {
            // Use single-send with a plain text body if Vaartabot supports it
            await axios.post(`${VB_BASE}/messages/send`,
                { to: phone, message: flow.response_text },
                { headers: vbHeaders() }
            ).catch(e => console.error('[autoReply.sendText]', e.response?.data || e.message));
        }
        break; // Only fire the first matching flow
    }
}

// ── POST /api/outreach/whatsapp/templates/sync ───────────────────────────────
// Calls GET /templates/sync (Vaartabot force-refetch from Meta) then upserts locally.
// Only APPROVED templates are marked active; PENDING/REJECTED are stored but inactive.
exports.syncTemplates = async (req, res) => {
    if (!process.env.VAARTABOT_API_KEY) return res.status(503).json({ success: false, message: 'Vaartabot API key not configured.' });

    let vaartabotTemplates;
    try {
        // /templates/sync force-refetches from Meta; falls back to /templates if it fails
        const response = await axios.get(`${VB_BASE}/templates/sync`, { headers: vbHeaders() })
            .catch(() => axios.get(`${VB_BASE}/templates`, { headers: vbHeaders() }));
        const payload = response.data?.data || response.data?.templates || response.data;
        vaartabotTemplates = Array.isArray(payload) ? payload : [];
    } catch (err) {
        console.error('[vaartabot.syncTemplates]', err.response?.data || err.message);
        return res.status(502).json({ success: false, message: 'Could not fetch templates from Vaartabot.' });
    }

    if (!vaartabotTemplates.length) {
        return res.json({ success: true, synced: 0, message: 'No templates returned from Vaartabot.' });
    }

    let synced = 0;
    for (const t of vaartabotTemplates) {
        // Vaartabot shape: { name, status, category, language, components: [...] }
        const templateName  = t.name || t.template_name;
        const languageCode  = t.language || t.language_code || 'en';
        const category      = (t.category || 'MARKETING').toUpperCase();
        // Only APPROVED templates should be selectable for campaigns
        const approvalStatus = (t.status || 'PENDING').toUpperCase();
        const isActive       = approvalStatus === 'APPROVED' ? 1 : 0;

        let bodyText = '', headerType = 'none', headerContent = '', footerText = '', variableCount = 0;

        if (Array.isArray(t.components)) {
            for (const comp of t.components) {
                const type = (comp.type || '').toUpperCase();
                if (type === 'BODY')   bodyText      = comp.text || '';
                if (type === 'HEADER') { headerType = (comp.format || 'TEXT').toLowerCase(); headerContent = comp.text || ''; }
                if (type === 'FOOTER') footerText    = comp.text || '';
            }
            const matches  = bodyText.match(/\{\{\d+\}\}/g);
            variableCount  = matches ? new Set(matches).size : 0;
        }
        if (!bodyText) bodyText = t.body_text || t.body || '';
        if (!templateName) continue;

        const [[existing]] = await db.query(
            'SELECT id FROM whatsapp_templates WHERE template_name = ? AND deleted_at IS NULL LIMIT 1',
            [templateName]
        );
        if (existing) {
            await db.query(
                `UPDATE whatsapp_templates SET language_code=?, category=?, body_text=?, header_type=?,
                 header_content=?, footer_text=?, variable_count=?, is_active=? WHERE id=?`,
                [languageCode, category, bodyText, headerType, headerContent, footerText, variableCount, isActive, existing.id]
            );
        } else {
            await db.query(
                `INSERT INTO whatsapp_templates
                   (created_by, template_name, language_code, category, header_type, header_content,
                    body_text, footer_text, variable_count, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.user.id, templateName, languageCode, category, headerType, headerContent,
                 bodyText, footerText, variableCount, isActive]
            );
        }
        synced++;
    }

    const approved = vaartabotTemplates.filter(t => (t.status || '').toUpperCase() === 'APPROVED').length;
    res.json({ success: true, synced, total: vaartabotTemplates.length, approved,
               message: `Synced ${synced} template(s) — ${approved} approved, ${synced - approved} pending/rejected.` });
};

// ── Webhook management (proxy to Vaartabot API) ───────────────────────────────

exports.listWebhooks = async (req, res) => {
    try {
        const response = await axios.get(`${VB_BASE}/webhooks`, { headers: vbHeaders() });
        res.json({ success: true, data: response.data?.data || response.data });
    } catch (err) {
        console.error('[vaartabot.webhooks.list]', err.response?.data || err.message);
        res.status(502).json({ success: false, message: 'Could not fetch webhooks.' });
    }
};

exports.registerWebhook = async (req, res) => {
    const { name, url, events } = req.body;
    if (!url) return res.status(422).json({ success: false, message: 'url is required.' });
    try {
        const response = await axios.post(`${VB_BASE}/webhooks`,
            { name: name || 'LadderStep', url, events: events || ['message.received','message.delivered','message.read','message.failed'] },
            { headers: vbHeaders() }
        );
        res.status(201).json({ success: true, data: response.data?.data || response.data,
            message: 'Webhook registered. Save the secret — it is shown only once.' });
    } catch (err) {
        console.error('[vaartabot.webhooks.register]', err.response?.data || err.message);
        res.status(err.response?.status || 502).json({
            success: false, message: err.response?.data?.message || 'Could not register webhook.'
        });
    }
};

exports.updateWebhook = async (req, res) => {
    try {
        const response = await axios.patch(`${VB_BASE}/webhooks/${req.params.id}`, req.body, { headers: vbHeaders() });
        res.json({ success: true, data: response.data?.data || response.data });
    } catch (err) {
        res.status(err.response?.status || 502).json({
            success: false, message: err.response?.data?.message || 'Could not update webhook.'
        });
    }
};

exports.testWebhook = async (req, res) => {
    try {
        const response = await axios.post(`${VB_BASE}/webhooks/${req.params.id}/test`, {}, { headers: vbHeaders() });
        res.json({ success: true, data: response.data?.data || response.data, message: 'Test event sent.' });
    } catch (err) {
        res.status(err.response?.status || 502).json({
            success: false, message: err.response?.data?.message || 'Test failed.'
        });
    }
};

exports.deleteWebhook = async (req, res) => {
    try {
        await axios.delete(`${VB_BASE}/webhooks/${req.params.id}`, { headers: vbHeaders() });
        res.json({ success: true, message: 'Webhook deleted.' });
    } catch (err) {
        res.status(err.response?.status || 502).json({
            success: false, message: err.response?.data?.message || 'Could not delete webhook.'
        });
    }
};

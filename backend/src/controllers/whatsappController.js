const db   = require('../config/db');
const axios = require('axios');
const { createLeadFromContact } = require('../services/leadConverter');

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

async function sendWABatch(campaign, template, contacts) {
    const apiKey    = process.env.VAARTABOT_API_KEY;
    const baseUrl   = 'https://api.vaartabot.com/api/v1';
    const varMapping = campaign.variable_mapping
        ? (typeof campaign.variable_mapping === 'string' ? JSON.parse(campaign.variable_mapping) : campaign.variable_mapping)
        : {};

    // Vaartabot: 300ms between recipients, max 60/min via single send
    const SEND_DELAY = 350;
    let sent = 0, failed = 0;

    for (const contact of contacts) {
        const rawPhone = contact.whatsapp_number || contact.phone;
        const phone = toE164(rawPhone);
        if (!phone) {
            failed++;
            await db.query(
                "INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, error_message) VALUES (?, ?, 'whatsapp', 'failed', ?)",
                [campaign.id, contact.id, 'No valid phone number']
            );
            continue;
        }

        // Vaartabot variables: positional string array, ordered by placeholder key
        const variables = Object.keys(varMapping).sort().map(ph => resolveVar(contact, varMapping[ph]));

        const payload = {
            to: phone.replace('+', ''), // Vaartabot accepts E.164 without leading +
            templateName: template.template_name,
            language: template.language_code || 'en',
            ...(variables.length > 0 && { variables }),
        };

        try {
            const response = await axios.post(
                `${baseUrl}/messages/send`,
                payload,
                { headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' } }
            );
            const waMessageId = response.data?.data?.messageId || null;
            sent++;
            await db.query(
                "INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, sent_at, whatsapp_message_id) VALUES (?, ?, 'whatsapp', 'sent', NOW(), ?)",
                [campaign.id, contact.id, waMessageId]
            );
        } catch (err) {
            failed++;
            const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
            await db.query(
                "INSERT INTO outreach_campaign_logs (campaign_id, contact_id, channel, status, error_message) VALUES (?, ?, 'whatsapp', 'failed', ?)",
                [campaign.id, contact.id, String(errMsg).slice(0, 500)]
            );
        }

        await new Promise(r => setTimeout(r, SEND_DELAY));
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

// POST /api/outreach/webhooks/whatsapp — handles both Vaartabot and Meta formats
exports.handleWebhook = async (req, res) => {
    res.sendStatus(200); // Always respond 200 immediately

    const body = req.body;
    if (!body) return;

    try {
        // ── Vaartabot webhook format ────────────────────────────────────────
        // { event: 'message.received', data: { from, messageId, message, timestamp } }
        // { event: 'message.status',   data: { messageId, status } }
        if (body.event) {
            const event = body.event;
            const data  = body.data || {};

            if (event === 'message.received') {
                const from      = data.from || data.phone || '';
                const msgId     = data.messageId || data.message_id || '';
                const text      = data.message || data.text || data.body || '';
                const timestamp = data.timestamp || null;
                if (from) await handleIncomingWAMessage(from, msgId, text, timestamp);

            } else if (event === 'message.status') {
                const msgId  = data.messageId || data.message_id;
                const status = data.status;
                if (msgId && ['delivered','read','sent'].includes(status)) {
                    await db.query(
                        "UPDATE outreach_campaign_logs SET status='sent' WHERE whatsapp_message_id=? AND status='pending'",
                        [msgId]
                    ).catch(() => {});
                }
            }
            return;
        }

        // ── Meta/WhatsApp Cloud API format (legacy compatibility) ───────────
        if (body.object !== 'whatsapp_business_account') return;
        const entries = body.entry || [];
        for (const entry of entries) {
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

async function handleIncomingWAMessage(fromPhone, waMessageId, bodyText, timestampSec) {
    const receivedAt = timestampSec ? new Date(parseInt(timestampSec) * 1000) : new Date();
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
// Proxy Vaartabot credit balance to the frontend — avoids exposing the API key.
exports.getCredits = async (req, res) => {
    try {
        const response = await axios.get('https://api.vaartabot.com/api/v1/credits/balance', {
            headers: { 'X-API-Key': process.env.VAARTABOT_API_KEY },
        });
        res.json({ success: true, data: response.data?.data || response.data });
    } catch (err) {
        console.error('[vaartabot.credits]', err.response?.data || err.message);
        res.status(502).json({ success: false, message: 'Could not fetch credit balance.' });
    }
};

// ── GET /api/outreach/whatsapp/vaartabot-contacts/groups ─────────────────────
// Fetch contact groups (phonebooks) from Vaartabot
exports.getVaartabotGroups = async (req, res) => {
    const apiKey = process.env.VAARTABOT_API_KEY;
    if (!apiKey) return res.status(503).json({ success: false, message: 'Vaartabot API key not configured.' });
    try {
        const response = await axios.get('https://api.vaartabot.com/api/v1/contacts/groups', {
            headers: { 'X-API-Key': apiKey },
        });
        const payload = response.data?.data || response.data?.groups || response.data;
        const groups  = Array.isArray(payload) ? payload : [];
        res.json({ success: true, data: groups });
    } catch (err) {
        console.error('[vaartabot.groups]', err.response?.data || err.message);
        res.status(502).json({ success: false, message: 'Could not fetch groups from Vaartabot.' });
    }
};

// ── POST /api/outreach/whatsapp/vaartabot-contacts/sync ───────────────────────
// Import a Vaartabot contact group into a local outreach_contact_list
exports.syncVaartabotGroup = async (req, res) => {
    const apiKey = process.env.VAARTABOT_API_KEY;
    if (!apiKey) return res.status(503).json({ success: false, message: 'Vaartabot API key not configured.' });

    const { group_id, group_name, list_name } = req.body;
    if (!group_id) return res.status(422).json({ success: false, message: 'group_id is required.' });

    // Fetch contacts from the group
    let contacts;
    try {
        const response = await axios.get(`https://api.vaartabot.com/api/v1/contacts`, {
            headers: { 'X-API-Key': apiKey },
            params: { group_id, limit: 10000 },
        });
        const payload = response.data?.data || response.data?.contacts || response.data;
        contacts = Array.isArray(payload) ? payload : [];
    } catch (err) {
        console.error('[vaartabot.syncGroup]', err.response?.data || err.message);
        return res.status(502).json({ success: false, message: 'Could not fetch contacts from Vaartabot.' });
    }

    if (contacts.length === 0) {
        return res.json({ success: true, imported: 0, message: 'No contacts in this group.' });
    }

    const finalListName = list_name || group_name || `Vaartabot Group ${group_id}`;
    const [listResult] = await db.query(
        `INSERT INTO outreach_contact_lists
           (uploaded_by, list_name, file_name, total_contacts, imported_contacts, import_status)
         VALUES (?, ?, ?, ?, 0, 'processing')`,
        [req.user.id, finalListName, `vaartabot_group_${group_id}`, contacts.length]
    );
    const listId = listResult.insertId;

    // Background import
    setImmediate(async () => {
        let imported = 0;
        const errors = [];
        for (const c of contacts) {
            // Vaartabot contact shape: { name, phone, email?, ... }
            const fullName  = c.name || c.full_name || '';
            const phone     = c.phone || c.whatsapp_number || c.mobile || '';
            const email     = c.email || null;
            const waNumber  = c.whatsapp_number || c.phone || '';
            if (!phone && !email) { errors.push(`Skipped: no phone/email for "${fullName}"`); continue; }
            try {
                await db.query(
                    `INSERT IGNORE INTO outreach_contacts
                       (list_id, uploaded_by, full_name, email, phone, whatsapp_number, source, deleted_at)
                     VALUES (?, ?, ?, ?, ?, ?, 'vaartabot', NULL)`,
                    [listId, req.user.id, fullName, email, phone, waNumber]
                );
                imported++;
            } catch (e) {
                errors.push(e.message);
            }
        }
        await db.query(
            `UPDATE outreach_contact_lists SET import_status='done', imported_contacts=?, failed_rows=?, import_errors=? WHERE id=?`,
            [imported, contacts.length - imported,
             errors.length ? JSON.stringify(errors.slice(0, 50)) : null,
             listId]
        );
    });

    res.status(201).json({
        success: true,
        list_id: listId,
        total: contacts.length,
        message: `Importing ${contacts.length} contacts from Vaartabot group "${finalListName}" in background.`,
    });
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
            await axios.post('https://api.vaartabot.com/api/v1/messages/send',
                { to: phone, templateName: flow.template_name, language: flow.language_code || 'en' },
                { headers: { 'X-API-Key': apiKey } }
            ).catch(e => console.error('[autoReply.send]', e.response?.data || e.message));
        } else if (flow.response_type === 'text' && flow.response_text) {
            await axios.post('https://api.vaartabot.com/api/v1/messages/send-text',
                { to: phone, message: flow.response_text },
                { headers: { 'X-API-Key': apiKey } }
            ).catch(e => console.error('[autoReply.sendText]', e.response?.data || e.message));
        }
        break; // Only fire the first matching flow
    }
}

// ── POST /api/outreach/whatsapp/templates/sync ────────────────────────────────
// Fetch approved templates from Vaartabot and upsert into local whatsapp_templates.
exports.syncTemplates = async (req, res) => {
    const apiKey = process.env.VAARTABOT_API_KEY;
    if (!apiKey) return res.status(503).json({ success: false, message: 'Vaartabot API key not configured.' });

    let vaartabotTemplates;
    try {
        const response = await axios.get('https://api.vaartabot.com/api/v1/templates', {
            headers: { 'X-API-Key': apiKey },
        });
        // Vaartabot returns { data: [...] } or { templates: [...] } — handle both shapes
        const payload = response.data?.data || response.data?.templates || response.data;
        vaartabotTemplates = Array.isArray(payload) ? payload : [];
    } catch (err) {
        console.error('[vaartabot.syncTemplates]', err.response?.data || err.message);
        return res.status(502).json({ success: false, message: 'Could not fetch templates from Vaartabot.' });
    }

    if (vaartabotTemplates.length === 0) {
        return res.json({ success: true, synced: 0, message: 'No templates returned from Vaartabot.' });
    }

    let synced = 0;
    for (const t of vaartabotTemplates) {
        // Vaartabot template shape: { name, language, category, components: [...] }
        const templateName = t.name || t.template_name;
        const languageCode = t.language || t.language_code || 'en';
        const category     = (t.category || 'MARKETING').toUpperCase();

        // Extract body text from components array if present
        let bodyText = t.body_text || t.body || '';
        let headerType    = 'none';
        let headerContent = '';
        let footerText    = '';
        let variableCount = 0;

        if (Array.isArray(t.components)) {
            for (const comp of t.components) {
                const type = (comp.type || '').toUpperCase();
                if (type === 'BODY')   { bodyText = comp.text || ''; }
                if (type === 'HEADER') { headerType = (comp.format || 'TEXT').toLowerCase(); headerContent = comp.text || ''; }
                if (type === 'FOOTER') { footerText = comp.text || ''; }
            }
            // Count {{N}} placeholders in body
            const matches = bodyText.match(/\{\{\d+\}\}/g);
            variableCount = matches ? new Set(matches).size : 0;
        }

        if (!templateName || !bodyText) continue;

        // Upsert: match on template_name (it's unique per account)
        const [[existing]] = await db.query(
            'SELECT id FROM whatsapp_templates WHERE template_name = ? AND deleted_at IS NULL LIMIT 1',
            [templateName]
        );

        if (existing) {
            await db.query(
                `UPDATE whatsapp_templates SET language_code=?, category=?, body_text=?, header_type=?,
                 header_content=?, footer_text=?, variable_count=?, is_active=1 WHERE id=?`,
                [languageCode, category, bodyText, headerType, headerContent, footerText, variableCount, existing.id]
            );
        } else {
            await db.query(
                `INSERT INTO whatsapp_templates
                   (created_by, template_name, language_code, category, header_type, header_content, body_text, footer_text, variable_count, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [req.user.id, templateName, languageCode, category, headerType, headerContent, bodyText, footerText, variableCount]
            );
        }
        synced++;
    }

    res.json({ success: true, synced, total: vaartabotTemplates.length, message: `Synced ${synced} template(s) from Vaartabot.` });
};

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

// GET /api/outreach/webhooks/whatsapp — kept for compatibility; Vaartabot
// inbound webhook format is not yet documented in their public API reference.
exports.verifyWebhook = (req, res) => {
    // Support Meta-style hub.challenge verification if still needed
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.sendStatus(200); // Vaartabot: just acknowledge
};

// POST /api/outreach/webhooks/whatsapp — incoming messages & delivery receipts
exports.handleWebhook = async (req, res) => {
    res.sendStatus(200); // Always respond 200 immediately

    const body = req.body;
    if (body?.object !== 'whatsapp_business_account') return;

    try {
        const entries = body.entry || [];
        for (const entry of entries) {
            for (const change of entry.changes || []) {
                const value = change.value;
                if (!value) continue;

                // Incoming messages
                for (const msg of value.messages || []) {
                    if (msg.type === 'text') {
                        await handleIncomingWAMessage(
                            msg.from,
                            msg.id,
                            msg.text?.body || '',
                            msg.timestamp
                        );
                    }
                }

                // Delivery / read status updates
                for (const status of value.statuses || []) {
                    if (['delivered','read'].includes(status.status)) {
                        await db.query(
                            "UPDATE outreach_campaign_logs SET status = 'sent' WHERE whatsapp_message_id = ? AND status = 'pending'",
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

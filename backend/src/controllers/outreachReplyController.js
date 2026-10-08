const fs = require('fs');
const db = require('../config/db');
const axios = require('axios');
const media = require('../services/whatsappMedia');
const inbox = require('../services/whatsappInbox');
const { getTransporter, getDefaultFrom } = require('../utils/outreachEmail');
const { createLeadFromContact } = require('../services/leadConverter');

const VB_BASE   = 'https://vaartabot.com/api/v1';
const vbHeaders = () => ({ 'X-API-Key': process.env.VAARTABOT_API_KEY, 'Content-Type': 'application/json' });

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) {
        console.error('[notify:reply]', err.message);
    }
};

// ── GET /outreach/replies ─────────────────────────────────────────────────────
exports.listReplies = async (req, res) => {
    const { status, channel, campaign_id, page = 1, limit = 20 } = req.query;
    const offset  = (parseInt(page) - 1) * parseInt(limit);
    const filters = ['r.deleted_at IS NULL'];
    const params  = [];

    if (req.user.role === 'hr_staff') {
        filters.push('r.assigned_to = ?');
        params.push(req.user.id);
    }
    if (status)  { filters.push('r.reply_status = ?');  params.push(status); }
    if (channel) { filters.push('r.channel = ?');       params.push(channel); }
    if (Number.isInteger(parseInt(campaign_id, 10))) { filters.push('r.campaign_id = ?'); params.push(parseInt(campaign_id, 10)); }

    const where = filters.join(' AND ');
    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM outreach_email_replies r WHERE ${where}`, params
        );
        const [rows] = await db.query(
            `SELECT r.*, (r.media_key IS NOT NULL) AS has_media, c.campaign_name, u.name AS assigned_to_name,
                    ct.full_name AS contact_name, ct.company_name AS contact_company
             FROM outreach_email_replies r
             LEFT JOIN outreach_campaigns c ON c.id = r.campaign_id
             LEFT JOIN users u ON u.id = r.assigned_to
             LEFT JOIN outreach_contacts ct ON ct.id = r.contact_id
             WHERE ${where}
             ORDER BY r.received_at DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        for (const r of rows) { r.has_media = !!r.has_media; delete r.media_key; }
        res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('[outreachReply.list]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /outreach/replies/:id ─────────────────────────────────────────────────
exports.getReply = async (req, res) => {
    try {
        const [[row]] = await db.query(
            `SELECT r.*, (r.media_key IS NOT NULL) AS has_media, c.campaign_name, u.name AS assigned_to_name,
                    ct.full_name AS contact_name, ct.email AS contact_email, ct.company_name AS contact_company
             FROM outreach_email_replies r
             LEFT JOIN outreach_campaigns c ON c.id = r.campaign_id
             LEFT JOIN users u ON u.id = r.assigned_to
             LEFT JOIN outreach_contacts ct ON ct.id = r.contact_id
             WHERE r.id = ? AND r.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Reply not found.' });
        if (req.user.role === 'hr_staff' && row.assigned_to !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        // Mark as read when viewed
        if (row.reply_status === 'unread') {
            await db.query(
                "UPDATE outreach_email_replies SET reply_status = 'read' WHERE id = ?", [req.params.id]
            );
            row.reply_status = 'read';
        }

        row.has_media = !!row.has_media;
        delete row.media_key;
        if (row.channel === 'whatsapp') {
            // The conversation with this number, and whether WhatsApp still lets us answer.
            row.thread = await inbox.getThread(row.from_phone, req.user);
            row.window = await inbox.getWindow(row.from_phone);
        }

        res.json({ success: true, data: row });
    } catch (err) {
        console.error('[outreachReply.get]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /outreach/replies/:id/reply — send email reply ──────────────────────
// WhatsApp: reply with text and/or a file. Vaartabot's reply call carries text only, so a file is
// stored here and the message carries a private link to it (it works for SHARE_DAYS days).
async function sendWhatsAppReply(req, res, reply) {
    const file = req.file;
    const discardUpload = () => { if (file) fs.unlink(file.path, () => {}); };
    try {
        const text = String(req.body.body_text || '').trim();
        if (!process.env.VAARTABOT_API_KEY) { discardUpload(); return res.status(503).json({ success: false, message: 'Vaartabot API key not configured.' }); }
        const phone = inbox.digits(reply.from_phone);
        if (!phone) { discardUpload(); return res.status(422).json({ success: false, message: 'No phone number on this reply.' }); }
        if (!text && !file) { discardUpload(); return res.status(422).json({ success: false, message: 'Type a message or attach a file.' }); }
        if (text.length > 3500) { discardUpload(); return res.status(422).json({ success: false, message: 'That message is too long for WhatsApp. Keep it under 3,500 characters.' }); }

        const win = await inbox.getWindow(phone);
        if (!win.open) {
            discardUpload();
            return res.status(422).json({
                success: false, code: 'WINDOW_CLOSED',
                message: 'WhatsApp only allows a free reply within 24 hours of the customer\'s last message, and that window has closed. Send an approved template from a campaign to start the conversation again.',
            });
        }

        let message = text;
        let share = null;
        let fileInfo = null;
        if (file) {
            const mime = media.mimeFromName(file.originalname) || media.cleanMime(file.mimetype);
            const name = media.safeFilename(file.originalname);
            share = { token: media.newShareToken(), expires: new Date(Date.now() + media.SHARE_DAYS * 86400000) };
            fileInfo = { key: media.relKey(file.filename), mime, name, size: file.size, kind: media.kindOfMime(mime) };
            message = `${text ? `${text}\n\n` : ''}📎 ${name} (${media.humanSize(file.size)})\n${media.shareUrl(share.token)}`;
        }

        let waId = null;
        try {
            const vb = await axios.post(`${VB_BASE}/messages/reply`, { to: phone, message }, { headers: vbHeaders(), timeout: 20000 });
            if (vb.data?.success === false) throw new Error(vb.data.error || 'WhatsApp rejected the message.');
            waId = vb.data?.data?.message_id || vb.data?.data?.messageId || vb.data?.message_id || null;
        } catch (err) {
            discardUpload();
            const why = err.response?.data?.error || err.message;
            console.error('[outreachReply.sendWhatsApp]', why);
            return res.status(502).json({ success: false, message: `WhatsApp could not send that message: ${why}` });
        }

        const [ins] = await db.query(
            `INSERT INTO whatsapp_outbound_messages
               (phone, contact_id, reply_id, campaign_id, sent_by, body_text, msg_type,
                media_key, media_mime, media_filename, media_size, share_token, share_expires_at, wa_message_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [phone, reply.contact_id || null, reply.id, reply.campaign_id || null, req.user.id, text || null,
             fileInfo ? fileInfo.kind : 'text',
             fileInfo?.key || null, fileInfo?.mime || null, fileInfo?.name || null, fileInfo?.size || null,
             share?.token || null, share?.expires || null, waId]
        );

        await db.query(
            "UPDATE outreach_email_replies SET reply_status = 'replied', reply_note = ? WHERE id = ?",
            [(text || `📎 ${fileInfo?.name || 'file'}`).slice(0, 1000), reply.id]
        );

        const [[me]] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
        res.json({
            success: true, message: 'Reply sent.',
            data: {
                id: ins.insertId, direction: 'out', at: new Date(), body_text: text || null,
                msg_type: fileInfo ? fileInfo.kind : 'text', media_mime: fileInfo?.mime || null,
                media_filename: fileInfo?.name || null, media_size: fileInfo?.size || null,
                has_media: !!fileInfo, sent_by_name: me?.name || null,
            },
        });
    } catch (err) {
        discardUpload();
        console.error('[outreachReply.sendWhatsApp]', err);
        res.status(500).json({ success: false, message: 'Failed to send reply: ' + err.message });
    }
}

exports.sendReply = async (req, res) => {
    const { body_text, body_html } = req.body;
    try {
        const [[reply]] = await db.query(
            'SELECT * FROM outreach_email_replies WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!reply) { if (req.file) fs.unlink(req.file.path, () => {}); return res.status(404).json({ success: false, message: 'Reply not found.' }); }
        if (req.user.role === 'hr_staff' && reply.assigned_to !== req.user.id) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        if (reply.channel === 'whatsapp') return sendWhatsAppReply(req, res, reply);

        if (!body_text && !body_html) {
            return res.status(422).json({ success: false, message: 'body_text or body_html is required.' });
        }

        // Email reply via outreach SMTP
        const [[emp]] = await db.query(
            'SELECT outreach_email, outreach_email_name FROM employees WHERE user_id = ? AND deleted_at IS NULL',
            [req.user.id]
        );
        const fromEmail = emp?.outreach_email || getDefaultFrom();
        const fromName  = emp?.outreach_email_name || 'LadderStep Human Consulting';

        const transporter = getTransporter();
        await transporter.sendMail({
            from:        `"${fromName}" <${fromEmail}>`,
            to:          reply.from_email,
            subject:     `Re: ${reply.subject || ''}`,
            text:        body_text || '',
            html:        body_html || body_text || '',
            inReplyTo:   reply.message_id || undefined,
            references:  reply.message_id ? [reply.message_id] : undefined,
        });

        await db.query(
            "UPDATE outreach_email_replies SET reply_status = 'replied', reply_note = ? WHERE id = ?",
            [body_text?.slice(0, 1000) || null, req.params.id]
        );

        res.json({ success: true, message: 'Reply sent.' });
    } catch (err) {
        console.error('[outreachReply.sendReply]', err);
        const msg = err.response?.data?.error || err.message;
        res.status(500).json({ success: false, message: 'Failed to send reply: ' + msg });
    }
};

// ── PATCH /outreach/replies/:id/convert ──────────────────────────────────────
exports.convertToLead = async (req, res) => {
    try {
        const [[reply]] = await db.query(
            'SELECT * FROM outreach_email_replies WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!reply) return res.status(404).json({ success: false, message: 'Reply not found.' });
        if (req.user.role === 'hr_staff' && reply.assigned_to !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (!reply.contact_id) {
            return res.status(422).json({ success: false, message: 'Reply has no linked contact. Cannot auto-convert.' });
        }

        // Allow caller to specify which executive owns the lead; default to assignee or self
        const executiveUserId = req.body.executive_user_id || reply.assigned_to || req.user.id;

        const source   = reply.channel === 'whatsapp' ? 'whatsapp' : 'cold_email';
        const leadId   = await createLeadFromContact({
            contactId: reply.contact_id,
            source,
            campaignId: reply.campaign_id,
            executiveUserId,
            replyId: reply.id,
        });

        await db.query(
            "UPDATE outreach_email_replies SET reply_status = 'converted', lead_id = ? WHERE id = ?",
            [leadId, req.params.id]
        );

        res.json({ success: true, message: 'Contact converted to lead.', lead_id: leadId });
    } catch (err) {
        console.error('[outreachReply.convert]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PATCH /outreach/replies/:id/ignore ───────────────────────────────────────
exports.ignoreReply = async (req, res) => {
    try {
        const [[reply]] = await db.query(
            'SELECT id, assigned_to FROM outreach_email_replies WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!reply) return res.status(404).json({ success: false, message: 'Reply not found.' });
        if (req.user.role === 'hr_staff' && reply.assigned_to !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        await db.query(
            "UPDATE outreach_email_replies SET reply_status = 'ignored' WHERE id = ?", [req.params.id]
        );
        res.json({ success: true, message: 'Reply marked as ignored.' });
    } catch (err) {
        console.error('[outreachReply.ignore]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PATCH /outreach/replies/:id/assign — admin only ──────────────────────────
exports.assignReply = async (req, res) => {
    const { assigned_to } = req.body;
    if (!assigned_to) return res.status(422).json({ success: false, message: 'assigned_to (user_id) required.' });
    try {
        const [[reply]] = await db.query(
            'SELECT id FROM outreach_email_replies WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!reply) return res.status(404).json({ success: false, message: 'Reply not found.' });

        await db.query(
            'UPDATE outreach_email_replies SET assigned_to = ? WHERE id = ?', [assigned_to, req.params.id]
        );

        await notify(assigned_to, 'reply_assigned', 'Reply Assigned to You',
            'An outreach reply has been assigned to you for follow-up.',
            { reply_id: req.params.id }
        );
        res.json({ success: true, message: 'Reply assigned.' });
    } catch (err) {
        console.error('[outreachReply.assign]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

const db = require('../config/db');
const { sendGraphMail } = require('../utils/graphMail');

const THANKS = 'Thank you for your message! We will get back to you soon.';

// Single-line fields: strip line breaks so nothing can smuggle extra mail headers.
const oneLine = (v, max) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

// POST /api/public/contact — the marketing website's contact form. No login.
exports.submitContact = async (req, res) => {
    const b = req.body || {};

    // Hidden "website" field: people never see it, bots fill it. Pretend it worked.
    if (b.website) return res.json({ success: true, message: THANKS });

    const name = oneLine(b.name, 100);
    const email = oneLine(b.email, 150).toLowerCase();
    const phone = oneLine(b.phone, 30);
    const company = oneLine(b.company, 120);
    const message = String(b.message ?? '').trim().slice(0, 3000);

    if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: 'Name, email and message are required.' });
    }
    if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const to = process.env.CONTACT_FORM_TO || process.env.CONTACT_EMAIL || process.env.SMTP_USER;
    const from = process.env.EMAIL_FROM || `"LadderStep Human Consulting" <${process.env.SMTP_USER}>`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #164B78;">New website enquiry</h2>
        <div style="background-color: #f5f7fa; padding: 20px; border-radius: 8px; margin-top: 20px;">
          <p><strong>Name:</strong> ${esc(name)}</p>
          <p><strong>Email:</strong> ${esc(email)}</p>
          ${phone ? `<p><strong>Phone:</strong> ${esc(phone)}</p>` : ''}
          ${company ? `<p><strong>Company:</strong> ${esc(company)}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap; background-color: white; padding: 15px; border-radius: 4px; margin-top: 10px;">${esc(message)}</p>
        </div>
        <p style="margin-top: 20px; color: #8C9094; font-size: 12px;">Sent from the LadderStep website contact form. Reply to this email to answer ${esc(name)} directly.</p>
      </div>`;

    let emailed = false;
    try {
        await sendGraphMail({
            from, to, replyTo: email,
            subject: `Website enquiry from ${name}`,
            html, saveToSent: true,
        });
        emailed = true;
    } catch (err) {
        console.error('[public.contact] email failed:', err.message);
    }

    // The mail poller marks mail from our own mailbox as read, so staff could miss the
    // email. Tell the admins inside the portal too — it is also the safety net if mail is down.
    let notified = false;
    try {
        const [admins] = await db.query(
            `SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id
             WHERE ro.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL`
        );
        const body = `${email}${phone ? ` · ${phone}` : ''}${company ? ` · ${company}` : ''}: ${message.slice(0, 280)}`;
        const meta = JSON.stringify({ name, email, phone: phone || null, company: company || null });
        for (const a of admins) {
            await db.query(
                `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, 'website_enquiry', ?, ?, ?)`,
                [a.id, `New website enquiry from ${name}`, body, meta]
            );
        }
        notified = admins.length > 0;
    } catch (err) {
        console.error('[public.contact] notify failed:', err.message);
    }

    if (!emailed && !notified) {
        return res.status(502).json({
            success: false,
            message: 'We could not send your message just now. Please try again in a few minutes.',
        });
    }
    res.json({ success: true, message: THANKS });
};

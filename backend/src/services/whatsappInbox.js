/**
 * WhatsApp inbox helpers: who sent a message (the WhatsApp profile name), whether we may still
 * answer them (WhatsApp's 24-hour window), and the two-way conversation shown in the inbox.
 */

const axios = require('axios');
const db = require('../config/db');

const VB_BASE = 'https://vaartabot.com/api/v1';
const vbHeaders = () => ({ 'X-API-Key': process.env.VAARTABOT_API_KEY, 'Content-Type': 'application/json' });

// WhatsApp lets a business send free-form messages only within 24 hours of the customer's last
// message. Stop a few minutes early so a send never races the cut-off.
const WINDOW_MS = (24 * 60 - 5) * 60 * 1000;

const digits = (p) => String(p || '').replace(/\D/g, '');

// ── Names ───────────────────────────────────────────────────────────────────
const cleanName = (v, phone) => {
    if (typeof v !== 'string') return null;
    const n = v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!n || digits(n) === digits(phone) || /^\+?[\d\s-]{7,}$/.test(n)) return null;
    return n;
};

/** The sender's WhatsApp profile name if the webhook carried it, in any of the shapes providers use. */
function extractProfileName(data = {}, body = {}, phone) {
    const c0 = (x) => (Array.isArray(x?.contacts) ? x.contacts[0] : null);
    const candidates = [
        data.profile_name, data.profileName, data.contact_name, data.contactName, data.sender_name, data.senderName,
        data.from_name, data.fromName, data.name, data.pushName, data.push_name,
        data.contact?.name, data.contact?.profile?.name, data.contact?.profile_name,
        c0(data)?.profile?.name, c0(data)?.name, c0(body)?.profile?.name, c0(body)?.name,
        body.profile_name, body.contact_name, body.name,
    ];
    for (const c of candidates) {
        const n = cleanName(c, phone);
        if (n) return n;
    }
    return null;
}

const nameCache = new Map(); // phone digits -> { name, at }
const NAME_TTL_MS = 5 * 60 * 1000;

/** Ask Vaartabot's contact list for the name WhatsApp gave it for this number. */
async function lookupProfileName(phone, { fresh = false } = {}) {
    const d = digits(phone);
    if (!d || !process.env.VAARTABOT_API_KEY) return null;
    const hit = nameCache.get(d);
    if (!fresh && hit && Date.now() - hit.at < NAME_TTL_MS) return hit.name;
    try {
        const res = await axios.get(`${VB_BASE}/contacts`, { headers: vbHeaders(), params: { search: d }, timeout: 8000 });
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        const match = rows.find((r) => digits(r.phone) === d);
        const name = cleanName(match?.name, phone);
        nameCache.set(d, { name, at: Date.now() });
        return name;
    } catch (err) {
        console.error('[whatsappInbox:lookupName]', err.response?.data?.error || err.message);
        return null;
    }
}

/** Save a name on every message from this number that does not have one yet. Returns rows changed. */
async function saveNameForPhone(phone, name) {
    const d = digits(phone);
    if (!d || !name) return 0;
    const [r] = await db.query(
        `UPDATE outreach_email_replies SET from_name = ?
         WHERE channel = 'whatsapp' AND REPLACE(from_phone, '+', '') = ?
           AND (from_name IS NULL OR from_name = '') AND deleted_at IS NULL`,
        [name, d]
    );
    return r.affectedRows || 0;
}

/**
 * Vaartabot often creates the contact (and its name) a moment after the message arrives, so look
 * again a little later if the first lookup came back empty.
 */
function captureNameLater(phone) {
    [15_000, 120_000].forEach((delay) => {
        setTimeout(async () => {
            try {
                const name = await lookupProfileName(phone, { fresh: true });
                if (name) await saveNameForPhone(phone, name);
            } catch (e) { console.error('[whatsappInbox:captureLater]', e.message); }
        }, delay).unref?.();
    });
}

// ── 24-hour window ──────────────────────────────────────────────────────────
async function getWindow(phone) {
    const d = digits(phone);
    const [[row]] = await db.query(
        `SELECT MAX(received_at) AS last_in FROM outreach_email_replies
         WHERE channel = 'whatsapp' AND REPLACE(from_phone, '+', '') = ? AND deleted_at IS NULL`,
        [d]
    );
    const lastIn = row?.last_in ? new Date(row.last_in) : null;
    const open = !!lastIn && Date.now() - lastIn.getTime() < WINDOW_MS;
    return {
        open,
        last_inbound_at: lastIn,
        expires_at: lastIn ? new Date(lastIn.getTime() + WINDOW_MS) : null,
    };
}

// ── Conversation ────────────────────────────────────────────────────────────
// Staff see only their own side of a conversation unless they are an admin.
async function getThread(phone, user) {
    const d = digits(phone);
    const mineOnly = user?.role === 'hr_staff';

    const [inbound] = await db.query(
        `SELECT id, received_at AS at, body_text, msg_type, media_mime, media_filename, media_size,
                (media_key IS NOT NULL) AS has_media, from_name
         FROM outreach_email_replies
         WHERE channel = 'whatsapp' AND REPLACE(from_phone, '+', '') = ? AND deleted_at IS NULL
           ${mineOnly ? 'AND assigned_to = ?' : ''}
         ORDER BY received_at DESC LIMIT 100`,
        mineOnly ? [d, user.id] : [d]
    );
    const [outbound] = await db.query(
        `SELECT m.id, m.created_at AS at, m.body_text, m.msg_type, m.media_mime, m.media_filename, m.media_size,
                (m.media_key IS NOT NULL) AS has_media, m.share_token, m.share_expires_at, u.name AS sent_by_name
         FROM whatsapp_outbound_messages m
         LEFT JOIN users u ON u.id = m.sent_by
         WHERE m.phone = ? AND m.deleted_at IS NULL
           ${mineOnly ? 'AND m.sent_by = ?' : ''}
         ORDER BY m.created_at DESC LIMIT 100`,
        mineOnly ? [d, user.id] : [d]
    );

    const items = [
        ...inbound.map((m) => ({ ...m, direction: 'in', has_media: !!m.has_media })),
        ...outbound.map((m) => ({
            ...m, direction: 'out', has_media: !!m.has_media,
            share_expired: m.share_expires_at ? new Date(m.share_expires_at).getTime() < Date.now() : false,
            share_token: undefined, share_expires_at: undefined,
        })),
    ];
    items.sort((a, b) => new Date(a.at) - new Date(b.at));
    return items.slice(-100);
}

module.exports = {
    WINDOW_MS, digits, extractProfileName, lookupProfileName, saveNameForPhone, captureNameLater, getWindow, getThread,
};

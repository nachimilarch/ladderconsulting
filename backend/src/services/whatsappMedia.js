/**
 * WhatsApp media: what we accept, how an inbound file is fetched and stored, and how a stored
 * file is served. Files live under uploads/whatsapp/ (never served statically) and are only
 * reachable through authenticated staff endpoints, or, for files we send out, through a
 * long random share link that expires.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const dns = require('dns').promises;
const axios = require('axios');

const MEDIA_DIR = path.join(process.cwd(), 'uploads', 'whatsapp');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const MAX_BYTES = 10 * 1024 * 1024; // matches the upload limit used elsewhere in the app
const SHARE_DAYS = 30;

// What may be stored or sent. Anything else (scripts, executables, archives) is refused.
const MIME_EXT = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt', 'text/csv': '.csv',
    'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/aac': '.aac', 'audio/mp4': '.m4a', 'audio/amr': '.amr', 'audio/wav': '.wav',
    'video/mp4': '.mp4', 'video/3gpp': '.3gp', 'video/quicktime': '.mov', 'video/webm': '.webm',
};
const EXT_MIME = Object.fromEntries(Object.entries(MIME_EXT).map(([m, e]) => [e, m]));
EXT_MIME['.jpeg'] = 'image/jpeg';
EXT_MIME['.oga'] = 'audio/ogg';

const cleanMime = (m) => String(m || '').split(';')[0].trim().toLowerCase();
const isAllowedMime = (m) => Object.prototype.hasOwnProperty.call(MIME_EXT, cleanMime(m));
const mimeFromName = (name) => EXT_MIME[path.extname(String(name || '')).toLowerCase()] || null;

const kindOfMime = (mime) => {
    const m = cleanMime(mime);
    if (m.startsWith('image/')) return 'image';
    if (m.startsWith('audio/')) return 'audio';
    if (m.startsWith('video/')) return 'video';
    return 'document';
};

// Files a browser can safely show inline. Everything else is offered as a download.
const isInlineSafe = (mime) => {
    const m = cleanMime(mime);
    return m.startsWith('image/') || m.startsWith('audio/') || m.startsWith('video/') || m === 'application/pdf';
};

const safeFilename = (name, fallback = 'file') => {
    const base = path.basename(String(name || '')).replace(/[^\w.\- ()]+/g, '_').trim().slice(0, 120);
    return base || fallback;
};

const newStoredName = (mime) => `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${MIME_EXT[cleanMime(mime)] || ''}`;
const relKey = (stored) => path.posix.join('uploads', 'whatsapp', stored);
const absPath = (key) => {
    // Only ever resolve inside the media folder, whatever is stored in the database.
    const full = path.resolve(process.cwd(), String(key || ''));
    return full.startsWith(MEDIA_DIR + path.sep) ? full : null;
};

// ── Inbound: pull the file details out of whatever shape the webhook sends ───
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

const MEDIA_TYPES = new Set(['image', 'document', 'audio', 'voice', 'video', 'sticker']);
const OTHER_TYPES = new Set(['location', 'contacts', 'contact', 'reaction', 'button', 'interactive', 'order', 'unsupported']);

function extractInboundMedia(data = {}) {
    let type = String(data.type || data.message_type || data.messageType || '').toLowerCase();
    if (type === 'text') type = '';
    const nested = (data.media && typeof data.media === 'object') ? data.media
        : (type && data[type] && typeof data[type] === 'object') ? data[type] : {};

    const url = str(data.media_url) || str(data.mediaUrl) || str(data.file_url) || str(data.fileUrl)
        || str(data.url) || str(data.link) || str(nested.url) || str(nested.link) || str(nested.media_url)
        || (typeof data.media === 'string' ? str(data.media) : null);
    const mimeRaw = str(data.mime_type) || str(data.mimeType) || str(nested.mime_type) || str(nested.mimeType)
        || (str(data.media_type) && String(data.media_type).includes('/') ? str(data.media_type) : null);
    const filename = str(data.filename) || str(data.file_name) || str(data.fileName) || str(nested.filename) || str(nested.file_name);
    const caption = str(data.caption) || str(nested.caption);

    const rawText = str(data.text) || str(data.message) || str(data.body);
    if (!type && rawText === '[unsupported]') type = 'unsupported';
    if (!type && url) type = kindOfMime(mimeRaw || mimeFromName(filename) || '') === 'document' ? 'document' : kindOfMime(mimeRaw);

    const msgType = type === 'voice' ? 'audio' : (type || null);
    return {
        msgType: msgType && (MEDIA_TYPES.has(type) || OTHER_TYPES.has(type) || url) ? msgType : null,
        url, mime: mimeRaw ? cleanMime(mimeRaw) : null, filename, caption,
        hasFileReference: !!url,
    };
}

// ── Inbound: fetch the file, safely ─────────────────────────────────────────
const isPrivateIp = (ip) => {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    const v = ip.toLowerCase();
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9')
        || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('::ffff:');
};

async function assertPublicHttpUrl(urlStr) {
    const u = new URL(urlStr);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) media links are fetched.');
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) throw new Error('Refusing a local address.');
    const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Refusing a non-public address.');
}

/** Download a media file the webhook pointed us at. Returns { key, mime, filename, size } or throws. */
async function downloadInboundMedia({ url, mime, filename }) {
    await assertPublicHttpUrl(url);
    const headers = {};
    try { if (new URL(url).hostname.endsWith('vaartabot.com')) headers['X-API-Key'] = process.env.VAARTABOT_API_KEY; } catch { /* ignore */ }

    const res = await axios.get(url, {
        responseType: 'stream', headers, timeout: 25000, maxRedirects: 3,
        maxContentLength: MAX_BYTES, validateStatus: (s) => s >= 200 && s < 300,
        beforeRedirect: (options) => {
            const h = String(options.hostname || '').replace(/^\[|\]$/g, '');
            if (h === 'localhost' || (net.isIP(h) && isPrivateIp(h))) throw new Error('Redirected to a non-public address.');
        },
    });

    const headerMime = cleanMime(res.headers['content-type']);
    const finalMime = [cleanMime(mime), headerMime, mimeFromName(filename)].find((m) => m && isAllowedMime(m));
    if (!finalMime) { res.data.destroy(); throw new Error(`File type not accepted (${headerMime || mime || 'unknown'}).`); }

    const stored = newStoredName(finalMime);
    const target = path.join(MEDIA_DIR, stored);
    let size = 0;
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(target);
        res.data.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BYTES) { res.data.destroy(new Error('File is larger than the 10 MB limit.')); }
        });
        res.data.on('error', (e) => { out.destroy(); fs.unlink(target, () => reject(e)); });
        out.on('error', (e) => { fs.unlink(target, () => reject(e)); });
        out.on('finish', resolve);
        res.data.pipe(out);
    });

    const dispositionName = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers['content-disposition'] || '')?.[1];
    return {
        key: relKey(stored),
        mime: finalMime,
        filename: safeFilename(filename || dispositionName || `whatsapp-${kindOfMime(finalMime)}${MIME_EXT[finalMime] || ''}`),
        size,
    };
}

// ── Serving ─────────────────────────────────────────────────────────────────
function sendStoredFile(res, { key, mime, filename }, { forceDownload = false } = {}) {
    const file = absPath(key);
    if (!file || !fs.existsSync(file)) { res.status(404).json({ success: false, message: 'File not found.' }); return; }
    const inline = !forceDownload && isInlineSafe(mime);
    res.setHeader('Content-Type', cleanMime(mime) || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeFilename(filename).replace(/"/g, '')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // The app and the API may sit on sibling addresses; the default (same-origin) would stop images loading.
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    fs.createReadStream(file).pipe(res);
}

const newShareToken = () => crypto.randomBytes(24).toString('base64url');

const shareUrl = (token) => {
    const base = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '').replace(/^http:\/\/(?!localhost)/, 'https://');
    return `${base}/api/outreach/media/${token}`;
};

const humanSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

module.exports = {
    MEDIA_DIR, MAX_BYTES, SHARE_DAYS, MIME_EXT,
    cleanMime, isAllowedMime, mimeFromName, kindOfMime, isInlineSafe, safeFilename, newStoredName, relKey, absPath,
    extractInboundMedia, downloadInboundMedia, sendStoredFile, newShareToken, shareUrl, humanSize,
};

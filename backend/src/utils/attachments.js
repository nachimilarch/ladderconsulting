// Shared rules for files attached to email campaigns and email templates.
// Mail goes out through Microsoft Graph as inline base64 attachments, which has a ~4MB request
// limit (3MB per attachment), so the caps below are deliberately conservative.
const fs = require('fs');
const path = require('path');

const MAX_ATTACH_BYTES = 2.5 * 1024 * 1024;   // per file AND total per campaign/template
const ATTACH_MIME = {
    '.pdf':  'application/pdf',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.gif':  'image/gif',
    '.doc':  'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls':  'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt':  'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// Video and audio are never attached to the email itself; the recipient gets a download link.
const MAX_LINK_BYTES = 25 * 1024 * 1024;       // per file sent as a link
const MAX_LINK_FILES = 5;                      // per campaign
const LINK_ONLY_MIME = {
    '.mp4':  'video/mp4',
    '.mov':  'video/quicktime',
    '.webm': 'video/webm',
    '.mp3':  'audio/mpeg',
    '.m4a':  'audio/mp4',
    '.wav':  'audio/wav',
};

const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);
const MAGIC = {
    '.pdf':  (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]),                 // %PDF
    '.jpg':  (b) => startsWith(b, [0xFF, 0xD8, 0xFF]),
    '.jpeg': (b) => startsWith(b, [0xFF, 0xD8, 0xFF]),
    '.png':  (b) => startsWith(b, [0x89, 0x50, 0x4E, 0x47]),
    '.gif':  (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]),                 // GIF8
    '.doc':  (b) => startsWith(b, [0xD0, 0xCF, 0x11, 0xE0]),
    '.docx': (b) => startsWith(b, [0x50, 0x4B, 0x03, 0x04]),                 // zip
    '.xls':  (b) => startsWith(b, [0xD0, 0xCF, 0x11, 0xE0]),
    '.xlsx': (b) => startsWith(b, [0x50, 0x4B, 0x03, 0x04]),
    '.ppt':  (b) => startsWith(b, [0xD0, 0xCF, 0x11, 0xE0]),
    '.pptx': (b) => startsWith(b, [0x50, 0x4B, 0x03, 0x04]),
    '.mp4':  (b) => b.slice(4, 8).toString('latin1') === 'ftyp',
    '.mov':  (b) => b.slice(4, 8).toString('latin1') === 'ftyp' || ['moov', 'mdat', 'wide', 'free', 'skip'].includes(b.slice(4, 8).toString('latin1')),
    '.m4a':  (b) => b.slice(4, 8).toString('latin1') === 'ftyp',
    '.webm': (b) => startsWith(b, [0x1A, 0x45, 0xDF, 0xA3]),
    '.mp3':  (b) => startsWith(b, [0x49, 0x44, 0x33]) || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0),   // ID3 tag or frame sync
    '.wav':  (b) => b.slice(0, 4).toString('latin1') === 'RIFF',
};

const fmtMb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const safeUnlink = (p) => { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ } };

// Checks a freshly uploaded multer file. Returns { mime } or { error }. Deletes the file on error.
function checkUploadedFile(file, existingBytes = 0) {
    const ext = path.extname(file.originalname).toLowerCase();
    const fail = (error) => { safeUnlink(file.path); return { error }; };
    if (!ATTACH_MIME[ext]) return fail('Only PDF, images (JPG, PNG, GIF) and Word documents can be attached.');
    if (file.size > MAX_ATTACH_BYTES) return fail(`File is too large (${fmtMb(file.size)}). Maximum is ${fmtMb(MAX_ATTACH_BYTES)}.`);
    if (existingBytes + file.size > MAX_ATTACH_BYTES) {
        return fail(`Attachments are limited to ${fmtMb(MAX_ATTACH_BYTES)} in total. Remove one first.`);
    }
    let head;
    try {
        const fd = fs.openSync(file.path, 'r');
        head = Buffer.alloc(8);
        fs.readSync(fd, head, 0, 8, 0);
        fs.closeSync(fd);
    } catch { return fail('Could not read the uploaded file.'); }
    if (!MAGIC[ext](head)) return fail('File contents do not match its type. Upload a real PDF, image or Word document.');
    return { mime: ATTACH_MIME[ext] };
}

// Checks a campaign attachment and decides how it travels: inline ('attach') when it is a small
// document that still fits in the 2.5 MB mail budget, otherwise a download link ('link').
// Returns { mime, delivery } or { error } (and deletes the file on error).
function classifyCampaignUpload(file, { attachBytes = 0, linkCount = 0 } = {}) {
    const ext = path.extname(file.originalname).toLowerCase();
    const fail = (error) => { safeUnlink(file.path); return { error }; };
    const mime = ATTACH_MIME[ext] || LINK_ONLY_MIME[ext];
    if (!mime) return fail('Allowed: PDF, images, Word, Excel, PowerPoint, video (MP4, MOV, WebM) and audio (MP3, M4A, WAV).');
    if (file.size > MAX_LINK_BYTES) return fail(`File is too large (${fmtMb(file.size)}). Maximum is ${fmtMb(MAX_LINK_BYTES)}.`);
    let head;
    try {
        const fd = fs.openSync(file.path, 'r');
        head = Buffer.alloc(12);
        fs.readSync(fd, head, 0, 12, 0);
        fs.closeSync(fd);
    } catch { return fail('Could not read the uploaded file.'); }
    if (!MAGIC[ext](head)) return fail('File contents do not match its type.');
    const mustLink = !!LINK_ONLY_MIME[ext] || file.size > MAX_ATTACH_BYTES || attachBytes + file.size > MAX_ATTACH_BYTES;
    if (mustLink && linkCount >= MAX_LINK_FILES) return fail(`At most ${MAX_LINK_FILES} files can be sent as download links per campaign.`);
    return { mime, delivery: mustLink ? 'link' : 'attach' };
}

const shareBase = () => (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '').replace(/^http:\/\/(?!localhost)/, 'https://');
const fileLinkUrl = (token) => `${shareBase()}/api/outreach/files/${token}`;

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// HTML block appended to every email of a campaign that has link files.
function linkBlockHtml(links) {
    if (!links.length) return '';
    const items = links.map((l) =>
        `<li style="margin:4px 0"><a href="${escHtml(fileLinkUrl(l.share_token))}" style="color:#4f46e5">${escHtml(l.file_name)}</a> <span style="color:#6b7280">(${fmtMb(l.file_size)})</span></li>`).join('');
    return `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:13px;color:#374151"><b>Files shared with this email</b><ul style="margin:6px 0 0 18px;padding:0">${items}</ul></div>`;
}

// Copy a stored attachment file to a new unique name (so deleting one copy never breaks another).
function copyStoredFile(srcPath) {
    if (!srcPath || !fs.existsSync(srcPath)) return null;
    const ext = path.extname(srcPath);
    const dest = path.join(path.dirname(srcPath), `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    fs.copyFileSync(srcPath, dest);
    return dest;
}

module.exports = { MAX_ATTACH_BYTES, MAX_LINK_BYTES, MAX_LINK_FILES, ATTACH_MIME, LINK_ONLY_MIME, classifyCampaignUpload, fileLinkUrl, linkBlockHtml, checkUploadedFile, copyStoredFile, safeUnlink, fmtMb };

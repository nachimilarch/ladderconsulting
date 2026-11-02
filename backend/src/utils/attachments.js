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

// Copy a stored attachment file to a new unique name (so deleting one copy never breaks another).
function copyStoredFile(srcPath) {
    if (!srcPath || !fs.existsSync(srcPath)) return null;
    const ext = path.extname(srcPath);
    const dest = path.join(path.dirname(srcPath), `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    fs.copyFileSync(srcPath, dest);
    return dest;
}

module.exports = { MAX_ATTACH_BYTES, ATTACH_MIME, checkUploadedFile, copyStoredFile, safeUnlink, fmtMb };

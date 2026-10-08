const multer = require('multer');
const db = require('../config/db');
const media = require('../services/whatsappMedia');

// ── Upload of a file to send from the inbox ─────────────────────────────────
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, media.MEDIA_DIR),
        filename: (req, file, cb) => {
            const mime = media.mimeFromName(file.originalname) || media.cleanMime(file.mimetype);
            cb(null, media.newStoredName(mime));
        },
    }),
    limits: { fileSize: media.MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        const byName = media.mimeFromName(file.originalname);
        const byClient = media.cleanMime(file.mimetype);
        if ((byName && media.isAllowedMime(byName)) || media.isAllowedMime(byClient)) return cb(null, true);
        cb(new Error('That file type cannot be sent. Use an image, PDF, Office document, text, audio or video file.'));
    },
});

// Multer errors become a clear 422 instead of a generic 500.
exports.uploadMedia = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (!err) return next();
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is larger than 10 MB.' : err.message;
        res.status(422).json({ success: false, message });
    });
};

// ── GET /outreach/whatsapp/media/:direction/:id — staff view of a stored file ─
exports.serveStaffMedia = async (req, res) => {
    const { direction, id } = req.params;
    try {
        let row;
        if (direction === 'in') {
            [[row]] = await db.query(
                `SELECT media_key AS \`key\`, media_mime AS mime, media_filename AS filename, assigned_to AS owner
                 FROM outreach_email_replies WHERE id = ? AND channel = 'whatsapp' AND deleted_at IS NULL`, [id]);
        } else if (direction === 'out') {
            [[row]] = await db.query(
                `SELECT media_key AS \`key\`, media_mime AS mime, media_filename AS filename, sent_by AS owner
                 FROM whatsapp_outbound_messages WHERE id = ? AND deleted_at IS NULL`, [id]);
        } else {
            return res.status(404).json({ success: false, message: 'Not found.' });
        }
        if (!row || !row.key) return res.status(404).json({ success: false, message: 'No file on this message.' });
        if (req.user.role === 'hr_staff' && row.owner !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        media.sendStoredFile(res, row, { forceDownload: req.query.download === '1' });
    } catch (err) {
        console.error('[whatsappInbox.serveStaffMedia]', err.message);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/outreach/media/:token — the link a contact receives (no sign-in) ─
exports.serveSharedMedia = async (req, res) => {
    try {
        const token = String(req.params.token || '');
        if (!/^[\w-]{20,64}$/.test(token)) return res.status(404).send('Not found');
        const [[row]] = await db.query(
            `SELECT media_key AS \`key\`, media_mime AS mime, media_filename AS filename, share_expires_at
             FROM whatsapp_outbound_messages WHERE share_token = ? AND deleted_at IS NULL`, [token]);
        if (!row || !row.key) return res.status(404).send('Not found');
        if (row.share_expires_at && new Date(row.share_expires_at).getTime() < Date.now()) {
            return res.status(410).send('This link has expired. Please ask the sender to share the file again.');
        }
        res.setHeader('Cache-Control', 'private, max-age=600');
        media.sendStoredFile(res, row);
    } catch (err) {
        console.error('[whatsappInbox.serveSharedMedia]', err.message);
        res.status(500).send('Server error');
    }
};

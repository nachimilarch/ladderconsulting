const db          = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const path        = require('path');
const xlsx        = require('xlsx');
const { uploadToS3 } = require('../utils/s3');
const { logAction } = require('../utils/auditLog');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || null;

// ── Column name normalisation for flexible Excel header mapping ───────────────

// Normalise a header string: lowercase, trim, collapse whitespace,
// replace dots / dashes / underscores / slashes with a single space
const normHeader = (s) =>
    String(s).toLowerCase()
        .replace(/[    ]+/g, ' ') // non-breaking spaces
        .replace(/[._\-/\\]+/g, ' ')                   // punctuation → space
        .replace(/\s+/g, ' ')                           // collapse spaces
        .trim();

// All aliases are already in normalised form (spaces only, no punctuation)
const COLUMN_MAP = {
    full_name: [
        'full name','name','contact name','person name',
        'customer name','client name','contact person','candidate name',
    ],
    email: [
        'email','email id','email address','e mail','mail','emailid',
    ],
    phone: [
        // generic
        'phone','phone number','phone no','ph','ph no','ph number',
        // mobile variants
        'mobile','mobile number','mobile no','mob','mob no','mob number',
        // cell / tel
        'cell','cell number','cell no','cell phone',
        'tel','telephone','telephone number','tel no',
        // contact
        'contact','contact number','contact no','contact phone','contact mobile',
        // numbered / role-qualified
        'phone 1','phone1','mobile 1','mobile1',
        'primary phone','primary mobile','work phone','home phone','office phone',
        'number','numbers',
    ],
    whatsapp_number: [
        'whatsapp','whatsapp number','whatsapp no','wa number','wa no',
        'whatsapp mobile','watsapp','wp number','wp no',
    ],
    company_name: [
        'company','company name','organisation','organization','org',
        'firm','employer','org name',
    ],
    designation: [
        'designation','title','role','job title','position','job role',
        'dept','department','function',
    ],
    city: ['city','location','place','region','area','district','state'],
};

const normaliseHeaders = (headers) => {
    const map = {};

    // Pass 1 — normalised exact alias match
    headers.forEach((h, i) => {
        const norm = normHeader(h);
        for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
            if (map[field] === undefined && aliases.includes(norm)) {
                map[field] = i;
            }
        }
    });

    // Pass 2 — substring keyword match for any still-unmapped column
    const FUZZY = {
        phone:           ['phone','mobile','mob','cell','tel'],
        whatsapp_number: ['whatsapp','watsapp'],
        email:           ['email','mail'],
        full_name:       ['name'],
        company_name:    ['company','org','firm'],
        city:            ['city','location'],
        designation:     ['designation','title','role','position'],
    };
    const assignedIdx = new Set(Object.values(map));
    headers.forEach((h, i) => {
        if (assignedIdx.has(i)) return;
        const norm = normHeader(h);
        for (const [field, keywords] of Object.entries(FUZZY)) {
            if (map[field] === undefined && keywords.some(kw => norm.includes(kw))) {
                map[field] = i;
                assignedIdx.add(i);
                break;
            }
        }
    });

    console.log('[outreach:import] column map:', map, '| headers:', headers.map(normHeader));
    return map;
};

// ── Split a cell that may hold multiple phone numbers ─────────────────────────
// Handles separators: comma, semicolon, pipe, slash, ampersand, newline, tab,
// and 2+ consecutive spaces (e.g. "9898989898  9090909090").
// Returns only valid phone-length digit strings (7–15 chars).
const splitPhones = (raw) => {
    if (!raw) return [];
    const segmented = String(raw)
        .replace(/[,;|&\n\r\t]/g, '§')  // explicit delimiters
        .replace(/\//g, '§')             // forward slash
        .replace(/\s{2,}/g, '§')        // 2+ consecutive spaces → delimiter
        .replace(/\s*§\s*/g, '§');      // trim spaces around delimiter

    return segmented.split('§')
        .map(seg => seg.replace(/[^\d]/g, ''))   // extract digits only
        .filter(d => d.length >= 7 && d.length <= 15);  // valid phone range
};

// Return the first valid phone number from a potentially multi-value cell
const firstPhone = (raw) => {
    const nums = splitPhones(raw);
    return nums.length > 0 ? nums[0] : null;
};

// ── POST /outreach/contact-lists/upload ───────────────────────────────────────
exports.upload = async (req, res) => {
    if (!req.file) return res.status(422).json({ success: false, message: 'No file uploaded.' });
    const { list_name, description } = req.body;
    if (!list_name) return res.status(422).json({ success: false, message: 'list_name is required.' });

    const ext      = path.extname(req.file.originalname).toLowerCase();
    const fileKey  = `outreach/lists/${uuidv4()}${ext}`;
    const mimeType = req.file.mimetype || 'application/octet-stream';

    try {
        // Upload to S3 (optional — skip if S3 bucket not configured in env)
        let savedFileKey = null;
        if (process.env.S3_BUCKET) {
            try {
                await uploadToS3(req.file.buffer, fileKey, mimeType);
                savedFileKey = fileKey;
            } catch (s3Err) {
                console.warn('[outreach.upload] S3 upload failed (skipping):', s3Err.message);
            }
        }

        // Create list record
        const [result] = await db.query(
            `INSERT INTO outreach_contact_lists
               (uploaded_by, list_name, description, file_key, file_name, import_status)
             VALUES (?, ?, ?, ?, ?, 'processing')`,
            [req.user.id, list_name, description || null, savedFileKey, req.file.originalname]
        );
        const listId = result.insertId;

        // Run import in background
        setImmediate(() => importContacts(listId, req.file.buffer, req.user.id).catch(e => {
            console.error('[outreach:import]', e.message);
            db.query(
                "UPDATE outreach_contact_lists SET import_status = 'failed' WHERE id = ?",
                [listId]
            ).catch(() => {});
        }));

        res.status(201).json({
            success: true,
            message: 'Upload received, import started.',
            list_id: listId,
        });
    } catch (err) {
        console.error('[outreach.upload]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── Background import helper ──────────────────────────────────────────────────
async function importContacts(listId, buffer, uploadedBy) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length < 2) {
        await db.query(
            "UPDATE outreach_contact_lists SET import_status = 'done', total_contacts = 0, imported_contacts = 0, failed_rows = 0 WHERE id = ?",
            [listId]
        );
        return;
    }

    const headers  = rows[0].map(String);
    const colMap   = normaliseHeaders(headers);
    const dataRows = rows.slice(1);

    const errors   = [];
    const toInsert = [];
    const seenEmails = new Set();

    // Load emails already in this list to skip duplicates
    const [existingContacts] = await db.query(
        'SELECT email FROM outreach_contacts WHERE list_id = ? AND deleted_at IS NULL AND email IS NOT NULL',
        [listId]
    );
    existingContacts.forEach(r => seenEmails.add(r.email.toLowerCase()));

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const get = (field) => {
            const idx = colMap[field];
            if (idx === undefined) return '';
            const val = row[idx];
            // xlsx returns numeric cells as JS numbers; convert carefully to avoid
            // scientific notation on large integers (phone numbers etc.)
            if (typeof val === 'number') return Number.isInteger(val) ? String(val) : val.toFixed(0);
            return String(val || '').trim();
        };

        const email     = get('email').toLowerCase() || null;
        const whatsapp  = firstPhone(get('whatsapp_number')) || null;
        const phones    = splitPhones(get('phone'));
        const fullName  = get('full_name')    || null;
        const company   = get('company_name') || null;
        const desig     = get('designation')  || null;
        const city      = get('city')         || null;

        // Skip rows missing email and all phone/whatsapp info
        if (!email && phones.length === 0 && !whatsapp) {
            errors.push({ row: i + 2, reason: 'Missing email and phone' });
            continue;
        }

        // Skip duplicate emails within this list
        if (email && seenEmails.has(email)) {
            errors.push({ row: i + 2, reason: `Duplicate email: ${email}` });
            continue;
        }
        if (email) seenEmails.add(email);

        // Primary row — first phone number
        toInsert.push([
            listId, uploadedBy,
            fullName,
            email,
            phones[0] || null,
            whatsapp,
            company, desig, city,
        ]);

        // Extra rows for additional phone numbers — email null to avoid dedup collision
        for (let p = 1; p < phones.length; p++) {
            toInsert.push([
                listId, uploadedBy,
                fullName,
                null,
                phones[p],
                whatsapp,
                company, desig, city,
            ]);
        }
    }

    // Batch insert
    if (toInsert.length > 0) {
        const placeholders = toInsert.map(() => '(?,?,?,?,?,?,?,?,?)').join(',');
        const flat = toInsert.flat();
        await db.query(
            `INSERT INTO outreach_contacts
               (list_id, uploaded_by, full_name, email, phone, whatsapp_number, company_name, designation, city)
             VALUES ${placeholders}`,
            flat
        );
    }

    await db.query(
        `UPDATE outreach_contact_lists
         SET import_status = 'done', total_contacts = ?, imported_contacts = ?, failed_rows = ?, import_errors = ?
         WHERE id = ?`,
        [dataRows.length, toInsert.length, errors.length, JSON.stringify(errors), listId]
    );
}

// ── GET /outreach/contact-lists ───────────────────────────────────────────────
exports.getLists = async (req, res) => {
    const { search } = req.query;
    const filters = ['l.deleted_at IS NULL'];
    const params  = [];

    if (req.user.role === 'hr_staff') {
        filters.push('l.uploaded_by = ?');
        params.push(req.user.id);
    }
    if (search) {
        filters.push('l.list_name LIKE ?');
        params.push(`%${search}%`);
    }

    try {
        const [rows] = await db.query(
            `SELECT l.*, u.name AS uploaded_by_name
             FROM outreach_contact_lists l
             JOIN users u ON u.id = l.uploaded_by
             WHERE ${filters.join(' AND ')}
             ORDER BY l.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[outreach.getLists]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /outreach/contact-lists/:id ──────────────────────────────────────────
exports.getList = async (req, res) => {
    try {
        const [[row]] = await db.query(
            `SELECT l.*, u.name AS uploaded_by_name
             FROM outreach_contact_lists l
             JOIN users u ON u.id = l.uploaded_by
             WHERE l.id = ? AND l.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'List not found.' });
        if (req.user.role === 'hr_staff' && row.uploaded_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        res.json({ success: true, data: row });
    } catch (err) {
        console.error('[outreach.getList]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /outreach/contact-lists/:id/contacts ──────────────────────────────────
exports.getContacts = async (req, res) => {
    const { page = 1, limit = 50, search, has_email, has_phone, unsubscribed } = req.query;
    const offset  = (parseInt(page) - 1) * parseInt(limit);
    const filters = ['c.list_id = ?', 'c.deleted_at IS NULL'];
    const params  = [req.params.id];

    if (search) {
        filters.push('(c.full_name LIKE ? OR c.email LIKE ? OR c.company_name LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (has_email === 'true')  { filters.push('c.email IS NOT NULL'); }
    if (has_phone === 'true')  { filters.push('c.phone IS NOT NULL'); }
    if (unsubscribed === 'true')  { filters.push('c.is_unsubscribed = 1'); }
    if (unsubscribed === 'false') { filters.push('c.is_unsubscribed = 0'); }

    const where = filters.join(' AND ');
    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM outreach_contacts c WHERE ${where}`, params
        );
        const [rows] = await db.query(
            `SELECT c.* FROM outreach_contacts c WHERE ${where}
             ORDER BY c.created_at ASC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('[outreach.getContacts]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── DELETE /outreach/contact-lists/:id ───────────────────────────────────────
exports.deleteList = async (req, res) => {
    try {
        const [[row]] = await db.query(
            'SELECT id, uploaded_by FROM outreach_contact_lists WHERE id = ? AND deleted_at IS NULL',
            [req.params.id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'List not found.' });
        if (req.user.role === 'hr_staff' && row.uploaded_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        await db.query('UPDATE outreach_contact_lists SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        await db.query('UPDATE outreach_contacts SET deleted_at = NOW() WHERE list_id = ? AND deleted_at IS NULL', [req.params.id]);
        logAction(req.user.id, 'delete_contact_list', 'outreach_contact_list', req.params.id, {}, ip(req));
        res.json({ success: true, message: 'List deleted.' });
    } catch (err) {
        console.error('[outreach.deleteList]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PATCH /outreach/contacts/:id/unsubscribe ─────────────────────────────────
exports.unsubscribeContact = async (req, res) => {
    try {
        const [[contact]] = await db.query(
            'SELECT id FROM outreach_contacts WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });

        await db.query(
            'UPDATE outreach_contacts SET is_unsubscribed = 1, unsubscribed_at = NOW() WHERE id = ?',
            [req.params.id]
        );
        res.json({ success: true, message: 'Contact unsubscribed.' });
    } catch (err) {
        console.error('[outreach.unsubscribeContact]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /outreach/contacts/:id/call-history ───────────────────────────────────
exports.getContactCallHistory = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ocl.*, u.name AS called_by_name
             FROM outreach_call_logs ocl
             JOIN users u ON u.id = ocl.called_by
             WHERE ocl.contact_id = ? AND ocl.deleted_at IS NULL
             ORDER BY ocl.called_at DESC`,
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[outreach.getContactCallHistory]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

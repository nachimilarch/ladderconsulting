// Candidate management for HR executives and admins.
//   • Applicants of a job (JD)             GET  /recruitment/jobs/:jobId/applicants
//   • "My candidates" list                 GET  /recruitment/my-candidates
//   • Add a candidate (with optional CV)   POST /recruitment/candidates
//   • Read / edit one candidate            GET|PUT /recruitment/candidates/:id/manage
//   • Add or replace the resume            POST /recruitment/candidates/:id/resume
//   • Take a candidate off a JD            DELETE /recruitment/candidates/:id/applications/:appId
//
// Who may touch which candidate:
//   admin     – any candidate.
//   hr_staff  – only candidates they sourced (added by hand, uploaded a resume for, or put on a JD)
//               and only while the person has never signed in themselves. Once a candidate logs in,
//               the profile is theirs.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { parseFullProfile } = require('../utils/aiParser');
const { parseRecruiterFilename, chooseName } = require('../utils/resumeParser');
const matchingService = require('../services/matchingService');
const { getDeleteBlockers, describeBlockers } = require('../utils/candidateDeletion');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress;

const logAction = (adminId, action, entityType, entityId, details, ipAddr) =>
    db.query(
        `INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?)`,
        [adminId, action, entityType, entityId, details ? JSON.stringify(details) : null, ipAddr || null]
    ).catch((e) => console.error('[logAction]', e.message));

const extractText = async (absolutePath) => {
    const buffer = fs.readFileSync(absolutePath);
    if (absolutePath.toLowerCase().endsWith('.pdf')) return (await require('pdf-parse')(buffer)).text;
    return (await require('mammoth').extractRawText({ buffer })).value;
};

const dropFile = (file) => { if (file?.path) fs.unlink(file.path, () => {}); };
const clean = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));
const numOrNull = (v) => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : NaN; };

// SQL that is true for candidate rows `c` that user ? sourced.
const OWNED_SQL = `(c.created_by_user_id = ?
    OR EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id AND a.sourced_by = ? AND a.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM resume_upload_items i JOIN resume_upload_batches b ON b.id = i.batch_id
               WHERE i.candidate_id = c.id AND b.uploaded_by = ? AND b.deleted_at IS NULL))`;

// Loads a candidate the caller may manage, or answers 404/403 and returns null.
async function loadManageable(req, res, candidateId) {
    const id = parseInt(candidateId, 10);
    const [[cand]] = await db.query(
        `SELECT c.id, c.user_id, c.created_by_user_id, u.name, u.email, u.phone, u.status, u.last_login_at,
                ${req.user.role === 'admin' ? '1' : `(${OWNED_SQL})`} AS owned
         FROM candidates c JOIN users u ON u.id = c.user_id
         WHERE c.id = ? AND c.deleted_at IS NULL AND u.deleted_at IS NULL`,
        req.user.role === 'admin' ? [id] : [req.user.id, req.user.id, req.user.id, id]
    );
    if (!cand) { res.status(404).json({ success: false, message: 'Candidate not found.' }); return null; }
    if (!cand.owned) { res.status(403).json({ success: false, message: 'You can only manage candidates you sourced.' }); return null; }
    if (req.user.role !== 'admin' && cand.last_login_at) {
        res.status(403).json({ success: false, message: 'This candidate has signed in and manages their own profile.' });
        return null;
    }
    return cand;
}

// ── Applicants of a JD ───────────────────────────────────────────────────────
exports.getJobApplicants = async (req, res) => {
    try {
        const [[job]] = await db.query(
            `SELECT jp.id, jp.title, jp.status, jp.location, co.company_name
             FROM job_postings jp JOIN companies co ON co.id = jp.company_id
             WHERE jp.id = ? AND jp.deleted_at IS NULL`, [req.params.jobId]
        );
        if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });

        const [rows] = await db.query(
            `SELECT a.id AS application_id, a.status, a.source, a.applied_at, a.resume_id,
                    c.id AS candidate_id, u.name AS candidate_name, u.email, u.phone,
                    cp.headline, cp.total_experience, cp.current_location,
                    sb.name AS sourced_by_name,
                    (SELECT mr.fit_score FROM match_results mr WHERE mr.application_id = a.id
                       ORDER BY mr.id DESC LIMIT 1) AS fit_score,
                    ${req.user.role === 'admin' ? '1' : `(${OWNED_SQL})`} AS can_manage
             FROM applications a
             JOIN candidates c ON c.id = a.candidate_id AND c.deleted_at IS NULL
             JOIN users u ON u.id = c.user_id
             LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
             LEFT JOIN users sb ON sb.id = a.sourced_by
             WHERE a.job_id = ? AND a.deleted_at IS NULL
             ORDER BY COALESCE((SELECT mr.fit_score FROM match_results mr WHERE mr.application_id = a.id
                                ORDER BY mr.id DESC LIMIT 1), -1) DESC, a.applied_at DESC`,
            req.user.role === 'admin' ? [req.params.jobId] : [req.user.id, req.user.id, req.user.id, req.params.jobId]
        );
        res.json({ success: true, data: { job, applicants: rows.map((r) => ({ ...r, can_manage: !!r.can_manage })) } });
    } catch (err) {
        console.error('[candidateMgmt.getJobApplicants]', err);
        res.status(500).json({ success: false, message: 'Failed to load applicants.' });
    }
};

// ── My candidates ────────────────────────────────────────────────────────────
exports.listMyCandidates = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    try {
        const where = ['c.deleted_at IS NULL', 'u.deleted_at IS NULL'];
        const params = [];
        // scope=registered: people who signed up and log in themselves. Anyone in HR/admin can look
        // them up (and open their resume) but only the candidate edits their own profile.
        const registered = req.query.scope === 'registered';
        if (registered) where.push('u.last_login_at IS NOT NULL');
        else if (req.user.role !== 'admin') {
            where.push('u.last_login_at IS NULL', OWNED_SQL);
            params.push(req.user.id, req.user.id, req.user.id);
        }
        if (req.query.search) {
            where.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR cp.headline LIKE ?)');
            const q = `%${String(req.query.search).slice(0, 80)}%`;
            params.push(q, q, q, q);
        }
        const base = `FROM candidates c JOIN users u ON u.id = c.user_id
                      LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
                      WHERE ${where.join(' AND ')}`;
        const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${base}`, params);
        const [rows] = await db.query(
            `SELECT c.id AS candidate_id, u.name, u.email, u.phone, u.status, u.created_at,
                    cp.headline, cp.total_experience, cp.current_location,
                    (SELECT COUNT(*) FROM applications a WHERE a.candidate_id = c.id AND a.deleted_at IS NULL) AS application_count,
                    (SELECT COUNT(*) FROM resumes r WHERE r.candidate_id = c.id AND r.deleted_at IS NULL) AS resume_count,
                    (SELECT r.id FROM resumes r WHERE r.candidate_id = c.id AND r.deleted_at IS NULL
                       ORDER BY r.is_primary DESC, r.created_at DESC LIMIT 1) AS resume_id
             ${base} ORDER BY c.id DESC LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        );
        res.json({ success: true, data: rows, total: Number(total), page, limit, scope: registered ? 'registered' : 'sourced' });
    } catch (err) {
        console.error('[candidateMgmt.listMyCandidates]', err);
        res.status(500).json({ success: false, message: 'Failed to load candidates.' });
    }
};

// ── One candidate, for the edit form ─────────────────────────────────────────
exports.getManagedCandidate = async (req, res) => {
    try {
        const cand = await loadManageable(req, res, req.params.id);
        if (!cand) return;
        const [[profile]] = await db.query(
            `SELECT headline, summary, total_experience, current_location, expected_salary, current_salary,
                    notice_period_days, linkedin_url, portfolio_url
             FROM candidate_profiles WHERE candidate_id = ?`, [cand.id]);
        const [skills] = await db.query(
            `SELECT st.name FROM candidate_skill_vectors csv JOIN skill_tags st ON st.id = csv.skill_tag_id
             WHERE csv.candidate_id = ? ORDER BY st.name`, [cand.id]);
        const [resumes] = await db.query(
            `SELECT id, file_name, is_primary, created_at FROM resumes
             WHERE candidate_id = ? AND deleted_at IS NULL ORDER BY is_primary DESC, created_at DESC`, [cand.id]);
        const [applications] = await db.query(
            `SELECT a.id AS application_id, a.status, a.source, a.applied_at, jp.id AS job_id, jp.title, co.company_name,
                    (SELECT mr.fit_score FROM match_results mr WHERE mr.application_id = a.id ORDER BY mr.id DESC LIMIT 1) AS fit_score
             FROM applications a JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             WHERE a.candidate_id = ? AND a.deleted_at IS NULL ORDER BY a.applied_at DESC`, [cand.id]);
        const blockers = await getDeleteBlockers(cand.id);
        res.json({
            success: true,
            data: {
                candidate_id: cand.id, name: cand.name, email: cand.email, phone: cand.phone, status: cand.status,
                self_registered: !!cand.last_login_at,
                ...(profile || {}), skills: skills.map((s) => s.name), resumes, applications,
                delete_blocked_reason: describeBlockers(blockers),
            },
        });
    } catch (err) {
        console.error('[candidateMgmt.get]', err);
        res.status(500).json({ success: false, message: 'Failed to load the candidate.' });
    }
};

// Validates the editable fields. Returns { user, profile } or { error }.
function readFields(body, { requireEmail }) {
    const name = clean(body.name, 150);
    const email = clean(body.email, 191).toLowerCase();
    if (!name) return { error: 'Name is required.' };
    if ((requireEmail || email) && !EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };
    const phone = clean(body.phone, 20);
    const exp = numOrNull(body.total_experience);
    const expected = numOrNull(body.expected_salary);
    const current = numOrNull(body.current_salary);
    const notice = numOrNull(body.notice_period_days);
    if ([exp, expected, current, notice].some(Number.isNaN)) return { error: 'Experience, salaries and notice period must be numbers (0 or more).' };
    if (exp != null && exp > 60) return { error: 'Experience looks too high (max 60 years).' };
    return {
        user: { name, email, phone: phone || null },
        profile: {
            headline: clean(body.headline, 255) || null, summary: clean(body.summary, 4000) || null,
            total_experience: exp, current_location: clean(body.current_location, 150) || null,
            expected_salary: expected, current_salary: current, notice_period_days: notice == null ? null : Math.round(notice),
            linkedin_url: clean(body.linkedin_url, 500) || null, portfolio_url: clean(body.portfolio_url, 500) || null,
        },
    };
}

async function saveProfile(candidateId, p) {
    await db.query(
        `INSERT INTO candidate_profiles (candidate_id, headline, summary, total_experience, current_location,
                expected_salary, current_salary, notice_period_days, linkedin_url, portfolio_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE headline = VALUES(headline), summary = VALUES(summary),
            total_experience = VALUES(total_experience), current_location = VALUES(current_location),
            expected_salary = VALUES(expected_salary), current_salary = VALUES(current_salary),
            notice_period_days = VALUES(notice_period_days), linkedin_url = VALUES(linkedin_url),
            portfolio_url = VALUES(portfolio_url)`,
        [candidateId, p.headline, p.summary, p.total_experience ?? 0, p.current_location, p.expected_salary,
         p.current_salary, p.notice_period_days, p.linkedin_url, p.portfolio_url]
    );
}

// Stores an uploaded resume for a candidate, reads its text and refreshes their skills.
async function attachResume(candidateId, file, { makePrimary }) {
    const fileKey = path.join('uploads', 'resumes', file.filename).replace(/\\/g, '/');
    let text = '';
    try { text = await extractText(file.path); } catch (e) { console.error('[candidateMgmt] resume text:', e.message); }
    if (makePrimary) await db.query('UPDATE resumes SET is_primary = 0 WHERE candidate_id = ? AND deleted_at IS NULL', [candidateId]);
    const [r] = await db.query(
        `INSERT INTO resumes (candidate_id, file_key, file_name, file_size, mime_type, is_primary, parse_status, parsed_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [candidateId, fileKey, file.originalname, file.size || null, file.mimetype || null, makePrimary ? 1 : 0,
         text.trim() ? 'done' : 'failed', text || null]
    );
    if (text.trim()) {
        try { await matchingService.parseResumeToSkills(candidateId, text); }
        catch (e) { console.error('[candidateMgmt] skills:', e.message); }
    }
    return { resumeId: r.insertId, text };
}

// ── Add a candidate by hand ──────────────────────────────────────────────────
// Fields come from the form; if a resume is attached, anything left blank (name, email, phone,
// headline, location, experience) is filled in from the resume.
exports.createCandidate = async (req, res) => {
    const file = req.file;
    try {
        let body = { ...req.body };
        let text = '';
        if (file) {
            try { text = await extractText(file.path); } catch { /* handled below */ }
            if (text.trim()) {
                try {
                    const parsed = await parseFullProfile(text);
                    const fromFile = parseRecruiterFilename(file.originalname);
                    const fill = (k, v) => { if (!clean(body[k], 5000) && v != null && v !== '') body[k] = v; };
                    fill('name', chooseName(parsed.full_name, fromFile.name));
                    fill('email', parsed.email);
                    fill('phone', parsed.phone);
                    fill('headline', parsed.headline);
                    fill('summary', parsed.summary);
                    fill('current_location', parsed.location);
                    fill('total_experience', fromFile.experienceYears > 0 ? fromFile.experienceYears : parsed.experience_years);
                    fill('linkedin_url', parsed.linkedin_url);
                } catch (e) { console.error('[candidateMgmt] parse:', e.message); }
            }
        }
        const f = readFields(body, { requireEmail: true });
        if (f.error) { dropFile(file); return res.status(400).json({ success: false, message: f.error }); }

        const [[existing]] = await db.query('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [f.user.email]);
        if (existing) { dropFile(file); return res.status(409).json({ success: false, message: 'Someone with this email already exists on the platform.' }); }

        const [[role]] = await db.query(`SELECT id FROM roles WHERE name = 'candidate'`);
        const pwd = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
        const [u] = await db.query(
            `INSERT INTO users (name, email, phone, password, role_id, status, is_email_verified) VALUES (?, ?, ?, ?, ?, 'active', 1)`,
            [f.user.name, f.user.email, f.user.phone, pwd, role.id]
        );
        const [c] = await db.query('INSERT INTO candidates (user_id, created_by_user_id) VALUES (?, ?)', [u.insertId, req.user.id]);
        await saveProfile(c.insertId, f.profile);

        let resumeId = null;
        if (file) resumeId = (await attachResume(c.insertId, file, { makePrimary: true })).resumeId;

        // Typed skills (comma separated) are added on top of whatever the resume gave us.
        const typed = String(req.body.skills || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40);
        if (typed.length) { try { await matchingService.parseResumeToSkills(c.insertId, typed.join(', ')); } catch { /* optional */ } }

        // Optionally put them on a JD straight away (needs a resume — applications.resume_id is NOT NULL).
        let applicationId = null, note = null;
        if (req.body.job_id) {
            if (!resumeId) note = 'Candidate added, but not put on the JD: attach a resume first.';
            else {
                const [[job]] = await db.query(`SELECT id FROM job_postings WHERE id = ? AND status = 'active' AND deleted_at IS NULL`, [req.body.job_id]);
                if (!job) note = 'Candidate added, but that JD is not active.';
                else {
                    const [a] = await db.query(
                        `INSERT INTO applications (candidate_id, job_id, resume_id, source, sourced_by, status) VALUES (?, ?, ?, 'executive', ?, 'applied')`,
                        [c.insertId, job.id, resumeId, req.user.id]);
                    applicationId = a.insertId;
                    matchingService.calculateMatchScore(applicationId).catch((e) => console.error('[candidateMgmt] match:', e.message));
                }
            }
        }
        logAction(req.user.id, 'create_candidate', 'candidate', c.insertId, { name: f.user.name, email: f.user.email }, ip(req));
        res.status(201).json({ success: true, message: note || 'Candidate added.', data: { candidate_id: c.insertId, application_id: applicationId } });
    } catch (err) {
        dropFile(file);
        console.error('[candidateMgmt.create]', err);
        res.status(500).json({ success: false, message: 'Failed to add the candidate.' });
    }
};

// ── Edit ─────────────────────────────────────────────────────────────────────
exports.updateCandidate = async (req, res) => {
    try {
        const cand = await loadManageable(req, res, req.params.id);
        if (!cand) return;
        const f = readFields(req.body, { requireEmail: true });
        if (f.error) return res.status(400).json({ success: false, message: f.error });

        if (f.user.email !== cand.email) {
            const [[dup]] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ? AND deleted_at IS NULL', [f.user.email, cand.user_id]);
            if (dup) return res.status(409).json({ success: false, message: 'Someone else already uses this email.' });
            if (cand.last_login_at) return res.status(409).json({ success: false, message: 'This candidate has signed in with their email, so it cannot be changed here.' });
        }
        await db.query('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?', [f.user.name, f.user.email, f.user.phone, cand.user_id]);
        await saveProfile(cand.id, f.profile);
        logAction(req.user.id, 'update_candidate', 'candidate', cand.id, { name: f.user.name, email_changed: f.user.email !== cand.email }, ip(req));
        res.json({ success: true, message: 'Candidate updated.' });
    } catch (err) {
        console.error('[candidateMgmt.update]', err);
        res.status(500).json({ success: false, message: 'Failed to update the candidate.' });
    }
};

// ── Add / replace the resume ─────────────────────────────────────────────────
exports.uploadCandidateResume = async (req, res) => {
    const file = req.file;
    try {
        if (!file) return res.status(400).json({ success: false, message: 'Choose a PDF, DOC or DOCX file.' });
        const cand = await loadManageable(req, res, req.params.id);
        if (!cand) { dropFile(file); return; }
        const { resumeId, text } = await attachResume(cand.id, file, { makePrimary: true });
        logAction(req.user.id, 'upload_candidate_resume', 'candidate', cand.id, { file: file.originalname }, ip(req));
        res.status(201).json({
            success: true, data: { resume_id: resumeId },
            message: text.trim() ? 'Resume saved and skills refreshed.' : 'Resume saved, but no text could be read from it, so skills were not updated.',
        });
    } catch (err) {
        dropFile(file);
        console.error('[candidateMgmt.resume]', err);
        res.status(500).json({ success: false, message: 'Failed to save the resume.' });
    }
};

// ── Remove a candidate from a JD ─────────────────────────────────────────────
exports.removeApplication = async (req, res) => {
    try {
        const cand = await loadManageable(req, res, req.params.id);
        if (!cand) return;
        const [[app]] = await db.query(
            `SELECT a.id, a.status FROM applications a WHERE a.id = ? AND a.candidate_id = ? AND a.deleted_at IS NULL`,
            [req.params.appId, cand.id]);
        if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });
        if (app.status === 'hired') return res.status(409).json({ success: false, message: 'This candidate was hired for that JD.' });
        const [[live]] = await db.query(
            `SELECT
               (SELECT COUNT(*) FROM offers o WHERE o.application_id = a.id AND o.deleted_at IS NULL AND o.status IN ('sent','accepted')) AS offers,
               (SELECT COUNT(*) FROM interview_slots s WHERE s.application_id = a.id AND s.deleted_at IS NULL
                  AND s.status IN ('proposed','confirmed','rescheduled') AND s.slot_datetime >= UTC_TIMESTAMP()) AS interviews
             FROM applications a WHERE a.id = ?`, [app.id]);
        if (live.offers || live.interviews) {
            return res.status(409).json({ success: false, message: 'This application has an open offer or an upcoming interview. Resolve that first.' });
        }
        await db.query('UPDATE applications SET deleted_at = NOW() WHERE id = ?', [app.id]);
        logAction(req.user.id, 'remove_candidate_application', 'application', app.id, { candidate_id: cand.id }, ip(req));
        res.json({ success: true, message: 'Removed from the JD.' });
    } catch (err) {
        console.error('[candidateMgmt.removeApplication]', err);
        res.status(500).json({ success: false, message: 'Failed to remove the application.' });
    }
};

// ── Message selected candidates ──────────────────────────────────────────────
// POST /recruitment/candidates/message-list   body: { candidate_ids: [..], name? }
// Turns the selection into an Outreach contact list. The caller then opens an email or WhatsApp
// campaign for that list, reviews the message and sends it from there (so merge tags, attachments,
// unsubscribes and send logs all work the same as any other campaign).
exports.createMessageList = async (req, res) => {
    try {
        const ids = [...new Set((Array.isArray(req.body.candidate_ids) ? req.body.candidate_ids : []).map(Number).filter(Number.isInteger))];
        if (!ids.length) return res.status(400).json({ success: false, message: 'Select at least one candidate.' });
        if (ids.length > 1000) return res.status(400).json({ success: false, message: 'Select 1000 candidates or fewer at a time.' });

        const [people] = await db.query(
            `SELECT c.id, u.name, u.email, u.phone, cp.current_location
             FROM candidates c JOIN users u ON u.id = c.user_id
             LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
             WHERE c.id IN (?) AND c.deleted_at IS NULL AND u.deleted_at IS NULL AND u.status = 'active'`, [ids]);
        const usable = people.filter((p) => p.email || p.phone);
        if (!usable.length) return res.status(422).json({ success: false, message: 'None of the selected candidates has an email or phone number.' });

        const emails = usable.map((p) => (p.email || '').toLowerCase()).filter(Boolean);
        const unsub = new Set();
        if (emails.length) {
            const [u] = await db.query(
                `SELECT DISTINCT LOWER(email) AS email FROM outreach_contacts WHERE is_unsubscribed = 1 AND LOWER(email) IN (?)`, [emails]);
            u.forEach((r) => unsub.add(r.email));
        }

        const stamp = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
        const listName = clean(req.body.name, 200) || `Selected candidates - ${stamp}`;
        const [l] = await db.query(
            `INSERT INTO outreach_contact_lists (uploaded_by, list_name, description, import_status, total_contacts, imported_contacts, failed_rows)
             VALUES (?, ?, 'Made from candidates selected in the HR portal', 'done', ?, ?, 0)`,
            [req.user.id, listName, usable.length, usable.length]);
        for (const p of usable) {
            const email = (p.email || '').toLowerCase() || null;
            await db.query(
                `INSERT INTO outreach_contacts (list_id, uploaded_by, full_name, email, phone, whatsapp_number, city, designation, source, is_unsubscribed)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'Candidate', 'candidate_selection', ?)`,
                [l.insertId, req.user.id, p.name, email, p.phone || null, p.phone || null, p.current_location || null, email && unsub.has(email) ? 1 : 0]);
        }
        logAction(req.user.id, 'create_candidate_message_list', 'outreach_contact_list', l.insertId, { candidates: usable.length }, ip(req));
        res.status(201).json({
            success: true,
            data: {
                list_id: l.insertId, total: usable.length,
                with_email: usable.filter((p) => p.email).length,
                with_phone: usable.filter((p) => p.phone).length,
                skipped_no_contact: people.length - usable.length,
                not_found: ids.length - people.length,
            },
        });
    } catch (err) {
        console.error('[candidateMgmt.messageList]', err);
        res.status(500).json({ success: false, message: 'Failed to prepare the message list.' });
    }
};

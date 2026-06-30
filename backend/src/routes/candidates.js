const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { uploadResume, uploadDocument } = require('../middleware/upload');
const { parseResumeText, parseFullProfile } = require('../utils/aiParser');
const matchingService = require('../services/matchingService');
const { maskResumeText } = require('../utils/maskPII');
const { isCandidateHired } = require('../utils/candidateStatus');
const { upsertCandidateSkills } = require('../utils/skillTags');

// Ensure a candidates row exists for this user and return its id
const getCandidateId = async (userId) => {
    await db.query('INSERT IGNORE INTO candidates (user_id) VALUES (?)', [userId]);
    const [[row]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [userId]);
    return row.id;
};

// ── GET /api/candidates/profile ──────────────────────────────────────────────
router.get('/profile', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const userId = req.user.id;
    try {
        const candidateId = await getCandidateId(userId);

        const [[profile]] = await db.query(
            `SELECT cp.*,
                    cp.current_location    AS location,
                    cp.notice_period_days  AS notice_period,
                    u.name                 AS full_name,
                    u.phone
             FROM candidate_profiles cp
             JOIN candidates c ON c.id = cp.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE cp.candidate_id = ? AND cp.deleted_at IS NULL`,
            [candidateId]
        );

        const [skills] = await db.query(
            `SELECT csv.id, csv.proficiency, csv.years_exp, st.name AS skill_name
             FROM candidate_skill_vectors csv
             JOIN skill_tags st ON st.id = csv.skill_tag_id
             WHERE csv.candidate_id = ?`,
            [candidateId]
        );

        const [[resume]] = await db.query(
            `SELECT id, file_name AS original_name, file_key, file_size, mime_type,
                    parse_status, (parse_status = 'done') AS parsed, is_primary, created_at
             FROM resumes
             WHERE candidate_id = ? AND deleted_at IS NULL
             ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
            [candidateId]
        );

        let education = [];
        if (profile?.education) {
            education = typeof profile.education === 'string'
                ? JSON.parse(profile.education)
                : profile.education;
        }

        // Build file_url from file_key (local path stored as uploads/resumes/...)
        let resumeWithUrl = resume || null;
        if (resume && resume.file_key) {
            resumeWithUrl = {
                ...resume,
                file_url: '/' + resume.file_key.replace(/\\/g, '/'),
            };
        }

        // Calculate profile completeness (6 checkpoints, each worth ~17%)
        const checkpoints = [
            !!profile?.headline,
            !!profile?.summary,
            skills.length > 0,
            education.length > 0,
            !!resumeWithUrl,
            (parseFloat(profile?.total_experience) || 0) > 0,
        ];
        const profile_complete_pct = Math.round(
            checkpoints.filter(Boolean).length / checkpoints.length * 100
        );

        res.json({
            success: true,
            profile: profile || null,
            skills,
            resume: resumeWithUrl,
            education,
            experience_years: parseFloat(profile?.total_experience) || 0,
            profile_complete_pct,
        });
    } catch (err) {
        console.error('[profile fetch]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
    }
});

// ── POST /api/candidates/profile ─────────────────────────────────────────────
router.post('/profile', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const userId = req.user.id;
    const {
        full_name, phone, location, notice_period,
        headline, summary, total_experience,
        current_location, preferred_locations,
        expected_salary, current_salary, notice_period_days,
        linkedin_url, portfolio_url, education, skills,
    } = req.body;

    const resolvedLocation     = current_location     ?? location       ?? null;
    const resolvedNoticePeriod = notice_period_days   != null ? notice_period_days
                               : notice_period        != null ? notice_period : 0;

    try {
        const candidateId = await getCandidateId(userId);

        const userFields = [];
        const userVals   = [];
        if (full_name !== undefined && full_name !== '') {
            userFields.push('name = ?');
            userVals.push(full_name);
        }
        if (phone !== undefined) {
            userFields.push('phone = ?');
            userVals.push(phone || null);
        }
        if (userFields.length) {
            userVals.push(userId);
            await db.query(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, userVals);
        }

        const educationJson = Array.isArray(education) ? JSON.stringify(education) : null;

        await db.query(
            `INSERT INTO candidate_profiles
                (candidate_id, headline, summary, total_experience, current_location,
                 preferred_locations, expected_salary, current_salary, notice_period_days,
                 linkedin_url, portfolio_url, education)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 headline            = VALUES(headline),
                 summary             = VALUES(summary),
                 total_experience    = VALUES(total_experience),
                 current_location    = VALUES(current_location),
                 preferred_locations = VALUES(preferred_locations),
                 expected_salary     = VALUES(expected_salary),
                 current_salary      = VALUES(current_salary),
                 notice_period_days  = VALUES(notice_period_days),
                 linkedin_url        = VALUES(linkedin_url),
                 portfolio_url       = VALUES(portfolio_url),
                 education           = VALUES(education)`,
            [
                candidateId,
                headline              || null,
                summary               || null,
                parseFloat(total_experience)  || 0,
                resolvedLocation,
                preferred_locations   || null,
                parseFloat(expected_salary)   || null,
                parseFloat(current_salary)    || null,
                parseInt(resolvedNoticePeriod) || 0,
                linkedin_url          || null,
                portfolio_url         || null,
                educationJson,
            ]
        );

        // Save skills if provided (replace set, then one batched upsert)
        if (Array.isArray(skills)) {
            await db.query(
                `DELETE FROM candidate_skill_vectors WHERE candidate_id = ?`,
                [candidateId]
            );
            await upsertCandidateSkills(candidateId, skills, 'manual');
        }

        res.json({ success: true, message: 'Profile saved.' });
    } catch (err) {
        console.error('[profile save]', err);
        res.status(500).json({ success: false, message: 'Failed to save profile.' });
    }
});

// ── GET /api/candidates/jobs ──────────────────────────────────────────────────
router.get('/jobs', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const userId = req.user.id;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { search } = req.query;

    try {
        const candidateId = await getCandidateId(userId);

        const filters = ["jp.status = 'active'", 'jp.deleted_at IS NULL'];
        const mainParams = [candidateId];
        const countParams = [];

        if (search) {
            filters.push('(jp.title LIKE ? OR co.company_name LIKE ?)');
            mainParams.push(`%${search}%`, `%${search}%`);
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const whereClause = filters.join(' AND ');

        const [jobs] = await db.query(
            `SELECT jp.id, jp.title, jp.description, jp.location, jp.job_type, jp.work_mode,
                    jp.salary_min, jp.salary_max, jp.experience_min, jp.experience_max,
                    jp.openings, jp.deadline, jp.created_at,
                    co.company_name,
                    CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END AS already_applied,
                    a.status AS application_status, a.id AS application_id
             FROM job_postings jp
             JOIN companies co ON co.id = jp.company_id
             LEFT JOIN applications a
               ON a.job_id = jp.id AND a.candidate_id = ? AND a.deleted_at IS NULL
             WHERE ${whereClause}
             ORDER BY jp.created_at DESC
             LIMIT ? OFFSET ?`,
            [...mainParams, limit, offset]
        );

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total
             FROM job_postings jp
             JOIN companies co ON co.id = jp.company_id
             WHERE ${whereClause}`,
            countParams
        );

        const hired = await isCandidateHired(candidateId);

        res.json({ success: true, data: jobs, total: Number(total), page, limit, is_hired: hired });
    } catch (err) {
        console.error('[jobs browse]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch jobs.' });
    }
});

// ── POST /api/candidates/resume ──────────────────────────────────────────────
router.post('/resume', authenticateToken, authorizeRole('candidate'), (req, res, next) => {
    uploadResume.single('resume')(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    });
}, async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const userId = req.user.id;
    const relativeKey = path.join('uploads', 'resumes', req.file.filename).replace(/\\/g, '/');
    const absolutePath = path.join(process.cwd(), relativeKey);

    try {
        const candidateId = await getCandidateId(userId);

        // Unset previous primary resume
        await db.query(
            'UPDATE resumes SET is_primary = 0 WHERE candidate_id = ? AND deleted_at IS NULL',
            [candidateId]
        );

        const [result] = await db.query(
            `INSERT INTO resumes (candidate_id, file_key, file_name, file_size, mime_type, is_primary, parse_status)
             VALUES (?, ?, ?, ?, ?, 1, 'pending')`,
            [candidateId, relativeKey, req.file.originalname, req.file.size, req.file.mimetype]
        );
        const resumeId = result.insertId;

        // Invalidate any cached masked resume so company gets a fresh redacted version
        const maskedCachePath = path.join(process.cwd(), 'uploads', 'masked_resumes', `masked_${candidateId}.pdf`);
        try { if (fs.existsSync(maskedCachePath)) fs.unlinkSync(maskedCachePath); } catch (_) {}

        // Respond immediately — the PDF is parsed ONCE in the background below
        // (skills land via triggerCandidateMatching). The client then calls
        // /resume/extract-profile, so it never needs skills in this response.
        res.json({
            success: true,
            message: 'Resume uploaded.',
            data: {
                file_url: '/' + relativeKey,
                original_name: req.file.originalname,
                skills: [],
            },
            // kept for backwards compat
            resume_id: resumeId,
            file_key: relativeKey,
            original_name: req.file.originalname,
        });

        // Background: parse text ONCE → store masked text → extract skills + match
        setImmediate(async () => {
            try {
                let parsedText = '';
                const mime = req.file.mimetype;
                const buffer = fs.readFileSync(absolutePath);
                if (mime === 'application/pdf') {
                    const pdfParse = require('pdf-parse');
                    parsedText = (await pdfParse(buffer)).text;
                } else {
                    const mammoth = require('mammoth');
                    parsedText = (await mammoth.extractRawText({ buffer })).value;
                }
                if (parsedText.trim()) {
                    const maskedText = maskResumeText(parsedText);
                    await db.query(
                        `UPDATE resumes SET parsed_text = ?, parse_status = 'done' WHERE id = ?`,
                        [maskedText, resumeId]
                    );
                    // Use original unmasked text for matching accuracy; this also
                    // extracts + batch-upserts the candidate's skill vectors.
                    await matchingService.triggerCandidateMatching(candidateId, parsedText);
                }
            } catch (err) {
                console.error('[resume background]', err.message);
                await db.query(
                    "UPDATE resumes SET parse_status = 'failed' WHERE id = ?", [resumeId]
                );
            }
        });
    } catch (err) {
        console.error('[resume upload]', err);
        // Clean up saved file on DB error
        try { fs.unlinkSync(absolutePath); } catch (_) {}
        res.status(500).json({ success: false, message: 'Upload failed.' });
    }
});

// ── POST /api/candidates/resume/extract-profile ──────────────────────────────
// Reads the candidate's latest resume file, runs AI extraction, returns all profile fields
router.post('/resume/extract-profile', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    try {
        const candidateId = await getCandidateId(req.user.id);
        const [[resume]] = await db.query(
            `SELECT file_key, mime_type FROM resumes
             WHERE candidate_id = ? AND deleted_at IS NULL
             ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
            [candidateId]
        );
        if (!resume) return res.status(404).json({ message: 'No resume found. Please upload a resume first.' });

        const absolutePath = path.join(process.cwd(), resume.file_key);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ message: 'Resume file not found on server.' });
        }

        const buffer = fs.readFileSync(absolutePath);
        let rawText = '';
        if (resume.mime_type === 'application/pdf') {
            const pdfParse = require('pdf-parse');
            rawText = (await pdfParse(buffer)).text;
        } else {
            const mammoth = require('mammoth');
            rawText = (await mammoth.extractRawText({ buffer })).value;
        }

        if (!rawText.trim()) {
            return res.status(422).json({ message: 'Could not extract text from resume.' });
        }

        const extracted = await parseFullProfile(rawText);
        res.json({ success: true, data: extracted });
    } catch (err) {
        console.error('[resume.extract-profile]', err.message);
        res.status(500).json({ message: 'Failed to extract profile from resume.' });
    }
});

// ── GET /api/candidates/resume ────────────────────────────────────────────────
router.get('/resume', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const userId = req.user.id;
    try {
        const candidateId = await getCandidateId(userId);

        const [[resume]] = await db.query(
            `SELECT id, file_name AS original_name, file_key, file_size,
                    mime_type, parse_status, created_at AS uploaded_at
             FROM resumes
             WHERE candidate_id = ? AND deleted_at IS NULL
             ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
            [candidateId]
        );

        if (!resume) return res.status(404).json({ success: false, message: 'No resume found.' });

        const [skillRows] = await db.query(
            `SELECT st.name FROM candidate_skill_vectors csv
             JOIN skill_tags st ON st.id = csv.skill_tag_id
             WHERE csv.candidate_id = ?
             ORDER BY st.name`,
            [candidateId]
        );

        res.json({
            success: true,
            data: {
                file_url: '/' + resume.file_key.replace(/\\/g, '/'),
                original_name: resume.original_name,
                uploaded_at: resume.uploaded_at,
                parse_status: resume.parse_status,
                extracted_skills: skillRows.map(r => r.name),
            },
        });
    } catch (err) {
        console.error('[resume get]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch resume.' });
    }
});

// ── GET /api/candidates/resume/download ──────────────────────────────────────
router.get('/resume/download', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const userId = req.user.id;
    try {
        const candidateId = await getCandidateId(userId);

        const [[resume]] = await db.query(
            `SELECT file_key, file_name FROM resumes
             WHERE candidate_id = ? AND deleted_at IS NULL
             ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
            [candidateId]
        );

        if (!resume) return res.status(404).json({ success: false, message: 'No resume on file.' });

        const absolutePath = path.join(process.cwd(), resume.file_key);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ success: false, message: 'Resume file not found on server.' });
        }

        res.download(absolutePath, resume.file_name);
    } catch (err) {
        console.error('[resume download]', err);
        res.status(500).json({ success: false, message: 'Download failed.' });
    }
});

// ── POST /api/candidates/resume/parse ────────────────────────────────────────
// Re-parses the resume using the OpenAI-based parser and updates skill_vectors
router.post('/resume/parse', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const userId = req.user.id;
    try {
        const candidateId = await getCandidateId(userId);

        const [[resumeRow]] = await db.query(
            `SELECT id, file_key, mime_type FROM resumes
             WHERE candidate_id = ? AND deleted_at IS NULL
             ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
            [candidateId]
        );
        if (!resumeRow) return res.status(404).json({ success: false, message: 'No resume found.' });

        const absolutePath = path.join(process.cwd(), resumeRow.file_key);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ success: false, message: 'Resume file not found on server.' });
        }

        const buffer = fs.readFileSync(absolutePath);
        let parsedText = '';
        if (resumeRow.file_key.endsWith('.pdf')) {
            const pdfParse = require('pdf-parse');
            parsedText = (await pdfParse(buffer)).text;
        } else {
            const mammoth = require('mammoth');
            parsedText = (await mammoth.extractRawText({ buffer })).value;
        }

        const aiResult = await parseResumeText(parsedText);

        const names = await upsertCandidateSkills(candidateId, aiResult.skills, 'resume_parsed');
        const insertedSkills = names.map((name) => ({ skill_name: name }));

        await db.query(
            `UPDATE resumes SET parsed_text = ?, parse_status = 'done' WHERE id = ? AND deleted_at IS NULL`,
            [maskResumeText(parsedText), resumeRow.id]
        );

        if (aiResult.experience_years) {
            await db.query(
                `INSERT INTO candidate_profiles (candidate_id, total_experience, summary)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                     total_experience = VALUES(total_experience),
                     summary = COALESCE(NULLIF(summary,''), VALUES(summary))`,
                [candidateId, aiResult.experience_years, aiResult.summary || null]
            );
        }

        res.json({
            success: true,
            data: {
                skills: insertedSkills,
                experience_years: aiResult.experience_years,
                summary: aiResult.summary,
            },
        });
    } catch (err) {
        console.error('[resume parse]', err);
        res.status(500).json({ success: false, message: 'Parsing failed.' });
    }
});

// ── GET /api/candidates/applications ─────────────────────────────────────────
router.get('/applications', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const userId = req.user.id;
    try {
        const candidateId = await getCandidateId(userId);

        const [applications] = await db.query(
            `SELECT a.id, a.status, a.cover_letter, a.applied_at,
                    jp.id AS job_id, jp.title, jp.location, jp.job_type,
                    jp.salary_min, jp.salary_max,
                    co.company_name
             FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             WHERE a.candidate_id = ? AND a.deleted_at IS NULL
             ORDER BY a.applied_at DESC`,
            [candidateId]
        );

        res.json({ success: true, data: applications });
    } catch (err) {
        console.error('[applications fetch]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch applications.' });
    }
});

// ── POST /api/candidates/applications/:jobId ──────────────────────────────────
router.post('/applications/:jobId', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const userId = req.user.id;
    const { jobId } = req.params;
    const { cover_letter } = req.body;

    try {
        const candidateId = await getCandidateId(userId);

        // Once hired through Ladder, a candidate is off the market for new roles
        if (await isCandidateHired(candidateId)) {
            return res.status(403).json({
                success: false,
                message: 'You have already been hired through LadderStep Human Consulting and can no longer apply to new roles.',
            });
        }

        const [[resumeRow]] = await db.query(
            `SELECT id FROM resumes WHERE candidate_id = ? AND deleted_at IS NULL
             ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
            [candidateId]
        );
        if (!resumeRow) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a resume before applying.',
            });
        }

        const [[jobRow]] = await db.query(
            "SELECT id FROM job_postings WHERE id = ? AND status = 'active' AND deleted_at IS NULL",
            [jobId]
        );
        if (!jobRow) {
            return res.status(404).json({ success: false, message: 'Job not found or no longer active.' });
        }

        const [result] = await db.query(
            `INSERT INTO applications (candidate_id, job_id, resume_id, cover_letter) VALUES (?, ?, ?, ?)`,
            [candidateId, jobId, resumeRow.id, cover_letter || null]
        );

        const applicationId = result.insertId;
        res.status(201).json({ success: true, message: 'Application submitted.', data: { id: applicationId } });

        setImmediate(() =>
            matchingService.calculateMatchScore(applicationId)
                .catch(err => console.error('[AI match]', err.message))
        );
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'You have already applied to this job.' });
        }
        console.error('[application submit]', err);
        res.status(500).json({ success: false, message: 'Failed to submit application.' });
    }
});

// ── PATCH /api/candidates/applications/:id/withdraw ───────────────────────────
router.patch('/applications/:id/withdraw', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const candidateId = await getCandidateId(userId);

        const [[app]] = await db.query(
            `SELECT id, status FROM applications
             WHERE id = ? AND candidate_id = ? AND deleted_at IS NULL`,
            [id, candidateId]
        );
        if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

        if (['hired', 'rejected', 'withdrawn'].includes(app.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot withdraw an application with status: ${app.status}`,
            });
        }

        await db.query(
            `UPDATE applications SET status = 'withdrawn', deleted_at = NOW() WHERE id = ?`,
            [id]
        );

        res.json({ success: true, message: 'Application withdrawn.' });
    } catch (err) {
        console.error('[withdraw]', err);
        res.status(500).json({ success: false, message: 'Failed to withdraw application.' });
    }
});

// ── GET /api/candidates/documents ────────────────────────────────────────────
router.get('/documents', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    try {
        const candidateId = await getCandidateId(req.user.id);
        const [docs] = await db.query(
            `SELECT id, doc_type, original_name, file_size, mime_type, notes, created_at
             FROM candidate_documents
             WHERE candidate_id = ? AND deleted_at IS NULL
             ORDER BY created_at DESC`,
            [candidateId]
        );
        res.json({ success: true, data: docs });
    } catch (err) {
        console.error('[docs.list]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch documents.' });
    }
});

// ── POST /api/candidates/documents ───────────────────────────────────────────
router.post('/documents', authenticateToken, authorizeRole('candidate'),
    uploadDocument.single('file'),
    async (req, res) => {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
        const { doc_type, notes } = req.body;
        if (!doc_type) return res.status(400).json({ message: 'doc_type is required.' });

        try {
            const candidateId = await getCandidateId(req.user.id);
            const [result] = await db.query(
                `INSERT INTO candidate_documents
                    (candidate_id, doc_type, original_name, file_path, file_size, mime_type, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [candidateId, doc_type, req.file.originalname,
                 req.file.filename, req.file.size, req.file.mimetype, notes || null]
            );
            res.status(201).json({
                success: true,
                data: {
                    id: result.insertId,
                    doc_type,
                    original_name: req.file.originalname,
                    file_size: req.file.size,
                    mime_type: req.file.mimetype,
                    notes: notes || null,
                },
            });
        } catch (err) {
            console.error('[docs.upload]', err);
            res.status(500).json({ success: false, message: 'Failed to save document.' });
        }
    }
);

// ── DELETE /api/candidates/documents/:id ─────────────────────────────────────
router.delete('/documents/:id', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    try {
        const candidateId = await getCandidateId(req.user.id);
        const [[doc]] = await db.query(
            `SELECT id, file_path FROM candidate_documents
             WHERE id = ? AND candidate_id = ? AND deleted_at IS NULL`,
            [req.params.id, candidateId]
        );
        if (!doc) return res.status(404).json({ message: 'Document not found.' });

        await db.query(
            `UPDATE candidate_documents SET deleted_at = NOW() WHERE id = ?`,
            [doc.id]
        );

        // Remove file from disk
        const fullPath = path.join(process.cwd(), 'uploads', 'documents', doc.file_path);
        fs.unlink(fullPath, () => {});

        res.json({ success: true, message: 'Document removed.' });
    } catch (err) {
        console.error('[docs.delete]', err);
        res.status(500).json({ success: false, message: 'Failed to delete document.' });
    }
});

module.exports = router;

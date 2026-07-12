const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { parseFullProfile } = require('../utils/aiParser');
const { parseRecruiterFilename, isNoiseName, chooseName } = require('../utils/resumeParser');
const { maskResumeText } = require('../utils/maskPII');
const matchingService = require('../services/matchingService');
const { isCandidateHired } = require('../utils/candidateStatus');

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) { console.error('[notify]', err.message); }
};

const extractText = async (absolutePath) => {
    const buffer = fs.readFileSync(absolutePath);
    if (absolutePath.toLowerCase().endsWith('.pdf')) {
        const pdfParse = require('pdf-parse');
        return (await pdfParse(buffer)).text;
    }
    const mammoth = require('mammoth');
    return (await mammoth.extractRawText({ buffer })).value;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── GET /api/recruitment/jobs ─────────────────────────────────────────────────
// Active job postings across all companies — the JDs executives can source for
exports.listActiveJobs = async (req, res) => {
    try {
        const [jobs] = await db.query(
            `SELECT jp.id, jp.title, jp.location, jp.job_type, jp.work_mode,
                    jp.experience_min, jp.experience_max, jp.openings, jp.deadline,
                    jp.created_at, co.id AS company_id, co.company_name,
                    (SELECT COUNT(*) FROM applications a
                     WHERE a.job_id = jp.id AND a.deleted_at IS NULL) AS applicant_count,
                    (SELECT COUNT(*) FROM applications a
                     WHERE a.job_id = jp.id AND a.source = 'executive' AND a.deleted_at IS NULL) AS sourced_count
             FROM job_postings jp
             JOIN companies co ON co.id = jp.company_id AND co.deleted_at IS NULL
             WHERE jp.status = 'active' AND jp.deleted_at IS NULL
             ORDER BY co.company_name, jp.created_at DESC`
        );
        res.json({ success: true, data: jobs });
    } catch (err) {
        console.error('[recruitment.listJobs]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch jobs.' });
    }
};

// ── GET /api/recruitment/jobs/:jobId ──────────────────────────────────────────
// Full JD so the executive knows what profiles to source for this requirement
exports.getJobDetail = async (req, res) => {
    try {
        const [[job]] = await db.query(
            `SELECT jp.id, jp.title, jp.description, jp.requirements, jp.location,
                    jp.job_type, jp.work_mode, jp.salary_min, jp.salary_max,
                    jp.experience_min, jp.experience_max, jp.openings, jp.deadline,
                    jp.created_at, co.id AS company_id, co.company_name,
                    co.industry, co.headquarters,
                    (SELECT COUNT(*) FROM applications a
                     WHERE a.job_id = jp.id AND a.deleted_at IS NULL) AS applicant_count,
                    (SELECT COUNT(*) FROM applications a
                     WHERE a.job_id = jp.id AND a.source = 'executive' AND a.deleted_at IS NULL) AS sourced_count
             FROM job_postings jp
             JOIN companies co ON co.id = jp.company_id AND co.deleted_at IS NULL
             WHERE jp.id = ? AND jp.status = 'active' AND jp.deleted_at IS NULL`,
            [req.params.jobId]
        );
        if (!job) return res.status(404).json({ success: false, message: 'Job not found or not active.' });

        // AI-extracted skills (job_skill_vectors) — what the matcher scores against
        const [skills] = await db.query(
            `SELECT st.name, jsv.is_mandatory
             FROM job_skill_vectors jsv
             JOIN skill_tags st ON st.id = jsv.skill_tag_id
             WHERE jsv.job_id = ?
             ORDER BY jsv.is_mandatory DESC, st.name`,
            [req.params.jobId]
        );
        job.required_skills  = skills.filter(s => s.is_mandatory).map(s => s.name);
        job.preferred_skills = skills.filter(s => !s.is_mandatory).map(s => s.name);

        res.json({ success: true, data: job });
    } catch (err) {
        console.error('[recruitment.getJobDetail]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch job detail.' });
    }
};

// ── Background pipeline: one resume file → candidate + application + AI match ─
const processResumeItem = async (item, job, uploadedBy) => {
    const mark = (status, fields = {}) => db.query(
        `UPDATE resume_upload_items SET status = ?, error_message = ?, candidate_id = ?,
                application_id = ?, extracted_name = ?, extracted_email = ?, fit_score = ?
         WHERE id = ?`,
        [status, fields.error || null, fields.candidateId || null, fields.applicationId || null,
         fields.name || null, fields.email || null, fields.fitScore ?? null, item.id]
    );

    const absolutePath = path.join(process.cwd(), item.file_key);
    await db.query(`UPDATE resume_upload_items SET status = 'parsing' WHERE id = ?`, [item.id]);

    // 1. Extract raw text
    let rawText = '';
    try {
        rawText = await extractText(absolutePath);
    } catch (err) {
        await mark('failed', { error: `Could not read file: ${err.message}` });
        return 'failed';
    }
    if (!rawText.trim()) {
        await mark('failed', { error: 'No text could be extracted from this file.' });
        return 'failed';
    }

    // 2. AI: full profile extraction (name, email, skills, education, experience)
    let profile;
    try {
        profile = await parseFullProfile(rawText);
    } catch (err) {
        await mark('failed', { error: `AI parsing failed: ${err.message}` });
        return 'failed';
    }

    const email = (profile.email || '').trim().toLowerCase();

    // The recruiter-verified filename ("NN_-_Name_-_Designation_-_X_Yrs_Y_Month")
    // is the most reliable source of the candidate's name and total experience for
    // executive-sourced uploads. Prefer it over the noisier text-scraped values:
    //   • name — use the filename name when the body parse is empty or looks like a
    //     section header / job title / address fragment (isNoiseName).
    //   • experience — use the filename figure whenever it is a real (>0) number.
    const fromFile = parseRecruiterFilename(item.file_name);
    const name = chooseName(profile.full_name, fromFile.name);
    const experienceYears = (fromFile.experienceYears != null && fromFile.experienceYears > 0)
        ? fromFile.experienceYears
        : (profile.experience_years || 0);

    if (!EMAIL_RE.test(email)) {
        await mark('failed', { name, error: 'No valid email address found in the resume.' });
        return 'failed';
    }

    // 3. Find or create the candidate user
    let userId;
    let isExistingProfile = false;
    const [[existingUser]] = await db.query(
        `SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.email = ? AND u.deleted_at IS NULL`, [email]
    );
    if (existingUser) {
        if (existingUser.role !== 'candidate') {
            await mark('failed', { name, email, error: `Email belongs to an existing ${existingUser.role} account.` });
            return 'failed';
        }
        userId = existingUser.id;
        isExistingProfile = true;
    } else {
        const randomPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
        const [[roleRow]] = await db.query(`SELECT id FROM roles WHERE name = 'candidate'`);
        const [result] = await db.query(
            `INSERT INTO users (name, email, phone, password, role_id, status, is_email_verified)
             VALUES (?, ?, ?, ?, ?, 'active', 1)`,
            [name || email.split('@')[0], email, profile.phone || null, randomPassword, roleRow.id]
        );
        userId = result.insertId;
    }

    await db.query('INSERT IGNORE INTO candidates (user_id) VALUES (?)', [userId]);
    const [[cand]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [userId]);
    const candidateId = cand.id;

    // 3b. Hired candidates are off the market — don't source them into new roles
    if (await isCandidateHired(candidateId)) {
        await mark('skipped', { name, email, candidateId, error: '[hired] Candidate is already placed and off the market.' });
        return 'skipped';
    }

    // 4. Duplicate guard — uq_application(candidate_id, job_id) covers soft-deleted rows too.
    // Only applies when targeting a specific JD; free-pool uploads have no job to dupe against.
    if (job) {
        const [[existingApp]] = await db.query(
            `SELECT id, deleted_at FROM applications WHERE candidate_id = ? AND job_id = ?`,
            [candidateId, job.id]
        );
        if (existingApp) {
            const reason = existingApp.deleted_at
                ? '[duplicate-job] Candidate previously withdrew their application for this job.'
                : '[duplicate-job] Candidate already has an active application for this JD.';
            await mark('skipped', { name, email, candidateId, error: reason });
            return 'skipped';
        }
    }

    // 5. Store the resume (keep candidate's own primary resume if they have one)
    const [[hasResume]] = await db.query(
        `SELECT id FROM resumes WHERE candidate_id = ? AND is_primary = 1 AND deleted_at IS NULL LIMIT 1`,
        [candidateId]
    );
    const [resResult] = await db.query(
        `INSERT INTO resumes (candidate_id, file_key, file_name, file_size, mime_type, is_primary, parse_status, parsed_text)
         VALUES (?, ?, ?, ?, ?, ?, 'done', ?)`,
        [candidateId, item.file_key, item.file_name, item.file_size || null,
         item.mime_type || null, hasResume ? 0 : 1, maskResumeText(rawText)]
    );
    const resumeId = resResult.insertId;

    // 6. Fill profile fields the candidate hasn't set themselves
    await db.query(
        `INSERT INTO candidate_profiles
            (candidate_id, headline, summary, total_experience, current_location,
             linkedin_url, portfolio_url, education)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
             headline         = COALESCE(NULLIF(headline, ''), VALUES(headline)),
             summary          = COALESCE(NULLIF(summary, ''), VALUES(summary)),
             total_experience = IF(COALESCE(total_experience, 0) = 0, VALUES(total_experience), total_experience),
             current_location = COALESCE(NULLIF(current_location, ''), VALUES(current_location)),
             linkedin_url     = COALESCE(NULLIF(linkedin_url, ''), VALUES(linkedin_url)),
             portfolio_url    = COALESCE(NULLIF(portfolio_url, ''), VALUES(portfolio_url)),
             education        = COALESCE(education, VALUES(education))`,
        [candidateId, profile.headline || null, profile.summary || null,
         experienceYears || 0, profile.location || null,
         profile.linkedin_url || null, profile.portfolio_url || null,
         profile.education?.length ? JSON.stringify(profile.education) : null]
    );

    // 7. AI: skill vectors (non-fatal — match score degrades gracefully without them)
    try {
        await matchingService.parseResumeToSkills(candidateId, rawText);
    } catch (err) {
        console.error('[recruitment] skill parsing failed:', err.message);
    }

    // 8. Create the application, sourced by this executive — only when targeting a JD.
    // Free-pool uploads (job === null) stop here: candidate + resume are on file,
    // searchable in the talent pool, with no application/match score yet.
    let applicationId = null;
    let fitScore = null;
    if (job) {
        const [appResult] = await db.query(
            `INSERT INTO applications (candidate_id, job_id, resume_id, source, sourced_by, status)
             VALUES (?, ?, ?, 'executive', ?, 'applied')`,
            [candidateId, job.id, resumeId, uploadedBy]
        );
        applicationId = appResult.insertId;

        // 9. AI match score against the JD
        try {
            const matchResult = await matchingService.calculateMatchScore(applicationId);
            fitScore = matchResult?.score ?? null;
        } catch (err) {
            console.error('[recruitment] match score failed:', err.message);
        }
    }

    const doneNote = isExistingProfile
        ? '[existing-profile] Existing pool profile matched — no duplicate created.'
        : (!job ? '[pool] Added to free talent pool.' : null);
    await mark('done', { name, email, candidateId, applicationId, fitScore, error: doneNote });
    return 'created';
};

const processBatch = async (batchId, job, uploadedBy) => {
    const [items] = await db.query(
        `SELECT id, file_name, file_key, file_size, mime_type FROM resume_upload_items
         WHERE batch_id = ? AND status = 'pending' ORDER BY id`, [batchId]
    );

    const counts = { created: 0, skipped: 0, failed: 0 };
    for (const item of items) {
        let outcome = 'failed';
        try {
            outcome = await processResumeItem(item, job, uploadedBy);
        } catch (err) {
            console.error(`[recruitment] item ${item.id} crashed:`, err.message);
            await db.query(
                `UPDATE resume_upload_items SET status = 'failed', error_message = ? WHERE id = ?`,
                [err.message.substring(0, 490), item.id]
            ).catch(() => {});
        }
        if (outcome === 'created') counts.created++;
        else if (outcome === 'skipped') counts.skipped++;
        else counts.failed++;

        await db.query(
            `UPDATE resume_upload_batches
             SET processed_files = processed_files + 1, created_count = ?, skipped_count = ?, failed_count = ?
             WHERE id = ?`,
            [counts.created, counts.skipped, counts.failed, batchId]
        );
    }

    await db.query(`UPDATE resume_upload_batches SET status = 'done' WHERE id = ?`, [batchId]);

    notify(
        uploadedBy,
        'bulk_resume_done',
        'Bulk resume upload complete',
        job
            ? `"${job.title}" (${job.company_name}): ${counts.created} candidate(s) added, ${counts.skipped} skipped, ${counts.failed} failed.`
            : `Free talent pool upload: ${counts.created} candidate(s) added, ${counts.skipped} skipped, ${counts.failed} failed.`,
        { batch_id: batchId, job_id: job?.id ?? null }
    );
};

// ── POST /api/recruitment/jobs/:jobId/resumes ─────────────────────────────────
// Multipart upload (field "resumes", up to 20 files). Returns immediately;
// parsing, account creation, and AI matching run in the background.
exports.bulkUploadResumes = async (req, res) => {
    const files = req.files || [];
    if (!files.length) {
        return res.status(400).json({ success: false, message: 'No resume files uploaded.' });
    }

    try {
        const [[job]] = await db.query(
            `SELECT jp.id, jp.title, co.company_name
             FROM job_postings jp
             JOIN companies co ON co.id = jp.company_id
             WHERE jp.id = ? AND jp.status = 'active' AND jp.deleted_at IS NULL`,
            [req.params.jobId]
        );
        if (!job) {
            files.forEach(f => fs.unlink(f.path, () => {}));
            return res.status(404).json({ success: false, message: 'Job not found or not active.' });
        }

        const [batchResult] = await db.query(
            `INSERT INTO resume_upload_batches (job_id, uploaded_by, total_files) VALUES (?, ?, ?)`,
            [job.id, req.user.id, files.length]
        );
        const batchId = batchResult.insertId;

        for (const file of files) {
            const fileKey = path.join('uploads', 'resumes', file.filename).replace(/\\/g, '/');
            await db.query(
                `INSERT INTO resume_upload_items (batch_id, file_name, file_key, file_size, mime_type)
                 VALUES (?, ?, ?, ?, ?)`,
                [batchId, file.originalname, fileKey, file.size, file.mimetype]
            );
        }

        res.status(202).json({
            success: true,
            message: `Upload received. Processing ${files.length} resume(s) in the background.`,
            data: { batch_id: batchId, total_files: files.length },
        });

        setImmediate(() => {
            processBatch(batchId, job, req.user.id)
                .catch(async (err) => {
                    console.error('[recruitment] batch crashed:', err);
                    await db.query(
                        `UPDATE resume_upload_batches SET status = 'failed' WHERE id = ?`, [batchId]
                    ).catch(() => {});
                });
        });
    } catch (err) {
        console.error('[recruitment.bulkUpload]', err);
        res.status(500).json({ success: false, message: 'Failed to start bulk upload.' });
    }
};

// ── POST /api/recruitment/resumes ─────────────────────────────────────────────
// Bulk upload straight into the free talent pool — no JD required. Same pipeline
// as bulkUploadResumes (extract → AI parse → candidate + resume + skills) but
// stops short of creating an application/match score. Candidates land in the
// existing /recruitment/talent pool, ready to be assigned to a JD later.
exports.bulkUploadToPool = async (req, res) => {
    const files = req.files || [];
    if (!files.length) {
        return res.status(400).json({ success: false, message: 'No resume files uploaded.' });
    }

    try {
        const [batchResult] = await db.query(
            `INSERT INTO resume_upload_batches (job_id, uploaded_by, total_files) VALUES (NULL, ?, ?)`,
            [req.user.id, files.length]
        );
        const batchId = batchResult.insertId;

        for (const file of files) {
            const fileKey = path.join('uploads', 'resumes', file.filename).replace(/\\/g, '/');
            await db.query(
                `INSERT INTO resume_upload_items (batch_id, file_name, file_key, file_size, mime_type)
                 VALUES (?, ?, ?, ?, ?)`,
                [batchId, file.originalname, fileKey, file.size, file.mimetype]
            );
        }

        res.status(202).json({
            success: true,
            message: `Upload received. Processing ${files.length} resume(s) into the free talent pool.`,
            data: { batch_id: batchId, total_files: files.length },
        });

        setImmediate(() => {
            processBatch(batchId, null, req.user.id)
                .catch(async (err) => {
                    console.error('[recruitment] pool batch crashed:', err);
                    await db.query(
                        `UPDATE resume_upload_batches SET status = 'failed' WHERE id = ?`, [batchId]
                    ).catch(() => {});
                });
        });
    } catch (err) {
        console.error('[recruitment.bulkUploadToPool]', err);
        res.status(500).json({ success: false, message: 'Failed to start bulk upload.' });
    }
};

// ── GET /api/recruitment/batches ──────────────────────────────────────────────
exports.listBatches = async (req, res) => {
    const conditions = ['b.deleted_at IS NULL'];
    const params = [];

    if (req.user.role !== 'admin') {
        conditions.push('b.uploaded_by = ?');
        params.push(req.user.id);
    }
    if (req.query.job_id) {
        conditions.push('b.job_id = ?');
        params.push(req.query.job_id);
    }

    try {
        const [rows] = await db.query(
            `SELECT b.id, b.job_id, b.total_files, b.processed_files, b.created_count,
                    b.skipped_count, b.failed_count, b.status, b.created_at,
                    jp.title AS job_title, co.company_name, u.name AS uploaded_by_name
             FROM resume_upload_batches b
             LEFT JOIN job_postings jp ON jp.id = b.job_id
             LEFT JOIN companies co ON co.id = jp.company_id
             JOIN users u ON u.id = b.uploaded_by
             WHERE ${conditions.join(' AND ')}
             ORDER BY b.created_at DESC
             LIMIT 50`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[recruitment.listBatches]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch upload batches.' });
    }
};

// ── GET /api/recruitment/batches/:id ──────────────────────────────────────────
exports.getBatchDetail = async (req, res) => {
    try {
        const [[batch]] = await db.query(
            `SELECT b.*, jp.title AS job_title, co.company_name, u.name AS uploaded_by_name
             FROM resume_upload_batches b
             LEFT JOIN job_postings jp ON jp.id = b.job_id
             LEFT JOIN companies co ON co.id = jp.company_id
             JOIN users u ON u.id = b.uploaded_by
             WHERE b.id = ? AND b.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });
        if (req.user.role !== 'admin' && batch.uploaded_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const [items] = await db.query(
            `SELECT id, file_name, status, error_message, candidate_id, application_id,
                    extracted_name, extracted_email, fit_score
             FROM resume_upload_items WHERE batch_id = ? ORDER BY id`,
            [req.params.id]
        );
        res.json({ success: true, data: { ...batch, items } });
    } catch (err) {
        console.error('[recruitment.getBatch]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch batch detail.' });
    }
};

const getEmployeeId = async (userId) => {
    const [[emp]] = await db.query(
        'SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL', [userId]
    );
    return emp?.id ?? null;
};

const logAction = (adminId, action, entityType, entityId, details, ipAddr) => {
    db.query(
        `INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, new_value, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [adminId, action, entityType, entityId, details ? JSON.stringify(details) : null, ipAddr || null]
    ).catch(e => console.error('[logAction]', e.message));
};

// ── GET /api/recruitment/candidates/:candidateId/profile ─────────────────────
// Full candidate profile for HR executives — PII exposed, no masking.
// Optional ?jobId= returns fit_score + matched/missing skills for that JD.
exports.getCandidateProfile = async (req, res) => {
    const { candidateId } = req.params;
    const { jobId } = req.query;

    try {
        const [[profile]] = await db.query(
            `SELECT c.id AS candidate_id, u.id AS user_id,
                    u.name AS candidate_name, u.email AS candidate_email,
                    u.phone AS candidate_phone, u.status, u.created_at AS registered_at,
                    cp.headline, cp.summary, cp.total_experience,
                    cp.current_location, cp.preferred_locations,
                    cp.expected_salary, cp.current_salary,
                    cp.notice_period_days, cp.linkedin_url, cp.portfolio_url, cp.education
             FROM candidates c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
             WHERE c.id = ? AND c.deleted_at IS NULL`,
            [candidateId]
        );
        if (!profile) return res.status(404).json({ success: false, message: 'Candidate not found.' });

        const [skills] = await db.query(
            `SELECT st.name, csv.proficiency, csv.years_exp
             FROM candidate_skill_vectors csv
             JOIN skill_tags st ON st.id = csv.skill_tag_id
             WHERE csv.candidate_id = ?
             ORDER BY csv.years_exp DESC, st.name`,
            [candidateId]
        );

        const [resumes] = await db.query(
            `SELECT id, file_name, file_key, is_primary, created_at
             FROM resumes
             WHERE candidate_id = ? AND deleted_at IS NULL
             ORDER BY is_primary DESC, created_at DESC`,
            [candidateId]
        );

        let fitScore = null;
        let matchedSkills = [];
        let missingSkills = [];
        if (jobId) {
            const [[mr]] = await db.query(
                `SELECT mr.fit_score, mr.matched_skills, mr.missing_skills
                 FROM applications a
                 JOIN match_results mr ON mr.application_id = a.id
                 WHERE a.candidate_id = ? AND a.job_id = ? AND a.deleted_at IS NULL
                 ORDER BY mr.created_at DESC LIMIT 1`,
                [candidateId, jobId]
            );
            if (mr) {
                fitScore = mr.fit_score;
                try { matchedSkills = typeof mr.matched_skills === 'string' ? JSON.parse(mr.matched_skills) : (mr.matched_skills || []); } catch {}
                try { missingSkills = typeof mr.missing_skills === 'string' ? JSON.parse(mr.missing_skills) : (mr.missing_skills || []); } catch {}
            }
        }

        res.json({
            success: true,
            data: {
                ...profile,
                skills,
                resumes,
                fit_score: fitScore,
                matched_skills: matchedSkills,
                missing_skills: missingSkills,
            },
        });
    } catch (err) {
        console.error('[recruitment.candidateProfile]', err);
        res.status(500).json({ success: false, message: 'Failed to load candidate profile.' });
    }
};

// ── GET /api/recruitment/talent ───────────────────────────────────────────────
// Executive talent pool — real names, no masking. Supports search + skill + exp.
// Optional ?jobId= to mark which candidates already have an application for that JD.
exports.listTalentPoolExec = async (req, res) => {
    try {
        const { search = '', skill, experience_min, experience_max, page = 1, jobId } = req.query;
        const limit = 20;
        const offset = (Math.max(1, parseInt(page)) - 1) * limit;

        const params = [];

        let searchClause = '';
        if (search.trim()) {
            searchClause = `AND (cp.headline LIKE ? OR cp.summary LIKE ? OR u.name LIKE ?)`;
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
        }

        let expClause = '';
        if (experience_min !== undefined && experience_min !== '') {
            expClause += ` AND COALESCE(cp.total_experience, 0) >= ?`;
            params.push(parseFloat(experience_min));
        }
        if (experience_max !== undefined && experience_max !== '') {
            expClause += ` AND COALESCE(cp.total_experience, 0) <= ?`;
            params.push(parseFloat(experience_max));
        }

        let skillClause = '';
        if (skill && skill.trim()) {
            skillClause = `AND EXISTS (
                SELECT 1 FROM candidate_skill_vectors csv2
                JOIN skill_tags st2 ON st2.id = csv2.skill_tag_id
                WHERE csv2.candidate_id = c.id AND st2.name LIKE ?
            )`;
            params.push(`%${skill.trim()}%`);
        }

        const jobIdInt = jobId ? parseInt(jobId) : null;

        const [rows] = await db.query(
            `SELECT
                c.id AS candidate_id,
                u.name AS candidate_name,
                u.email AS candidate_email,
                cp.headline,
                cp.total_experience,
                cp.current_location,
                cp.notice_period_days,
                cp.expected_salary,
                cp.summary,
                (SELECT JSON_ARRAYAGG(st.name)
                 FROM candidate_skill_vectors csv
                 JOIN skill_tags st ON st.id = csv.skill_tag_id
                 WHERE csv.candidate_id = c.id LIMIT 12) AS skills,
                (SELECT r.id FROM resumes r
                 WHERE r.candidate_id = c.id AND r.deleted_at IS NULL
                 ORDER BY r.created_at DESC LIMIT 1) AS latest_resume_id,
                ${jobIdInt ? `(SELECT 1 FROM applications a2
                 WHERE a2.candidate_id = c.id AND a2.job_id = ? AND a2.deleted_at IS NULL
                 LIMIT 1) AS already_applied,` : '0 AS already_applied,'}
                ${jobIdInt ? `(SELECT mr.fit_score FROM applications a_fs
                 JOIN match_results mr ON mr.application_id = a_fs.id
                 WHERE a_fs.candidate_id = c.id AND a_fs.job_id = ? AND a_fs.deleted_at IS NULL
                 ORDER BY mr.created_at DESC LIMIT 1) AS fit_score,` : 'NULL AS fit_score,'}
                (SELECT COUNT(*) FROM applications a3
                 WHERE a3.candidate_id = c.id AND a3.deleted_at IS NULL) AS total_applications
             FROM candidates c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
             WHERE c.deleted_at IS NULL
               AND u.deleted_at IS NULL
               AND u.status = 'active'
               AND NOT EXISTS (
                   SELECT 1 FROM applications a2
                   WHERE a2.candidate_id = c.id AND a2.status = 'hired' AND a2.deleted_at IS NULL
               )
               ${searchClause}
               ${expClause}
               ${skillClause}
             ORDER BY cp.total_experience DESC, c.id DESC
             LIMIT ? OFFSET ?`,
            jobIdInt
                ? [jobIdInt, jobIdInt, ...params, limit, offset]
                : [...params, limit, offset]
        );

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total
             FROM candidates c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
             WHERE c.deleted_at IS NULL
               AND u.deleted_at IS NULL
               AND u.status = 'active'
               AND NOT EXISTS (
                   SELECT 1 FROM applications a2
                   WHERE a2.candidate_id = c.id AND a2.status = 'hired' AND a2.deleted_at IS NULL
               )
               ${searchClause}
               ${expClause}
               ${skillClause}`,
            params
        );

        // Live-score every pool candidate against the selected JD (not just those
        // who already applied) so the executive sees a match % for anyone.
        let scoreMap = new Map();
        if (jobIdInt) {
            try { scoreMap = await matchingService.scorePoolAgainstJob(jobIdInt, rows.map(r => r.candidate_id)); }
            catch (e) { console.error('[recruitment.talentPool] scoring failed:', e.message); }
        }

        const candidates = rows.map(row => {
            const live = scoreMap.get(row.candidate_id);
            return {
                ...row,
                skills: (() => {
                    try { return Array.isArray(row.skills) ? row.skills : JSON.parse(row.skills || '[]'); }
                    catch { return []; }
                })(),
                already_applied: !!row.already_applied,
                // Prefer the persisted score for applied candidates; otherwise the live one.
                fit_score: row.fit_score ?? (live ? live.score : null),
                matched_skills: live ? live.matched_skills : [],
                missing_skills: live ? live.missing_skills : [],
            };
        });

        res.json({ success: true, data: candidates, total: countRows[0].total, page: parseInt(page), limit });
    } catch (err) {
        console.error('[recruitment.talentPool]', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch talent pool.' });
    }
};

// ── POST /api/recruitment/jobs/:jobId/assign-candidate ────────────────────────
// Directly assign an existing pool candidate to a JD (no file upload needed).
exports.assignCandidateToJob = async (req, res) => {
    const { candidateId } = req.body;
    const { jobId } = req.params;

    if (!candidateId) return res.status(400).json({ success: false, message: 'candidateId is required.' });

    try {
        // Verify job exists and is active
        const [[job]] = await db.query(
            `SELECT jp.id, jp.title, co.id AS company_id, co.company_name, co.assigned_executive_id
             FROM job_postings jp
             JOIN companies co ON co.id = jp.company_id AND co.deleted_at IS NULL
             WHERE jp.id = ? AND jp.status = 'active' AND jp.deleted_at IS NULL`,
            [jobId]
        );
        if (!job) return res.status(404).json({ success: false, message: 'Job posting not found or not active.' });

        // Verify candidate exists and is not hired
        const [[cand]] = await db.query(
            `SELECT c.id, u.name AS candidate_name, u.id AS user_id
             FROM candidates c JOIN users u ON u.id = c.user_id
             WHERE c.id = ? AND c.deleted_at IS NULL AND u.status = 'active'`,
            [candidateId]
        );
        if (!cand) return res.status(404).json({ success: false, message: 'Candidate not found.' });

        const isHired = await isCandidateHired(parseInt(candidateId));
        if (isHired) return res.status(409).json({ success: false, message: 'Candidate is already hired and unavailable.' });

        // Get most recent resume (applications.resume_id is NOT NULL)
        const [[resume]] = await db.query(
            `SELECT id FROM resumes WHERE candidate_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
            [candidateId]
        );
        if (!resume) {
            return res.status(400).json({
                success: false,
                message: 'This candidate has no resume on file. Upload their resume via "Upload Resumes" first.',
            });
        }

        // Get sourced_by employee id
        const empId = await getEmployeeId(req.user.id);

        // Insert application (uq_application unique on candidate_id+job_id — INSERT IGNORE if soft-deleted)
        let applicationId;
        try {
            const [result] = await db.query(
                `INSERT INTO applications (candidate_id, job_id, resume_id, status, source, sourced_by)
                 VALUES (?, ?, ?, 'applied', 'executive', ?)`,
                [candidateId, jobId, resume.id, req.user.id]
            );
            applicationId = result.insertId;
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'This candidate already has an application for this job.' });
            }
            throw err;
        }

        // Compute match score in background
        setImmediate(async () => {
            try { await matchingService.calculateMatchScore(applicationId); }
            catch (e) { console.error('[assignCandidate] matchScore error:', e.message); }
        });

        // Notify exec (or admin if no exec assigned)
        const notifyUserId = job.assigned_executive_id || req.user.id;
        if (notifyUserId !== req.user.id) {
            await notify(notifyUserId, 'candidate_assigned',
                `Candidate Assigned — ${job.title}`,
                `${cand.candidate_name} has been assigned to ${job.title} at ${job.company_name}.`,
                { application_id: applicationId, job_id: parseInt(jobId), candidate_id: parseInt(candidateId) }
            );
        }

        logAction(req.user.id, 'assign_candidate_to_job', 'application', applicationId,
            { candidate_name: cand.candidate_name, job_title: job.title, company_name: job.company_name },
            req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress
        );

        res.status(201).json({
            success: true,
            message: `${cand.candidate_name} assigned to "${job.title}" at ${job.company_name}.`,
            application_id: applicationId,
        });
    } catch (err) {
        console.error('[recruitment.assignCandidate]', err.message);
        res.status(500).json({ success: false, message: 'Failed to assign candidate.' });
    }
};

// ── DELETE /api/recruitment/candidates/:candidateId ───────────────────────────
// Soft-deletes the candidate + their user account + all their resumes, and
// best-effort removes the resume files from disk. Blocked if hired.
exports.deleteCandidate = async (req, res) => {
    const { candidateId } = req.params;
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress;
    try {
        const [[cand]] = await db.query(
            `SELECT c.id, c.user_id, u.name, u.email FROM candidates c
             JOIN users u ON u.id = c.user_id
             WHERE c.id = ? AND c.deleted_at IS NULL`,
            [candidateId]
        );
        if (!cand) return res.status(404).json({ success: false, message: 'Candidate not found.' });

        // Block delete if the candidate is currently hired
        const [[hired]] = await db.query(
            `SELECT id FROM applications WHERE candidate_id = ? AND status = 'hired' AND deleted_at IS NULL LIMIT 1`,
            [candidateId]
        );
        if (hired) return res.status(409).json({ success: false, message: 'Cannot delete a candidate who has been hired.' });

        const [resumeRows] = await db.query(
            `SELECT id, file_key FROM resumes WHERE candidate_id = ? AND deleted_at IS NULL`,
            [candidateId]
        );

        // Revoke login: free the email and scramble the password so a future login
        // attempt with the original email finds no matching row at all — the
        // strongest "removed" signal short of a hard DELETE (which would risk FK
        // errors from notifications.user_id etc. and break the soft-delete convention).
        const tombstoneEmail = `deleted+${cand.user_id}+${Date.now()}@removed.invalid`;
        const randomPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);

        await db.query('UPDATE candidates SET deleted_at = NOW() WHERE id = ?', [candidateId]);
        await db.query(
            `UPDATE users SET deleted_at = NOW(), status = 'suspended', email = ?, password = ? WHERE id = ?`,
            [tombstoneEmail, randomPassword, cand.user_id]
        );
        await db.query('UPDATE resumes SET deleted_at = NOW() WHERE candidate_id = ? AND deleted_at IS NULL', [candidateId]);

        resumeRows.forEach(r => {
            if (!r.file_key) return;
            fs.unlink(path.join(process.cwd(), r.file_key), () => {});
        });

        logAction(req.user.id, 'delete_candidate_profile', 'candidate', candidateId,
            { candidate_name: cand.name, original_email: cand.email, user_id: cand.user_id, resumes_removed: resumeRows.length }, ip);

        res.json({
            success: true,
            message: `Candidate profile for ${cand.name} deleted along with ${resumeRows.length} resume(s). Login access revoked.`,
        });
    } catch (err) {
        console.error('[recruitment.deleteCandidate]', err);
        res.status(500).json({ success: false, message: 'Failed to delete candidate.' });
    }
};

// ── GET /api/recruitment/talent-interests ─────────────────────────────────────
// Inbox of company interest notifications for the logged-in executive.
exports.listTalentInterests = async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';

        let rows;
        if (isAdmin) {
            [rows] = await db.query(
                `SELECT n.id AS notif_id, n.is_read, n.created_at,
                        n.body AS interest_notes, n.metadata,
                        co.id AS company_id, co.company_name,
                        c.id AS candidate_id, u_cand.name AS candidate_name,
                        cp.headline, cp.total_experience, cp.current_location,
                        (SELECT JSON_ARRAYAGG(st.name)
                         FROM candidate_skill_vectors csv
                         JOIN skill_tags st ON st.id = csv.skill_tag_id
                         WHERE csv.candidate_id = c.id LIMIT 8) AS skills,
                        jp.id AS job_id, jp.title AS job_title,
                        (SELECT 1 FROM applications a2
                         WHERE a2.candidate_id = c.id AND a2.job_id = jp.id AND a2.deleted_at IS NULL LIMIT 1) AS already_assigned,
                        (SELECT 1 FROM applications a3
                         WHERE a3.candidate_id = c.id AND a3.status = 'hired' AND a3.deleted_at IS NULL LIMIT 1) AS is_hired
                 FROM notifications n
                 JOIN companies co ON co.id = JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.company_id'))
                 JOIN candidates c ON c.id = JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.candidate_id'))
                 JOIN users u_cand ON u_cand.id = c.user_id
                 LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
                 LEFT JOIN job_postings jp ON jp.id = JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.job_id'))
                 WHERE n.type = 'talent_interest' AND n.deleted_at IS NULL
                 ORDER BY n.is_read ASC, n.created_at DESC`
            );
        } else {
            // hr_staff sees interests for companies assigned to them
            [rows] = await db.query(
                `SELECT n.id AS notif_id, n.is_read, n.created_at,
                        n.body AS interest_notes, n.metadata,
                        co.id AS company_id, co.company_name,
                        c.id AS candidate_id, u_cand.name AS candidate_name,
                        cp.headline, cp.total_experience, cp.current_location,
                        (SELECT JSON_ARRAYAGG(st.name)
                         FROM candidate_skill_vectors csv
                         JOIN skill_tags st ON st.id = csv.skill_tag_id
                         WHERE csv.candidate_id = c.id LIMIT 8) AS skills,
                        jp.id AS job_id, jp.title AS job_title,
                        (SELECT 1 FROM applications a2
                         WHERE a2.candidate_id = c.id AND a2.job_id = jp.id AND a2.deleted_at IS NULL LIMIT 1) AS already_assigned,
                        (SELECT 1 FROM applications a3
                         WHERE a3.candidate_id = c.id AND a3.status = 'hired' AND a3.deleted_at IS NULL LIMIT 1) AS is_hired
                 FROM notifications n
                 JOIN companies co ON co.id = JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.company_id'))
                    AND co.assigned_executive_id = ?
                 JOIN candidates c ON c.id = JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.candidate_id'))
                 JOIN users u_cand ON u_cand.id = c.user_id
                 LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
                 LEFT JOIN job_postings jp ON jp.id = JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.job_id'))
                 WHERE n.type = 'talent_interest' AND n.deleted_at IS NULL
                 ORDER BY n.is_read ASC, n.created_at DESC`,
                [req.user.id]
            );
        }

        const interests = rows.map(row => ({
            ...row,
            metadata: (() => { try { return typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata; } catch { return {}; } })(),
            skills: (() => { try { return Array.isArray(row.skills) ? row.skills : JSON.parse(row.skills || '[]'); } catch { return []; } })(),
            already_assigned: !!row.already_assigned,
            is_hired: !!row.is_hired,
        }));

        res.json({ success: true, data: interests, unread_count: interests.filter(i => !i.is_read).length });
    } catch (err) {
        console.error('[recruitment.talentInterests]', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch talent interests.' });
    }
};

// ── POST /api/recruitment/talent-interests/:notifId/assign ────────────────────
// Executive acts on a company interest — assigns the candidate to the job,
// marks notification as read, notifies the company that it's been facilitated.
exports.actOnTalentInterest = async (req, res) => {
    const { notifId } = req.params;
    const { job_id } = req.body; // exec can override the job if company didn't specify one

    try {
        const [[notif]] = await db.query(
            `SELECT n.id, n.metadata, n.user_id AS notified_exec_id
             FROM notifications n
             WHERE n.id = ? AND n.type = 'talent_interest' AND n.deleted_at IS NULL`,
            [notifId]
        );
        if (!notif) return res.status(404).json({ success: false, message: 'Interest notification not found.' });

        const meta = (() => { try { return typeof notif.metadata === 'string' ? JSON.parse(notif.metadata) : notif.metadata; } catch { return {}; } })();
        const candidateId = meta.candidate_id;
        const jobIdToUse = job_id || meta.job_id;

        if (!candidateId) return res.status(400).json({ success: false, message: 'No candidate in this notification.' });
        if (!jobIdToUse) return res.status(400).json({ success: false, message: 'Specify a job_id to assign this candidate to.' });

        // Delegate to assignCandidateToJob logic inline
        const [[job]] = await db.query(
            `SELECT jp.id, jp.title, co.id AS company_id, co.company_name, co.user_id AS company_user_id
             FROM job_postings jp
             JOIN companies co ON co.id = jp.company_id AND co.deleted_at IS NULL
             WHERE jp.id = ? AND jp.status = 'active' AND jp.deleted_at IS NULL`,
            [jobIdToUse]
        );
        if (!job) return res.status(404).json({ success: false, message: 'Job posting not found or not active.' });

        const [[cand]] = await db.query(
            `SELECT c.id, u.name AS candidate_name FROM candidates c JOIN users u ON u.id = c.user_id
             WHERE c.id = ? AND c.deleted_at IS NULL`,
            [candidateId]
        );
        if (!cand) return res.status(404).json({ success: false, message: 'Candidate not found.' });

        const isHired = await isCandidateHired(parseInt(candidateId));
        if (isHired) return res.status(409).json({ success: false, message: 'Candidate is already hired.' });

        const [[resume]] = await db.query(
            `SELECT id FROM resumes WHERE candidate_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
            [candidateId]
        );
        if (!resume) return res.status(400).json({ success: false, message: 'Candidate has no resume on file.' });

        let applicationId;
        try {
            const [result] = await db.query(
                `INSERT INTO applications (candidate_id, job_id, resume_id, status, source, sourced_by)
                 VALUES (?, ?, ?, 'applied', 'executive', ?)`,
                [candidateId, jobIdToUse, resume.id, req.user.id]
            );
            applicationId = result.insertId;
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                // Already assigned — still mark notification read
                await db.query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notifId]);
                return res.json({ success: true, message: 'Candidate already assigned to this job. Notification marked as read.' });
            }
            throw err;
        }

        setImmediate(async () => {
            try { await matchingService.calculateMatchScore(applicationId); }
            catch (e) { console.error('[actOnInterest] matchScore:', e.message); }
        });

        // Mark notification as read
        await db.query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notifId]);

        // Notify company that exec has acted
        await notify(job.company_user_id, 'interest_actioned',
            `Introduction Facilitated — ${job.title}`,
            `Your LadderStep Human Consulting executive has facilitated an introduction for ${cand.candidate_name} to your "${job.title}" opening. The candidate profile has been shortlisted for your review.`,
            { application_id: applicationId, job_id: parseInt(jobIdToUse), candidate_id: parseInt(candidateId) }
        );

        res.json({
            success: true,
            message: `${cand.candidate_name} assigned to "${job.title}". Company has been notified.`,
            application_id: applicationId,
        });
    } catch (err) {
        console.error('[recruitment.actOnInterest]', err.message);
        res.status(500).json({ success: false, message: 'Failed to action this interest.' });
    }
};

// ── GET /api/recruitment/resumes/:resumeId/download ───────────────────────────
// HR/admin direct download of a candidate's resume file (full PII, unmasked).
exports.downloadResume = async (req, res) => {
    const { resumeId } = req.params;
    try {
        const [[resume]] = await db.query(
            `SELECT r.id, r.file_name, r.file_key
             FROM resumes r
             WHERE r.id = ? AND r.deleted_at IS NULL`,
            [resumeId]
        );
        if (!resume) return res.status(404).json({ success: false, message: 'Resume not found.' });
        if (!resume.file_key) return res.status(404).json({ success: false, message: 'File not available.' });

        const absolutePath = path.join(process.cwd(), resume.file_key);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ success: false, message: 'File not found on server.' });
        }
        res.download(absolutePath, resume.file_name || 'resume.pdf');
    } catch (err) {
        console.error('[recruitment.downloadResume]', err);
        res.status(500).json({ success: false, message: 'Failed to download resume.' });
    }
};

const db = require('../config/db');
const matchingService = require('../services/matchingService');
const { extractAndSaveJobSkills } = require('../services/jobSkillExtractor');
const { maskCandidateForCompany } = require('../utils/maskPII');
const { isCandidateHired } = require('../utils/candidateStatus');
const { hasSelectedPackage } = require('./resumeUnlockController');

// Helper: resolve or create the companies row for req.user.id
const getCompanyId = async (userId) => {
    const [rows] = await db.query(
        'SELECT id FROM companies WHERE user_id=? AND deleted_at IS NULL',
        [userId]
    );
    if (rows.length) return rows[0].id;

    const [[user]] = await db.query('SELECT name FROM users WHERE id=?', [userId]);
    const [result] = await db.query(
        'INSERT INTO companies (user_id, company_name, is_approved) VALUES (?,?,1)',
        [userId, user.name]
    );
    return result.insertId;
};

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
exports.listCompanyJobs = async (req, res) => {
    try {
        const companyId = await getCompanyId(req.user.id);

        const [jobs] = await db.query(
            `SELECT jp.*,
                    (SELECT COUNT(*) FROM applications a WHERE a.job_id=jp.id AND a.deleted_at IS NULL) AS applicant_count
             FROM job_postings jp
             WHERE jp.company_id=? AND jp.deleted_at IS NULL
             ORDER BY jp.created_at DESC`,
            [companyId]
        );

        res.json({ jobs });
    } catch (err) {
        console.error('listCompanyJobs error:', err);
        res.status(500).json({ message: 'Failed to fetch jobs.' });
    }
};

// ── POST /api/jobs ────────────────────────────────────────────────────────────
exports.createJob = async (req, res) => {
    const {
        title, description, requirements, location, job_type, work_mode,
        salary_min, salary_max, experience_min, experience_max,
        openings, deadline, status,
    } = req.body;

    if (!title || !description) {
        return res.status(400).json({ message: 'title and description are required.' });
    }

    try {
        const companyId = await getCompanyId(req.user.id);

        const [result] = await db.query(
            `INSERT INTO job_postings
             (company_id, posted_by, title, description, requirements, location,
              job_type, work_mode, salary_min, salary_max, experience_min,
              experience_max, openings, deadline, status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [companyId, req.user.id, title, description, requirements || null,
             location || null, job_type || 'full_time', work_mode || 'onsite',
             salary_min || null, salary_max || null, experience_min || 0,
             experience_max || null, openings || 1, deadline || null,
             status || 'draft']
        );

        const jobId = result.insertId;
        res.status(201).json({ message: 'Job created.', id: jobId });

        // Background: keyword extraction first (fast, no API needed), then AI matching
        const jdText = `${description || ''}\n\n${requirements || ''}`;
        setImmediate(async () => {
            try {
                await extractAndSaveJobSkills(jobId, { title, description, requirements }, db);
            } catch (err) {
                console.error('[Keyword] createJob extraction failed:', err.message);
            }
            // AI extraction runs after; if it succeeds it replaces keyword vectors with
            // better-quality data. If it fails, keyword vectors remain as a working fallback.
            matchingService.triggerJobMatching(jobId, jdText)
                .catch(err => console.error('[AI] Job matching failed:', err.message));
        });
    } catch (err) {
        console.error('createJob error:', err);
        res.status(500).json({ message: 'Failed to create job.' });
    }
};

// ── GET /api/jobs/:id (company view) ─────────────────────────────────────────
exports.getJob = async (req, res) => {
    try {
        const companyId = await getCompanyId(req.user.id);

        const [rows] = await db.query(
            `SELECT jp.*,
                    (SELECT COUNT(*) FROM applications a WHERE a.job_id=jp.id AND a.deleted_at IS NULL) AS applicant_count
             FROM job_postings jp
             WHERE jp.id=? AND jp.company_id=? AND jp.deleted_at IS NULL`,
            [req.params.id, companyId]
        );
        if (!rows.length) return res.status(404).json({ message: 'Job not found.' });

        res.json({ job: rows[0] });
    } catch (err) {
        console.error('getJob error:', err);
        res.status(500).json({ message: 'Failed to fetch job.' });
    }
};

// ── PUT /api/jobs/:id ─────────────────────────────────────────────────────────
exports.updateJob = async (req, res) => {
    const {
        title, description, requirements, location, job_type, work_mode,
        salary_min, salary_max, experience_min, experience_max,
        openings, deadline, status,
    } = req.body;

    if (!title || !description) {
        return res.status(400).json({ message: 'title and description are required.' });
    }

    try {
        const companyId = await getCompanyId(req.user.id);

        const [check] = await db.query(
            'SELECT id FROM job_postings WHERE id=? AND company_id=? AND deleted_at IS NULL',
            [req.params.id, companyId]
        );
        if (!check.length) return res.status(404).json({ message: 'Job not found.' });

        await db.query(
            `UPDATE job_postings
             SET title=?, description=?, requirements=?, location=?, job_type=?,
                 work_mode=?, salary_min=?, salary_max=?, experience_min=?,
                 experience_max=?, openings=?, deadline=?, status=?
             WHERE id=?`,
            [title, description, requirements || null, location || null,
             job_type || 'full_time', work_mode || 'onsite',
             salary_min || null, salary_max || null, experience_min || 0,
             experience_max || null, openings || 1, deadline || null,
             status || 'draft', req.params.id]
        );

        res.json({ message: 'Job updated.' });

        // Background: keyword extraction first, then AI re-matching
        const jdText = `${description || ''}\n\n${requirements || ''}`;
        const jobIdInt = parseInt(req.params.id);
        setImmediate(async () => {
            try {
                await extractAndSaveJobSkills(jobIdInt, { title, description, requirements }, db);
            } catch (err) {
                console.error('[Keyword] updateJob extraction failed:', err.message);
            }
            matchingService.triggerJobMatching(jobIdInt, jdText)
                .catch(err => console.error('[AI] Job re-matching failed:', err.message));
        });
    } catch (err) {
        console.error('updateJob error:', err);
        res.status(500).json({ message: 'Failed to update job.' });
    }
};

// ── PATCH /api/jobs/:id/status ────────────────────────────────────────────────
exports.setJobStatus = async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['draft', 'active', 'paused', 'closed'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Valid status required.' });
    }

    try {
        const companyId = await getCompanyId(req.user.id);

        const [check] = await db.query(
            'SELECT id FROM job_postings WHERE id=? AND company_id=? AND deleted_at IS NULL',
            [req.params.id, companyId]
        );
        if (!check.length) return res.status(404).json({ message: 'Job not found.' });

        await db.query('UPDATE job_postings SET status=? WHERE id=?', [status, req.params.id]);
        res.json({ message: 'Status updated.' });
    } catch (err) {
        console.error('setJobStatus error:', err);
        res.status(500).json({ message: 'Failed to update status.' });
    }
};

// ── DELETE /api/jobs/:id ──────────────────────────────────────────────────────
exports.deleteJob = async (req, res) => {
    try {
        const companyId = await getCompanyId(req.user.id);

        const [check] = await db.query(
            'SELECT id FROM job_postings WHERE id=? AND company_id=? AND deleted_at IS NULL',
            [req.params.id, companyId]
        );
        if (!check.length) return res.status(404).json({ message: 'Job not found.' });

        await db.query(
            'UPDATE job_postings SET status=\'closed\', deleted_at=NOW() WHERE id=?',
            [req.params.id]
        );
        res.json({ message: 'Job deleted.' });
    } catch (err) {
        console.error('deleteJob error:', err);
        res.status(500).json({ message: 'Failed to delete job.' });
    }
};

// ── GET /api/jobs/:jobId/applications ─────────────────────────────────────────
exports.getJobApplications = async (req, res) => {
    const { status } = req.query;

    try {
        const companyId = await getCompanyId(req.user.id);

        const [check] = await db.query(
            'SELECT id FROM job_postings WHERE id=? AND company_id=? AND deleted_at IS NULL',
            [req.params.jobId, companyId]
        );
        if (!check.length) return res.status(404).json({ message: 'Job not found.' });

        const [[companyRow]] = await db.query(
            'SELECT placement_fee_percent FROM companies WHERE id = ?', [companyId]
        );
        const hasPackage = await hasSelectedPackage(companyId, companyRow?.placement_fee_percent);

        // Candidates this company unlocked via a prepaid per-resume tier (Single/4-Pack)
        // see their real name + contact info in the shortlist — they already paid Ladder
        // directly for that candidate, so there's no fee-collection reason to redact it.
        // Platinum unlocks (granted_via='platinum') stay masked, same as un-unlocked rows.
        const [unlockedRows] = await db.query(
            `SELECT candidate_id FROM resume_unlocks WHERE company_id = ? AND granted_via IN ('single', 'pack')`,
            [companyId]
        );
        const unlockedCandidateIds = new Set(unlockedRows.map(r => r.candidate_id));

        const filters = ['a.job_id=?', 'a.deleted_at IS NULL'];
        const params = [req.params.jobId];
        if (status) { filters.push('a.status=?'); params.push(status); }

        const [applications] = await db.query(
            `SELECT a.id, a.status, a.applied_at, a.cover_letter,
                    a.candidate_id, a.source,
                    u.name AS candidate_name, u.email AS candidate_email, u.phone AS candidate_phone,
                    cp.current_location AS location, cp.total_experience, cp.expected_salary,
                    cp.notice_period_days AS notice_period,
                    s.status AS shortlist_status, s.fit_score AS shortlist_score, s.notes AS shortlist_notes,
                    mr.fit_score AS match_score, (mr.id IS NOT NULL) AS match_computed,
                    mr.matched_skills, mr.missing_skills,
                    (SELECT COUNT(*) FROM applications a2
                     WHERE a2.candidate_id = a.candidate_id AND a2.status = 'hired'
                       AND a2.id <> a.id AND a2.deleted_at IS NULL) AS hired_elsewhere,
                    (SELECT JSON_ARRAYAGG(st.name)
                     FROM candidate_skill_vectors csv
                     JOIN skill_tags st ON st.id = csv.skill_tag_id
                     WHERE csv.candidate_id = c.id) AS extracted_skills
             FROM applications a
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
             LEFT JOIN shortlists s ON s.application_id = a.id AND s.deleted_at IS NULL
             LEFT JOIN match_results mr ON mr.application_id = a.id
             WHERE ${filters.join(' AND ')}
             ORDER BY COALESCE(mr.fit_score, 0) DESC, a.applied_at DESC`,
            params
        );

        const result = applications.map(app => {
            const parsed = {
                ...app,
                matched_skills: (() => {
                    try { return typeof app.matched_skills === 'string' ? JSON.parse(app.matched_skills) : (app.matched_skills ?? []); }
                    catch { return []; }
                })(),
                missing_skills: (() => {
                    try { return typeof app.missing_skills === 'string' ? JSON.parse(app.missing_skills) : (app.missing_skills ?? []); }
                    catch { return []; }
                })(),
                extracted_skills: (() => {
                    try { return typeof app.extracted_skills === 'string' ? JSON.parse(app.extracted_skills) : (app.extracted_skills ?? []); }
                    catch { return []; }
                })(),
            };
            // AI match % is a paid-package feature — withhold it server-side
            // (not just hide in the UI) until the company has selected one.
            if (!hasPackage) {
                parsed.match_score = null;
                parsed.match_computed = false;
                parsed.matched_skills = [];
                parsed.missing_skills = [];
                parsed.package_required = true;
            }
            // Single/4-Pack unlocked candidates: real name + contact info, no masking.
            if (unlockedCandidateIds.has(app.candidate_id)) {
                parsed.contact_unlocked = true;
                return parsed;
            }
            return maskCandidateForCompany(parsed);
        });
        res.json({ applications: result, package_required: !hasPackage });
    } catch (err) {
        console.error('[GET /jobs/:jobId/applications]', err.message, err.stack);
        res.status(500).json({ message: 'Failed to fetch applications.' });
    }
};

// ── POST /api/jobs/:jobId/applications/:appId/shortlist ───────────────────────
exports.shortlistApplication = async (req, res) => {
    const { notes, fit_score } = req.body;

    try {
        const companyId = await getCompanyId(req.user.id);

        const [check] = await db.query(
            `SELECT a.id, a.candidate_id FROM applications a
             JOIN job_postings jp ON jp.id=a.job_id
             WHERE a.id=? AND jp.id=? AND jp.company_id=? AND a.deleted_at IS NULL`,
            [req.params.appId, req.params.jobId, companyId]
        );
        if (!check.length) return res.status(404).json({ message: 'Application not found.' });

        // A candidate hired through Ladder is off the market — block shortlisting
        if (await isCandidateHired(check[0].candidate_id)) {
            return res.status(409).json({ message: 'This candidate has already been hired and is no longer available.' });
        }

        await db.query(
            `INSERT INTO shortlists (application_id, shortlisted_by, fit_score, notes)
             VALUES (?,?,?,?)
             ON DUPLICATE KEY UPDATE status='shortlisted', notes=VALUES(notes), fit_score=VALUES(fit_score)`,
            [req.params.appId, req.user.id, fit_score || null, notes || null]
        );

        await db.query(
            `UPDATE applications SET status='shortlisted' WHERE id=? AND deleted_at IS NULL`,
            [req.params.appId]
        );

        res.json({ message: 'Candidate shortlisted.' });
    } catch (err) {
        console.error('shortlistApplication error:', err);
        res.status(500).json({ message: 'Failed to shortlist candidate.' });
    }
};

// ── DELETE /api/jobs/:jobId/applications/:appId/shortlist ─────────────────────
exports.removeShortlist = async (req, res) => {
    try {
        const companyId = await getCompanyId(req.user.id);

        const [check] = await db.query(
            `SELECT a.id FROM applications a
             JOIN job_postings jp ON jp.id=a.job_id
             WHERE a.id=? AND jp.id=? AND jp.company_id=? AND a.deleted_at IS NULL`,
            [req.params.appId, req.params.jobId, companyId]
        );
        if (!check.length) return res.status(404).json({ message: 'Application not found.' });

        await db.query(
            `UPDATE shortlists SET status='rejected', deleted_at=NOW()
             WHERE application_id=? AND deleted_at IS NULL`,
            [req.params.appId]
        );
        await db.query(
            `UPDATE applications SET status='under_review' WHERE id=? AND deleted_at IS NULL`,
            [req.params.appId]
        );

        res.json({ message: 'Removed from shortlist.' });
    } catch (err) {
        console.error('removeShortlist error:', err);
        res.status(500).json({ message: 'Failed to update shortlist.' });
    }
};

// ── PATCH /api/jobs/:jobId/applications/:appId/status ────────────────────────
exports.updateApplicationStatus = async (req, res) => {
    const { status, reason_code, reason_text } = req.body;
    const validStatuses = ['under_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'offer_sent', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Valid status required.' });
    }

    try {
        const companyId = await getCompanyId(req.user.id);

        const [check] = await db.query(
            `SELECT a.id, a.candidate_id FROM applications a
             JOIN job_postings jp ON jp.id=a.job_id
             WHERE a.id=? AND jp.id=? AND jp.company_id=? AND a.deleted_at IS NULL`,
            [req.params.appId, req.params.jobId, companyId]
        );
        if (!check.length) return res.status(404).json({ message: 'Application not found.' });

        // Once hired through Ladder, a candidate cannot be advanced by another company.
        // 'rejected' is still allowed so a company can close out its own pipeline.
        const FORWARD = ['shortlisted', 'interview_scheduled', 'interviewed', 'offer_sent'];
        if (FORWARD.includes(status) && await isCandidateHired(check[0].candidate_id)) {
            return res.status(409).json({ message: 'This candidate has already been hired and is no longer available.' });
        }

        await db.query(
            `UPDATE applications SET status=? WHERE id=? AND deleted_at IS NULL`,
            [status, req.params.appId]
        );

        // Log rejection feedback so the matching model can learn from it
        if (status === 'rejected') {
            await db.query(
                `INSERT INTO rejection_feedback (application_id, rejected_by, reason_code, reason_text)
                 VALUES (?, ?, ?, ?)`,
                [req.params.appId, req.user.id, reason_code || null, reason_text || null]
            );
        }

        res.json({ message: 'Application status updated.' });
    } catch (err) {
        console.error('updateApplicationStatus error:', err);
        res.status(500).json({ message: 'Failed to update status.' });
    }
};

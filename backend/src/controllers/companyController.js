const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const { maskName, maskCandidateForCompany, maskLocation } = require('../utils/maskPII');
const { logAction } = require('../utils/auditLog');
const { hasSelectedPackage } = require('./resumeUnlockController');
const { scorePoolAgainstJob } = require('../services/matchingService');
const { sendEmail } = require('../utils/email');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
const safeEmail = (opts) => sendEmail(opts).catch(e => console.error('[Email]', e.message));

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) { console.error('[notify]', err.message); }
};

// ── Helper: get or create companies row for this user ──────────────────────
const getOrCreateCompany = async (userId) => {
    const [rows] = await db.query(
        'SELECT id, company_name, industry, size, website, headquarters, description, is_approved, placement_fee_percent FROM companies WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
    );
    if (rows.length) return rows[0];

    // First login — bootstrap from users table
    const [[user]] = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
    const [result] = await db.query(
        'INSERT INTO companies (user_id, company_name, is_approved) VALUES (?, ?, 1)',
        [userId, user.name]
    );
    const [[newRow]] = await db.query('SELECT id, company_name, industry, size, website, headquarters, description, is_approved, placement_fee_percent FROM companies WHERE id = ?', [result.insertId]);
    return newRow;
};

// ── GET /api/companies/me ────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
    try {
        const company = await getOrCreateCompany(req.user.id);
        const [[user]] = await db.query('SELECT name, phone FROM users WHERE id = ? AND deleted_at IS NULL', [req.user.id]);
        res.json({ company: { ...company, contact_name: user?.name, contact_phone: user?.phone || null } });
    } catch (err) {
        console.error('getProfile error:', err);
        res.status(500).json({ message: 'Failed to load company profile.' });
    }
};

// ── PUT /api/companies/me ────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
    const { company_name, industry, size, website, headquarters, description, contact_phone } = req.body;
    if (!company_name) return res.status(400).json({ message: 'Company name is required.' });

    try {
        const company = await getOrCreateCompany(req.user.id);
        await db.query(
            `UPDATE companies SET company_name=?, industry=?, size=?, website=?, headquarters=?, description=?
             WHERE id=? AND deleted_at IS NULL`,
            [company_name, industry || null, size || null, website || null,
             headquarters || null, description || null, company.id]
        );
        if (contact_phone !== undefined) {
            await db.query('UPDATE users SET phone=? WHERE id=?', [contact_phone || null, req.user.id]);
        }
        res.json({ message: 'Profile updated.' });
    } catch (err) {
        console.error('updateProfile error:', err);
        res.status(500).json({ message: 'Failed to update profile.' });
    }
};

// ── GET /api/hr/companies ─────────────────────────────────────────────────────
// Executive sees their assigned companies; admin sees all approved companies.
exports.getMyCompanies = async (req, res) => {
    try {
        let rows;
        if (req.user.role === 'admin') {
            [rows] = await db.query(
                `SELECT co.id, co.company_name, co.industry, co.size, co.headquarters, co.website,
                        co.description, co.placement_fee_percent, co.assigned_executive_id,
                        co.executive_assigned_at,
                        u.name AS contact_name, u.email AS contact_email, u.phone AS contact_phone,
                        eu.name AS exec_name,
                        (SELECT COUNT(*) FROM job_postings jp WHERE jp.company_id = co.id AND jp.deleted_at IS NULL) AS job_count,
                        (SELECT COUNT(*) FROM applications a
                           JOIN job_postings jp2 ON jp2.id = a.job_id
                           WHERE jp2.company_id = co.id AND a.deleted_at IS NULL) AS application_count
                 FROM companies co
                 JOIN users u ON u.id = co.user_id AND u.deleted_at IS NULL
                 LEFT JOIN users eu ON eu.id = co.assigned_executive_id AND eu.deleted_at IS NULL
                 WHERE co.deleted_at IS NULL AND co.is_approved = 1
                 ORDER BY co.company_name`
            );
        } else {
            // assigned_executive_id is a users.id FK — match directly against logged-in user
            [rows] = await db.query(
                `SELECT co.id, co.company_name, co.industry, co.size, co.headquarters, co.website,
                        co.description, co.placement_fee_percent, co.assigned_executive_id,
                        co.executive_assigned_at,
                        u.name AS contact_name, u.email AS contact_email, u.phone AS contact_phone,
                        (SELECT COUNT(*) FROM job_postings jp WHERE jp.company_id = co.id AND jp.deleted_at IS NULL) AS job_count,
                        (SELECT COUNT(*) FROM applications a
                           JOIN job_postings jp2 ON jp2.id = a.job_id
                           WHERE jp2.company_id = co.id AND a.deleted_at IS NULL) AS application_count
                 FROM companies co
                 JOIN users u ON u.id = co.user_id AND u.deleted_at IS NULL
                 WHERE co.deleted_at IS NULL AND co.is_approved = 1
                   AND co.assigned_executive_id = ?
                 ORDER BY co.company_name`,
                [req.user.id]
            );
        }
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[getMyCompanies]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/companies/dashboard ─────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
    try {
        const company = await getOrCreateCompany(req.user.id);
        const cid = company.id;

        const [[jobStats]] = await db.query(
            `SELECT
               COUNT(*) AS total_jobs,
               SUM(status='active') AS active_jobs,
               SUM(status='draft') AS draft_jobs,
               SUM(status='closed') AS closed_jobs
             FROM job_postings WHERE company_id=? AND deleted_at IS NULL`,
            [cid]
        );

        const [[appStats]] = await db.query(
            `SELECT
               COUNT(*) AS total_applications,
               SUM(a.status='shortlisted') AS shortlisted,
               SUM(a.status='interview_scheduled') AS interviews,
               SUM(a.status='offer_sent') AS offers_sent
             FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             WHERE jp.company_id=? AND a.deleted_at IS NULL`,
            [cid]
        );

        const [recentApps] = await db.query(
            `SELECT a.id, a.status, a.applied_at,
                    jp.title AS job_title,
                    u.name AS candidate_name
             FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE jp.company_id=? AND a.deleted_at IS NULL
             ORDER BY a.applied_at DESC LIMIT 5`,
            [cid]
        );

        const maskedRecent = recentApps.map(r => ({ ...r, candidate_name: maskName(r.candidate_name) }));
        res.json({ company, jobs: jobStats, applications: appStats, recent_applications: maskedRecent });
    } catch (err) {
        console.error('getDashboard error:', err);
        res.status(500).json({ message: 'Failed to load dashboard.' });
    }
};

// ── POST /api/companies/interviews — DISABLED ────────────────────────────────
// Direct slot creation is not allowed. Interviews must go through the executive
// approval gate (POST /api/interview-requests) so a LadderStep Human Consulting executive
// confirms the slot — that approval secures Ladder's placement cut at hire.
// Slots are created only by interviewRequestController.approveRequest.
exports.scheduleInterview = async (req, res) => {
    return res.status(403).json({
        message: 'Interviews must be requested for executive approval. Please submit an interview request — your assigned LadderStep Human Consulting executive will confirm the slot.',
        code: 'APPROVAL_REQUIRED',
    });
};

// ── GET /api/companies/interviews ────────────────────────────────────────────
exports.listInterviews = async (req, res) => {
    try {
        const company = await getOrCreateCompany(req.user.id);

        const [interviews] = await db.query(
            `SELECT is2.id, is2.slot_datetime, is2.duration_mins, is2.mode,
                    is2.meeting_link, is2.location_detail, is2.status, is2.candidate_confirmed,
                    jp.title AS job_title,
                    u.name AS candidate_name,
                    a.id AS application_id, a.candidate_id
             FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE jp.company_id=? AND is2.deleted_at IS NULL
             ORDER BY is2.slot_datetime ASC`,
            [company.id]
        );

        // Package A/B companies (non-Platinum with any paid resume_unlock_orders) have
        // no placement fee on any candidate. Check once at the company level, not per row.
        const isPackageAB = company.placement_fee_percent == null;
        let hasPaidPackage = false;
        if (isPackageAB) {
            const [[pkgRow]] = await db.query(
                `SELECT ruo.id FROM resume_unlock_orders ruo
                 JOIN invoices inv ON inv.id = ruo.invoice_id AND inv.status = 'paid'
                 WHERE ruo.company_id = ? LIMIT 1`,
                [company.id]
            );
            hasPaidPackage = !!pkgRow;
        }
        const prepaidUnlock = isPackageAB && hasPaidPackage;

        const masked = interviews.map(i => ({
            ...i,
            candidate_name: prepaidUnlock ? i.candidate_name : maskName(i.candidate_name),
            prepaid_unlock: prepaidUnlock,
        }));
        res.json({ interviews: masked });
    } catch (err) {
        console.error('listInterviews error:', err);
        res.status(500).json({ message: 'Failed to fetch interviews.' });
    }
};

// ── PATCH /api/companies/interviews/:id ─────────────────────────────────────
exports.updateInterview = async (req, res) => {
    const { slot_datetime, duration_mins, mode, meeting_link, location_detail, status } = req.body;
    const validStatuses = ['proposed', 'confirmed', 'rescheduled', 'completed', 'cancelled'];

    try {
        const company = await getOrCreateCompany(req.user.id);

        const [check] = await db.query(
            `SELECT is2.id FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             WHERE is2.id=? AND jp.company_id=? AND is2.deleted_at IS NULL`,
            [req.params.id, company.id]
        );
        if (!check.length) return res.status(404).json({ message: 'Interview slot not found.' });

        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status.' });
        }

        await db.query(
            `UPDATE interview_slots
             SET slot_datetime=COALESCE(?,slot_datetime), duration_mins=COALESCE(?,duration_mins),
                 mode=COALESCE(?,mode), meeting_link=COALESCE(?,meeting_link),
                 location_detail=COALESCE(?,location_detail), status=COALESCE(?,status)
             WHERE id=?`,
            [slot_datetime || null, duration_mins || null, mode || null,
             meeting_link || null, location_detail || null, status || null, req.params.id]
        );

        res.json({ message: 'Interview updated.' });
    } catch (err) {
        console.error('updateInterview error:', err);
        res.status(500).json({ message: 'Failed to update interview.' });
    }
};

// ── POST /api/companies/offers ───────────────────────────────────────────────
exports.sendOffer = async (req, res) => {
    const { application_id, ctc, joining_date, valid_until, notes } = req.body;
    if (!application_id) return res.status(400).json({ message: 'application_id is required.' });

    try {
        const company = await getOrCreateCompany(req.user.id);

        const [check] = await db.query(
            `SELECT a.id FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             WHERE a.id=? AND jp.company_id=? AND a.deleted_at IS NULL`,
            [application_id, company.id]
        );
        if (!check.length) return res.status(404).json({ message: 'Application not found.' });

        // Offer letter grant check
        const [[grant]] = await db.query(
            `SELECT id FROM offer_letter_grants WHERE application_id = ? AND deleted_at IS NULL LIMIT 1`,
            [application_id]
        );
        if (!grant) {
            return res.status(403).json({
                message: 'Offer letter release not approved. Please complete the placement fee process.',
                error_code: 'OFFER_GRANT_REQUIRED',
            });
        }

        const [result] = await db.query(
            `INSERT INTO offers (application_id, issued_by, ctc, joining_date, valid_until, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [application_id, req.user.id, ctc || null,
             joining_date || null, valid_until || null, notes || null]
        );

        await db.query(
            `UPDATE applications SET status='offer_sent' WHERE id=? AND deleted_at IS NULL`,
            [application_id]
        );

        res.status(201).json({ message: 'Offer sent.', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'An offer already exists for this application.' });
        }
        console.error('sendOffer error:', err);
        res.status(500).json({ message: 'Failed to send offer.' });
    }
};

// ── GET /api/companies/offers ────────────────────────────────────────────────
exports.listOffers = async (req, res) => {
    try {
        const company = await getOrCreateCompany(req.user.id);

        const [offers] = await db.query(
            `SELECT o.id, o.ctc, o.joining_date, o.valid_until, o.status,
                    o.candidate_response_at, o.notes, o.created_at,
                    jp.title AS job_title,
                    u.name AS candidate_name,
                    a.id AS application_id
             FROM offers o
             JOIN applications a ON a.id = o.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE jp.company_id=? AND o.deleted_at IS NULL
             ORDER BY o.created_at DESC`,
            [company.id]
        );

        const masked = offers.map(o => ({ ...o, candidate_name: maskName(o.candidate_name) }));
        res.json({ offers: masked });
    } catch (err) {
        console.error('listOffers error:', err);
        res.status(500).json({ message: 'Failed to fetch offers.' });
    }
};

// ── GET /api/companies/candidates/:candidateId/resume ────────────────────────
exports.downloadCandidateResume = async (req, res) => {
    const { candidateId } = req.params;
    try {
        const company = await getOrCreateCompany(req.user.id);

        // Verify the candidate has applied to at least one of this company's jobs
        // and identify the application for the access-grant check.
        const [[application]] = await db.query(
            `SELECT a.id AS application_id FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             WHERE a.candidate_id = ? AND jp.company_id = ? AND a.deleted_at IS NULL
             ORDER BY a.applied_at DESC LIMIT 1`,
            [candidateId, company.id]
        );
        if (!application) return res.status(403).json({ message: 'Access denied.' });

        const [[resume]] = await db.query(
            `SELECT r.file_key, r.file_name, u.name AS candidate_name
             FROM resumes r
             JOIN candidates c ON c.id = r.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE r.candidate_id = ? AND r.deleted_at IS NULL
             ORDER BY r.is_primary DESC, r.created_at DESC LIMIT 1`,
            [candidateId]
        );
        if (!resume) return res.status(404).json({ message: 'No resume on file.' });

        const absolutePath = path.join(process.cwd(), resume.file_key);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ message: 'Resume file not found on server.' });
        }

        const { getMaskedResumePath } = require('../services/maskedResumeGenerator');
        const maskedPath = await getMaskedResumePath(absolutePath, resume.candidate_name, candidateId);

        // Audit the download before serving
        logAction(
            req.user.id,
            'company_resume_download',
            'candidate',
            candidateId,
            {
                company_id:     company.id,
                company_name:   company.company_name,
                application_id: application.application_id,
                masked:         true,
            },
            ip(req)
        );

        res.setHeader('X-Resume-Note', 'Contact information has been redacted by LadderStep Human Consulting');
        res.download(maskedPath, 'candidate_resume_masked.pdf');
    } catch (err) {
        console.error('downloadCandidateResume error:', err);
        res.status(500).json({ message: 'Failed to generate resume. Please contact LadderStep Human Consulting.' });
    }
};

// ── GET /api/companies/candidates/:candidateId/skills ────────────────────────
exports.getCandidateSkills = async (req, res) => {
    const { candidateId } = req.params;
    try {
        const company = await getOrCreateCompany(req.user.id);

        const [check] = await db.query(
            `SELECT a.id FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             WHERE a.candidate_id = ? AND jp.company_id = ? AND a.deleted_at IS NULL
             LIMIT 1`,
            [candidateId, company.id]
        );
        if (!check.length) return res.status(403).json({ message: 'Access denied.' });

        const [skillRows] = await db.query(
            `SELECT st.name FROM candidate_skill_vectors csv
             JOIN skill_tags st ON st.id = csv.skill_tag_id
             WHERE csv.candidate_id = ?
             ORDER BY st.name`,
            [candidateId]
        );

        res.json({ success: true, data: { extracted_skills: skillRows.map(r => r.name) } });
    } catch (err) {
        console.error('getCandidateSkills error:', err);
        res.status(500).json({ message: 'Failed to fetch skills.' });
    }
};

// ── PATCH /api/companies/offers/:id ─────────────────────────────────────────
exports.updateOffer = async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['sent', 'accepted', 'declined', 'expired', 'withdrawn'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Valid status is required.' });
    }

    try {
        const company = await getOrCreateCompany(req.user.id);

        const [check] = await db.query(
            `SELECT o.id, o.application_id FROM offers o
             JOIN applications a ON a.id = o.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             WHERE o.id=? AND jp.company_id=? AND o.deleted_at IS NULL`,
            [req.params.id, company.id]
        );
        if (!check.length) return res.status(404).json({ message: 'Offer not found.' });

        await db.query('UPDATE offers SET status=? WHERE id=?', [status, req.params.id]);

        if (status === 'accepted') {
            await db.query(
                `UPDATE applications SET status='hired' WHERE id=? AND deleted_at IS NULL`,
                [check[0].application_id]
            );
        }

        res.json({ message: 'Offer updated.' });
    } catch (err) {
        console.error('updateOffer error:', err);
        res.status(500).json({ message: 'Failed to update offer.' });
    }
};

// ── COMPANY REQUESTS (Phase 3) ────────────────────────────────────────────────

// POST /api/companies/requests — company submits an access request
exports.createRequest = async (req, res) => {
    const { application_id, request_type, notes } = req.body;
    const validTypes = ['candidate_profile_access', 'interview_scheduling'];
    if (!application_id || !request_type) {
        return res.status(400).json({ message: 'application_id and request_type are required.' });
    }
    if (!validTypes.includes(request_type)) {
        return res.status(400).json({ message: `request_type must be one of: ${validTypes.join(', ')}` });
    }

    try {
        const company = await getOrCreateCompany(req.user.id);

        // Verify the application belongs to a job posted by this company
        const [[app]] = await db.query(
            `SELECT a.id, a.candidate_id, jp.title AS job_title,
                    u.name AS candidate_name
             FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE a.id = ? AND jp.company_id = ? AND a.deleted_at IS NULL`,
            [application_id, company.id]
        );
        if (!app) return res.status(404).json({ message: 'Application not found.' });

        // Block duplicate pending/in_progress requests for the same type
        const [[existing]] = await db.query(
            `SELECT id FROM company_requests
             WHERE company_id = ? AND application_id = ? AND request_type = ?
               AND status IN ('pending','in_progress') AND deleted_at IS NULL`,
            [company.id, application_id, request_type]
        );
        if (existing) {
            return res.status(409).json({ message: 'A pending request already exists for this candidate and type.' });
        }

        const [result] = await db.query(
            `INSERT INTO company_requests (company_id, application_id, request_type, requested_by, company_notes)
             VALUES (?, ?, ?, ?, ?)`,
            [company.id, application_id, request_type, req.user.id, notes || null]
        );

        // Notify the assigned executive (or an active admin if none is assigned yet)
        const [[execRow]] = await db.query(
            `SELECT co.assigned_executive_id, u.email AS exec_email, u.name AS exec_name
             FROM companies co LEFT JOIN users u ON u.id = co.assigned_executive_id
             WHERE co.id = ?`,
            [company.id]
        );
        let notifyUserId = execRow?.assigned_executive_id;
        let notifyEmail = execRow?.exec_email;
        let notifyName = execRow?.exec_name;
        if (!notifyUserId) {
            const [[adminRow]] = await db.query(
                `SELECT u.id, u.email, u.name FROM users u JOIN roles ro ON ro.id = u.role_id
                 WHERE ro.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1`
            );
            notifyUserId = adminRow?.id;
            notifyEmail = adminRow?.email;
            notifyName = adminRow?.name;
        }

        const typeLabel = request_type === 'candidate_profile_access' ? 'Candidate Profile Access' : 'Interview Scheduling';
        if (notifyUserId) {
            await notify(
                notifyUserId,
                'company_request',
                `${typeLabel} Request — ${company.company_name}`,
                `${company.company_name} has requested ${typeLabel.toLowerCase()} for ${app.candidate_name} (${app.job_title}).`,
                { request_id: result.insertId, application_id, company_id: company.id }
            );
        }
        if (notifyEmail) {
            safeEmail({
                to: notifyEmail,
                subject: `${typeLabel} Request — ${company.company_name}`,
                html: `
                    <p>Hi ${notifyName || 'Team'},</p>
                    <p><strong>${company.company_name}</strong> has requested <strong>${typeLabel}</strong> for candidate <strong>${app.candidate_name}</strong> (${app.job_title}).</p>
                    ${notes ? `<p><strong>Note:</strong> ${notes}</p>` : ''}
                    <p>Please log in to review and action this request.</p>
                    <br/><p>LadderStep Human Consulting System</p>
                `,
            });
        }

        res.status(201).json({ message: 'Request submitted.', request_id: result.insertId });
    } catch (err) {
        console.error('createRequest error:', err);
        res.status(500).json({ message: 'Failed to submit request.' });
    }
};

// GET /api/companies/requests — company views their own requests
exports.listRequests = async (req, res) => {
    try {
        const company = await getOrCreateCompany(req.user.id);

        const [rows] = await db.query(
            `SELECT cr.id, cr.request_type, cr.status, cr.company_notes, cr.created_at, cr.resolved_at,
                    jp.title AS job_title,
                    si.invoice_number, si.amount, si.currency, si.status AS invoice_status, si.due_date,
                    cag.id AS grant_id, cag.granted_at, cag.expires_at
             FROM company_requests cr
             JOIN applications app ON app.id = cr.application_id
             JOIN job_postings jp ON jp.id = app.job_id
             LEFT JOIN service_invoices si ON si.request_id = cr.id AND si.deleted_at IS NULL
             LEFT JOIN candidate_access_grants cag ON cag.request_id = cr.id AND cag.revoked_at IS NULL
             WHERE cr.company_id = ? AND cr.deleted_at IS NULL
             ORDER BY cr.created_at DESC`,
            [company.id]
        );

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('listRequests error:', err);
        res.status(500).json({ message: 'Failed to fetch requests.' });
    }
};

// ── GET /api/companies/talent ─────────────────────────────────────────────────
// Browse non-hired candidates with masked PII; supports search + filters.
exports.getTalentPool = async (req, res) => {
    try {
        const company = await getOrCreateCompany(req.user.id);
        // No package gate — every company can browse masked candidates.
        // PII (name/email/phone) stays hidden via maskCandidateForCompany until
        // the specific candidate is unlocked. has_package lets the frontend know
        // whether to show the credit-spend flow or the request-a-package flow.
        const companyHasPkg = await hasSelectedPackage(company.id, company.placement_fee_percent);

        const { search = '', experience_min, experience_max, skill, page = 1, jobId } = req.query;
        const limit = 24;
        const offset = (Math.max(1, parseInt(page)) - 1) * limit;

        // Optional "match against this JD" — restricted to the company's own jobs.
        // The AI match % is shown to every company regardless of package status.
        let matchJobId = null;
        if (jobId) {
            const [[ownJob]] = await db.query(
                `SELECT id FROM job_postings WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
                [parseInt(jobId), company.id]
            );
            if (ownJob) matchJobId = ownJob.id;
        }

        const params = [];
        let having = '';

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

        const [rows] = await db.query(
            `SELECT
                c.id AS candidate_id,
                u.name AS candidate_name,
                cp.headline,
                cp.summary,
                cp.total_experience,
                cp.current_location,
                cp.notice_period_days,
                cp.expected_salary,
                (SELECT JSON_ARRAYAGG(st.name)
                 FROM candidate_skill_vectors csv
                 JOIN skill_tags st ON st.id = csv.skill_tag_id
                 WHERE csv.candidate_id = c.id
                 LIMIT 12) AS skills
             FROM candidates c
             JOIN users u ON u.id = c.user_id
             JOIN candidate_profiles cp ON cp.candidate_id = c.id
             WHERE c.deleted_at IS NULL
               AND u.deleted_at IS NULL
               AND u.status = 'active'
               AND NOT EXISTS (
                   SELECT 1 FROM applications a2
                   WHERE a2.candidate_id = c.id AND a2.status = 'hired' AND a2.deleted_at IS NULL
               )
               AND NOT EXISTS (
                   SELECT 1 FROM applications a3
                   JOIN offers o ON o.application_id = a3.id AND o.deleted_at IS NULL
                   WHERE a3.candidate_id = c.id AND o.status IN ('sent', 'accepted')
               )
               ${searchClause}
               ${expClause}
               ${skillClause}
             ORDER BY cp.total_experience DESC, c.id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Count for pagination
        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total
             FROM candidates c
             JOIN users u ON u.id = c.user_id
             JOIN candidate_profiles cp ON cp.candidate_id = c.id
             WHERE c.deleted_at IS NULL
               AND u.deleted_at IS NULL
               AND u.status = 'active'
               AND NOT EXISTS (
                   SELECT 1 FROM applications a2
                   WHERE a2.candidate_id = c.id AND a2.status = 'hired' AND a2.deleted_at IS NULL
               )
               AND NOT EXISTS (
                   SELECT 1 FROM applications a3
                   JOIN offers o ON o.application_id = a3.id AND o.deleted_at IS NULL
                   WHERE a3.candidate_id = c.id AND o.status IN ('sent', 'accepted')
               )
               ${searchClause}
               ${expClause}
               ${skillClause}`,
            params
        );

        // Live match % against the selected JD (masking never touches match_score).
        let scoreMap = new Map();
        if (matchJobId) {
            try { scoreMap = await scorePoolAgainstJob(matchJobId, rows.map(r => r.candidate_id)); }
            catch (e) { console.error('[getTalentPool] scoring failed:', e.message); }
        }

        const candidates = rows.map(row => {
            const skills = (() => {
                try { return Array.isArray(row.skills) ? row.skills : JSON.parse(row.skills || '[]'); }
                catch { return []; }
            })();
            const live = scoreMap.get(row.candidate_id);
            return maskCandidateForCompany({
                ...row,
                skills,
                current_location: row.current_location,
                match_score: live ? live.score : null,
            });
        });

        res.json({
            success: true,
            data: candidates,
            total: countRows[0].total,
            page: parseInt(page),
            limit,
            has_package: companyHasPkg,
            match_job_id: matchJobId,
        });
    } catch (err) {
        console.error('[getTalentPool]', err.message);
        res.status(500).json({ message: 'Failed to fetch talent pool.' });
    }
};

// ── POST /api/companies/talent/:candidateId/interest ─────────────────────────
// Company expresses interest in a candidate; notifies the assigned executive.
exports.expressInterest = async (req, res) => {
    try {
        const { candidateId } = req.params;
        const { job_id, notes } = req.body;

        const company = await getOrCreateCompany(req.user.id);

        // Verify candidate exists and is not hired
        const [[cand]] = await db.query(
            `SELECT c.id, u.name AS candidate_name
             FROM candidates c JOIN users u ON u.id = c.user_id
             WHERE c.id = ? AND c.deleted_at IS NULL AND u.status = 'active'`,
            [candidateId]
        );
        if (!cand) return res.status(404).json({ message: 'Candidate not found or unavailable.' });

        const isHired = (await db.query(
            `SELECT 1 FROM applications WHERE candidate_id = ? AND status = 'hired' AND deleted_at IS NULL LIMIT 1`,
            [candidateId]
        ))[0].length > 0;
        if (isHired) return res.status(409).json({ message: 'This candidate is no longer available.' });

        // Get job title if job_id provided
        let jobTitle = null;
        if (job_id) {
            const [[jp]] = await db.query(
                `SELECT title FROM job_postings WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
                [job_id, company.id]
            );
            jobTitle = jp?.title || null;
        }

        // Notify the assigned executive
        const [[execRow]] = await db.query(
            `SELECT assigned_executive_id FROM companies WHERE id = ? AND deleted_at IS NULL`,
            [company.id]
        );
        const execUserId = execRow?.assigned_executive_id;

        if (execUserId) {
            const body = jobTitle
                ? `${company.company_name} is interested in Candidate #${candidateId} for "${jobTitle}".`
                : `${company.company_name} has expressed interest in Candidate #${candidateId}.`;
            await db.query(
                `INSERT INTO notifications (user_id, type, title, body, metadata)
                 VALUES (?, 'talent_interest', ?, ?, ?)`,
                [execUserId,
                 `Talent Interest — ${company.company_name}`,
                 body + (notes ? ` Notes: ${notes}` : ''),
                 JSON.stringify({ company_id: company.id, candidate_id: parseInt(candidateId), job_id: job_id || null })]
            );
        }

        logAction(req.user.id, 'talent_interest', 'candidate', candidateId,
            { company_name: company.company_name, job_id: job_id || null }, ip(req));

        res.json({ success: true, message: 'Interest submitted. Your executive will reach out to facilitate the introduction.' });
    } catch (err) {
        console.error('[expressInterest]', err.message);
        res.status(500).json({ message: 'Failed to submit interest.' });
    }
};

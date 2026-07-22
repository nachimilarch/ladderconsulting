const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const { sendEmail } = require('../utils/email');
const { logAction } = require('../utils/auditLog');
const crypto = require('crypto');
const wa = require('../utils/whatsappNotify');

const safeEmail = (opts) => sendEmail(opts).catch(e => console.error('[Email]', e.message));
const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

// ── COMPANY MANAGEMENT ────────────────────────────────────────────────────────

exports.listCompanies = async (req, res) => {
    const { status } = req.query;
    try {
        // Pending companies have never logged in → they only exist in company_approvals + users,
        // not yet in companies (getOrCreateCompany runs on first login with is_approved=1).
        if (status === 'pending') {
            const [companies] = await db.query(
                `SELECT u.id AS id, u.id AS user_id,
                        COALESCE(co.company_name, u.name) AS company_name,
                        co.industry, co.size, co.website, co.headquarters,
                        u.email, u.name AS contact_name, u.phone AS contact_phone, u.status, u.created_at,
                        'pending' AS company_status,
                        0 AS job_count, 0 AS hire_count
                 FROM company_approvals ca
                 JOIN users u ON u.id = ca.user_id AND u.deleted_at IS NULL
                 LEFT JOIN companies co ON co.user_id = u.id AND co.deleted_at IS NULL
                 WHERE ca.status = 'pending'
                 ORDER BY ca.created_at DESC`
            );
            return res.json({ success: true, data: companies });
        }

        // Approved / suspended / all — query the companies table
        const ALLOWED = ['approved', 'suspended'];
        let statusWhere = '';
        if (ALLOWED.includes(status)) {
            if (status === 'approved')  statusWhere = `AND co.is_approved = 1 AND u.status = 'active'`;
            if (status === 'suspended') statusWhere = `AND u.status = 'suspended'`;
        }

        const [companies] = await db.query(
            `SELECT co.id, co.company_name, co.industry, co.size, co.is_approved, co.created_at,
                    co.headquarters, co.website,
                    u.id AS user_id, u.name AS contact_name, u.email, u.phone AS contact_phone, u.status,
                    (u.last_login_at IS NULL) AS never_logged_in,
                    COUNT(DISTINCT jp.id) AS job_count,
                    COUNT(DISTINCT he.id) AS hire_count,
                    CASE
                        WHEN u.status = 'suspended' THEN 'suspended'
                        WHEN co.is_approved = 1 THEN 'approved'
                        ELSE 'pending'
                    END AS company_status
             FROM companies co
             JOIN users u ON u.id = co.user_id
             LEFT JOIN job_postings jp ON jp.company_id = co.id AND jp.deleted_at IS NULL
             LEFT JOIN hired_employees he ON he.company_id = co.id AND he.deleted_at IS NULL
             WHERE co.deleted_at IS NULL ${statusWhere}
             GROUP BY co.id, co.company_name, co.industry, co.size, co.is_approved, co.created_at,
                      co.headquarters, co.website, u.id, u.name, u.email, u.phone, u.status, u.last_login_at
             ORDER BY co.created_at DESC`
        );
        res.json({ success: true, data: companies });
    } catch (err) {
        console.error('listCompanies:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch companies.' });
    }
};

exports.getCompanyDetail = async (req, res) => {
    try {
        const id = req.params.id;

        // First try: by companies.id (approved/existing companies)
        let [[company]] = await db.query(
            `SELECT co.*, u.name AS contact_name, u.email, u.phone AS contact_phone, u.status,
                    u.id AS user_id, (u.last_login_at IS NULL) AS never_logged_in,
                    CASE WHEN u.status = 'suspended' THEN 'suspended'
                         WHEN co.is_approved = 1 THEN 'approved' ELSE 'pending'
                    END AS company_status
             FROM companies co JOIN users u ON u.id = co.user_id
             WHERE co.id = ? AND co.deleted_at IS NULL`,
            [id]
        );

        let jobs = [], hires = [];

        if (company) {
            [jobs] = await db.query(
                `SELECT jp.id, jp.title, jp.status,
                        (SELECT COUNT(*) FROM applications a WHERE a.job_id = jp.id AND a.deleted_at IS NULL) AS applicant_count,
                        jp.created_at
                 FROM job_postings jp
                 WHERE jp.company_id = ? AND jp.deleted_at IS NULL ORDER BY jp.created_at DESC LIMIT 10`,
                [company.id]
            );
            [hires] = await db.query(
                `SELECT he.id, he.role_title, he.joining_date, he.onboarding_started,
                        u.name AS candidate_name
                 FROM hired_employees he
                 JOIN candidates c ON c.id = he.candidate_id
                 JOIN users u ON u.id = c.user_id
                 WHERE he.company_id = ? AND he.deleted_at IS NULL ORDER BY he.created_at DESC LIMIT 10`,
                [company.id]
            );
        } else {
            // Second try: by user_id (pending registration, no companies row yet)
            const [[usr]] = await db.query(
                `SELECT u.id, u.id AS user_id, u.name AS company_name, u.name AS contact_name,
                        u.email, u.phone AS contact_phone, u.status, u.created_at,
                        'pending' AS company_status, NULL AS assigned_executive_id
                 FROM users u
                 WHERE u.id = ? AND u.deleted_at IS NULL`,
                [id]
            );
            company = usr;
        }

        if (!company) return res.status(404).json({ message: 'Company not found.' });

        res.json({ success: true, data: { company, jobs, hires } });
    } catch (err) {
        console.error('getCompanyDetail:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch company detail.' });
    }
};

exports.approveCompany = async (req, res) => {
    try {
        const id = req.params.id;

        // Try as companies.id (already-registered company that logged in)
        let [[company]] = await db.query(
            `SELECT co.id AS company_id, co.company_name, u.id AS user_id, u.email, u.name AS contact_name
             FROM companies co JOIN users u ON u.id = co.user_id
             WHERE co.id = ? AND co.deleted_at IS NULL`,
            [id]
        );

        // Fall back: treat id as user_id (pending registration without a companies row)
        if (!company) {
            const [[usr]] = await db.query(
                `SELECT NULL AS company_id, u.name AS company_name, u.id AS user_id, u.email, u.name AS contact_name
                 FROM users u WHERE u.id = ? AND u.deleted_at IS NULL`,
                [id]
            );
            company = usr;
        }

        if (!company) return res.status(404).json({ message: 'Company not found.' });

        if (company.company_id) {
            await db.query('UPDATE companies SET is_approved = 1 WHERE id = ?', [company.company_id]);
        } else {
            // Approved before the company ever logged in → no companies row exists yet.
            // Create it now so the company is immediately visible and manageable in the
            // admin Companies section (assign executive, set fee, etc.). getOrCreateCompany
            // on the company's first login is idempotent and reuses this row.
            const [ins] = await db.query(
                'INSERT INTO companies (user_id, company_name, is_approved) VALUES (?, ?, 1)',
                [company.user_id, company.company_name]
            );
            company.company_id = ins.insertId;
        }
        await db.query(`UPDATE users SET status = 'active' WHERE id = ?`, [company.user_id]);
        await db.query(
            `UPDATE company_approvals SET status = 'approved', reviewed_by = ? WHERE user_id = ? AND status = 'pending'`,
            [req.user.id, company.user_id]
        );

        await logAction(req.user.id, 'approve_company', 'company', company.company_id || company.user_id,
            { company_name: company.company_name }, ip(req));

        db.query(
            `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, 'company_approved', ?, ?, ?)`,
            [company.user_id,
             'Your company account is approved!',
             `Welcome to LadderStep Human Consulting, ${company.company_name}! You can now log in and start hiring.`,
             JSON.stringify({ user_id: company.user_id })]
        ).catch(e => console.error('[notify]', e.message));

        // Fetch the assigned executive's email for CC (if any)
        let execEmail = null;
        if (company.company_id) {
            const [[execRow]] = await db.query(
                `SELECT u.email FROM companies co JOIN users u ON u.id = co.assigned_executive_id
                 WHERE co.id = ? AND co.assigned_executive_id IS NOT NULL AND co.deleted_at IS NULL`,
                [company.company_id]
            );
            execEmail = execRow?.email || null;
        }

        safeEmail({
            to: company.email,
            cc: execEmail,
            subject: 'Your LadderStep Human Consulting Account is Approved!',
            html: `
                <p>Hi ${company.contact_name},</p>
                <p>Great news! Your company account for <strong>${company.company_name}</strong> has been approved.</p>
                <p>You can now log in and start posting jobs, reviewing candidates, and managing your hiring pipeline.</p>
                <p><strong>Getting Started:</strong></p>
                <ul>
                    <li>Complete your company profile</li>
                    <li>Post your first job opening</li>
                    <li>Review matched candidates</li>
                </ul>
                <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Log In Now</a></p>
                <br/><p>Welcome to LadderStep Human Consulting!<br/>The Team</p>
            `,
        });

        // WhatsApp notification
        const [[companyUser]] = await db.query('SELECT phone FROM users WHERE id = ?', [company.user_id]);
        wa.notifyCompanyApproved(companyUser?.phone, company.company_name);

        res.json({ message: 'Company approved.' });
    } catch (err) {
        console.error('approveCompany:', err);
        res.status(500).json({ message: 'Failed to approve company.' });
    }
};

exports.rejectCompany = async (req, res) => {
    const { reason } = req.body;
    try {
        const id = req.params.id;

        let [[company]] = await db.query(
            `SELECT co.id AS company_id, co.company_name, u.email, u.name AS contact_name, u.id AS user_id
             FROM companies co JOIN users u ON u.id = co.user_id
             WHERE co.id = ? AND co.deleted_at IS NULL`,
            [id]
        );

        if (!company) {
            const [[usr]] = await db.query(
                `SELECT NULL AS company_id, u.name AS company_name, u.email, u.name AS contact_name, u.id AS user_id
                 FROM users u WHERE u.id = ? AND u.deleted_at IS NULL`,
                [id]
            );
            company = usr;
        }

        if (!company) return res.status(404).json({ message: 'Company not found.' });

        await db.query(`UPDATE users SET status = 'suspended' WHERE id = ?`, [company.user_id]);
        await db.query(
            `UPDATE company_approvals SET status = 'rejected', reviewed_by = ?, review_note = ? WHERE user_id = ? AND status = 'pending'`,
            [req.user.id, reason || null, company.user_id]
        );

        await logAction(req.user.id, 'reject_company', 'company', company.company_id || company.user_id,
            { company_name: company.company_name, reason }, ip(req));

        // Fetch exec email for CC if company already has one assigned
        let rejectExecEmail = null;
        if (company.company_id) {
            const [[execRow]] = await db.query(
                `SELECT u.email FROM companies co JOIN users u ON u.id = co.assigned_executive_id
                 WHERE co.id = ? AND co.assigned_executive_id IS NOT NULL AND co.deleted_at IS NULL`,
                [company.company_id]
            );
            rejectExecEmail = execRow?.email || null;
        }

        safeEmail({
            to: company.email,
            cc: rejectExecEmail,
            subject: 'LadderStep Human Consulting — Account Application Update',
            html: `
                <p>Hi ${company.contact_name},</p>
                <p>We have reviewed your application for <strong>${company.company_name}</strong> and are unable to approve your account at this time.</p>
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                <p>If you believe this is an error, please contact us at ${process.env.SUPPORT_EMAIL || 'support@ladderconsulting.in'}.</p>
                <br/><p>LadderStep Human Consulting Team</p>
            `,
        });

        res.json({ message: 'Company rejected.' });
    } catch (err) {
        console.error('rejectCompany:', err);
        res.status(500).json({ message: 'Failed to reject company.' });
    }
};

exports.suspendCompany = async (req, res) => {
    try {
        await db.query(
            `UPDATE users SET status = 'suspended' WHERE id =
             (SELECT user_id FROM companies WHERE id = ? AND deleted_at IS NULL)`,
            [req.params.id]
        );
        await logAction(req.user.id, 'suspend_company', 'company', req.params.id, {}, ip(req));
        res.json({ message: 'Company suspended.' });
    } catch (err) {
        console.error('suspendCompany:', err);
        res.status(500).json({ message: 'Failed to suspend company.' });
    }
};

exports.reactivateCompany = async (req, res) => {
    try {
        await db.query(
            `UPDATE users SET status = 'active' WHERE id =
             (SELECT user_id FROM companies WHERE id = ? AND deleted_at IS NULL)`,
            [req.params.id]
        );
        await db.query('UPDATE companies SET is_approved = 1 WHERE id = ?', [req.params.id]);
        await logAction(req.user.id, 'reactivate_company', 'company', req.params.id, {}, ip(req));
        res.json({ message: 'Company reactivated.' });
    } catch (err) {
        console.error('reactivateCompany:', err);
        res.status(500).json({ message: 'Failed to reactivate company.' });
    }
};

exports.deleteCompany = async (req, res) => {
    try {
        const [[co]] = await db.query('SELECT id, user_id FROM companies WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!co) return res.status(404).json({ message: 'Company not found.' });

        await db.query('UPDATE companies SET deleted_at = NOW() WHERE id = ?', [co.id]);
        // Soft-delete the user and free the email so the address can be re-registered later
        await db.query(
            `UPDATE users SET deleted_at = NOW(), email = CONCAT('deleted_', id, '_', email)
             WHERE id = ? AND deleted_at IS NULL`,
            [co.user_id]
        );
        await db.query('DELETE FROM user_oauth_identities WHERE user_id = ?', [co.user_id]);

        await logAction(req.user.id, 'delete_company', 'company', co.id, {}, ip(req));
        res.json({ message: 'Company deleted.' });
    } catch (err) {
        console.error('deleteCompany:', err);
        res.status(500).json({ message: 'Failed to delete company.' });
    }
};

// ── CANDIDATE MANAGEMENT ──────────────────────────────────────────────────────

exports.listCandidates = async (req, res) => {
    const { status, location, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const where = ['u.deleted_at IS NULL', 'ro.name = ?'];
        const params = ['candidate'];

        if (status) { where.push('u.status = ?'); params.push(status); }
        if (location) { where.push('cp.current_location LIKE ?'); params.push(`%${location}%`); }
        if (search) {
            where.push('(u.name LIKE ? OR u.email LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const [candidates] = await db.query(
            `SELECT u.id, u.name AS full_name, u.email, u.status, u.created_at,
                    c.id AS candidate_id,
                    cp.current_location AS location, cp.total_experience AS experience_years, cp.headline,
                    COUNT(DISTINCT a.id) AS application_count,
                    COUNT(DISTINCT cert.id) AS certificate_count
             FROM users u
             JOIN roles ro ON ro.id = u.role_id
             LEFT JOIN candidates c ON c.user_id = u.id
             LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
             LEFT JOIN applications a ON a.candidate_id = c.id AND a.deleted_at IS NULL
             LEFT JOIN hired_employees he ON he.candidate_id = c.id AND he.deleted_at IS NULL
             LEFT JOIN certificates cert ON cert.hired_employee_id = he.id AND cert.deleted_at IS NULL
             WHERE ${where.join(' AND ')}
             GROUP BY u.id, c.id, u.name, u.email, u.status, u.created_at,
                      cp.current_location, cp.total_experience, cp.headline
             ORDER BY u.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        // Count must honour the same filters as the list, else the pager is wrong
        const [[{ total }]] = await db.query(
            `SELECT COUNT(DISTINCT u.id) AS total FROM users u
             JOIN roles ro ON ro.id = u.role_id
             LEFT JOIN candidates c ON c.user_id = u.id
             LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
             WHERE ${where.join(' AND ')}`,
            params
        );

        res.json({ success: true, data: candidates, total: Number(total), page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('listCandidates:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch candidates.' });
    }
};

exports.getCandidateDetail = async (req, res) => {
    try {
        const [[user]] = await db.query(
            `SELECT u.id, u.name AS full_name, u.email, u.phone, u.status, u.created_at,
                    cp.headline, cp.summary,
                    cp.total_experience AS experience_years,
                    cp.current_location AS location,
                    cp.expected_salary, cp.notice_period_days
             FROM users u
             JOIN roles ro ON ro.id = u.role_id
             LEFT JOIN candidates c ON c.user_id = u.id
             LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
             WHERE u.id = ? AND ro.name = 'candidate' AND u.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!user) return res.status(404).json({ message: 'Candidate not found.' });

        const [[cand]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [req.params.id]);

        const [applications] = cand ? await db.query(
            `SELECT a.id, a.status, a.applied_at, jp.title AS job_title, co.company_name
             FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             WHERE a.candidate_id = ? AND a.deleted_at IS NULL
             ORDER BY a.applied_at DESC LIMIT 10`,
            [cand.id]
        ) : [[]];

        const [skills] = cand ? await db.query(
            `SELECT st.name, csv.proficiency FROM candidate_skill_vectors csv
             JOIN skill_tags st ON st.id = csv.skill_tag_id
             WHERE csv.candidate_id = ? ORDER BY st.name`,
            [cand.id]
        ) : [[]];

        const [training] = cand ? await db.query(
            `SELECT ta.status, co.title AS course_title
             FROM training_assignments ta
             JOIN hired_employees he ON he.id = ta.hired_employee_id
             JOIN courses co ON co.id = ta.course_id
             WHERE he.candidate_id = ? AND ta.deleted_at IS NULL`,
            [cand.id]
        ) : [[]];

        const [certs] = cand ? await db.query(
            `SELECT cert.id, cert.issued_at, co.title AS course_title
             FROM certificates cert
             JOIN courses co ON co.id = cert.course_id
             JOIN hired_employees he ON he.id = cert.hired_employee_id
             WHERE he.candidate_id = ? AND cert.deleted_at IS NULL
             ORDER BY cert.issued_at DESC`,
            [cand.id]
        ) : [[]];

        res.json({ success: true, data: { ...user, candidate_id: cand?.id ?? null, applications, skills: skills.map(s => s.name), training, certificates: certs, application_count: applications.length, training_count: training.length, certificate_count: certs.length } });
    } catch (err) {
        console.error('getCandidateDetail:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch candidate detail.' });
    }
};

exports.suspendCandidate = async (req, res) => {
    try {
        await db.query(
            `UPDATE users SET status = 'suspended' WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );
        await logAction(req.user.id, 'suspend_candidate', 'user', req.params.id, {}, ip(req));
        res.json({ message: 'Candidate suspended.' });
    } catch (err) {
        console.error('suspendCandidate:', err);
        res.status(500).json({ message: 'Failed to suspend candidate.' });
    }
};

exports.reactivateCandidate = async (req, res) => {
    try {
        await db.query(
            `UPDATE users SET status = 'active' WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );
        await logAction(req.user.id, 'reactivate_candidate', 'user', req.params.id, {}, ip(req));
        res.json({ message: 'Candidate reactivated.' });
    } catch (err) {
        console.error('reactivateCandidate:', err);
        res.status(500).json({ message: 'Failed to reactivate candidate.' });
    }
};

// ── HR STAFF MANAGEMENT ───────────────────────────────────────────────────────

exports.listStaff = async (req, res) => {
    try {
        const [staff] = await db.query(
            `SELECT u.id, u.name AS full_name, u.email, u.phone, u.status, u.created_at,
                    IFNULL((SELECT COUNT(*) FROM call_logs cl
                            JOIN employees e2 ON e2.user_id = u.id
                            WHERE cl.employee_id = e2.id AND cl.deleted_at IS NULL), 0) AS call_count,
                    IFNULL((SELECT COUNT(*) FROM leads l
                            JOIN employees e3 ON e3.user_id = u.id
                            WHERE l.assigned_to = e3.id AND l.deleted_at IS NULL), 0) AS lead_count
             FROM users u
             JOIN roles ro ON ro.id = u.role_id
             WHERE ro.name IN ('hr_staff', 'trainer') AND u.deleted_at IS NULL
             ORDER BY u.created_at DESC`
        );
        res.json({ success: true, data: staff });
    } catch (err) {
        console.error('listStaff:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch staff.' });
    }
};

exports.createStaff = async (req, res) => {
    const { name, full_name, email, phone, role: roleName = 'hr_staff' } = req.body;
    const staffName = full_name || name;
    if (!staffName || !email) return res.status(400).json({ message: 'name and email are required.' });

    try {
        const [[existing]] = await db.query(
            'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [email]
        );
        if (existing) return res.status(409).json({ message: 'Email already registered.' });

        const [[roleRow]] = await db.query('SELECT id FROM roles WHERE name = ?', [roleName]);
        if (!roleRow) return res.status(400).json({ message: 'Invalid role.' });

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 24 * 3600 * 1000);

        // Placeholder password — user must reset via email link
        const bcrypt = require('bcryptjs');
        const tempHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

        const [result] = await db.query(
            `INSERT INTO users (role_id, name, email, phone, password, status, is_email_verified,
                                reset_password_token, reset_password_expires)
             VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
            [roleRow.id, staffName, email, phone || null, tempHash, token, expires]
        );

        await logAction(req.user.id, 'create_staff', 'user', result.insertId,
            { name: staffName, email, role: roleName }, ip(req));

        const loginLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
        safeEmail({
            to: email,
            subject: 'Welcome to LadderStep Human Consulting',
            html: `
                <p>Hi ${staffName},</p>
                <p>Your ${roleName.replace('_', ' ')} account has been created on LadderStep Human Consulting.</p>
                <p>Sign in with your Microsoft 365 account using this email address (<strong>${email}</strong>) — no password needed:</p>
                <p><a href="${loginLink}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Sign in with Microsoft</a></p>
                <p style="color:#9ca3af;font-size:12px;margin-top:16px;">If you did not expect this email, please ignore it.</p>
                <br/><p>LadderStep Human Consulting Team</p>
            `,
        });

        res.status(201).json({ message: 'Staff account created. Welcome email sent.', id: result.insertId });
    } catch (err) {
        console.error('createStaff:', err);
        res.status(500).json({ message: 'Failed to create staff account.' });
    }
};

exports.updateStaff = async (req, res) => {
    const { name, full_name, phone } = req.body;
    const staffName = full_name || name;
    try {
        const fields = [];
        const vals = [];
        if (staffName) { fields.push('name = ?'); vals.push(staffName); }
        if (phone !== undefined) { fields.push('phone = ?'); vals.push(phone); }
        if (!fields.length) return res.status(400).json({ message: 'Nothing to update.' });
        vals.push(req.params.id);
        await db.query(
            `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            vals
        );
        await logAction(req.user.id, 'update_staff', 'user', req.params.id, { name, phone }, ip(req));
        res.json({ message: 'Staff updated.' });
    } catch (err) {
        console.error('updateStaff:', err);
        res.status(500).json({ message: 'Failed to update staff.' });
    }
};

exports.deactivateStaff = async (req, res) => {
    try {
        await db.query(
            `UPDATE users SET status = 'suspended' WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );
        await logAction(req.user.id, 'deactivate_staff', 'user', req.params.id, {}, ip(req));
        res.json({ message: 'Staff deactivated.' });
    } catch (err) {
        console.error('deactivateStaff:', err);
        res.status(500).json({ message: 'Failed to deactivate staff.' });
    }
};

exports.getStaffPerformance = async (req, res) => {
    const { from, to } = req.query;
    const dateFrom = from || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0];

    try {
        const [[user]] = await db.query(
            `SELECT u.id, u.name, u.email, u.status FROM users u
             WHERE u.id = ? AND u.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!user) return res.status(404).json({ success: false, message: 'Staff not found.' });

        // Look up employees.id for this user (needed for call_logs and leads FKs)
        const [[emp]] = await db.query(
            'SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL', [req.params.id]
        );
        const empId = emp?.id ?? null;

        const [[callStats]] = empId ? await db.query(
            `SELECT COUNT(*) AS total_calls,
                    SUM(CASE WHEN outcome = 'not_interested' THEN 1 ELSE 0 END) AS not_interested,
                    SUM(CASE WHEN outcome = 'converted' THEN 1 ELSE 0 END) AS converted
             FROM call_logs WHERE employee_id = ? AND deleted_at IS NULL
             AND DATE(called_at) BETWEEN ? AND ?`,
            [empId, dateFrom, dateTo]
        ) : [[{ total_calls: 0, not_interested: 0, converted: 0 }]];

        const [[leadStats]] = empId ? await db.query(
            `SELECT COUNT(*) AS total_leads,
                    SUM(CASE WHEN stage = 'converted' THEN 1 ELSE 0 END) AS converted
             FROM leads WHERE assigned_to = ? AND deleted_at IS NULL
             AND DATE(created_at) BETWEEN ? AND ?`,
            [empId, dateFrom, dateTo]
        ) : [[{ total_leads: 0, converted: 0 }]];

        const [[taskStats]] = empId ? await db.query(
            `SELECT COUNT(*) AS total_tasks,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
             FROM tasks WHERE assigned_to = ? AND deleted_at IS NULL
             AND DATE(created_at) BETWEEN ? AND ?`,
            [empId, dateFrom, dateTo]
        ) : [[{ total_tasks: 0, completed: 0 }]];

        res.json({
            success: true,
            data: { user, callStats, leadStats, taskStats, period: { from: dateFrom, to: dateTo } },
        });
    } catch (err) {
        console.error('getStaffPerformance:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch performance data.' });
    }
};

// ── RECRUITMENT OVERSIGHT ─────────────────────────────────────────────────────

exports.getRecruitmentOverview = async (req, res) => {
    try {
        const [[stats]] = await db.query(
            `SELECT
                (SELECT COUNT(*) FROM job_postings WHERE status = 'active' AND deleted_at IS NULL) AS active_jobs,
                (SELECT COUNT(*) FROM applications WHERE deleted_at IS NULL) AS total_applications,
                (SELECT COUNT(*) FROM applications WHERE status = 'shortlisted' AND deleted_at IS NULL) AS shortlisted,
                (SELECT COUNT(*) FROM applications WHERE status IN ('interview_scheduled','interviewed') AND deleted_at IS NULL) AS interviews,
                (SELECT COUNT(*) FROM applications WHERE status = 'offer_sent' AND deleted_at IS NULL) AS offers_sent,
                (SELECT COUNT(*) FROM offers WHERE deleted_at IS NULL) AS total_hires,
                (SELECT COUNT(*) FROM offers WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW()) AND deleted_at IS NULL) AS hires_this_month`
        );
        res.json({ success: true, data: { overview: { ...stats, interviewed: stats.interviews } } });
    } catch (err) {
        console.error('getRecruitmentOverview:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch overview.' });
    }
};

exports.getRecruitmentPipeline = async (req, res) => {
    try {
        const [pipeline] = await db.query(
            `SELECT a.id AS application_id, a.status AS pipeline_stage, a.applied_at,
                    u.name AS candidate_name,
                    jp.title AS job_title,
                    co.company_name
             FROM applications a
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             WHERE a.deleted_at IS NULL
             ORDER BY a.applied_at DESC
             LIMIT 100`
        );
        res.json({ success: true, data: pipeline });
    } catch (err) {
        console.error('getRecruitmentPipeline:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch pipeline.' });
    }
};

exports.getPlacements = async (req, res) => {
    try {
        const [placements] = await db.query(
            `SELECT he.id, he.role_title, he.joining_date, he.onboarding_started, he.created_at,
                    u.name AS candidate_name, u.email AS candidate_email,
                    co.company_name,
                    o.ctc,
                    COUNT(DISTINCT ta.id) AS courses_assigned,
                    COUNT(DISTINCT CASE WHEN ta.status = 'completed' THEN ta.id END) AS courses_completed
             FROM hired_employees he
             JOIN candidates c ON c.id = he.candidate_id
             JOIN users u ON u.id = c.user_id
             JOIN companies co ON co.id = he.company_id
             LEFT JOIN offers o ON o.id = he.offer_id AND o.deleted_at IS NULL
             LEFT JOIN training_assignments ta ON ta.hired_employee_id = he.id AND ta.deleted_at IS NULL
             WHERE he.deleted_at IS NULL
             GROUP BY he.id, he.role_title, he.joining_date, he.onboarding_started, he.created_at,
                      u.name, u.email, co.company_name, o.ctc
             ORDER BY he.created_at DESC`
        );
        res.json({ success: true, data: placements });
    } catch (err) {
        console.error('getPlacements:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch placements.' });
    }
};

// ── ANALYTICS ─────────────────────────────────────────────────────────────────

exports.getAnalyticsSummary = async (req, res) => {
    try {
        const [[summary]] = await db.query(
            `SELECT
                (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'company'   AND u.deleted_at IS NULL) AS total_companies,
                (SELECT COUNT(*) FROM companies WHERE is_approved = 1 AND deleted_at IS NULL)              AS approved_companies,
                (SELECT COUNT(*) FROM companies WHERE is_approved = 0 AND deleted_at IS NULL
                    AND user_id IN (SELECT id FROM users WHERE status != 'suspended'))                     AS pending_companies,
                (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'candidate' AND u.deleted_at IS NULL) AS total_candidates,
                (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'candidate' AND u.status = 'active' AND u.deleted_at IS NULL) AS active_candidates,
                (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'hr_staff'  AND u.deleted_at IS NULL) AS total_hr_staff,
                (SELECT COUNT(*) FROM job_postings WHERE status = 'active' AND deleted_at IS NULL)         AS active_jobs,
                (SELECT COUNT(*) FROM job_postings WHERE deleted_at IS NULL)                               AS total_jobs,
                (SELECT COUNT(*) FROM applications WHERE deleted_at IS NULL)                               AS total_applications,
                (SELECT COUNT(*) FROM offers WHERE deleted_at IS NULL)                                      AS total_placements,
                (SELECT COUNT(*) FROM offers WHERE MONTH(created_at) = MONTH(NOW())
                    AND YEAR(created_at) = YEAR(NOW()) AND deleted_at IS NULL)                             AS placements_this_month,
                (SELECT COUNT(*) FROM interview_slots WHERE status = 'completed' AND deleted_at IS NULL)   AS interviews_held,
                (SELECT COUNT(*) FROM certificates WHERE deleted_at IS NULL)                               AS certificates_issued,
                (SELECT COUNT(*) FROM courses)                                                             AS total_courses,
                (SELECT COUNT(*) FROM training_assignments WHERE status IN ('assigned','in_progress') AND deleted_at IS NULL) AS active_assignments,
                (SELECT COUNT(*) FROM training_assignments WHERE status = 'completed' AND deleted_at IS NULL) AS completed_assignments,
                (SELECT COUNT(*) FROM call_logs WHERE deleted_at IS NULL)                                  AS total_calls,
                (SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL)                                      AS total_leads,
                (SELECT COUNT(*) FROM leads WHERE stage = 'converted' AND deleted_at IS NULL)              AS converted_leads,
                (SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND deleted_at IS NULL)             AS tasks_completed,
                (SELECT ROUND(AVG(mr.fit_score)) FROM match_results mr)                                    AS avg_match_score`
        );
        res.json({ success: true, data: { summary } });
    } catch (err) {
        console.error('getAnalyticsSummary:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
    }
};

exports.getMonthlyAnalytics = async (req, res) => {
    try {
        const [registrations] = await db.query(
            `SELECT DATE_FORMAT(u.created_at, '%Y-%m') AS month,
                    SUM(CASE WHEN r.name = 'candidate' THEN 1 ELSE 0 END) AS candidates,
                    SUM(CASE WHEN r.name = 'company' THEN 1 ELSE 0 END) AS companies
             FROM users u JOIN roles r ON r.id = u.role_id
             WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) AND u.deleted_at IS NULL
             GROUP BY DATE_FORMAT(u.created_at, '%Y-%m')
             ORDER BY month ASC`
        );

        const [placements] = await db.query(
            `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
             FROM offers
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) AND deleted_at IS NULL
             GROUP BY DATE_FORMAT(created_at, '%Y-%m')
             ORDER BY month ASC`
        );

        // Reshape to match frontend field names (new_companies, new_candidates)
        const shaped = registrations.map(r => ({
            month: r.month,
            new_companies: r.companies,
            new_candidates: r.candidates,
        }));
        res.json({ success: true, data: shaped });
    } catch (err) {
        console.error('getMonthlyAnalytics:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch monthly analytics.' });
    }
};

exports.getConversionFunnel = async (req, res) => {
    try {
        const [[funnel]] = await db.query(
            `SELECT
                (SELECT COUNT(DISTINCT candidate_id) FROM applications WHERE deleted_at IS NULL)
                    AS applied,
                (SELECT COUNT(DISTINCT candidate_id) FROM applications
                    WHERE status IN ('shortlisted','interview_scheduled','interviewed','offer_sent','hired') AND deleted_at IS NULL)
                    AS shortlisted,
                (SELECT COUNT(DISTINCT candidate_id) FROM applications
                    WHERE status IN ('interview_scheduled','interviewed','offer_sent','hired') AND deleted_at IS NULL)
                    AS interviewed,
                (SELECT COUNT(DISTINCT candidate_id) FROM applications
                    WHERE status IN ('offer_sent','hired') AND deleted_at IS NULL)
                    AS offers_sent,
                (SELECT COUNT(DISTINCT candidate_id) FROM applications
                    WHERE status = 'hired' AND deleted_at IS NULL)
                    AS hired`
        );
        const shaped = {
            applications: funnel.applied,
            shortlisted:  funnel.shortlisted,
            interviewed:  funnel.interviewed,
            offers_sent:  funnel.offers_sent,
            hired:        funnel.hired,
            offer_acceptance_rate: funnel.offers_sent
                ? Math.round((funnel.hired / funnel.offers_sent) * 100)
                : 0,
        };
        res.json({ success: true, data: { funnel: shaped } });
    } catch (err) {
        console.error('getConversionFunnel:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch funnel data.' });
    }
};

exports.getExecutivePerformance = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT
                u.id AS user_id, u.name AS executive_name,
                e.id AS employee_id, e.department, e.designation,
                COUNT(DISTINCT co.id) AS companies_assigned,
                COUNT(DISTINCT l.id) AS leads_managed,
                COALESCE(SUM(l.stage = 'converted'), 0) AS leads_converted,
                COUNT(DISTINCT cl.id) AS calls_made,
                COUNT(DISTINCT a_src.id) AS candidates_sourced,
                COALESCE((
                    SELECT COUNT(*) FROM offers oo
                    JOIN applications aa ON aa.id = oo.application_id
                    JOIN job_postings jjp ON jjp.id = aa.job_id
                    WHERE jjp.company_id IN (
                        SELECT id FROM companies WHERE assigned_executive_id = u.id AND deleted_at IS NULL
                    ) AND oo.deleted_at IS NULL
                ), 0) AS offers_sent,
                COALESCE((
                    SELECT SUM(inv.amount_paid) FROM invoices inv
                    WHERE inv.raised_by = u.id AND inv.deleted_at IS NULL
                ), 0) AS fees_collected
             FROM employees e
             JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL
             LEFT JOIN companies co ON co.assigned_executive_id = u.id AND co.deleted_at IS NULL
             LEFT JOIN leads l ON l.assigned_to = e.id AND l.deleted_at IS NULL
             LEFT JOIN call_logs cl ON cl.employee_id = e.id AND cl.deleted_at IS NULL
             LEFT JOIN applications a_src ON a_src.sourced_by = u.id AND a_src.source = 'executive' AND a_src.deleted_at IS NULL
             WHERE e.deleted_at IS NULL
             GROUP BY e.id, u.id, u.name, e.department, e.designation
             ORDER BY offers_sent DESC, leads_converted DESC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getExecutivePerformance:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch executive performance.' });
    }
};

// ── AUDIT LOGS ────────────────────────────────────────────────────────────────

exports.getAuditLogs = async (req, res) => {
    const { page = 1, limit = 25, action, entity, from, to } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const where = [];
        const params = [];

        if (action) { where.push('al.action LIKE ?'); params.push(`%${action}%`); }
        if (entity) { where.push('al.entity_type = ?'); params.push(entity); }
        if (from) { where.push('DATE(al.created_at) >= ?'); params.push(from); }
        if (to) { where.push('DATE(al.created_at) <= ?'); params.push(to); }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [logs] = await db.query(
            `SELECT al.id, al.action, al.entity_type, al.entity_id, al.new_value,
                    al.ip_address, al.created_at,
                    u.name AS admin_name, u.email AS admin_email
             FROM admin_logs al
             JOIN users u ON u.id = al.admin_id
             ${whereClause}
             ORDER BY al.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM admin_logs al ${whereClause}`,
            params
        );

        res.json({ success: true, data: logs, total: Number(total), page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('getAuditLogs:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
    }
};

// ── PLATFORM SETTINGS ─────────────────────────────────────────────────────────

// ── AI MATCHING ADMIN ─────────────────────────────────────────────────────────

exports.reparseResumeSkills = async (req, res) => {
    try {
        const [resumes] = await db.query(
            `SELECT r.id, r.candidate_id, r.parsed_text
             FROM resumes r
             WHERE r.deleted_at IS NULL AND r.parsed_text IS NOT NULL AND r.parsed_text != ''
             ORDER BY r.id DESC`
        );
        res.json({ message: `Re-parsing skills for ${resumes.length} resumes in background.` });

        const { parseResumeToSkills } = require('../services/matchingService');
        setImmediate(async () => {
            let success = 0, failed = 0;
            for (const r of resumes) {
                try {
                    await parseResumeToSkills(r.candidate_id, r.parsed_text);
                    success++;
                } catch (err) {
                    console.error(`[Admin] Reparse failed for resume ${r.id}:`, err.message);
                    failed++;
                }
            }
            console.log(`[Admin] reparseResumeSkills done: ${success} success, ${failed} failed`);
        });
    } catch (err) {
        console.error('reparseResumeSkills:', err);
        res.status(500).json({ message: 'Failed to start re-parse.' });
    }
};

exports.recomputeMatchScores = async (req, res) => {
    try {
        const [apps] = await db.query(
            `SELECT a.id FROM applications a
             WHERE a.deleted_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM match_results mr WHERE mr.application_id = a.id)`
        );

        res.json({ message: `Recomputing scores for ${apps.length} applications. Running in background.` });

        const { calculateMatchScore } = require('../services/matchingService');
        setImmediate(async () => {
            let success = 0, failed = 0;
            for (const app of apps) {
                try {
                    await calculateMatchScore(app.id);
                    success++;
                } catch (err) {
                    console.error(`[Admin] Score failed for app ${app.id}:`, err.message);
                    failed++;
                }
            }
            console.log(`[Admin] recomputeMatchScores done: ${success} success, ${failed} failed`);
        });
    } catch (err) {
        console.error('recomputeMatchScores:', err);
        res.status(500).json({ message: 'Failed to start recompute.' });
    }
};

exports.backfillJobSkills = async (req, res) => {
    try {
        const [jobs] = await db.query(
            `SELECT id, title, description, requirements
             FROM job_postings
             WHERE (ai_processed IS NULL OR ai_processed = 0) AND deleted_at IS NULL`
        );

        res.json({ message: `Backfilling skills for ${jobs.length} jobs. Running in background.` });

        const { extractAndSaveJobSkills } = require('../services/jobSkillExtractor');
        setImmediate(async () => {
            let success = 0, failed = 0;
            for (const job of jobs) {
                try {
                    await extractAndSaveJobSkills(job.id, job, db);
                    success++;
                } catch (err) {
                    console.error(`[Admin] Backfill failed for job ${job.id}:`, err.message);
                    failed++;
                }
            }
            console.log(`[Admin] backfillJobSkills done: ${success} success, ${failed} failed`);
        });
    } catch (err) {
        console.error('backfillJobSkills:', err);
        res.status(500).json({ message: 'Failed to start backfill.' });
    }
};

exports.getSettings = async (req, res) => {
    try {
        const [settings] = await db.query(
            'SELECT setting_key, value, description, updated_by, updated_at FROM platform_settings ORDER BY setting_key'
        );
        res.json({ success: true, data: settings });
    } catch (err) {
        console.error('getSettings:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch settings.' });
    }
};

exports.updateSettings = async (req, res) => {
    const { settings } = req.body; // [{ key, value }]
    if (!Array.isArray(settings) || !settings.length) {
        return res.status(400).json({ message: 'settings[] array is required.' });
    }

    try {
        for (const { key, value } of settings) {
            if (!key) continue;
            await db.query(
                `INSERT INTO platform_settings (setting_key, value, updated_by)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by), updated_at = NOW()`,
                [key, String(value), req.user.id]
            );
        }

        await logAction(req.user.id, 'update_settings', 'platform_settings', null,
            { keys: settings.map(s => s.key) }, ip(req));

        // Bust maintenance mode cache and reload env overrides
        try { require('../middleware/maintenanceCheck').bustCache(); } catch { }
        try { require('../server').reloadEnv(); } catch { }

        res.json({ message: 'Settings updated.' });
    } catch (err) {
        console.error('updateSettings:', err);
        res.status(500).json({ message: 'Failed to update settings.' });
    }
};

// ── EXECUTIVE ASSIGNMENT (Phase 2) ───────────────────────────────────────────

exports.assignExecutive = async (req, res) => {
    const companyId = req.params.id;
    const { executive_id, notes } = req.body;
    if (!executive_id) return res.status(400).json({ message: 'executive_id is required.' });

    try {
        const [[company]] = await db.query(
            `SELECT co.id, co.company_name, u.email AS company_email, u.name AS contact_name
             FROM companies co JOIN users u ON u.id = co.user_id
             WHERE co.id = ? AND co.deleted_at IS NULL`,
            [companyId]
        );
        if (!company) return res.status(404).json({ message: 'Company not found.' });

        const [[executive]] = await db.query(
            `SELECT u.id, u.name, u.email FROM users u
             JOIN roles ro ON ro.id = u.role_id
             WHERE u.id = ? AND ro.name = 'hr_staff' AND u.deleted_at IS NULL`,
            [executive_id]
        );
        if (!executive) return res.status(404).json({ message: 'Executive (hr_staff) not found.' });

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // Close out any previous active assignment
            await conn.query(
                `UPDATE company_executive_assignments
                 SET unassigned_at = NOW()
                 WHERE company_id = ? AND unassigned_at IS NULL AND deleted_at IS NULL`,
                [companyId]
            );

            // Update companies row
            await conn.query(
                `UPDATE companies
                 SET assigned_executive_id = ?, executive_assigned_at = NOW(), executive_assigned_by = ?
                 WHERE id = ?`,
                [executive_id, req.user.id, companyId]
            );

            // Insert assignment history row
            await conn.query(
                `INSERT INTO company_executive_assignments
                    (company_id, executive_id, assigned_by, notes)
                 VALUES (?, ?, ?, ?)`,
                [companyId, executive_id, req.user.id, notes || null]
            );

            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        // Notify the assigned executive
        db.query(
            `INSERT INTO notifications (user_id, type, title, body, metadata)
             VALUES (?, 'executive_assignment', ?, ?, ?)`,
            [
                executive_id,
                `You've been assigned to ${company.company_name}`,
                `Admin has assigned you as the account executive for ${company.company_name}. You'll be their primary contact.`,
                JSON.stringify({ company_id: Number(companyId), company_name: company.company_name }),
            ]
        ).catch(e => console.error('[Notify]', e.message));

        await logAction(req.user.id, 'assign_executive', 'company', companyId,
            { executive_id, executive_name: executive.name, company_name: company.company_name }, ip(req));

        res.json({ message: 'Executive assigned.', executive: { id: executive.id, name: executive.name, email: executive.email } });
    } catch (err) {
        console.error('assignExecutive:', err);
        res.status(500).json({ message: 'Failed to assign executive.' });
    }
};

// ── PATCH /api/admin/companies/:id/placement-fee-rate ─────────────────────────
// Sets the company's contracted placement fee % (from their onboarding agreement).
// A non-NULL rate also makes the company "Platinum" — free unlimited resume
// unlocks, and this rate overrides platform_settings.placement_fee_multiplier
// at hire time. Pass placement_fee_percent: null to revert to the platform default.
// Optional multipart field "agreement" attaches/replaces the agreement document.
exports.setPlacementFeeRate = async (req, res) => {
    const companyId = req.params.id;
    const { placement_fee_percent } = req.body;

    if (placement_fee_percent !== null && placement_fee_percent !== undefined && placement_fee_percent !== '') {
        const pct = parseFloat(placement_fee_percent);
        if (isNaN(pct) || pct <= 0 || pct > 100) {
            return res.status(400).json({ message: 'placement_fee_percent must be a number between 0 and 100.' });
        }
    }

    try {
        const [[company]] = await db.query(
            `SELECT id, company_name, placement_fee_percent, agreement_file_key
             FROM companies WHERE id = ? AND deleted_at IS NULL`,
            [companyId]
        );
        if (!company) return res.status(404).json({ message: 'Company not found.' });

        const newPercent = (placement_fee_percent === null || placement_fee_percent === undefined || placement_fee_percent === '')
            ? null : parseFloat(placement_fee_percent);
        const newFileKey = req.file
            ? path.join('uploads', 'documents', req.file.filename).replace(/\\/g, '/')
            : company.agreement_file_key;

        await db.query(
            `UPDATE companies SET placement_fee_percent = ?, agreement_file_key = ? WHERE id = ?`,
            [newPercent, newFileKey, companyId]
        );

        logAction(req.user.id, 'set_placement_fee_rate', 'company', companyId,
            { company_name: company.company_name, old_percent: company.placement_fee_percent, new_percent: newPercent,
              agreement_uploaded: !!req.file }, ip(req));

        res.json({
            message: newPercent != null
                ? `${company.company_name} is now on a ${newPercent}% contracted rate (Platinum — free resume unlocks).`
                : `${company.company_name} reverted to the platform default placement fee rate.`,
            placement_fee_percent: newPercent,
            agreement_file_key: newFileKey,
        });
    } catch (err) {
        console.error('setPlacementFeeRate:', err);
        res.status(500).json({ message: 'Failed to update placement fee rate.' });
    }
};

// ── GET /api/admin/companies/:id/agreement ────────────────────────────────────
exports.downloadAgreement = async (req, res) => {
    try {
        const [[company]] = await db.query(
            `SELECT agreement_file_key FROM companies WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );
        if (!company?.agreement_file_key) return res.status(404).json({ message: 'No agreement on file.' });

        const absolutePath = path.join(process.cwd(), company.agreement_file_key);
        if (!fs.existsSync(absolutePath)) return res.status(404).json({ message: 'Agreement file not found on server.' });

        res.download(absolutePath);
    } catch (err) {
        console.error('downloadAgreement:', err);
        res.status(500).json({ message: 'Failed to download agreement.' });
    }
};

exports.listExecutiveAssignments = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT co.id AS company_id, co.company_name, co.industry,
                    exec_u.id AS executive_id, exec_u.name AS executive_name, exec_u.email AS executive_email,
                    co.executive_assigned_at, assigner.name AS assigned_by_name
             FROM companies co
             JOIN users exec_u ON exec_u.id = co.assigned_executive_id
             JOIN users assigner ON assigner.id = co.executive_assigned_by
             WHERE co.deleted_at IS NULL AND co.assigned_executive_id IS NOT NULL
             ORDER BY co.executive_assigned_at DESC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('listExecutiveAssignments:', err);
        res.status(500).json({ message: 'Failed to fetch assignments.' });
    }
};

exports.listUnassignedCompanies = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT co.id, co.company_name, co.industry, co.is_approved, u.name AS contact_name, u.email
             FROM companies co
             JOIN users u ON u.id = co.user_id
             WHERE co.deleted_at IS NULL AND co.assigned_executive_id IS NULL AND co.is_approved = 1
             ORDER BY co.created_at DESC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('listUnassignedCompanies:', err);
        res.status(500).json({ message: 'Failed to fetch unassigned companies.' });
    }
};

// ── COMPANY REQUESTS & FEE GATE (Phase 3) ────────────────────────────────────

exports.listRequests = async (req, res) => {
    const { status, company_id, executive_id } = req.query;
    const conditions = ['cr.deleted_at IS NULL'];
    const params = [];

    if (status) { conditions.push('cr.status = ?'); params.push(status); }
    if (company_id) { conditions.push('cr.company_id = ?'); params.push(company_id); }
    if (executive_id) { conditions.push('cr.assigned_executive_id = ?'); params.push(executive_id); }

    try {
        const [rows] = await db.query(
            `SELECT cr.id, cr.request_type, cr.status, cr.company_notes, cr.internal_notes,
                    cr.created_at, cr.resolved_at,
                    co.company_name,
                    co_u.name AS company_contact_name, co_u.email AS company_email,
                    exec_u.id AS executive_id, exec_u.name AS executive_name,
                    app.job_id,
                    jp.title AS job_title,
                    cand_u.name AS candidate_name,
                    si.id AS invoice_id, si.invoice_number, si.amount, si.status AS invoice_status,
                    cag.id AS grant_id, cag.granted_at, cag.expires_at, cag.revoked_at
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN users co_u ON co_u.id = co.user_id
             LEFT JOIN users exec_u ON exec_u.id = cr.assigned_executive_id
             JOIN applications app ON app.id = cr.application_id
             JOIN job_postings jp ON jp.id = app.job_id
             JOIN candidates cand ON cand.id = app.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN service_invoices si ON si.request_id = cr.id AND si.deleted_at IS NULL
             LEFT JOIN candidate_access_grants cag ON cag.request_id = cr.id
             WHERE ${conditions.join(' AND ')}
             ORDER BY cr.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('listRequests:', err);
        res.status(500).json({ message: 'Failed to fetch requests.' });
    }
};

exports.updateRequest = async (req, res) => {
    const reqId = req.params.id;
    const { status, internal_notes, assigned_executive_id } = req.body;

    const allowed = ['in_progress', 'approved', 'rejected', 'cancelled'];
    if (status && !allowed.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}` });
    }

    try {
        const [[cr]] = await db.query(
            `SELECT cr.*, co.company_name,
                    app.candidate_id, co.id AS co_id,
                    co_u.id AS company_user_id, co_u.email AS company_email, co_u.name AS company_contact,
                    cand_u.name AS candidate_name
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN users co_u ON co_u.id = co.user_id
             JOIN applications app ON app.id = cr.application_id
             JOIN candidates cand ON cand.id = app.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             WHERE cr.id = ? AND cr.deleted_at IS NULL`,
            [reqId]
        );
        if (!cr) return res.status(404).json({ message: 'Request not found.' });

        const setClauses = [];
        const params = [];

        if (status) {
            setClauses.push('status = ?');
            params.push(status);
            if (['approved', 'rejected', 'cancelled'].includes(status)) {
                setClauses.push('resolved_at = NOW()', 'resolved_by = ?');
                params.push(req.user.id);
            }
        }
        if (internal_notes !== undefined) { setClauses.push('internal_notes = ?'); params.push(internal_notes); }
        if (assigned_executive_id !== undefined) { setClauses.push('assigned_executive_id = ?'); params.push(assigned_executive_id); }

        if (setClauses.length) {
            params.push(reqId);
            await db.query(`UPDATE company_requests SET ${setClauses.join(', ')} WHERE id = ?`, params);
        }

        // If approved, auto-create access grant (invoice must already be paid or waived)
        if (status === 'approved') {
            const [[invoice]] = await db.query(
                `SELECT id FROM service_invoices WHERE request_id = ? AND status IN ('paid','waived') AND deleted_at IS NULL LIMIT 1`,
                [reqId]
            );
            await db.query(
                `INSERT IGNORE INTO candidate_access_grants
                    (request_id, invoice_id, company_id, candidate_id, application_id, grant_type, granted_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [reqId, invoice?.id || null, cr.co_id, cr.candidate_id, cr.application_id, cr.request_type, req.user.id]
            );
        }

        // Tell the company their request was resolved — they had no other way to know
        if (['approved', 'rejected'].includes(status)) {
            const typeLabel = cr.request_type === 'candidate_profile_access' ? 'Candidate Profile Access' : 'Interview Scheduling';
            db.query(
                `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)`,
                [cr.company_user_id,
                 status === 'approved' ? 'company_request_approved' : 'company_request_rejected',
                 `${typeLabel} Request ${status === 'approved' ? 'Approved' : 'Rejected'} — ${cr.candidate_name}`,
                 status === 'approved'
                    ? `Your ${typeLabel.toLowerCase()} request for ${cr.candidate_name} has been approved.`
                    : `Your ${typeLabel.toLowerCase()} request for ${cr.candidate_name} was not approved.`,
                 JSON.stringify({ request_id: reqId })]
            ).catch(e => console.error('[notify]', e.message));

            if (cr.company_email) {
                safeEmail({
                    to: cr.company_email,
                    subject: `${typeLabel} Request ${status === 'approved' ? 'Approved' : 'Update'} — ${cr.candidate_name}`,
                    html: `
                        <p>Hi ${cr.company_contact || ''},</p>
                        <p>Your <strong>${typeLabel}</strong> request for candidate <strong>${cr.candidate_name}</strong> has been
                        <strong>${status === 'approved' ? 'approved' : 'rejected'}</strong> by LadderStep Human Consulting.</p>
                        <p>Please log in to your <strong>Company Portal → Requests</strong> for details.</p>
                        <br/><p>LadderStep Human Consulting Team</p>
                    `,
                });
            }
        }

        await logAction(req.user.id, 'update_request', 'company_request', reqId,
            { status, company_name: cr.company_name }, ip(req));

        res.json({ message: 'Request updated.' });
    } catch (err) {
        console.error('updateRequest:', err);
        res.status(500).json({ message: 'Failed to update request.' });
    }
};

exports.createInvoice = async (req, res) => {
    const { request_id, amount, fee_type, due_date, notes } = req.body;
    if (!request_id || !amount || !fee_type) {
        return res.status(400).json({ message: 'request_id, amount, fee_type are required.' });
    }

    try {
        const [[cr]] = await db.query(
            `SELECT cr.id, cr.company_id, cr.request_type,
                    co.company_name, co_u.id AS company_user_id, co_u.email AS company_email, co_u.name AS company_contact
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN users co_u ON co_u.id = co.user_id
             WHERE cr.id = ? AND cr.deleted_at IS NULL`,
            [request_id]
        );
        if (!cr) return res.status(404).json({ message: 'Request not found.' });

        const [[setting]] = await db.query(
            `SELECT value FROM platform_settings WHERE setting_key = 'fee_currency'`
        );
        const currency = setting?.value || 'INR';

        // Generate invoice number: INV-YYYYMMDD-<requestId>
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const invoiceNumber = `INV-${dateStr}-${request_id}`;

        const [result] = await db.query(
            `INSERT INTO service_invoices
                (request_id, company_id, invoice_number, amount, currency, fee_type, due_date, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [request_id, cr.company_id, invoiceNumber, amount, currency, fee_type, due_date || null, notes || null]
        );

        await logAction(req.user.id, 'create_invoice', 'service_invoice', result.insertId,
            { invoice_number: invoiceNumber, amount, request_id }, ip(req));

        db.query(
            `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, 'invoice_raised', ?, ?, ?)`,
            [cr.company_user_id,
             `Invoice Raised — ${invoiceNumber}`,
             `An invoice of ${currency} ${parseFloat(amount).toLocaleString('en-IN')} has been raised for your ${cr.request_type.replace('_', ' ')} request. Please log in to pay.`,
             JSON.stringify({ invoice_id: result.insertId, invoice_number: invoiceNumber })]
        ).catch(e => console.error('[notify]', e.message));

        if (cr.company_email) {
            safeEmail({
                to: cr.company_email,
                subject: `Invoice Raised — ${invoiceNumber}`,
                html: `
                    <p>Hi ${cr.company_contact || ''},</p>
                    <p>An invoice has been raised for your <strong>${cr.request_type.replace('_', ' ')}</strong> request.</p>
                    <p><strong>Invoice:</strong> ${invoiceNumber}<br/>
                       <strong>Amount:</strong> ${currency} ${parseFloat(amount).toLocaleString('en-IN')}
                       ${due_date ? `<br/><strong>Due:</strong> ${fmtDate(due_date)}` : ''}</p>
                    ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
                    <p>Please log in to your <strong>Company Portal → Requests</strong> to view and pay.</p>
                    <br/><p>LadderStep Human Consulting Team</p>
                `,
            });
        }

        res.status(201).json({ message: 'Invoice created.', invoice_id: result.insertId, invoice_number: invoiceNumber });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'An invoice already exists for this request.' });
        }
        console.error('createInvoice:', err);
        res.status(500).json({ message: 'Failed to create invoice.' });
    }
};

exports.updateInvoiceStatus = async (req, res) => {
    const invoiceId = req.params.id;
    const { status, notes } = req.body;

    const allowed = ['paid', 'waived', 'overdue', 'cancelled'];
    if (!status || !allowed.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}` });
    }

    try {
        const [[inv]] = await db.query(
            `SELECT id, request_id, company_id FROM service_invoices WHERE id = ? AND deleted_at IS NULL`,
            [invoiceId]
        );
        if (!inv) return res.status(404).json({ message: 'Invoice not found.' });

        const extra = (status === 'paid' || status === 'waived')
            ? ', paid_at = NOW(), paid_by = ?'
            : '';
        const params = (status === 'paid' || status === 'waived')
            ? [status, notes || null, req.user.id, invoiceId]
            : [status, notes || null, invoiceId];

        await db.query(
            `UPDATE service_invoices SET status = ?, notes = COALESCE(?, notes)${extra} WHERE id = ?`,
            params
        );

        await logAction(req.user.id, 'update_invoice_status', 'service_invoice', invoiceId,
            { status, request_id: inv.request_id }, ip(req));

        res.json({ message: 'Invoice status updated.' });
    } catch (err) {
        console.error('updateInvoiceStatus:', err);
        res.status(500).json({ message: 'Failed to update invoice.' });
    }
};

// ── POST /api/admin/companies/:id/activate-package ───────────────────────────
// Manually activate a Single or 4-Pack resume-unlock package for a company
// (used when payment is collected offline or deferred). Creates a paid invoice
// + a resume_unlock_orders row and notifies the company.
const PACKAGE_CONFIG = {
    single: { credits: 1, amount: 999,  label: 'Single Resume Unlock' },
    pack_4: { credits: 4, amount: 3999, label: '4-Resume Pack'         },
};

exports.activatePackage = async (req, res) => {
    const { tier } = req.body;
    const companyId = parseInt(req.params.id);
    if (!PACKAGE_CONFIG[tier]) return res.status(400).json({ message: 'tier must be single or pack_4.' });

    const { credits, amount, label } = PACKAGE_CONFIG[tier];

    try {
        const [[company]] = await db.query(
            `SELECT c.id, c.company_name, c.user_id FROM companies c WHERE c.id = ? AND c.deleted_at IS NULL`,
            [companyId]
        );
        if (!company) return res.status(404).json({ message: 'Company not found.' });

        const conn = await db.getConnection();
        let invoiceId, invoiceNumber;
        try {
            await conn.beginTransaction();

            const { nextInvoiceNumber } = require('../utils/placementFee');
            invoiceNumber = await nextInvoiceNumber(conn);
            const [invResult] = await conn.query(
                `INSERT INTO invoices
                    (invoice_number, company_id, raised_by, invoice_type, amount, amount_paid,
                     status, description, paid_at)
                 VALUES (?, ?, ?, 'resume_unlock', ?, ?, 'paid', ?, NOW())`,
                [invoiceNumber, companyId, req.user.id, amount, amount,
                 `${label} — activated by LadderStep (offline payment)`]
            );
            invoiceId = invResult.insertId;

            await conn.query(
                `INSERT INTO resume_unlock_orders
                    (company_id, order_type, credits_total, credits_used, invoice_id)
                 VALUES (?, ?, ?, 0, ?)`,
                [companyId, tier, credits, invoiceId]
            );

            await conn.commit();
        } catch (e) {
            await conn.rollback(); throw e;
        } finally { conn.release(); }

        // Notify company
        await db.query(
            `INSERT INTO notifications (user_id, type, title, body, metadata)
             VALUES (?, 'package_activated', ?, ?, ?)`,
            [company.user_id,
             `Package Activated — ${label}`,
             `Your ${label} package has been activated by LadderStep Human Consulting. You now have ${credits} resume unlock credit${credits > 1 ? 's' : ''} to use in the Talent Pool.`,
             JSON.stringify({ company_id: companyId, tier, credits, invoice_id: invoiceId })]
        );

        await logAction(req.user.id, 'activate_package', 'company', companyId,
            { tier, credits, amount, invoice_id: invoiceId, invoice_number: invoiceNumber }, ip(req));

        res.json({ message: `${label} activated for ${company.company_name}.`, invoice_number: invoiceNumber, credits });
    } catch (err) {
        console.error('activatePackage:', err);
        res.status(500).json({ message: 'Failed to activate package.' });
    }
};

// ── GET /api/admin/jobs ───────────────────────────────────────────────────────
exports.listAllJobs = async (req, res) => {
    const { company_id, status, search } = req.query;
    const filters = ['jp.deleted_at IS NULL'];
    const params  = [];

    if (company_id) { filters.push('jp.company_id = ?'); params.push(company_id); }
    if (status)     { filters.push('jp.status = ?');     params.push(status); }
    if (search)     { filters.push('(jp.title LIKE ? OR co.company_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    try {
        const [jobs] = await db.query(
            `SELECT jp.id, jp.title, jp.location, jp.job_type, jp.work_mode, jp.status,
                    jp.openings, jp.deadline, jp.created_at,
                    co.id AS company_id, co.company_name,
                    (SELECT COUNT(*) FROM applications a WHERE a.job_id = jp.id AND a.deleted_at IS NULL) AS applicant_count
             FROM job_postings jp
             JOIN companies co ON co.id = jp.company_id AND co.deleted_at IS NULL
             WHERE ${filters.join(' AND ')}
             ORDER BY jp.created_at DESC`,
            params
        );
        res.json({ success: true, data: jobs });
    } catch (err) {
        console.error('admin.listAllJobs:', err);
        res.status(500).json({ message: 'Failed to fetch jobs.' });
    }
};

// ── PATCH /api/admin/jobs/:id/status ─────────────────────────────────────────
exports.setJobStatus = async (req, res) => {
    const { status } = req.body;
    const valid = ['active', 'draft', 'paused', 'closed'];
    if (!status || !valid.includes(status)) {
        return res.status(400).json({ message: 'Valid status required: active | draft | paused | closed' });
    }
    try {
        const [[job]] = await db.query(
            'SELECT id, company_id FROM job_postings WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!job) return res.status(404).json({ message: 'Job not found.' });
        await db.query('UPDATE job_postings SET status = ? WHERE id = ?', [status, req.params.id]);
        await logAction(req.user.id, 'set_job_status', 'job_posting', req.params.id,
            { status }, ip(req));
        res.json({ success: true, message: `Job status set to ${status}.` });
    } catch (err) {
        console.error('admin.setJobStatus:', err);
        res.status(500).json({ message: 'Failed to update status.' });
    }
};

// ── DELETE /api/admin/jobs/:id ────────────────────────────────────────────────
exports.deleteJob = async (req, res) => {
    try {
        const [[job]] = await db.query(
            'SELECT id, title, company_id FROM job_postings WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!job) return res.status(404).json({ message: 'Job not found.' });
        await db.query('UPDATE job_postings SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        await logAction(req.user.id, 'delete_job_posting', 'job_posting', req.params.id,
            { title: job.title, company_id: job.company_id }, ip(req));
        res.json({ success: true, message: 'Job posting deleted.' });
    } catch (err) {
        console.error('admin.deleteJob:', err);
        res.status(500).json({ message: 'Failed to delete job.' });
    }
};

// ── Email Templates ──────────────────────────────────────────────────────────
exports.listEmailTemplates = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, name, description, subject, variables, is_active, created_at, updated_at
             FROM email_templates WHERE deleted_at IS NULL ORDER BY name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('admin.listEmailTemplates:', err);
        res.status(500).json({ message: 'Failed to fetch templates.' });
    }
};

exports.getEmailTemplate = async (req, res) => {
    try {
        const [[tpl]] = await db.query(
            'SELECT * FROM email_templates WHERE id = ? AND deleted_at IS NULL',
            [req.params.id]
        );
        if (!tpl) return res.status(404).json({ message: 'Template not found.' });
        res.json({ success: true, data: tpl });
    } catch (err) {
        console.error('admin.getEmailTemplate:', err);
        res.status(500).json({ message: 'Failed to fetch template.' });
    }
};

exports.createEmailTemplate = async (req, res) => {
    try {
        const { name, description, subject, body_html, variables, is_active } = req.body;
        if (!name || !subject || !body_html) {
            return res.status(400).json({ message: 'name, subject, and body_html are required.' });
        }
        const [result] = await db.query(
            `INSERT INTO email_templates (created_by, name, description, subject, body_html, variables, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, name.trim(), description || null, subject, body_html,
             variables ? JSON.stringify(variables) : null, is_active !== false ? 1 : 0]
        );
        await logAction(req.user.id, 'create_email_template', 'email_template', result.insertId, { name }, ip(req));
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A template with that name already exists.' });
        console.error('admin.createEmailTemplate:', err);
        res.status(500).json({ message: 'Failed to create template.' });
    }
};

exports.updateEmailTemplate = async (req, res) => {
    try {
        const [[tpl]] = await db.query('SELECT id FROM email_templates WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!tpl) return res.status(404).json({ message: 'Template not found.' });
        const { name, description, subject, body_html, variables, is_active } = req.body;
        await db.query(
            `UPDATE email_templates SET name=?, description=?, subject=?, body_html=?, variables=?, is_active=? WHERE id=?`,
            [name, description || null, subject, body_html,
             variables ? JSON.stringify(variables) : null,
             is_active !== false ? 1 : 0, req.params.id]
        );
        await logAction(req.user.id, 'update_email_template', 'email_template', req.params.id, { name }, ip(req));
        res.json({ success: true, message: 'Template updated.' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A template with that name already exists.' });
        console.error('admin.updateEmailTemplate:', err);
        res.status(500).json({ message: 'Failed to update template.' });
    }
};

exports.deleteEmailTemplate = async (req, res) => {
    try {
        const [[tpl]] = await db.query('SELECT id, name FROM email_templates WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
        if (!tpl) return res.status(404).json({ message: 'Template not found.' });
        await db.query('UPDATE email_templates SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        await logAction(req.user.id, 'delete_email_template', 'email_template', req.params.id, { name: tpl.name }, ip(req));
        res.json({ success: true, message: 'Template deleted.' });
    } catch (err) {
        console.error('admin.deleteEmailTemplate:', err);
        res.status(500).json({ message: 'Failed to delete template.' });
    }
};

// ── MIS / OPERATIONAL ANALYTICS ──────────────────────────────────────────────

exports.getMIS = async (req, res) => {
    const period = req.query.period || 'weekly'; // daily | weekly | monthly

    const intervalMap = {
        daily:   'INTERVAL 1 DAY',
        weekly:  'INTERVAL 7 DAY',
        monthly: 'INTERVAL 30 DAY',
    };
    const interval = intervalMap[period] || intervalMap.weekly;

    const trendDays = period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1;

    try {
        // ── 1. Platform-wide operational metrics for the period ──────────────
        const [[platform]] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - ${interval} AND deleted_at IS NULL) AS new_registrations,
                (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
                    WHERE r.name = 'company' AND u.created_at >= NOW() - ${interval} AND u.deleted_at IS NULL) AS new_companies,
                (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
                    WHERE r.name = 'candidate' AND u.created_at >= NOW() - ${interval} AND u.deleted_at IS NULL) AS new_candidates,
                (SELECT COUNT(*) FROM job_postings WHERE created_at >= NOW() - ${interval} AND deleted_at IS NULL) AS jobs_posted,
                (SELECT COUNT(*) FROM applications WHERE created_at >= NOW() - ${interval} AND deleted_at IS NULL) AS applications_received,
                (SELECT COUNT(*) FROM interview_slots WHERE created_at >= NOW() - ${interval} AND deleted_at IS NULL) AS interviews_scheduled,
                (SELECT COUNT(*) FROM interview_slots WHERE status = 'completed' AND updated_at >= NOW() - ${interval} AND deleted_at IS NULL) AS interviews_completed,
                (SELECT COUNT(*) FROM offers WHERE created_at >= NOW() - ${interval} AND deleted_at IS NULL) AS offers_sent,
                (SELECT COUNT(*) FROM applications WHERE status = 'hired' AND updated_at >= NOW() - ${interval} AND deleted_at IS NULL) AS hires_made,
                (SELECT COUNT(*) FROM leads WHERE created_at >= NOW() - ${interval} AND deleted_at IS NULL) AS leads_created,
                (SELECT COUNT(*) FROM leads WHERE stage = 'converted' AND updated_at >= NOW() - ${interval} AND deleted_at IS NULL) AS leads_converted,
                (SELECT COUNT(*) FROM outreach_campaigns WHERE created_at >= NOW() - ${interval} AND deleted_at IS NULL) AS campaigns_launched,
                (SELECT COALESCE(SUM(sent_count),0) FROM outreach_campaigns WHERE created_at >= NOW() - ${interval} AND deleted_at IS NULL) AS outreach_messages_sent,
                (SELECT COUNT(*) FROM tasks WHERE created_at >= NOW() - ${interval} AND deleted_at IS NULL) AS tasks_created,
                (SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND updated_at >= NOW() - ${interval} AND deleted_at IS NULL) AS tasks_completed,
                (SELECT COALESCE(SUM(amount),0) FROM invoices WHERE status IN ('paid','partial') AND updated_at >= NOW() - ${interval} AND deleted_at IS NULL) AS revenue_collected
        `);

        // ── 2. Per-executive breakdown ───────────────────────────────────────
        const [executives] = await db.query(`
            SELECT
                u.id AS user_id, u.name AS executive_name,
                e.id AS employee_id, e.department, e.designation,
                (SELECT COUNT(*) FROM companies co
                    WHERE co.assigned_executive_id = u.id AND co.deleted_at IS NULL) AS companies_assigned,
                (SELECT COUNT(*) FROM leads l
                    WHERE l.assigned_to = e.id AND l.created_at >= NOW() - ${interval} AND l.deleted_at IS NULL) AS leads_created,
                (SELECT COUNT(*) FROM leads l
                    WHERE l.assigned_to = e.id AND l.stage = 'converted' AND l.updated_at >= NOW() - ${interval} AND l.deleted_at IS NULL) AS leads_converted,
                (SELECT COUNT(*) FROM call_logs cl
                    WHERE cl.employee_id = e.id AND cl.created_at >= NOW() - ${interval} AND cl.deleted_at IS NULL) AS calls_made,
                (SELECT COUNT(*) FROM applications a
                    WHERE a.sourced_by = u.id AND a.source = 'executive' AND a.created_at >= NOW() - ${interval} AND a.deleted_at IS NULL) AS candidates_sourced,
                (SELECT COUNT(*) FROM interview_request_logs irl
                    WHERE irl.reviewed_by = u.id AND irl.created_at >= NOW() - ${interval}) AS interviews_approved,
                (SELECT COUNT(*) FROM offers oo
                    JOIN applications aa ON aa.id = oo.application_id
                    JOIN job_postings jp ON jp.id = aa.job_id
                    JOIN companies co2 ON co2.id = jp.company_id AND co2.assigned_executive_id = u.id
                    WHERE oo.created_at >= NOW() - ${interval} AND oo.deleted_at IS NULL) AS offers_facilitated,
                (SELECT COUNT(*) FROM applications aa2
                    JOIN job_postings jp2 ON jp2.id = aa2.job_id
                    JOIN companies co3 ON co3.id = jp2.company_id AND co3.assigned_executive_id = u.id
                    WHERE aa2.status = 'hired' AND aa2.updated_at >= NOW() - ${interval} AND aa2.deleted_at IS NULL) AS hires_closed,
                (SELECT COUNT(*) FROM tasks t
                    WHERE t.assigned_by = u.id AND t.created_at >= NOW() - ${interval} AND t.deleted_at IS NULL) AS tasks_assigned,
                (SELECT COUNT(*) FROM tasks t2
                    WHERE t2.assigned_to = u.id AND t2.status = 'completed' AND t2.updated_at >= NOW() - ${interval} AND t2.deleted_at IS NULL) AS tasks_completed,
                (SELECT COUNT(*) FROM outreach_campaigns oc
                    WHERE oc.created_by = e.id AND oc.created_at >= NOW() - ${interval} AND oc.deleted_at IS NULL) AS campaigns_run,
                (SELECT COALESCE(SUM(oc2.sent_count),0) FROM outreach_campaigns oc2
                    WHERE oc2.created_by = e.id AND oc2.created_at >= NOW() - ${interval} AND oc2.deleted_at IS NULL) AS messages_sent,
                (SELECT COALESCE(SUM(inv.amount),0) FROM invoices inv
                    WHERE inv.raised_by = u.id AND inv.status IN ('paid','partial')
                    AND inv.updated_at >= NOW() - ${interval} AND inv.deleted_at IS NULL) AS fees_collected
            FROM employees e
            JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL
            WHERE e.deleted_at IS NULL
            ORDER BY hires_closed DESC, leads_converted DESC, calls_made DESC
        `);

        // ── 3. Daily trend (for sparklines) — last trendDays days ────────────
        const [trend] = await db.query(`
            SELECT
                DATE(d.day) AS date,
                COALESCE((SELECT COUNT(*) FROM applications WHERE DATE(created_at) = DATE(d.day) AND deleted_at IS NULL), 0) AS applications,
                COALESCE((SELECT COUNT(*) FROM leads WHERE DATE(created_at) = DATE(d.day) AND deleted_at IS NULL), 0) AS leads,
                COALESCE((SELECT COUNT(*) FROM interview_slots WHERE DATE(created_at) = DATE(d.day) AND deleted_at IS NULL), 0) AS interviews,
                COALESCE((SELECT COUNT(*) FROM offers WHERE DATE(created_at) = DATE(d.day) AND deleted_at IS NULL), 0) AS offers,
                COALESCE((SELECT COUNT(*) FROM applications WHERE status = 'hired' AND DATE(updated_at) = DATE(d.day) AND deleted_at IS NULL), 0) AS hires
            FROM (
                SELECT DATE(NOW()) - INTERVAL (a.a + (10 * b.a)) DAY AS day
                FROM (SELECT 0 AS a UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) AS a
                CROSS JOIN (SELECT 0 AS a UNION SELECT 1 UNION SELECT 2 UNION SELECT 3) AS b
                WHERE a.a + (10 * b.a) < ?
            ) d
            ORDER BY d.day ASC
        `, [trendDays]);

        // ── 4. Top performers ────────────────────────────────────────────────
        const [topPerformers] = await db.query(`
            SELECT u.name, e.designation,
                   COUNT(DISTINCT l.id) AS leads,
                   COALESCE(SUM(l.stage='converted'),0) AS converted,
                   COUNT(DISTINCT cl.id) AS calls
            FROM employees e
            JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL
            LEFT JOIN leads l ON l.assigned_to = e.id AND l.created_at >= NOW() - ${interval} AND l.deleted_at IS NULL
            LEFT JOIN call_logs cl ON cl.employee_id = e.id AND cl.created_at >= NOW() - ${interval} AND cl.deleted_at IS NULL
            WHERE e.deleted_at IS NULL
            GROUP BY e.id, u.name, e.designation
            ORDER BY converted DESC, calls DESC
            LIMIT 5
        `);

        res.json({ success: true, data: { period, platform, executives, trend, topPerformers } });
    } catch (err) {
        console.error('getMIS:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch MIS data.' });
    }
};

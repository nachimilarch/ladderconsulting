const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const cashfree = require('../services/cashfreeService');
const { nextInvoiceNumber } = require('../utils/placementFee');
const { consumePackCredit } = require('../utils/resumeUnlock');
const { isCandidateHired, hasPendingOffer } = require('../utils/candidateStatus');
const { logAction } = require('../utils/auditLog');
const matchingService = require('../services/matchingService');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

const PRICING = {
    single: { amount: 999,  credits: 1 },
    pack_4: { amount: 3999, credits: 5 },
};

const getCompany = async (userId) => {
    const [[row]] = await db.query(
        `SELECT c.id, c.company_name, c.placement_fee_percent, u.email, u.phone
         FROM companies c JOIN users u ON u.id = c.user_id
         WHERE c.user_id = ? AND c.deleted_at IS NULL`,
        [userId]
    );
    return row || null;
};

// A company has "selected a package" once they're Platinum (admin-set contracted
// rate) or have at least one paid single/pack order on file. Gates Talent Pool
// access and AI match-score visibility (companyController) until true.
const hasSelectedPackage = async (companyId, placementFeePercent) => {
    if (placementFeePercent != null) return true;
    const [[row]] = await db.query(
        `SELECT 1 FROM resume_unlock_orders ruo JOIN invoices i ON i.id = ruo.invoice_id
         WHERE ruo.company_id = ? AND i.status = 'paid' AND ruo.deleted_at IS NULL LIMIT 1`,
        [companyId]
    );
    return !!row;
};
exports.hasSelectedPackage = hasSelectedPackage;

// ── GET /api/companies/package-status ─────────────────────────────────────────
exports.getPackageStatus = async (req, res) => {
    try {
        const company = await getCompany(req.user.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

        const has_package = await hasSelectedPackage(company.id, company.placement_fee_percent);
        res.json({ success: true, has_package, platinum: company.placement_fee_percent != null });
    } catch (err) {
        console.error('[resumeUnlock.packageStatus]', err);
        res.status(500).json({ success: false, message: 'Failed to load package status.' });
    }
};

const grantUnlock = async (companyId, candidateId, orderId, grantedVia, unlockedBy) => {
    await db.query(
        `INSERT INTO resume_unlocks (company_id, candidate_id, order_id, granted_via, unlocked_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE order_id = order_id`,
        [companyId, candidateId, orderId, grantedVia, unlockedBy]
    );
};

// true if this company can already see candidateId's full resume/profile —
// either Platinum (contracted rate set) or an existing unlock grant.
const isUnlocked = async (companyId, candidateId, placementFeePercent) => {
    if (placementFeePercent != null) return 'platinum';
    const [[row]] = await db.query(
        `SELECT granted_via FROM resume_unlocks WHERE company_id = ? AND candidate_id = ?`,
        [companyId, candidateId]
    );
    return row?.granted_via || null;
};

// ── GET /api/companies/talent/unlock-status?candidateIds=1,2,3 ───────────────
exports.getUnlockStatus = async (req, res) => {
    try {
        const company = await getCompany(req.user.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

        const ids = (req.query.candidateIds || '').split(',').map(s => parseInt(s.trim())).filter(Boolean);
        const platinum = company.placement_fee_percent != null;

        let statuses = {};
        if (ids.length) {
            if (platinum) {
                statuses = Object.fromEntries(ids.map(id => [id, { unlocked: true, via: 'platinum' }]));
            } else {
                const [rows] = await db.query(
                    `SELECT candidate_id, granted_via FROM resume_unlocks WHERE company_id = ? AND candidate_id IN (?)`,
                    [company.id, ids]
                );
                const byId = Object.fromEntries(rows.map(r => [r.candidate_id, r.granted_via]));
                statuses = Object.fromEntries(ids.map(id => [id, byId[id] ? { unlocked: true, via: byId[id] } : { unlocked: false, via: null }]));
            }
        }

        const [[packRow]] = await db.query(
            `SELECT COALESCE(SUM(ruo.credits_total - ruo.credits_used), 0) AS remaining
             FROM resume_unlock_orders ruo JOIN invoices i ON i.id = ruo.invoice_id
             WHERE ruo.company_id = ? AND ruo.deleted_at IS NULL AND i.status = 'paid'`,
            [company.id]
        );

        res.json({
            success: true,
            platinum,
            pack_credits_remaining: parseInt(packRow?.remaining || 0),
            statuses,
        });
    } catch (err) {
        console.error('[resumeUnlock.status]', err);
        res.status(500).json({ success: false, message: 'Failed to load unlock status.' });
    }
};

// Shared by purchaseUnlock (per-candidate) and buyPack (standalone) — creates
// the invoice + order + Cashfree session for a paid tier. Returns the JSON
// payload to send straight back to the client.
const createUnlockOrder = async (company, userId, tier, candidateId = null) => {
    const { amount, credits } = PRICING[tier];

    const conn = await db.getConnection();
    let invoiceId, invoiceNumber;
    try {
        await conn.beginTransaction();

        invoiceNumber = await nextInvoiceNumber(conn);
        const description = tier === 'single' ? 'Single Resume Unlock' : '4-Resume Pack';
        const [invResult] = await conn.query(
            `INSERT INTO invoices (invoice_number, company_id, candidate_id, raised_by, invoice_type, amount, status, description, due_date)
             VALUES (?, ?, ?, ?, 'resume_unlock', ?, 'pending', ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
            [invoiceNumber, company.id, candidateId, userId, amount, description]
        );
        invoiceId = invResult.insertId;

        await conn.query(
            `INSERT INTO resume_unlock_orders (company_id, invoice_id, order_type, candidate_id, credits_total)
             VALUES (?, ?, ?, ?, ?)`,
            [company.id, invoiceId, tier, candidateId, credits]
        );

        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }

    const orderId = `LC-TXN-${Date.now()}-${invoiceId}`;
    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/^http:\/\//, 'https://');
    const returnUrl = `${frontendBase}/company/talent/unlock-callback?invoiceId=${invoiceId}&txnOrderId=${orderId}`;

    await db.query(
        `INSERT INTO payment_transactions (invoice_id, company_id, amount, payment_method, cashfree_order_id, status)
         VALUES (?, ?, ?, 'cashfree', ?, 'initiated')`,
        [invoiceId, company.id, amount, orderId]
    );

    const cfOrder = await cashfree.createOrder({
        orderId,
        amount,
        customerName: company.company_name,
        customerEmail: company.email,
        customerPhone: company.phone || '9999999999',
        orderNote: `Resume Unlock (${tier === 'single' ? '1 resume' : '4-resume pack'}) — LadderStep Human Consulting`,
        returnUrl,
    }).catch(async (cfErr) => {
        await db.query(`UPDATE payment_transactions SET status = 'failed' WHERE cashfree_order_id = ?`, [orderId]);
        console.error('[Cashfree] createOrder failed:', cfErr.response?.data || cfErr.message);
        throw Object.assign(new Error('Payment gateway unavailable.'), { gatewayError: true });
    });

    return {
        success: true,
        needs_payment: true,
        payment_session_id: cfOrder.payment_session_id,
        order_id: orderId,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        cashfree_env: cashfree.getEnv(),
    };
};

// ── POST /api/companies/talent/:candidateId/unlock ────────────────────────────
// Body: { tier: 'single' | 'pack_4' } — tier is ignored (and unneeded) if the
// company is Platinum, already unlocked, or has a spare pack credit.
exports.purchaseUnlock = async (req, res) => {
    const { candidateId } = req.params;
    const { tier } = req.body;

    try {
        const company = await getCompany(req.user.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

        const [[cand]] = await db.query(
            `SELECT c.id, u.name AS candidate_name FROM candidates c JOIN users u ON u.id = c.user_id
             WHERE c.id = ? AND c.deleted_at IS NULL AND u.status = 'active'`,
            [candidateId]
        );
        if (!cand) return res.status(404).json({ success: false, message: 'Candidate not found or unavailable.' });
        if (await isCandidateHired(parseInt(candidateId))) {
            return res.status(409).json({ success: false, message: 'This candidate is no longer available.' });
        }
        if (await hasPendingOffer(parseInt(candidateId))) {
            return res.status(409).json({ success: false, message: 'This candidate already holds an offer letter and is no longer available.' });
        }

        // Platinum — free, instant
        if (company.placement_fee_percent != null) {
            await grantUnlock(company.id, candidateId, null, 'platinum', req.user.id);
            return res.json({ success: true, unlocked: true, via: 'platinum' });
        }

        // Already unlocked — idempotent no-op
        const existingVia = await isUnlocked(company.id, candidateId, null);
        if (existingVia) return res.json({ success: true, unlocked: true, via: existingVia });

        // Spare pack credit — consume for free
        const creditOrderId = await consumePackCredit(company.id);
        if (creditOrderId) {
            await grantUnlock(company.id, candidateId, creditOrderId, 'pack', req.user.id);
            return res.json({ success: true, unlocked: true, via: 'pack' });
        }

        // Needs payment
        if (!tier || !PRICING[tier]) {
            return res.status(400).json({ success: false, message: 'Select a tier: single or pack_4.' });
        }

        const payload = await createUnlockOrder(company, req.user.id, tier, tier === 'single' ? candidateId : null);
        res.json(payload);
    } catch (err) {
        if (err.gatewayError) return res.status(502).json({ success: false, message: err.message });
        console.error('[resumeUnlock.purchase]', err);
        res.status(500).json({ success: false, message: 'Failed to start unlock purchase.' });
    }
};

// ── POST /api/companies/talent/buy-pack ───────────────────────────────────────
// Standalone credit purchase — no target candidate needed yet. Body: { tier:
// 'single' | 'pack_4' }, defaults to 'pack_4'. This is THE package-selection
// action on the mandatory gate screen and the Company Profile page — a
// 'single' bought here has no candidate_id, so it's just a 1-credit pack,
// spent later via consumePackCredit() exactly like a pack_4 credit.
exports.buyPack = async (req, res) => {
    const tier = req.body?.tier === 'single' ? 'single' : 'pack_4';
    try {
        const company = await getCompany(req.user.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

        if (company.placement_fee_percent != null) {
            return res.status(409).json({ success: false, message: 'You are on Platinum — resume unlocks are already free and unlimited.' });
        }

        const payload = await createUnlockOrder(company, req.user.id, tier);
        res.json(payload);
    } catch (err) {
        if (err.gatewayError) return res.status(502).json({ success: false, message: err.message });
        console.error('[resumeUnlock.buyPack]', err);
        res.status(500).json({ success: false, message: 'Failed to start purchase.' });
    }
};

// ── POST /api/companies/platinum-request ──────────────────────────────────────
// Lightweight interest signal — notifies the assigned executive (or admin if
// none) that the company wants to discuss Platinum pricing. No invoice/order;
// admin sets companies.placement_fee_percent manually once terms are agreed.
exports.requestPlatinum = async (req, res) => {
    const { note } = req.body;
    try {
        const [[company]] = await db.query(
            `SELECT c.id, c.company_name, c.assigned_executive_id FROM companies c
             WHERE c.user_id = ? AND c.deleted_at IS NULL`,
            [req.user.id]
        );
        if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

        let notifyUserId = company.assigned_executive_id;
        if (!notifyUserId) {
            const [[adminRow]] = await db.query(
                `SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id
                 WHERE ro.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1`
            );
            notifyUserId = adminRow?.id;
        }

        if (notifyUserId) {
            await db.query(
                `INSERT INTO notifications (user_id, type, title, body, metadata)
                 VALUES (?, 'platinum_interest', ?, ?, ?)`,
                [notifyUserId,
                 `Platinum Interest — ${company.company_name}`,
                 `${company.company_name} would like to discuss a Platinum (unlimited resume unlock) package.` + (note ? ` Notes: ${note}` : ''),
                 JSON.stringify({ company_id: company.id })]
            );
        }

        res.json({ success: true, message: 'Your interest has been sent to your LadderStep Human Consulting executive.' });
    } catch (err) {
        console.error('[resumeUnlock.requestPlatinum]', err);
        res.status(500).json({ success: false, message: 'Failed to send request.' });
    }
};

// ── POST /api/companies/package-request ──────────────────────────────────────
// Company requests a Single or 4-Pack package (pay-later / offline payment).
// Fires a notification to their executive (or admin). No invoice is created here;
// the admin manually activates the package via POST /api/admin/companies/:id/activate-package.
exports.requestPackage = async (req, res) => {
    const { tier, note } = req.body;
    const TIER_LABELS = { single: 'Single Resume Unlock (₹999)', pack_4: '5-Resume Pack (₹3,999)' };
    if (!TIER_LABELS[tier]) return res.status(400).json({ message: 'tier must be single or pack_4.' });

    try {
        const [[company]] = await db.query(
            `SELECT c.id, c.company_name, c.assigned_executive_id FROM companies c
             WHERE c.user_id = ? AND c.deleted_at IS NULL`,
            [req.user.id]
        );
        if (!company) return res.status(404).json({ message: 'Company not found.' });

        let notifyUserId = company.assigned_executive_id;
        if (!notifyUserId) {
            const [[adminRow]] = await db.query(
                `SELECT u.id FROM users u JOIN roles ro ON ro.id = u.role_id
                 WHERE ro.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1`
            );
            notifyUserId = adminRow?.id;
        }

        if (notifyUserId) {
            await db.query(
                `INSERT INTO notifications (user_id, type, title, body, metadata)
                 VALUES (?, 'package_request', ?, ?, ?)`,
                [notifyUserId,
                 `Package Request — ${company.company_name}`,
                 `${company.company_name} has requested the ${TIER_LABELS[tier]} package (offline payment).` + (note ? ` Note: ${note}` : '') + ` Please activate from Admin → Company Approvals.`,
                 JSON.stringify({ company_id: company.id, tier })]
            );
        }

        res.json({ success: true, message: `Your request for the ${TIER_LABELS[tier]} has been sent. Our team will activate it shortly.` });
    } catch (err) {
        console.error('[resumeUnlock.requestPackage]', err);
        res.status(500).json({ message: 'Failed to send request.' });
    }
};

// ── GET /api/companies/talent/:candidateId/profile ────────────────────────────
// Full profile detail (complete skills w/ proficiency, education, links) — gated.
exports.getFullProfile = async (req, res) => {
    const { candidateId } = req.params;
    try {
        const company = await getCompany(req.user.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

        const via = await isUnlocked(company.id, candidateId, company.placement_fee_percent);
        if (!via) return res.status(403).json({ success: false, message: 'Unlock this candidate first.' });

        const [[profile]] = await db.query(
            `SELECT u.name AS candidate_name, cp.headline, cp.summary, cp.total_experience,
                    cp.current_location, cp.preferred_locations, cp.expected_salary, cp.current_salary,
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
             FROM candidate_skill_vectors csv JOIN skill_tags st ON st.id = csv.skill_tag_id
             WHERE csv.candidate_id = ? ORDER BY csv.years_exp DESC`,
            [candidateId]
        );

        res.json({ success: true, data: { ...profile, skills, unlocked_via: via } });
    } catch (err) {
        console.error('[resumeUnlock.fullProfile]', err);
        res.status(500).json({ success: false, message: 'Failed to load profile.' });
    }
};

// ── GET /api/companies/talent/:candidateId/resume ──────────────────────────────
// Single/pack unlocks (prepaid per-resume) get the ACTUAL original file — the
// company already paid for this specific candidate, so there's no fee-collection
// reason to redact it. Platinum unlocks (free, unlimited, %-of-CTC-at-hire) keep
// getting the masked/parsed version — Ladder still needs to control the
// interview/offer pipeline to collect that fee, so contact info stays out.
exports.downloadUnlockedResume = async (req, res) => {
    const { candidateId } = req.params;
    try {
        const company = await getCompany(req.user.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

        const via = await isUnlocked(company.id, candidateId, company.placement_fee_percent);
        if (!via) return res.status(403).json({ success: false, message: 'Unlock this candidate first.' });

        const [[resume]] = await db.query(
            `SELECT r.file_key, r.file_name, u.name AS candidate_name
             FROM resumes r JOIN candidates c ON c.id = r.candidate_id JOIN users u ON u.id = c.user_id
             WHERE r.candidate_id = ? AND r.deleted_at IS NULL
             ORDER BY r.is_primary DESC, r.created_at DESC LIMIT 1`,
            [candidateId]
        );
        if (!resume) return res.status(404).json({ success: false, message: 'No resume on file.' });

        const absolutePath = path.join(process.cwd(), resume.file_key);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ success: false, message: 'Resume file not found on server.' });
        }

        logAction(req.user.id, 'company_unlocked_resume_download', 'candidate', candidateId,
            { company_id: company.id, company_name: company.company_name, via,
              actual_file: via !== 'platinum' }, ip(req));

        if (via === 'platinum') {
            const { getMaskedResumePath } = require('../services/maskedResumeGenerator');
            const maskedPath = await getMaskedResumePath(absolutePath, resume.candidate_name, candidateId);
            res.setHeader('X-Resume-Note', 'Contact information has been redacted by LadderStep Human Consulting');
            return res.download(maskedPath, 'candidate_resume_masked.pdf');
        }

        res.download(absolutePath, resume.file_name || 'candidate_resume.pdf');
    } catch (err) {
        console.error('[resumeUnlock.download]', err);
        res.status(500).json({ success: false, message: 'Failed to generate resume.' });
    }
};

// ── POST /api/companies/talent/:candidateId/apply ─────────────────────────────
// Moves an already-unlocked (single/pack) candidate into the company's own
// hiring pipeline by creating an application against one of their job postings.
// Feeds the EXISTING shortlist → interview-request → offer-request flow
// unchanged — executive approval still applies at every step, same as any
// other application. The only downstream difference is the placement fee gets
// waived at offer-approval time, since this company already paid at unlock.
// Platinum-only candidates aren't offered this — they stay on the existing
// Express Interest → executive-assigns path.
exports.applyToPipeline = async (req, res) => {
    const { candidateId } = req.params;
    const { job_id } = req.body;

    try {
        const company = await getCompany(req.user.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });
        if (!job_id) return res.status(400).json({ success: false, message: 'job_id is required.' });

        const [[grant]] = await db.query(
            `SELECT granted_via FROM resume_unlocks WHERE company_id = ? AND candidate_id = ?`,
            [company.id, candidateId]
        );
        if (!grant || !['single', 'pack'].includes(grant.granted_via)) {
            return res.status(403).json({ success: false, message: 'Unlock this candidate via Single or 5-Pack first.' });
        }

        const [[job]] = await db.query(
            `SELECT id, title FROM job_postings WHERE id = ? AND company_id = ? AND status = 'active' AND deleted_at IS NULL`,
            [job_id, company.id]
        );
        if (!job) return res.status(404).json({ success: false, message: 'Job posting not found or not active.' });

        if (await isCandidateHired(parseInt(candidateId))) {
            return res.status(409).json({ success: false, message: 'This candidate is no longer available.' });
        }
        if (await hasPendingOffer(parseInt(candidateId))) {
            return res.status(409).json({ success: false, message: 'This candidate already holds an offer letter and is no longer available.' });
        }

        const [[resume]] = await db.query(
            `SELECT id FROM resumes WHERE candidate_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
            [candidateId]
        );
        if (!resume) return res.status(400).json({ success: false, message: 'This candidate has no resume on file.' });

        let applicationId;
        try {
            const [result] = await db.query(
                `INSERT INTO applications (candidate_id, job_id, resume_id, status, source, sourced_by)
                 VALUES (?, ?, ?, 'applied', 'company', ?)`,
                [candidateId, job_id, resume.id, req.user.id]
            );
            applicationId = result.insertId;
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'This candidate already has an application for this job.' });
            }
            throw err;
        }

        setImmediate(async () => {
            try { await matchingService.calculateMatchScore(applicationId); }
            catch (e) { console.error('[applyToPipeline] matchScore:', e.message); }
        });

        logAction(req.user.id, 'company_applied_unlocked_candidate', 'application', applicationId,
            { company_id: company.id, candidate_id: parseInt(candidateId), job_id: parseInt(job_id), via: grant.granted_via }, ip(req));

        res.status(201).json({
            success: true,
            message: `Candidate added to your pipeline for "${job.title}".`,
            application_id: applicationId,
        });
    } catch (err) {
        console.error('[resumeUnlock.applyToPipeline]', err);
        res.status(500).json({ success: false, message: 'Failed to add candidate to pipeline.' });
    }
};

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { getInsight, requestInsight } = require('../services/matchInsight');
const { getCompanyAccess } = require('../utils/companyAccess');

const DAILY_LIMIT_PER_COMPANY = 30; // each note holds the shared model for up to a minute

router.use(authenticateToken, authorizeRole('company', 'hr_staff', 'admin'));

// May this user look at how a candidate fits this job? Returns the job's company id, or null.
async function jobCompanyIfAllowed(user, jobId) {
    const [[job]] = await db.query(
        `SELECT jp.id, jp.company_id, c.user_id AS company_user_id, c.assigned_executive_id
         FROM job_postings jp JOIN companies c ON c.id = jp.company_id
         WHERE jp.id = ? AND jp.deleted_at IS NULL AND c.deleted_at IS NULL`, [jobId]
    );
    if (!job) return null;
    if (user.role === 'admin') return job.company_id;
    if (user.role === 'company') return job.company_user_id === user.id ? job.company_id : null;
    return job.assigned_executive_id === user.id ? job.company_id : null; // hr_staff
}

async function parseIds(req) {
    const src = req.method === 'GET' ? req.query : req.body;
    const jobId = parseInt(src.jobId, 10);
    const candidateId = parseInt(src.candidateId, 10);
    if (!jobId || !candidateId) return { error: 'jobId and candidateId are required.' };
    const companyId = await jobCompanyIfAllowed(req.user, jobId);
    if (!companyId) return { error: 'Job not found.', status: 404 };
    // Match percentages are withheld until a company has a live paid job (or Platinum); the
    // written note would give the same information away, so it follows the same rule.
    if (req.user.role === 'company' && !(await getCompanyAccess(companyId)).activated) {
        return { error: 'Post a job (or go Platinum) to see how candidates fit.', status: 403 };
    }
    const [[cand]] = await db.query('SELECT id FROM candidates WHERE id = ? AND deleted_at IS NULL', [candidateId]);
    if (!cand) return { error: 'Candidate not found.', status: 404 };
    return { jobId, candidateId, companyId };
}

// GET /api/match-insights?jobId=&candidateId=  -> { status: ready|pending|failed|none, note? }
router.get('/', async (req, res) => {
    try {
        const ids = await parseIds(req);
        if (ids.error) return res.status(ids.status || 400).json({ success: false, message: ids.error });
        res.json({ success: true, data: await getInsight(ids.jobId, ids.candidateId) });
    } catch (err) {
        console.error('[match-insights.get]', err.message);
        res.status(500).json({ success: false, message: 'Could not load the note.' });
    }
});

// POST /api/match-insights  { jobId, candidateId }  -> starts (or reuses) a note; poll GET for it.
router.post('/', async (req, res) => {
    try {
        const ids = await parseIds(req);
        if (ids.error) return res.status(ids.status || 400).json({ success: false, message: ids.error });

        const [[used]] = await db.query(
            `SELECT COUNT(*) AS n FROM match_insights mi
             JOIN job_postings jp ON jp.id = mi.job_id
             WHERE jp.company_id = ? AND mi.created_at >= UTC_DATE()`, [ids.companyId]
        );
        const existing = await getInsight(ids.jobId, ids.candidateId);
        if (existing.status !== 'ready' && Number(used.n) >= DAILY_LIMIT_PER_COMPANY) {
            return res.status(429).json({ success: false, message: 'Daily limit for AI fit notes reached. Try again tomorrow.' });
        }
        res.json({ success: true, data: await requestInsight(ids.jobId, ids.candidateId) });
    } catch (err) {
        console.error('[match-insights.post]', err.message);
        res.status(500).json({ success: false, message: 'Could not start the note.' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const jobCtrl = require('../controllers/jobController');

// ── Candidate: matched jobs ───────────────────────────────────────────────────
router.get('/matched', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        // Resolve candidate_id for this user
        const [candRows] = await db.query('SELECT id FROM candidates WHERE user_id=?', [userId]);
        const candidateId = candRows[0]?.id || null;

        const [jobs] = await db.query(
            `SELECT
               jp.id, jp.title, jp.description, jp.location, jp.job_type,
               jp.salary_min, jp.salary_max, jp.experience_min, jp.experience_max,
               jp.work_mode, jp.openings, jp.deadline,
               c.company_name, c.headquarters AS company_location,
               jp.created_at,
               COALESCE(mr.fit_score, 0)      AS match_score,
               (mr.id IS NOT NULL)             AS match_computed,
               mr.matched_skills, mr.missing_skills,
               (SELECT COUNT(*) FROM applications a
                WHERE a.job_id=jp.id AND a.candidate_id=? AND a.deleted_at IS NULL) AS already_applied
             FROM job_postings jp
             JOIN companies c ON c.id = jp.company_id
             LEFT JOIN applications app_link
               ON app_link.job_id=jp.id AND app_link.candidate_id=? AND app_link.deleted_at IS NULL
             LEFT JOIN match_results mr ON mr.application_id = app_link.id
             WHERE jp.status='active' AND jp.deleted_at IS NULL
             ORDER BY match_score DESC, jp.created_at DESC
             LIMIT ? OFFSET ?`,
            [candidateId, candidateId, limit, offset]
        );

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM job_postings WHERE status='active' AND deleted_at IS NULL`
        );

        res.json({ jobs, pagination: { page, limit, total } });
    } catch (err) {
        console.error('matched jobs error:', err);
        res.status(500).json({ error: 'Failed to fetch matched jobs' });
    }
});

// ── Company: job CRUD ─────────────────────────────────────────────────────────
router.get('/',    authenticateToken, authorizeRole('company'), jobCtrl.listCompanyJobs);
router.post('/',   authenticateToken, authorizeRole('company'), jobCtrl.createJob);
router.get('/:id', authenticateToken, authorizeRole('company'), jobCtrl.getJob);
router.put('/:id', authenticateToken, authorizeRole('company'), jobCtrl.updateJob);
router.patch('/:id/status', authenticateToken, authorizeRole('company'), jobCtrl.setJobStatus);
router.delete('/:id', authenticateToken, authorizeRole('company'), jobCtrl.deleteJob);

// ── Company: application management per job ───────────────────────────────────
router.get('/:jobId/applications',
    authenticateToken, authorizeRole('company'), jobCtrl.getJobApplications);

router.post('/:jobId/applications/:appId/shortlist',
    authenticateToken, authorizeRole('company'), jobCtrl.shortlistApplication);

router.delete('/:jobId/applications/:appId/shortlist',
    authenticateToken, authorizeRole('company'), jobCtrl.removeShortlist);

router.patch('/:jobId/applications/:appId/status',
    authenticateToken, authorizeRole('company'), jobCtrl.updateApplicationStatus);

module.exports = router;

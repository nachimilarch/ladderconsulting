const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const jobCtrl = require('../controllers/jobController');

// ── Candidate: matched jobs ───────────────────────────────────────────────────
router.get('/matched', authenticateToken, authorizeRole('candidate'), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        // Resolve candidate_id for this user
        const [candRows] = await db.query('SELECT id FROM candidates WHERE user_id=?', [req.user.id]);
        const candidateId = candRows[0]?.id || null;

        const result = await jobCtrl.getMatchedJobsForCandidate(candidateId, { page, limit });
        res.json(result);
    } catch (err) {
        console.error('matched jobs error:', err);
        res.status(500).json({ error: 'Failed to fetch matched jobs' });
    }
});

// ── HR / Admin: post a job on behalf of a company ────────────────────────────
router.post('/for-company', authenticateToken, authorizeRole('hr_staff', 'admin'), jobCtrl.createJobForCompany);

// ── Company: job CRUD ─────────────────────────────────────────────────────────
router.get('/',    authenticateToken, authorizeRole('company'), jobCtrl.listCompanyJobs);
router.post('/',   authenticateToken, authorizeRole('company'), jobCtrl.createJob);
router.get('/:id', authenticateToken, authorizeRole('company'), jobCtrl.getJob);
router.put('/:id', authenticateToken, authorizeRole('company'), jobCtrl.updateJob);
router.patch('/:id/status', authenticateToken, authorizeRole('company'), jobCtrl.setJobStatus);
router.post('/:id/pay', authenticateToken, authorizeRole('company'), jobCtrl.payForJobPosting);
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

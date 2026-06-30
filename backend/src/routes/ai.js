const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const matching = require('../services/matchingService');

// ── POST /api/ai/parse-resume/:candidateId ────────────────────────────────────
// Manually re-trigger resume parsing + matching (admin / hr_staff)
router.post('/parse-resume/:candidateId',
    authenticateToken, authorizeRole('admin', 'hr_staff'),
    async (req, res) => {
        const candidateId = parseInt(req.params.candidateId);
        try {
            const [[candRow]] = await db.query(
                'SELECT user_id FROM candidates WHERE id = ?', [candidateId]
            );
            if (!candRow) return res.status(404).json({ message: 'Candidate not found.' });

            const [rows] = await db.query(
                `SELECT raw_text FROM resumes
                 WHERE user_id = ? AND deleted_at IS NULL
                 ORDER BY created_at DESC LIMIT 1`,
                [candRow.user_id]
            );
            if (!rows.length || !rows[0].raw_text) {
                return res.status(400).json({
                    message: 'No parsed resume text on file. Candidate must upload a resume first.',
                });
            }

            await matching.triggerCandidateMatching(candidateId, rows[0].raw_text);
            res.json({ message: 'Resume re-parsed and match scores updated.' });
        } catch (err) {
            console.error('parse-resume error:', err);
            res.status(500).json({ message: 'Matching failed.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
        }
    }
);

// ── POST /api/ai/match-job/:jobId ─────────────────────────────────────────────
// Manually re-trigger JD parsing + matching for all applicants (admin / hr_staff)
router.post('/match-job/:jobId',
    authenticateToken, authorizeRole('admin', 'hr_staff'),
    async (req, res) => {
        const jobId = parseInt(req.params.jobId);
        try {
            const [[job]] = await db.query(
                'SELECT description, requirements FROM job_postings WHERE id = ? AND deleted_at IS NULL',
                [jobId]
            );
            if (!job) return res.status(404).json({ message: 'Job not found.' });

            const jdText = `${job.description || ''}\n\n${job.requirements || ''}`;
            await matching.triggerJobMatching(jobId, jdText);
            res.json({ message: 'Job re-parsed and all applicant scores updated.' });
        } catch (err) {
            console.error('match-job error:', err);
            res.status(500).json({ message: 'Matching failed.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
        }
    }
);

// ── GET /api/ai/match-results/job/:jobId ──────────────────────────────────────
// Ranked candidates with scores for a job (company / admin / hr_staff)
// Must be declared BEFORE /:candidateId to avoid "job" matching as a candidateId
router.get('/match-results/job/:jobId',
    authenticateToken, authorizeRole('company', 'admin', 'hr_staff'),
    async (req, res) => {
        try {
            const [results] = await db.query(
                `SELECT mr.fit_score, mr.matched_skills, mr.missing_skills,
                        mr.ai_summary, mr.computed_at,
                        u.name AS candidate_name, u.email AS candidate_email,
                        a.id AS application_id, a.status AS application_status
                 FROM match_results mr
                 JOIN applications a ON a.id = mr.application_id
                 JOIN candidates c ON c.id = a.candidate_id
                 JOIN users u ON u.id = c.user_id
                 WHERE a.job_id = ? AND a.deleted_at IS NULL
                 ORDER BY mr.fit_score DESC`,
                [req.params.jobId]
            );
            res.json({ results });
        } catch (err) {
            console.error('match-results/job error:', err);
            res.status(500).json({ message: 'Failed to fetch match results.' });
        }
    }
);

// ── GET /api/ai/match-results/:candidateId ────────────────────────────────────
// All match scores for a candidate across their applications (candidate / admin / hr_staff)
router.get('/match-results/:candidateId',
    authenticateToken, authorizeRole('candidate', 'admin', 'hr_staff'),
    async (req, res) => {
        // Candidates may only view their own results
        if (req.user.role === 'candidate') {
            const [[candRow]] = await db.query(
                'SELECT id FROM candidates WHERE user_id = ?', [req.user.id]
            );
            if (!candRow || String(candRow.id) !== req.params.candidateId) {
                return res.status(403).json({ message: 'Access denied.' });
            }
        }

        try {
            const [results] = await db.query(
                `SELECT mr.fit_score, mr.matched_skills, mr.missing_skills,
                        mr.ai_summary, mr.computed_at,
                        jp.id AS job_id, jp.title AS job_title,
                        c.company_name
                 FROM match_results mr
                 JOIN applications a ON a.id = mr.application_id
                 JOIN job_postings jp ON jp.id = a.job_id
                 JOIN companies c ON c.id = jp.company_id
                 WHERE a.candidate_id = ? AND a.deleted_at IS NULL
                 ORDER BY mr.fit_score DESC`,
                [req.params.candidateId]
            );
            res.json({ results });
        } catch (err) {
            console.error('match-results error:', err);
            res.status(500).json({ message: 'Failed to fetch match results.' });
        }
    }
);

// ── POST /api/ai/rejection-feedback ──────────────────────────────────────────
// Log structured rejection reason for the feedback loop (company / admin / hr_staff)
router.post('/rejection-feedback',
    authenticateToken, authorizeRole('company', 'admin', 'hr_staff'),
    async (req, res) => {
        const { application_id, reason_code, reason_text } = req.body;
        if (!application_id) {
            return res.status(400).json({ message: 'application_id is required.' });
        }

        try {
            await db.query(
                `INSERT INTO rejection_feedback (application_id, rejected_by, reason_code, reason_text)
                 VALUES (?, ?, ?, ?)`,
                [application_id, req.user.id, reason_code || null, reason_text || null]
            );
            res.status(201).json({ message: 'Rejection feedback saved.' });
        } catch (err) {
            console.error('rejection-feedback error:', err);
            res.status(500).json({ message: 'Failed to save feedback.' });
        }
    }
);

module.exports = router;

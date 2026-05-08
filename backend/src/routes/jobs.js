const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/jobs/matched — jobs ranked by match score for logged-in candidate
router.get('/matched', authenticate, authorize('candidate'), async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        // Pull pre-computed match scores from match_results (populated by AI engine)
        const [jobs] = await db.query(`
      SELECT
        jp.id, jp.title, jp.description, jp.location, jp.job_type,
        jp.salary_min, jp.salary_max, jp.skills_required,
        c.name AS company_name, c.logo_url,
        COALESCE(mr.fit_score, 0) AS match_score,
        mr.matched_skills, mr.missing_skills,
        jp.created_at,
        (SELECT COUNT(*) FROM applications a WHERE a.job_id = jp.id AND a.user_id = ?) AS already_applied
      FROM job_postings jp
      JOIN companies c ON c.id = jp.company_id
      LEFT JOIN match_results mr ON mr.job_id = jp.id AND mr.candidate_id = ?
      WHERE jp.status = 'active'
      ORDER BY match_score DESC, jp.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, userId, limit, offset]);

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total FROM job_postings WHERE status = 'active'`
        );

        res.json({
            jobs,
            pagination: { page, limit, total: countRows[0].total },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch matched jobs' });
    }
});

module.exports = router;
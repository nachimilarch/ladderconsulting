const db = require('../config/db');
const matchingService = require('../services/matchingService');
const { isCandidateHired } = require('./candidateStatus');

// Shared by POST /api/candidates/applications/:jobId (routes/candidates.js) and
// the chatbot's confirmed apply_to_job action (chatbotTools.js) — identical
// validation and insert either way. Throws an Error with .status set for
// expected failures so callers can translate it.
const applyToJob = async (userId, jobId, coverLetter) => {
    const [[candRow]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [userId]);
    const candidateId = candRow?.id;
    if (!candidateId) throw Object.assign(new Error('Candidate account not found.'), { status: 404 });

    // Once hired through Ladder, a candidate is off the market for new roles
    if (await isCandidateHired(candidateId)) {
        throw Object.assign(
            new Error('You have already been hired through LadderStep Human Consulting and can no longer apply to new roles.'),
            { status: 403 }
        );
    }

    const [[resumeRow]] = await db.query(
        `SELECT id FROM resumes WHERE candidate_id = ? AND deleted_at IS NULL
         ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
        [candidateId]
    );
    if (!resumeRow) {
        throw Object.assign(new Error('Please upload a resume before applying.'), { status: 400 });
    }

    const [[jobRow]] = await db.query(
        "SELECT id FROM job_postings WHERE id = ? AND status = 'active' AND deleted_at IS NULL",
        [jobId]
    );
    if (!jobRow) {
        throw Object.assign(new Error('Job not found or no longer active.'), { status: 404 });
    }

    let applicationId;
    try {
        const [result] = await db.query(
            `INSERT INTO applications (candidate_id, job_id, resume_id, cover_letter) VALUES (?, ?, ?, ?)`,
            [candidateId, jobId, resumeRow.id, coverLetter || null]
        );
        applicationId = result.insertId;
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw Object.assign(new Error('You have already applied to this job.'), { status: 409 });
        }
        throw err;
    }

    setImmediate(() =>
        matchingService.calculateMatchScore(applicationId)
            .catch(err => console.error('[AI match]', err.message))
    );

    return applicationId;
};

module.exports = { applyToJob };

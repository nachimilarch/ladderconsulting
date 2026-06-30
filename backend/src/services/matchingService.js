const db = require('../config/db');
const { extractSkills, extractJobSkills } = require('../utils/resumeParser');
const { upsertCandidateSkills, replaceJobSkills } = require('../utils/skillTags');

// Label stored in match_results.model_version (no external model in use)
const getModel = () => 'local-parser-v1';

// ── Resolve skill_tag ids → names ─────────────────────────────────────────────
async function idsToNames(ids) {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(`SELECT name FROM skill_tags WHERE id IN (${placeholders})`, ids);
    return rows.map(r => r.name);
}

// ── 1. Parse resume text → candidate_skill_vectors ───────────────────────────
// Offline: skills come from the heuristic dictionary in resumeParser, then a
// single batched upsert (was an N+1 of 3 queries/skill). The match scorer only
// uses skill presence, so proficiency/years default safely.
async function parseResumeToSkills(candidateId, resumeText) {
    const skillNames = extractSkills(resumeText || '');
    return upsertCandidateSkills(candidateId, skillNames, 'resume_parsed');
}

// ── 2. Parse job description → job_skill_vectors ─────────────────────────────
// Offline: required vs preferred is inferred from "nice to have" cues in the JD,
// then replaced in a single batched DELETE + multi-row INSERT.
async function parseJobToSkills(jobId, jdText) {
    const { required, preferred } = extractJobSkills(jdText || '');
    return replaceJobSkills(jobId, required, preferred);
}

// ── 3. Compute and persist match score for a single application ───────────────
async function calculateMatchScore(applicationId) {
    const [[app]] = await db.query(
        `SELECT a.candidate_id, a.job_id,
                jp.experience_min, jp.experience_max,
                cp.total_experience, cp.education
         FROM applications a
         JOIN job_postings jp ON jp.id = a.job_id
         JOIN candidates c ON c.id = a.candidate_id
         LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
         WHERE a.id = ? AND a.deleted_at IS NULL`,
        [applicationId]
    );
    if (!app) return null;

    const [jobSkills] = await db.query(
        'SELECT skill_tag_id, is_mandatory FROM job_skill_vectors WHERE job_id = ?',
        [app.job_id]
    );
    const [candidateSkills] = await db.query(
        'SELECT skill_tag_id FROM candidate_skill_vectors WHERE candidate_id = ?',
        [app.candidate_id]
    );

    // Vectors not ready yet — skip silently
    if (jobSkills.length === 0 || candidateSkills.length === 0) return null;

    const candidateSet = new Set(candidateSkills.map(s => s.skill_tag_id));
    const mandatory = jobSkills.filter(s => s.is_mandatory);
    const optional  = jobSkills.filter(s => !s.is_mandatory);

    const matchedMandatory = mandatory.filter(s => candidateSet.has(s.skill_tag_id));
    const missingMandatory = mandatory.filter(s => !candidateSet.has(s.skill_tag_id));
    const matchedOptional  = optional.filter(s => candidateSet.has(s.skill_tag_id));

    // Required skills: 60%
    const skillScore = mandatory.length > 0
        ? (matchedMandatory.length / mandatory.length) * 60
        : 30; // Partial credit when no mandatory skills defined

    // Experience: 25%
    const exp    = parseFloat(app.total_experience) || 0;
    const expMin = parseFloat(app.experience_min) || 0;
    const experienceScore = expMin === 0 ? 25 : Math.min(25, (exp / expMin) * 25);

    // Education: 15% — stored in candidate_profiles.education as a JSON array
    let eduCnt = 0;
    try {
        const edu = app.education
            ? (typeof app.education === 'string' ? JSON.parse(app.education) : app.education)
            : [];
        eduCnt = Array.isArray(edu) ? edu.length : 0;
    } catch (_) {}
    const educationScore = eduCnt > 0 ? 15 : 0;

    const totalScore = Math.min(100, Math.round(skillScore + experienceScore + educationScore));

    const matchedIds = [
        ...matchedMandatory.map(s => s.skill_tag_id),
        ...matchedOptional.map(s => s.skill_tag_id),
    ];
    const missingIds = missingMandatory.map(s => s.skill_tag_id);

    const matchedNames = await idsToNames(matchedIds);
    const missingNames = await idsToNames(missingIds);

    const summary = `${totalScore}% fit — matched ${matchedNames.length} of ${jobSkills.length} skills.`;

    await db.query(
        `INSERT INTO match_results
             (application_id, fit_score, matched_skills, missing_skills, ai_summary, model_version, computed_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
             fit_score      = VALUES(fit_score),
             matched_skills = VALUES(matched_skills),
             missing_skills = VALUES(missing_skills),
             ai_summary     = VALUES(ai_summary),
             model_version  = VALUES(model_version),
             computed_at    = NOW()`,
        [applicationId, totalScore, JSON.stringify(matchedNames), JSON.stringify(missingNames),
         summary, getModel()]
    );

    return { score: totalScore, matched_skills: matchedNames, missing_skills: missingNames };
}

// ── 4. After resume upload: parse vectors + score all active applications ─────
async function triggerCandidateMatching(candidateId, resumeText) {
    await parseResumeToSkills(candidateId, resumeText);

    const [apps] = await db.query(
        `SELECT a.id FROM applications a
         JOIN job_postings jp ON jp.id = a.job_id
         WHERE a.candidate_id = ? AND a.deleted_at IS NULL
           AND jp.status = 'active' AND jp.deleted_at IS NULL`,
        [candidateId]
    );

    for (const app of apps) {
        try {
            await calculateMatchScore(app.id);
        } catch (err) {
            console.error(`[AI] Score failed for application ${app.id}:`, err.message);
        }
    }
}

// ── 5. After job create/update: parse vectors + score all applicants ──────────
async function triggerJobMatching(jobId, jdText) {
    // AI extraction: deletes old vectors and replaces with AI-extracted ones.
    // If this fails (e.g. no API key), keyword vectors placed by jobController remain.
    try {
        await parseJobToSkills(jobId, jdText);
    } catch (err) {
        console.error(`[AI] parseJobToSkills failed for job ${jobId}:`, err.message);
    }

    // Always score existing applicants regardless of whether AI extraction succeeded
    const [apps] = await db.query(
        'SELECT id FROM applications WHERE job_id = ? AND deleted_at IS NULL',
        [jobId]
    );

    for (const app of apps) {
        try {
            await calculateMatchScore(app.id);
        } catch (err) {
            console.error(`[Match] Score failed for application ${app.id}:`, err.message);
        }
    }
}

module.exports = {
    parseResumeToSkills,
    parseJobToSkills,
    calculateMatchScore,
    triggerCandidateMatching,
    triggerJobMatching,
};

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

// ── Pure scoring math (shared by the persisted scorer and the live pool scorer) ─
// Weighting: required skills 60% · experience 25% · education 15%.
function scoreVectors(jobSkills, candidateSet, exp, expMin, eduCnt) {
    const mandatory = jobSkills.filter(s => s.is_mandatory);
    const optional  = jobSkills.filter(s => !s.is_mandatory);

    const matchedMandatory = mandatory.filter(s => candidateSet.has(s.skill_tag_id));
    const missingMandatory = mandatory.filter(s => !candidateSet.has(s.skill_tag_id));
    const matchedOptional  = optional.filter(s => candidateSet.has(s.skill_tag_id));

    const skillScore = mandatory.length > 0
        ? (matchedMandatory.length / mandatory.length) * 60
        : 30; // partial credit when no mandatory skills defined
    const experienceScore = expMin === 0 ? 25 : Math.min(25, (exp / expMin) * 25);
    const educationScore  = eduCnt > 0 ? 15 : 0;

    return {
        score: Math.min(100, Math.round(skillScore + experienceScore + educationScore)),
        matchedIds: [
            ...matchedMandatory.map(s => s.skill_tag_id),
            ...matchedOptional.map(s => s.skill_tag_id),
        ],
        missingIds: missingMandatory.map(s => s.skill_tag_id),
        jobSkillCount: jobSkills.length,
    };
}

const parseEduCount = (education) => {
    try {
        const edu = education
            ? (typeof education === 'string' ? JSON.parse(education) : education)
            : [];
        return Array.isArray(edu) ? edu.length : 0;
    } catch { return 0; }
};

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
    const exp    = parseFloat(app.total_experience) || 0;
    const expMin = parseFloat(app.experience_min) || 0;
    const eduCnt = parseEduCount(app.education);

    const { score: totalScore, matchedIds, missingIds } =
        scoreVectors(jobSkills, candidateSet, exp, expMin, eduCnt);

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

// ── 6. Live (non-persisted) scoring of many pool candidates against one job ────
// Used by the Talent Pool (company + executive) so a match % can be shown for a
// selected JD even for candidates who have not applied. Fully batched: one query
// for the job's skill vectors, one for every candidate's profile, one for every
// candidate's skill vectors, one to resolve skill names. Returns
//   Map<candidateId, { score, matched_skills, missing_skills } | null>
// (null = candidate has no parsed skills yet, so no meaningful score).
async function scorePoolAgainstJob(jobId, candidateIds) {
    const out = new Map();
    const ids = [...new Set((candidateIds || []).map(Number).filter(Boolean))];
    if (!jobId || ids.length === 0) return out;

    const [jobSkills] = await db.query(
        'SELECT skill_tag_id, is_mandatory FROM job_skill_vectors WHERE job_id = ?', [jobId]
    );
    if (jobSkills.length === 0) return out; // JD has no skill vectors → cannot score

    const [[job]] = await db.query('SELECT experience_min FROM job_postings WHERE id = ?', [jobId]);
    const expMin = parseFloat(job?.experience_min) || 0;

    const ph = ids.map(() => '?').join(',');
    const [profiles] = await db.query(
        `SELECT candidate_id, total_experience, education FROM candidate_profiles WHERE candidate_id IN (${ph})`, ids
    );
    const profById = new Map(profiles.map(p => [p.candidate_id, p]));

    const [vecs] = await db.query(
        `SELECT candidate_id, skill_tag_id FROM candidate_skill_vectors WHERE candidate_id IN (${ph})`, ids
    );
    const skillsById = new Map();
    for (const v of vecs) {
        if (!skillsById.has(v.candidate_id)) skillsById.set(v.candidate_id, new Set());
        skillsById.get(v.candidate_id).add(v.skill_tag_id);
    }

    const allSkillIds = new Set();
    const prelim = [];
    for (const id of ids) {
        const set = skillsById.get(id);
        if (!set || set.size === 0) { out.set(id, null); continue; }
        const prof = profById.get(id) || {};
        const r = scoreVectors(jobSkills, set, parseFloat(prof.total_experience) || 0, expMin, parseEduCount(prof.education));
        r.matchedIds.forEach(i => allSkillIds.add(i));
        r.missingIds.forEach(i => allSkillIds.add(i));
        prelim.push({ id, r });
    }

    const nameById = new Map();
    if (allSkillIds.size) {
        const idArr = [...allSkillIds];
        const ph2 = idArr.map(() => '?').join(',');
        const [names] = await db.query(`SELECT id, name FROM skill_tags WHERE id IN (${ph2})`, idArr);
        for (const n of names) nameById.set(n.id, n.name);
    }
    for (const { id, r } of prelim) {
        out.set(id, {
            score: r.score,
            matched_skills: r.matchedIds.map(i => nameById.get(i)).filter(Boolean),
            missing_skills: r.missingIds.map(i => nameById.get(i)).filter(Boolean),
        });
    }
    return out;
}

module.exports = {
    parseResumeToSkills,
    parseJobToSkills,
    calculateMatchScore,
    triggerCandidateMatching,
    triggerJobMatching,
    scorePoolAgainstJob,
};

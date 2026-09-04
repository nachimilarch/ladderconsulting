const db = require('../config/db');
const { extractSkills, extractJobSkills, extractSeniority } = require('../utils/resumeParser');
const { upsertCandidateSkills, replaceJobSkills } = require('../utils/skillTags');

// Label stored in match_results.model_version
const getModel = () => 'local-parser-v3';

// ── Resolve skill_tag ids → names ─────────────────────────────────────────────
async function idsToNames(ids) {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(`SELECT name FROM skill_tags WHERE id IN (${placeholders})`, ids);
    return rows.map(r => r.name);
}

// ── 1. Parse resume text → candidate_skill_vectors ───────────────────────────
async function parseResumeToSkills(candidateId, resumeText) {
    const skillNames = extractSkills(resumeText || '');
    return upsertCandidateSkills(candidateId, skillNames, 'resume_parsed');
}

// ── 2. Parse job description → job_skill_vectors ─────────────────────────────
async function parseJobToSkills(jobId, jdText) {
    const { required, preferred } = extractJobSkills(jdText || '');
    return replaceJobSkills(jobId, required, preferred);
}

// ── Experience range scoring (0 → weight) ─────────────────────────────────────
// Rewards candidates who fall inside the JD's min–max band.
// Under-qualified: scales linearly from 0 to weight as exp → expMin.
// Over-qualified: gradual degradation (6% penalty per year over max, capped at 50%).
function calcExpScore(exp, expMin, expMax, weight) {
    const min = parseFloat(expMin) || 0;
    const max = parseFloat(expMax) || 0;
    if (min === 0 && max === 0) return weight;
    const effectiveMax = max > 0 ? max : min + 5;
    if (exp >= min && exp <= effectiveMax) return weight;
    if (exp > effectiveMax) {
        const overshoot = exp - effectiveMax;
        const factor = Math.max(0.5, 1 - overshoot * 0.06);
        return Math.round(weight * factor);
    }
    if (min === 0) return weight;
    return Math.min(weight, Math.round((exp / min) * weight));
}

// ── Seniority level scoring (0 → weight) ─────────────────────────────────────
// Compares the seniority tier inferred from the JD title vs the candidate's
// headline/most-recent title. A 10-year veteran applying to a fresh "Executive"
// role loses points here rather than scoring a full 10%.
function calcSeniorityScore(jobLevel, candidateLevel, weight) {
    const diff = Math.abs(jobLevel - candidateLevel);
    if (diff === 0) return weight;
    if (diff === 1) return Math.round(weight * 0.7);
    if (diff === 2) return Math.round(weight * 0.3);
    return 0;
}

// ── Pure scoring math ─────────────────────────────────────────────────────────
// Weights (v3): mandatory skills 55% · preferred bonus 10% · experience 20%
//               seniority 10% · education 15%. Capped at 100.
function scoreVectors(jobSkills, candidateSet, opts = {}) {
    const { exp = 0, expMin = 0, expMax = 0, eduCnt = 0, jobSeniority = 1, candidateSeniority = 1 } = opts;

    const mandatory = jobSkills.filter(s => s.is_mandatory);
    const optional  = jobSkills.filter(s => !s.is_mandatory);
    const matchedMandatory = mandatory.filter(s => candidateSet.has(s.skill_tag_id));
    const missingMandatory = mandatory.filter(s => !candidateSet.has(s.skill_tag_id));
    const matchedOptional  = optional.filter(s => candidateSet.has(s.skill_tag_id));

    let skillScore;
    if (mandatory.length > 0) {
        skillScore = (matchedMandatory.length / mandatory.length) * 55;
    } else if (optional.length > 0) {
        skillScore = 25 + Math.round((matchedOptional.length / optional.length) * 20);
    } else {
        skillScore = 35;
    }

    const optionalBonus = mandatory.length > 0 && optional.length > 0
        ? Math.round((matchedOptional.length / optional.length) * 10)
        : 0;

    const expScore       = calcExpScore(exp, expMin, expMax, 20);
    const seniorityScore = calcSeniorityScore(jobSeniority, candidateSeniority, 10);
    const educationScore = eduCnt > 0 ? 15 : 0;

    return {
        score: Math.min(100, Math.round(skillScore + optionalBonus + expScore + seniorityScore + educationScore)),
        matchedIds: [
            ...matchedMandatory.map(s => s.skill_tag_id),
            ...matchedOptional.map(s => s.skill_tag_id),
        ],
        missingIds: missingMandatory.map(s => s.skill_tag_id),
        jobSkillCount: jobSkills.length,
        expScore,
        seniorityScore,
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

const SENIORITY_NAMES = ['Fresher/Trainee', 'Junior/Executive', 'Senior/Lead', 'Manager', 'Director/VP', 'C-Suite'];

// ── 3. Compute and persist match score for a single application ───────────────
async function calculateMatchScore(applicationId) {
    const [[app]] = await db.query(
        `SELECT a.candidate_id, a.job_id,
                jp.title, jp.experience_min, jp.experience_max,
                cp.total_experience, cp.education, cp.headline
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

    if (jobSkills.length === 0 || candidateSkills.length === 0) return null;

    const candidateSet = new Set(candidateSkills.map(s => s.skill_tag_id));
    const jobSeniority       = extractSeniority(app.title);
    const candidateSeniority = extractSeniority(app.headline);

    const { score: totalScore, matchedIds, missingIds, expScore, seniorityScore } =
        scoreVectors(jobSkills, candidateSet, {
            exp:              parseFloat(app.total_experience) || 0,
            expMin:           parseFloat(app.experience_min)  || 0,
            expMax:           parseFloat(app.experience_max)  || 0,
            eduCnt:           parseEduCount(app.education),
            jobSeniority,
            candidateSeniority,
        });

    const matchedNames = await idsToNames(matchedIds);
    const missingNames = await idsToNames(missingIds);

    const seniorityNote = Math.abs(jobSeniority - candidateSeniority) >= 2
        ? ` Level mismatch: role is ${SENIORITY_NAMES[jobSeniority]}, candidate is ${SENIORITY_NAMES[candidateSeniority]}.`
        : '';

    const summary = missingNames.length > 0
        ? `${totalScore}% fit — ${matchedNames.length}/${jobSkills.length} skills matched. Missing: ${missingNames.slice(0, 5).join(', ')}${missingNames.length > 5 ? '…' : ''}.${seniorityNote}`
        : `${totalScore}% fit — all ${matchedNames.length} required skills matched.${seniorityNote}`;

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
    try {
        await parseJobToSkills(jobId, jdText);
    } catch (err) {
        console.error(`[AI] parseJobToSkills failed for job ${jobId}:`, err.message);
    }

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
async function scorePoolAgainstJob(jobId, candidateIds) {
    const out = new Map();
    const ids = [...new Set((candidateIds || []).map(Number).filter(Boolean))];
    if (!jobId || ids.length === 0) return out;

    const [jobSkills] = await db.query(
        'SELECT skill_tag_id, is_mandatory FROM job_skill_vectors WHERE job_id = ?', [jobId]
    );
    if (jobSkills.length === 0) return out;

    const [[job]] = await db.query(
        'SELECT title, experience_min, experience_max FROM job_postings WHERE id = ?', [jobId]
    );
    const expMin      = parseFloat(job?.experience_min) || 0;
    const expMax      = parseFloat(job?.experience_max) || 0;
    const jobSeniority = extractSeniority(job?.title);

    const ph = ids.map(() => '?').join(',');
    const [profiles] = await db.query(
        `SELECT candidate_id, total_experience, education, headline FROM candidate_profiles WHERE candidate_id IN (${ph})`, ids
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
        const r = scoreVectors(jobSkills, set, {
            exp:              parseFloat(prof.total_experience) || 0,
            expMin,
            expMax,
            eduCnt:           parseEduCount(prof.education),
            jobSeniority,
            candidateSeniority: extractSeniority(prof.headline),
        });
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

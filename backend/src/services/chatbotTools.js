// Chatbot tool definitions + implementations. Read-only tools wrap existing
// service/controller logic directly (matchingService, jobController) — they
// never reimplement scoring or matching. Write tools are PROPOSE-ONLY: they
// validate and create a chatbot_pending_actions row, returning a preview and
// an id. The model is never given a tool that can mutate job_postings or
// candidate_profiles directly — only chatbotController.confirmAction (after
// an explicit human confirm) calls the real jobController.createJobRecord /
// updateJobRecord / candidateProfile.saveCandidateProfile functions.

const db = require('../config/db');
const { scorePoolAgainstJob } = require('./matchingService');
const jobController = require('../controllers/jobController');
const { isCandidateHired } = require('../utils/candidateStatus');

const fmtINR = (n) => (n ? `₹${parseFloat(n).toLocaleString('en-IN')}` : 'not specified');

// Lists EVERY field the model actually set, not a curated subset — the whole
// point of the confirm step is the human catching anything wrong (including
// a value the model fabricated), so the preview must be exhaustive rather
// than only showing the fields we thought were "the important ones".
const JOB_FIELD_LABELS = {
    title: 'Title', description: 'Description', requirements: 'Requirements',
    location: 'Location', job_type: 'Type', work_mode: 'Mode',
    salary_min: 'Salary min', salary_max: 'Salary max',
    experience_min: 'Experience min (yrs)', experience_max: 'Experience max (yrs)',
    openings: 'Openings', status: 'Status',
};
const describeJobFields = (fields) => Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
        const label = JOB_FIELD_LABELS[k] || k;
        const isMoney = k === 'salary_min' || k === 'salary_max';
        const val = isMoney ? fmtINR(v) : (typeof v === 'string' && v.length > 300 ? v.slice(0, 300) + '…' : v);
        return `${label}: ${val}`;
    })
    .join('\n');

// The chat UI renders match results as cards on its own, so tell the model not to
// repeat the list — a short human comment and a next step reads far better.
const CARD_NOTE = "The app already shows these results to the user as cards. Do NOT list them again; add one or two friendly sentences about the best fit and ask what they'd like to do next.";

const insertPendingAction = async (conversationId, userId, actionType, payload, previewText) => {
    const [result] = await db.query(
        `INSERT INTO chatbot_pending_actions (conversation_id, user_id, action_type, payload, preview_text, status)
         VALUES (?, ?, ?, ?, ?, 'pending_confirmation')`,
        [conversationId, userId, actionType, JSON.stringify(payload), previewText]
    );
    return result.insertId;
};

// ── Company persona tools ──────────────────────────────────────────────────

async function findMatchingCandidates({ user }, { job_id, limit = 5 }) {
    const [[company]] = await db.query('SELECT id, company_tier FROM companies WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
    if (!company) return { error: 'Company account not found.' };

    const [[job]] = await db.query(
        'SELECT id, title FROM job_postings WHERE id = ? AND company_id = ? AND deleted_at IS NULL',
        [job_id, company.id]
    );
    if (!job) return { error: `Job #${job_id} not found, or does not belong to your company.` };

    // Same tier-visibility rule as Talent Pool (Phase 1): Standard companies
    // never see Premium candidates.
    const isPremium = company.company_tier === 'premium';
    const [candidates] = await db.query(
        `SELECT c.id FROM candidates c
         JOIN users u ON u.id = c.user_id
         WHERE c.deleted_at IS NULL AND u.deleted_at IS NULL AND u.status = 'active'
           ${isPremium ? '' : 'AND COALESCE(c.is_premium, 0) = 0'}
           AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id AND a.status = 'hired' AND a.deleted_at IS NULL)
         LIMIT 200`
    );

    const scoreMap = await scorePoolAgainstJob(job_id, candidates.map(c => c.id));
    const ranked = [...scoreMap.entries()]
        .map(([candidateId, v]) => ({ candidateId, ...v }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    if (!ranked.length) return { job_title: job.title, matches: [], note: 'No scored candidates found in your visible pool yet.' };

    const [profiles] = await db.query(
        `SELECT c.id AS candidate_id, u.name AS candidate_name, cp.headline, cp.total_experience, c.is_premium
         FROM candidates c JOIN users u ON u.id = c.user_id
         LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
         WHERE c.id IN (?)`,
        [ranked.map(r => r.candidateId)]
    );
    const byId = Object.fromEntries(profiles.map(p => [p.candidate_id, p]));

    return {
        job_title: job.title,
        matches: ranked.map(r => ({
            candidate_id: r.candidateId,
            name: byId[r.candidateId]?.candidate_name,
            headline: byId[r.candidateId]?.headline,
            experience_years: byId[r.candidateId]?.total_experience,
            is_premium: !!byId[r.candidateId]?.is_premium,
            match_score: r.score,
            matched_skills: (r.matched_skills || []).slice(0, 4),
        })),
        note: CARD_NOTE,
    };
}

async function proposeJobPost({ user, conversationId }, fields) {
    const [[company]] = await db.query('SELECT id, company_tier FROM companies WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
    if (!company) return { error: 'Company account not found.' };

    if (!fields.title || !fields.description) {
        return { error: 'A job post needs at least a title and a description — ask the user for whichever is missing.' };
    }

    // Standard-tier companies pay ₹3,999 per job at confirm time (a Cashfree
    // checkout, not something the chatbot can complete itself) — Platinum
    // posts for free. Either way, proposing/previewing here is always allowed;
    // this is just something the human should know before confirming.
    const feeNote = company.company_tier === 'premium'
        ? ''
        : '\n\nConfirming this will redirect you to pay a ₹3,999 posting fee for this job.';
    const preview = `New job post — "${fields.title}"\n${describeJobFields(fields)}${feeNote}`;

    const id = await insertPendingAction(conversationId, user.id, 'create_job', fields, preview);
    return { pending_action_id: id, preview };
}

async function proposeJobUpdate({ user, conversationId }, { job_id, ...fields }) {
    const [[company]] = await db.query('SELECT id FROM companies WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
    if (!company) return { error: 'Company account not found.' };

    const [[job]] = await db.query(
        'SELECT id, title FROM job_postings WHERE id = ? AND company_id = ? AND deleted_at IS NULL',
        [job_id, company.id]
    );
    if (!job) return { error: `Job #${job_id} not found, or does not belong to your company.` };
    if (!fields.title || !fields.description) {
        return { error: 'An update needs at least a title and a description (the full new values, not just the changed field) — ask the user for whichever is missing.' };
    }

    const preview = `Update job #${job_id} ("${job.title}") →\n${describeJobFields(fields)}`;

    const id = await insertPendingAction(conversationId, user.id, 'update_job', { job_id, ...fields }, preview);
    return { pending_action_id: id, preview };
}

async function getJobDetails({ user }, { job_id }) {
    const [[company]] = await db.query('SELECT id FROM companies WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
    if (!company) return { error: 'Company account not found.' };
    const [[job]] = await db.query(
        `SELECT id AS job_id, title, description, requirements, location, job_type, work_mode,
                salary_min, salary_max, experience_min, experience_max, openings, status
         FROM job_postings WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
        [job_id, company.id]
    );
    if (!job) return { error: `Job #${job_id} not found, or does not belong to your company.` };
    return { job };
}

// ── Candidate persona tools ────────────────────────────────────────────────

async function findMatchingJobs({ user }, { limit = 5 } = {}) {
    const [[cand]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [user.id]);
    if (!cand) return { error: 'Candidate account not found.' };

    // Scores are only stored per application, so a job the candidate hasn't applied
    // to comes back as 0 — score those on the fly with the same skill-vector engine
    // the Talent Pool uses, then rank.
    const { jobs: active } = await jobController.getMatchedJobsForCandidate(cand.id, { page: 1, limit: 30 });
    const scored = await Promise.all(active.map(async (j) => {
        let score = j.match_computed ? Number(j.match_score) : null;
        let matched = [];
        if (score === null) {
            const r = (await scorePoolAgainstJob(j.id, [cand.id])).get(cand.id);
            if (r) { score = r.score; matched = r.matched_skills || []; }
        } else if (j.matched_skills) {
            try { matched = typeof j.matched_skills === 'string' ? JSON.parse(j.matched_skills) : j.matched_skills; } catch { /* leave [] */ }
        }
        return {
            job_id: j.id,
            title: j.title,
            company: j.company_name,
            location: j.location,
            job_type: j.job_type,
            work_mode: j.work_mode,
            salary_min: j.salary_min,
            salary_max: j.salary_max,
            match_score: score === null ? null : Math.round(score),
            matched_skills: (matched || []).slice(0, 4),
            already_applied: !!j.already_applied,
        };
    }));

    const ranked = scored
        .sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1))
        .slice(0, limit);
    const anyScored = ranked.some(j => j.match_score !== null);

    return {
        jobs: ranked,
        note: CARD_NOTE + (anyScored ? '' : " None could be scored, which usually means the profile has no skills yet: suggest they add skills or upload a resume."),
    };
}

async function getProfileSummary({ user }) {
    const [[cand]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [user.id]);
    if (!cand) return { error: 'Candidate account not found.' };

    const [[profile]] = await db.query(
        `SELECT headline, summary, total_experience, current_location, expected_salary, notice_period_days
         FROM candidate_profiles WHERE candidate_id = ? AND deleted_at IS NULL`,
        [cand.id]
    );
    const [skills] = await db.query(
        `SELECT st.name FROM candidate_skill_vectors csv JOIN skill_tags st ON st.id = csv.skill_tag_id WHERE csv.candidate_id = ?`,
        [cand.id]
    );

    return { profile: profile || {}, skills: skills.map(s => s.name) };
}

async function proposeProfileUpdate({ user, conversationId }, fields) {
    const changed = Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (!changed.length) return { error: 'No fields to update were given — ask the user what they want to change.' };

    const preview = 'Profile update:\n' + changed.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
    const id = await insertPendingAction(conversationId, user.id, 'update_profile', fields, preview);
    return { pending_action_id: id, preview };
}

async function proposeApplyToJob({ user, conversationId }, { job_id, cover_letter }) {
    const [[cand]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [user.id]);
    if (!cand) return { error: 'Candidate account not found.' };

    if (await isCandidateHired(cand.id)) {
        return { error: 'You have already been hired through LadderStep Human Consulting and can no longer apply to new roles.' };
    }

    const [[resume]] = await db.query(
        `SELECT id FROM resumes WHERE candidate_id = ? AND deleted_at IS NULL LIMIT 1`,
        [cand.id]
    );
    if (!resume) return { error: 'The candidate has no resume uploaded yet — ask them to upload one before applying.' };

    const [[job]] = await db.query(
        `SELECT jp.id, jp.title, c.company_name
         FROM job_postings jp JOIN companies c ON c.id = jp.company_id
         WHERE jp.id = ? AND jp.status = 'active' AND jp.deleted_at IS NULL`,
        [job_id]
    );
    if (!job) return { error: `Job #${job_id} not found, or no longer active.` };

    const [[existing]] = await db.query(
        `SELECT id FROM applications WHERE candidate_id = ? AND job_id = ? AND deleted_at IS NULL`,
        [cand.id, job_id]
    );
    if (existing) return { error: `Already applied to "${job.title}" at ${job.company_name}.` };

    const preview = `Apply to "${job.title}" at ${job.company_name}` +
        (cover_letter ? `\nCover letter: ${cover_letter}` : '');
    const id = await insertPendingAction(
        conversationId, user.id, 'apply_to_job',
        { job_id, cover_letter, job_title: job.title, company_name: job.company_name },
        preview
    );
    return { pending_action_id: id, preview };
}

// ── Tool registry ───────────────────────────────────────────────────────────

const READ_ONLY = new Set(['find_matching_candidates', 'find_matching_jobs', 'get_profile_summary', 'get_job_details']);
const isWriteTool = (name) => !READ_ONLY.has(name);

const IMPLEMENTATIONS = {
    find_matching_candidates: findMatchingCandidates,
    get_job_details: getJobDetails,
    propose_job_post: proposeJobPost,
    propose_job_update: proposeJobUpdate,
    find_matching_jobs: findMatchingJobs,
    get_profile_summary: getProfileSummary,
    propose_profile_update: proposeProfileUpdate,
    propose_apply_to_job: proposeApplyToJob,
};

const SCHEMAS = {
    company: [
        {
            type: 'function',
            function: {
                name: 'find_matching_candidates',
                description: "Find and rank candidates against one of the company's own job postings using the platform's AI matching engine.",
                parameters: {
                    type: 'object',
                    properties: {
                        job_id: { type: 'integer', description: 'The job posting ID to match candidates against.' },
                        limit: { type: 'integer', description: 'Max candidates to return (default 10).' },
                    },
                    required: ['job_id'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'get_job_details',
                description: "Read the full current text of one of the company's job postings (needed before improving or editing it).",
                parameters: {
                    type: 'object',
                    properties: { job_id: { type: 'integer', description: 'The job posting ID.' } },
                    required: ['job_id'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'propose_job_post',
                description: 'Draft a new job posting for the user to review and confirm. Does NOT publish it — only creates a preview pending the user\'s explicit confirmation.',
                parameters: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        requirements: { type: 'string' },
                        location: { type: 'string' },
                        job_type: { type: 'string', enum: ['full_time', 'part_time', 'contract', 'internship'] },
                        work_mode: { type: 'string', enum: ['onsite', 'remote', 'hybrid'] },
                        salary_min: { type: 'number' },
                        salary_max: { type: 'number' },
                        experience_min: { type: 'number' },
                        experience_max: { type: 'number' },
                        openings: { type: 'integer' },
                    },
                    required: ['title', 'description'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'propose_job_update',
                description: 'Draft changes to an existing job posting the company owns, for the user to review and confirm. Does NOT apply them.',
                parameters: {
                    type: 'object',
                    properties: {
                        job_id: { type: 'integer' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        requirements: { type: 'string' },
                        location: { type: 'string' },
                        job_type: { type: 'string' },
                        work_mode: { type: 'string' },
                        salary_min: { type: 'number' },
                        salary_max: { type: 'number' },
                        status: { type: 'string', enum: ['draft', 'active', 'paused', 'closed'] },
                    },
                    required: ['job_id', 'title', 'description'],
                },
            },
        },
    ],
    candidate: [
        {
            type: 'function',
            function: {
                name: 'find_matching_jobs',
                description: "Find active job postings ranked by AI match score against the candidate's own profile.",
                parameters: {
                    type: 'object',
                    properties: { limit: { type: 'integer', description: 'Max jobs to return (default 10).' } },
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'propose_profile_update',
                description: 'Draft an update to one or more candidate profile fields, for the user to review and confirm. Does NOT save it.',
                parameters: {
                    type: 'object',
                    properties: {
                        headline: { type: 'string' },
                        summary: { type: 'string' },
                        total_experience: { type: 'number' },
                        current_location: { type: 'string' },
                        expected_salary: { type: 'number' },
                        current_salary: { type: 'number' },
                        notice_period_days: { type: 'integer' },
                        linkedin_url: { type: 'string' },
                        portfolio_url: { type: 'string' },
                        skills: { type: 'array', items: { type: 'string' } },
                    },
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'propose_apply_to_job',
                description: 'Propose applying the candidate to an active job posting, for the user to review and confirm. Does NOT submit the application.',
                parameters: {
                    type: 'object',
                    properties: {
                        job_id: { type: 'integer', description: 'The job posting ID to apply to.' },
                        cover_letter: { type: 'string', description: 'Optional cover letter text.' },
                    },
                    required: ['job_id'],
                },
            },
        },
    ],
};

module.exports = { SCHEMAS, IMPLEMENTATIONS, isWriteTool };

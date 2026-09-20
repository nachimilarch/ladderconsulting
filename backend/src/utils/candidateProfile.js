const db = require('../config/db');
const { upsertCandidateSkills } = require('./skillTags');

// Ensure a candidates row exists for this user and return its id — duplicated
// from routes/candidates.js's own getCandidateId rather than imported, matching
// this codebase's existing convention of small per-file ID-resolver helpers
// (e.g. jobController.js's own getCompanyId vs companyController.js's).
const getCandidateId = async (userId) => {
    await db.query('INSERT IGNORE INTO candidates (user_id) VALUES (?)', [userId]);
    const [[row]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [userId]);
    return row.id;
};

// Shared by POST /api/candidates/profile (routes/candidates.js) and the
// chatbot's confirmed update_profile action (chatbotTools.js) — identical
// upsert either way.
const saveCandidateProfile = async (userId, fields) => {
    const {
        full_name, phone, location, notice_period,
        headline, summary, total_experience,
        current_location, preferred_locations,
        expected_salary, current_salary, notice_period_days,
        linkedin_url, portfolio_url, education, skills,
    } = fields;

    const resolvedLocation     = current_location     ?? location       ?? null;
    const resolvedNoticePeriod = notice_period_days   != null ? notice_period_days
                               : notice_period        != null ? notice_period : 0;

    const candidateId = await getCandidateId(userId);

    const userFields = [];
    const userVals   = [];
    if (full_name !== undefined && full_name !== '') {
        userFields.push('name = ?');
        userVals.push(full_name);
    }
    if (phone !== undefined) {
        userFields.push('phone = ?');
        userVals.push(phone || null);
    }
    if (userFields.length) {
        userVals.push(userId);
        await db.query(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, userVals);
    }

    const educationJson = Array.isArray(education) ? JSON.stringify(education) : null;

    await db.query(
        `INSERT INTO candidate_profiles
            (candidate_id, headline, summary, total_experience, current_location,
             preferred_locations, expected_salary, current_salary, notice_period_days,
             linkedin_url, portfolio_url, education)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
             headline            = VALUES(headline),
             summary             = VALUES(summary),
             total_experience    = VALUES(total_experience),
             current_location    = VALUES(current_location),
             preferred_locations = VALUES(preferred_locations),
             expected_salary     = VALUES(expected_salary),
             current_salary      = VALUES(current_salary),
             notice_period_days  = VALUES(notice_period_days),
             linkedin_url        = VALUES(linkedin_url),
             portfolio_url       = VALUES(portfolio_url),
             education           = VALUES(education)`,
        [
            candidateId,
            headline              || null,
            summary               || null,
            parseFloat(total_experience)  || 0,
            resolvedLocation,
            preferred_locations   || null,
            parseFloat(expected_salary)   || null,
            parseFloat(current_salary)    || null,
            parseInt(resolvedNoticePeriod) || 0,
            linkedin_url          || null,
            portfolio_url         || null,
            educationJson,
        ]
    );

    // Save skills if provided (replace set, then one batched upsert)
    if (Array.isArray(skills)) {
        await db.query(`DELETE FROM candidate_skill_vectors WHERE candidate_id = ?`, [candidateId]);
        await upsertCandidateSkills(candidateId, skills, 'manual');
    }

    return candidateId;
};

// saveCandidateProfile REPLACES every profile column (an omitted field becomes NULL / 0),
// which is right for the full profile form but wrong for a partial change such as the
// assistant's "polish my headline". This overlays only the fields actually provided onto
// the current row first, so everything else is left exactly as it was.
const updateCandidateProfileFields = async (userId, changes) => {
    const candidateId = await getCandidateId(userId);
    const [[cur]] = await db.query(
        `SELECT headline, summary, total_experience, current_location, preferred_locations,
                expected_salary, current_salary, notice_period_days, linkedin_url, portfolio_url, education
         FROM candidate_profiles WHERE candidate_id = ?`,
        [candidateId]
    );

    let education = cur?.education ?? null;
    if (typeof education === 'string') { try { education = JSON.parse(education); } catch { education = null; } }

    const provided = Object.fromEntries(
        Object.entries(changes).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    return saveCandidateProfile(userId, { ...(cur || {}), education, ...provided });
};

module.exports = { saveCandidateProfile, updateCandidateProfileFields, getCandidateId };

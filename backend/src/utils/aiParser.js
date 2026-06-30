/**
 * Resume parsing — offline.
 *
 * Historically this called OpenAI (GPT-4o-mini). It now delegates to the
 * dependency-free heuristic engine in resumeParser.js, so no API key is
 * required. The exported function names and return shapes are unchanged, so
 * every caller (candidates.js, recruitmentController.js) keeps working.
 *
 * Kept async so existing `await parseFullProfile(...)` call sites are unaffected.
 */
const { parseFullProfile: localFullProfile, parseResumeText: localResumeText } = require('./resumeParser');

/**
 * Extract skills + experience + summary from raw resume text.
 * Returns: { skills: [], experience_years: number, summary: string }
 */
const parseResumeText = async (rawText) => localResumeText(rawText);

/**
 * Extract the full candidate profile from raw resume text.
 * Returns: { full_name, email, phone, headline, location, experience_years,
 *            linkedin_url, portfolio_url, summary, education[], skills[] }
 */
const parseFullProfile = async (rawText) => {
    const p = localFullProfile(rawText);
    return {
        full_name:        p.full_name        || '',
        email:            (p.email || '').trim().toLowerCase(),
        phone:            p.phone            || '',
        headline:         p.headline         || '',
        location:         p.location         || '',
        experience_years: parseFloat(p.experience_years) || 0,
        linkedin_url:     p.linkedin_url     || '',
        portfolio_url:    p.portfolio_url    || '',
        summary:          p.summary          || '',
        education:        Array.isArray(p.education) ? p.education : [],
        skills:           Array.isArray(p.skills)    ? p.skills    : [],
    };
};

module.exports = { parseResumeText, parseFullProfile };

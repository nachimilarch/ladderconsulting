const { extractSkillsFromText } = require('./skillExtractor');
const { replaceJobSkills } = require('../utils/skillTags');

async function extractAndSaveJobSkills(jobId, jobData, db) {
    const text = [jobData.title, jobData.description, jobData.requirements]
        .filter(Boolean).join(' ');
    const skills = extractSkillsFromText(text);

    // Keyword fallback — all skills as non-mandatory (is_mandatory=0), one batched
    // replace. The offline JD parser runs afterwards and refines required/preferred.
    await replaceJobSkills(jobId, [], skills, db);

    await db.query('UPDATE job_postings SET ai_processed = 1 WHERE id = ?', [jobId]);
    return skills;
}

module.exports = { extractAndSaveJobSkills };

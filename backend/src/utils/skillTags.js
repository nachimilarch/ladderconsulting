const db = require('../config/db');

// Normalize a skill name the same way everywhere (lowercase, trimmed, capped).
const norm = (s) => String(s || '').trim().toLowerCase().substring(0, 100);

/**
 * Batch-upsert skill names into skill_tags and return Map(normalizedName -> id).
 * Replaces the per-skill "INSERT IGNORE + SELECT id" N+1 with 2 queries total.
 */
async function resolveSkillTagIds(rawNames, runner = db) {
    const names = [...new Set((rawNames || []).map(norm).filter(Boolean))];
    if (!names.length) return new Map();

    await runner.query(
        `INSERT IGNORE INTO skill_tags (name) VALUES ${names.map(() => '(?)').join(',')}`,
        names
    );
    const [rows] = await runner.query(
        `SELECT id, name FROM skill_tags WHERE name IN (${names.map(() => '?').join(',')})`,
        names
    );
    return new Map(rows.map((r) => [r.name, r.id]));
}

/**
 * Batch-insert candidate skill vectors (one multi-row upsert).
 * proficiency/years_exp use their column defaults. Returns canonical names.
 */
async function upsertCandidateSkills(candidateId, rawNames, source = 'resume_parsed', runner = db) {
    const map = await resolveSkillTagIds(rawNames, runner);
    if (!map.size) return [];
    const ids = [...map.values()];
    await runner.query(
        `INSERT INTO candidate_skill_vectors (candidate_id, skill_tag_id, source)
         VALUES ${ids.map(() => '(?, ?, ?)').join(',')}
         ON DUPLICATE KEY UPDATE source = VALUES(source)`,
        ids.flatMap((id) => [candidateId, id, source])
    );
    return [...map.keys()];
}

/**
 * Replace a job's skill vectors in one batch.
 * required → is_mandatory=1 weight 1.0, preferred → is_mandatory=0 weight 0.5.
 * Pass preferred=[] (and required=names) for the keyword-fallback case.
 */
async function replaceJobSkills(jobId, requiredNames, preferredNames = [], runner = db) {
    const reqMap = await resolveSkillTagIds(requiredNames, runner);
    const prefMap = await resolveSkillTagIds(preferredNames, runner);
    for (const k of reqMap.keys()) prefMap.delete(k); // required wins over preferred

    await runner.query('DELETE FROM job_skill_vectors WHERE job_id = ?', [jobId]);

    const rows = [
        ...[...reqMap.values()].map((id) => [jobId, id, 1, 1.0]),
        ...[...prefMap.values()].map((id) => [jobId, id, 0, 0.5]),
    ];
    if (rows.length) {
        await runner.query(
            `INSERT IGNORE INTO job_skill_vectors (job_id, skill_tag_id, is_mandatory, weight)
             VALUES ${rows.map(() => '(?, ?, ?, ?)').join(',')}`,
            rows.flat()
        );
    }
    return { required: [...reqMap.keys()], preferred: [...prefMap.keys()] };
}

module.exports = { resolveSkillTagIds, upsertCandidateSkills, replaceJobSkills };

// Rules and file cleanup for an admin deleting a candidate account.
//
// An account that holds something live (a hire, an open offer, a scheduled interview) cannot be
// deleted until that is resolved: deleting it would strand a company mid-process or hide a fee.
// Everything else (applications, resumes, documents, profile) goes with the account.

const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const UPLOADS = path.join(process.cwd(), 'uploads');

async function getDeleteBlockers(candidateId, runner = db) {
    if (!candidateId) return { hired: false, pending_offer: false, upcoming_interviews: 0 };
    const [[hired]] = await runner.query(
        `SELECT 1 AS x FROM applications WHERE candidate_id = ? AND status = 'hired' AND deleted_at IS NULL LIMIT 1`,
        [candidateId]
    );
    const [[offer]] = await runner.query(
        `SELECT 1 AS x FROM applications a
         JOIN offers o ON o.application_id = a.id AND o.deleted_at IS NULL
         WHERE a.candidate_id = ? AND a.deleted_at IS NULL AND o.status IN ('sent', 'accepted') LIMIT 1`,
        [candidateId]
    );
    const [[iv]] = await runner.query(
        `SELECT COUNT(*) AS n FROM interview_slots s
         JOIN applications a ON a.id = s.application_id
         WHERE a.candidate_id = ? AND a.deleted_at IS NULL AND s.deleted_at IS NULL
           AND s.status IN ('proposed', 'confirmed', 'rescheduled') AND s.slot_datetime >= UTC_TIMESTAMP()`,
        [candidateId]
    );
    return { hired: !!hired, pending_offer: !!offer, upcoming_interviews: Number(iv.n) };
}

/** Plain-English reason, or null when nothing blocks the delete. */
function describeBlockers(b) {
    const parts = [];
    if (b.hired) parts.push('has been hired through the platform');
    if (b.pending_offer) parts.push('has an offer letter that is still open');
    if (b.upcoming_interviews) parts.push(`has ${b.upcoming_interviews} upcoming interview${b.upcoming_interviews === 1 ? '' : 's'}`);
    return parts.length ? `This candidate ${parts.join(' and ')}. Resolve that first, or suspend the account instead.` : null;
}

// Best-effort removal of stored files. Paths come from the database but are re-checked so a bad value
// can never point outside the uploads folder.
function removeUploads(relativeKeys, baseDir = process.cwd()) {
    let removed = 0;
    for (const key of relativeKeys) {
        if (!key) continue;
        const full = path.resolve(baseDir, key);
        if (!full.startsWith(UPLOADS + path.sep)) continue;
        fs.unlink(full, () => {});
        removed += 1;
    }
    return removed;
}

module.exports = { getDeleteBlockers, describeBlockers, removeUploads };

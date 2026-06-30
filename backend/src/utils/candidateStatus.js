const db = require('../config/db');

/**
 * A candidate is considered "hired" (off the market) the moment any one of
 * their applications reaches status 'hired'. Once hired they cannot apply to
 * new roles, be sourced by executives, or be shortlisted/advanced by any other
 * company.
 *
 * Both hire paths set applications.status='hired':
 *   - interviewController.respondToOffer (candidate accepts an offer)
 *   - companyController.updateOffer       (company marks an offer accepted)
 *
 * @param {number} candidateId  candidates.id
 * @param {object} [runner]     optional db/connection (for use inside a txn)
 * @returns {Promise<boolean>}
 */
async function isCandidateHired(candidateId, runner = db) {
    if (!candidateId) return false;
    const [[row]] = await runner.query(
        `SELECT 1 AS hired FROM applications
         WHERE candidate_id = ? AND status = 'hired' AND deleted_at IS NULL
         LIMIT 1`,
        [candidateId]
    );
    return !!row;
}

/**
 * A candidate "holds an offer letter" the moment any one of their applications
 * has an `offers` row with status 'sent' or 'accepted' (accepted normally also
 * implies isCandidateHired() — checked separately here for safety regardless
 * of timing). Used to keep candidates mid-offer with one company out of the
 * Talent Pool / further unlock-and-apply actions by other companies, even
 * before the candidate has formally responded.
 *
 * @param {number} candidateId  candidates.id
 * @param {object} [runner]     optional db/connection (for use inside a txn)
 * @returns {Promise<boolean>}
 */
async function hasPendingOffer(candidateId, runner = db) {
    if (!candidateId) return false;
    const [[row]] = await runner.query(
        `SELECT 1 FROM applications a
         JOIN offers o ON o.application_id = a.id AND o.deleted_at IS NULL
         WHERE a.candidate_id = ? AND o.status IN ('sent', 'accepted')
         LIMIT 1`,
        [candidateId]
    );
    return !!row;
}

module.exports = { isCandidateHired, hasPendingOffer };

const db = require('../config/db');
const { logAction } = require('../utils/auditLog');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) { console.error('[notify]', err.message); }
};

// ── GET /api/hr/premium-candidate-requests ────────────────────────────────────
exports.listRequests = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        const params = [];
        let statusClause = '';
        if (status !== 'all') {
            statusClause = 'AND cpr.status = ?';
            params.push(status);
        }

        const [rows] = await db.query(
            `SELECT cpr.id, cpr.candidate_id, cpr.declared_annual_ctc, cpr.status,
                    cpr.review_note, cpr.reviewed_at, cpr.created_at,
                    u.name AS candidate_name, u.email AS candidate_email,
                    (SELECT COUNT(*) FROM candidate_documents cd
                     WHERE cd.candidate_id = cpr.candidate_id AND cd.doc_type = 'payslip' AND cd.deleted_at IS NULL) AS payslip_count
             FROM candidate_premium_requests cpr
             JOIN candidates c ON c.id = cpr.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE cpr.deleted_at IS NULL
               ${statusClause}
             ORDER BY cpr.status = 'pending' DESC, cpr.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[premiumCandidateReview.list]', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch requests.' });
    }
};

// ── GET /api/hr/premium-candidate-requests/:id ────────────────────────────────
// Payslips are fetched via the existing GET /api/candidates/:candidateId/documents
// (and downloaded via its /:docId/download sibling) — both already hr_staff/admin
// gated, so no new document-serving code is needed here.
exports.getRequestDetail = async (req, res) => {
    try {
        const [[request]] = await db.query(
            `SELECT cpr.id, cpr.candidate_id, cpr.declared_annual_ctc, cpr.status,
                    cpr.review_note, cpr.reviewed_at, cpr.created_at,
                    u.id AS user_id, u.name AS candidate_name, u.email AS candidate_email, u.phone AS candidate_phone,
                    cp.headline, cp.total_experience, cp.current_location
             FROM candidate_premium_requests cpr
             JOIN candidates c ON c.id = cpr.candidate_id
             JOIN users u ON u.id = c.user_id
             LEFT JOIN candidate_profiles cp ON cp.candidate_id = c.id
             WHERE cpr.id = ? AND cpr.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!request) return res.status(404).json({ message: 'Request not found.' });

        const [payslips] = await db.query(
            `SELECT id, doc_type, original_name, file_size, mime_type, notes, created_at
             FROM candidate_documents
             WHERE candidate_id = ? AND doc_type = 'payslip' AND deleted_at IS NULL
             ORDER BY created_at DESC`,
            [request.candidate_id]
        );

        res.json({ success: true, data: { ...request, payslips } });
    } catch (err) {
        console.error('[premiumCandidateReview.detail]', err.message);
        res.status(500).json({ message: 'Failed to fetch request.' });
    }
};

// ── PUT /api/hr/premium-candidate-requests/:id/approve ────────────────────────
// Approval only marks the request approved — it does NOT set candidates.is_premium.
// The candidate must separately choose to pay the ₹999 fee to actually activate
// Premium status (see candidatePremiumController.payPremiumFee).
exports.approveRequest = async (req, res) => {
    try {
        const [[request]] = await db.query(
            `SELECT cpr.id, cpr.status, cpr.candidate_id, u.id AS user_id, u.name AS candidate_name
             FROM candidate_premium_requests cpr
             JOIN candidates c ON c.id = cpr.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE cpr.id = ? AND cpr.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!request) return res.status(404).json({ message: 'Request not found.' });
        if (request.status !== 'pending') {
            return res.status(409).json({ message: `Request is already ${request.status}.` });
        }

        await db.query(
            `UPDATE candidate_premium_requests SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
            [req.user.id, request.id]
        );

        await notify(
            request.user_id,
            'premium_candidate_approved',
            'Premium Verification Approved',
            'Your Premium candidate verification has been approved. Pay the ₹999 one-time fee to activate your Premium profile and get boosted visibility to Premium companies.',
            { request_id: request.id }
        );

        logAction(req.user.id, 'approve_premium_candidate', 'candidate', request.candidate_id, {}, ip(req));

        res.json({ success: true, message: `${request.candidate_name}'s Premium verification approved.` });
    } catch (err) {
        console.error('[premiumCandidateReview.approve]', err.message);
        res.status(500).json({ message: 'Failed to approve request.' });
    }
};

// ── PUT /api/hr/premium-candidate-requests/:id/reject ─────────────────────────
exports.rejectRequest = async (req, res) => {
    const { reason } = req.body;
    try {
        const [[request]] = await db.query(
            `SELECT cpr.id, cpr.status, cpr.candidate_id, u.id AS user_id, u.name AS candidate_name
             FROM candidate_premium_requests cpr
             JOIN candidates c ON c.id = cpr.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE cpr.id = ? AND cpr.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!request) return res.status(404).json({ message: 'Request not found.' });
        if (request.status !== 'pending') {
            return res.status(409).json({ message: `Request is already ${request.status}.` });
        }

        await db.query(
            `UPDATE candidate_premium_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_note = ? WHERE id = ?`,
            [req.user.id, reason || null, request.id]
        );

        await notify(
            request.user_id,
            'premium_candidate_rejected',
            'Premium Verification — Update',
            `Your Premium candidate verification could not be approved.${reason ? ` Reason: ${reason}` : ''} You're welcome to submit a new request with updated documents.`,
            { request_id: request.id }
        );

        logAction(req.user.id, 'reject_premium_candidate', 'candidate', request.candidate_id, { reason }, ip(req));

        res.json({ success: true, message: `${request.candidate_name}'s Premium verification rejected.` });
    } catch (err) {
        console.error('[premiumCandidateReview.reject]', err.message);
        res.status(500).json({ message: 'Failed to reject request.' });
    }
};

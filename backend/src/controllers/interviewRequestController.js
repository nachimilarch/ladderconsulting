const db = require('../config/db');
const { sendEmail } = require('../utils/email');

const safeEmail = (opts) => sendEmail(opts).catch(e => console.error('[Email]', e.message));

const notify = (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    db.query(
        `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)`,
        [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
    ).catch(e => console.error('[notify]', e.message));
};

const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }) + ' IST' : '';

// mysql2 returns JSON-type columns already parsed as objects, but some rows
// (or TEXT columns) come back as strings. Parse defensively either way.
const parseJson = (val, fallback = null) => {
    if (val == null) return fallback;
    if (typeof val !== 'string') return val;
    try { return JSON.parse(val); } catch { return fallback; }
};

const getCompanyRow = async (userId) => {
    const [[row]] = await db.query(
        `SELECT c.id, c.company_name, c.assigned_executive_id,
                u.email AS executive_email, u.name AS executive_name, u.id AS executive_user_id
         FROM companies c
         LEFT JOIN users u ON u.id = c.assigned_executive_id
         WHERE c.user_id = ? AND c.deleted_at IS NULL`,
        [userId]
    );
    return row || null;
};

// ── POST /api/interview-requests ─────────────────────────────────────────────
exports.submitRequest = async (req, res) => {
    const {
        application_id, proposed_datetime, duration_mins = 60,
        mode = 'video', meeting_link, location_detail, request_note,
    } = req.body;

    if (!application_id || !proposed_datetime || !mode) {
        return res.status(400).json({ message: 'application_id, proposed_datetime, and mode are required.' });
    }
    if (!['video', 'phone', 'in_person'].includes(mode)) {
        return res.status(400).json({ message: 'mode must be video, phone, or in_person.' });
    }

    try {
        const company = await getCompanyRow(req.user.id);
        if (!company) return res.status(403).json({ message: 'Company profile not found.' });
        if (!company.assigned_executive_id) {
            return res.status(400).json({
                message: 'No LadderStep Human Consulting executive is assigned to your account. Please contact support.',
            });
        }

        // Verify application belongs to this company
        const [[app]] = await db.query(
            `SELECT a.id, a.candidate_id, a.status AS app_status, a.sourced_by,
                    jp.title AS job_title,
                    u.name AS candidate_name, u.id AS candidate_user_id
             FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE a.id = ? AND jp.company_id = ? AND a.deleted_at IS NULL`,
            [application_id, company.id]
        );
        if (!app) return res.status(404).json({ message: 'Application not found.' });

        // Block duplicate active requests for same application
        const [[existing]] = await db.query(
            `SELECT id FROM company_requests
             WHERE company_id = ? AND application_id = ?
               AND request_type IN ('interview_schedule','interview_reschedule')
               AND status IN ('pending','in_progress')
               AND deleted_at IS NULL
             LIMIT 1`,
            [company.id, application_id]
        );
        if (existing) {
            return res.status(409).json({ message: 'An active interview request already exists for this application.' });
        }

        const metadata = {
            proposed_datetime,
            duration_mins: parseInt(duration_mins) || 60,
            mode,
            meeting_link: meeting_link || null,
            location_detail: location_detail || null,
        };

        const [result] = await db.query(
            `INSERT INTO company_requests
                (company_id, application_id, candidate_id, request_type, status,
                 assigned_executive_id, requested_by, company_notes, metadata)
             VALUES (?, ?, ?, 'interview_schedule', 'pending', ?, ?, ?, ?)`,
            [company.id, application_id, app.candidate_id,
             company.assigned_executive_id, req.user.id,
             request_note || null, JSON.stringify(metadata)]
        );

        notify(
            company.assigned_executive_id,
            'interview_request',
            `Interview Request — ${company.company_name}`,
            `${company.company_name} has requested an interview slot for ${app.candidate_name} on ${fmtDateTime(proposed_datetime)}. Please review and confirm your availability.`,
            { request_id: result.insertId, application_id, company_id: company.id }
        );

        // Also ping the executive who sourced this candidate, if that's someone else
        if (app.sourced_by && app.sourced_by !== company.assigned_executive_id) {
            notify(
                app.sourced_by,
                'interview_request',
                `Interview Request — ${company.company_name}`,
                `${company.company_name} requested an interview for ${app.candidate_name}, a candidate you sourced, on ${fmtDateTime(proposed_datetime)}.`,
                { request_id: result.insertId, application_id, company_id: company.id }
            );
        }

        if (company.executive_email) {
            safeEmail({
                to: company.executive_email,
                subject: `Interview Request — ${company.company_name}`,
                html: `
                    <p>Hi ${company.executive_name},</p>
                    <p><strong>${company.company_name}</strong> has requested an interview slot for candidate <strong>${app.candidate_name}</strong>.</p>
                    <p><strong>Proposed Date/Time:</strong> ${fmtDateTime(proposed_datetime)}</p>
                    <p><strong>Mode:</strong> ${mode}</p>
                    <p><strong>Duration:</strong> ${duration_mins} minutes</p>
                    ${request_note ? `<p><strong>Note:</strong> ${request_note}</p>` : ''}
                    <p>Please log in to your <strong>Executive Dashboard → Interview Requests</strong> to approve or reject.</p>
                    <br/><p>LadderStep Human Consulting System</p>
                `,
            });
        }

        // Email company to confirm their request was received
        if (req.user.email) {
            safeEmail({
                to: req.user.email,
                subject: `Interview Request Received — ${app.candidate_name}`,
                html: `
                    <p>Hi,</p>
                    <p>Your interview request for <strong>${app.candidate_name}</strong> (${app.job_title}) has been received and is pending review by your LadderStep Human Consulting executive.</p>
                    <p><strong>Proposed Date/Time:</strong> ${fmtDateTime(proposed_datetime)}</p>
                    <p>You will be notified once the interview is confirmed. You can track the status via <strong>Company Portal → Interviews</strong>.</p>
                    <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                `,
            });
        }

        res.status(201).json({
            message: 'Interview request submitted. Awaiting executive confirmation.',
            request_id: result.insertId,
        });
    } catch (err) {
        console.error('[interviewRequest.submit]', err);
        res.status(500).json({ message: 'Failed to submit interview request.' });
    }
};

// ── GET /api/interview-requests?applicationId=X ──────────────────────────────
exports.getRequestStatus = async (req, res) => {
    const { applicationId } = req.query;
    if (!applicationId) return res.status(400).json({ message: 'applicationId query param is required.' });

    try {
        const [[company]] = await db.query(
            `SELECT c.id FROM companies c WHERE c.user_id = ? AND c.deleted_at IS NULL`, [req.user.id]
        );
        if (!company) return res.status(404).json({ message: 'Company not found.' });

        const [[appCheck]] = await db.query(
            `SELECT a.id FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             WHERE a.id = ? AND jp.company_id = ? AND a.deleted_at IS NULL`,
            [applicationId, company.id]
        );
        if (!appCheck) return res.status(404).json({ message: 'Application not found.' });

        // Get the latest request for this application
        const [[request]] = await db.query(
            `SELECT cr.id, cr.status, cr.request_type, cr.rejection_reason,
                    cr.metadata, cr.created_at, cr.resolved_at,
                    is2.id AS slot_id, is2.slot_datetime, is2.duration_mins,
                    is2.mode, is2.meeting_link, is2.location_detail, is2.status AS slot_status,
                    is2.candidate_confirmed
             FROM company_requests cr
             LEFT JOIN interview_slots is2 ON is2.application_id = cr.application_id
               AND is2.deleted_at IS NULL
             WHERE cr.company_id = ? AND cr.application_id = ?
               AND cr.request_type IN ('interview_schedule','interview_reschedule')
               AND cr.deleted_at IS NULL
             ORDER BY cr.created_at DESC LIMIT 1`,
            [company.id, applicationId]
        );

        if (!request) return res.json({ status: 'none' });

        res.json({
            status: request.status,
            request_id: request.id,
            request_type: request.request_type,
            rejection_reason: request.rejection_reason || null,
            metadata: parseJson(request.metadata),
            created_at: request.created_at,
            resolved_at: request.resolved_at,
            slot: request.slot_id ? {
                id: request.slot_id,
                slot_datetime: request.slot_datetime,
                duration_mins: request.duration_mins,
                mode: request.mode,
                meeting_link: request.meeting_link,
                location_detail: request.location_detail,
                status: request.slot_status,
                candidate_confirmed: request.candidate_confirmed,
            } : null,
        });
    } catch (err) {
        console.error('[interviewRequest.status]', err);
        res.status(500).json({ message: 'Failed to fetch request status.' });
    }
};

// ── POST /api/interview-requests/:id/reschedule ───────────────────────────────
exports.submitReschedule = async (req, res) => {
    const {
        proposed_datetime, duration_mins = 60,
        mode = 'video', meeting_link, location_detail, request_note,
    } = req.body;

    if (!proposed_datetime) return res.status(400).json({ message: 'proposed_datetime is required.' });

    try {
        const company = await getCompanyRow(req.user.id);
        if (!company) return res.status(403).json({ message: 'Company profile not found.' });
        if (!company.assigned_executive_id) {
            return res.status(400).json({ message: 'No executive assigned to your account.' });
        }

        // Verify the original request belongs to this company
        const [[orig]] = await db.query(
            `SELECT cr.id, cr.application_id, cr.candidate_id, cr.status
             FROM company_requests cr
             WHERE cr.id = ? AND cr.company_id = ? AND cr.deleted_at IS NULL`,
            [req.params.id, company.id]
        );
        if (!orig) return res.status(404).json({ message: 'Original request not found.' });
        if (orig.status !== 'resolved') {
            return res.status(400).json({ message: 'Reschedule can only be submitted after interview is confirmed.' });
        }

        // Get candidate info
        const [[appInfo]] = await db.query(
            `SELECT jp.title AS job_title, u.name AS candidate_name, u.id AS candidate_user_id
             FROM applications a
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE a.id = ? AND a.deleted_at IS NULL`,
            [orig.application_id]
        );

        const metadata = {
            proposed_datetime,
            duration_mins: parseInt(duration_mins) || 60,
            mode,
            meeting_link: meeting_link || null,
            location_detail: location_detail || null,
        };

        const [result] = await db.query(
            `INSERT INTO company_requests
                (company_id, application_id, candidate_id, request_type, status,
                 assigned_executive_id, requested_by, company_notes, metadata)
             VALUES (?, ?, ?, 'interview_reschedule', 'pending', ?, ?, ?, ?)`,
            [company.id, orig.application_id, orig.candidate_id,
             company.assigned_executive_id, req.user.id,
             request_note || null, JSON.stringify(metadata)]
        );

        // Mark existing slot as rescheduled
        await db.query(
            `UPDATE interview_slots SET status = 'rescheduled'
             WHERE application_id = ? AND status IN ('proposed','confirmed') AND deleted_at IS NULL`,
            [orig.application_id]
        );

        notify(
            company.assigned_executive_id,
            'interview_reschedule_request',
            `Reschedule Request — ${company.company_name}`,
            `${company.company_name} has requested to reschedule the interview for ${appInfo?.candidate_name || 'candidate'} to ${fmtDateTime(proposed_datetime)}.`,
            { request_id: result.insertId, application_id: orig.application_id }
        );

        if (company.executive_email) {
            safeEmail({
                to: company.executive_email,
                subject: `Reschedule Request — ${company.company_name}`,
                html: `
                    <p>Hi ${company.executive_name},</p>
                    <p><strong>${company.company_name}</strong> has requested to reschedule the interview for <strong>${appInfo?.candidate_name || 'the candidate'}</strong>.</p>
                    <p><strong>New Proposed Date/Time:</strong> ${fmtDateTime(proposed_datetime)}</p>
                    <p><strong>Mode:</strong> ${mode}</p>
                    ${request_note ? `<p><strong>Note:</strong> ${request_note}</p>` : ''}
                    <p>Please log in to your <strong>Executive Dashboard → Interview Requests</strong> to approve or reject.</p>
                    <br/><p>LadderStep Human Consulting System</p>
                `,
            });
        }

        res.status(201).json({ message: 'Reschedule request submitted.', request_id: result.insertId });
    } catch (err) {
        console.error('[interviewRequest.reschedule]', err);
        res.status(500).json({ message: 'Failed to submit reschedule request.' });
    }
};

// ── GET /api/hr/interview-requests ───────────────────────────────────────────
exports.listExecRequests = async (req, res) => {
    const { status } = req.query;
    const isAdmin = req.user.role === 'admin';
    const conditions = [
        "cr.request_type IN ('interview_schedule','interview_reschedule')",
        'cr.deleted_at IS NULL',
    ];
    const params = [];

    // An executive sees requests for companies assigned to them OR candidates
    // they personally sourced (bulk upload) — so sourcing execs aren't left out.
    if (!isAdmin) {
        // Current company assignment OR the exec who sourced the candidate
        conditions.push('(co.assigned_executive_id = ? OR a.sourced_by = ?)');
        params.push(req.user.id, req.user.id);
    }
    if (status) { conditions.push('cr.status = ?'); params.push(status); }

    try {
        const [rows] = await db.query(
            `SELECT cr.id, cr.request_type, cr.status, cr.rejection_reason,
                    cr.metadata, cr.company_notes AS request_note,
                    cr.created_at, cr.resolved_at,
                    co.company_name,
                    cand_u.name AS candidate_name,
                    jp.title AS job_title,
                    exec_u.name AS executive_name,
                    is2.id AS slot_id, is2.slot_datetime, is2.status AS slot_status
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN applications a ON a.id = cr.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates cand ON cand.id = a.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN users exec_u ON exec_u.id = cr.assigned_executive_id
             LEFT JOIN interview_slots is2 ON is2.application_id = cr.application_id AND is2.deleted_at IS NULL
             WHERE ${conditions.join(' AND ')}
             ORDER BY cr.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[interviewRequest.listExec]', err);
        res.status(500).json({ message: 'Failed to fetch interview requests.' });
    }
};

// ── GET /api/hr/interview-requests/:id ───────────────────────────────────────
exports.getRequestDetail = async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    try {
        const [[row]] = await db.query(
            `SELECT cr.id, cr.request_type, cr.status, cr.rejection_reason,
                    cr.metadata, cr.company_notes AS request_note,
                    cr.created_at, cr.resolved_at,
                    co.id AS company_id, co.company_name, co.industry,
                    co_u.name AS company_contact, co_u.email AS company_email, co_u.id AS company_user_id,
                    cand_u.name AS candidate_name,
                    jp.title AS job_title, jp.id AS job_id,
                    a.id AS application_id
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN users co_u ON co_u.id = co.user_id
             JOIN applications a ON a.id = cr.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates cand ON cand.id = a.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             WHERE cr.id = ? AND cr.deleted_at IS NULL
               AND (? OR co.assigned_executive_id = ? OR a.sourced_by = ?)`,
            [req.params.id, isAdmin, req.user.id, req.user.id]
        );
        if (!row) return res.status(404).json({ message: 'Request not found.' });
        row.metadata = parseJson(row.metadata);
        res.json({ success: true, data: row });
    } catch (err) {
        console.error('[interviewRequest.detail]', err);
        res.status(500).json({ message: 'Failed to fetch request detail.' });
    }
};

// ── PUT /api/hr/interview-requests/:id/approve ────────────────────────────────
// Executive approves (optionally modifying time/details) — creates interview_slots
exports.approveRequest = async (req, res) => {
    // Executive can override metadata fields before approving
    const { slot_datetime, duration_mins, mode, meeting_link, location_detail } = req.body;
    const isAdmin = req.user.role === 'admin';

    try {
        const [[cr]] = await db.query(
            `SELECT cr.id, cr.company_id, cr.application_id, cr.candidate_id,
                    cr.metadata, cr.status,
                    co.company_name,
                    co_u.id AS company_user_id, co_u.email AS company_email,
                    cand_u.name AS candidate_name, cand_u.id AS candidate_user_id,
                    cand_u.email AS candidate_email,
                    jp.title AS job_title,
                    eu.email AS exec_email
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN users co_u ON co_u.id = co.user_id
             JOIN applications a ON a.id = cr.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates cand ON cand.id = a.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN users eu ON eu.id = co.assigned_executive_id
             WHERE cr.id = ? AND cr.deleted_at IS NULL
               AND (? OR co.assigned_executive_id = ? OR a.sourced_by = ?)`,
            [req.params.id, isAdmin, req.user.id, req.user.id]
        );
        if (!cr) return res.status(404).json({ message: 'Request not found.' });
        if (cr.status === 'resolved') return res.status(409).json({ message: 'Request is already resolved.' });
        if (cr.status === 'rejected') return res.status(409).json({ message: 'Cannot approve a rejected request.' });

        // Resolve final slot details — exec override takes priority over company proposal
        const meta = parseJson(cr.metadata, {}) || {};
        const finalDatetime = slot_datetime || meta.proposed_datetime;
        if (!finalDatetime) return res.status(400).json({ message: 'slot_datetime is required.' });

        const finalMode = mode || meta.mode || 'video';
        const finalDuration = duration_mins || meta.duration_mins || 60;
        const finalLink = meeting_link !== undefined ? meeting_link : (meta.meeting_link || null);
        const finalLocation = location_detail !== undefined ? location_detail : (meta.location_detail || null);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // Create the interview slot
            const [slotResult] = await conn.query(
                `INSERT INTO interview_slots
                    (application_id, scheduled_by, slot_datetime, duration_mins, mode, meeting_link, location_detail, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed')`,
                [cr.application_id, req.user.id, finalDatetime,
                 finalDuration, finalMode, finalLink, finalLocation]
            );

            // Resolve the request
            await conn.query(
                `UPDATE company_requests
                 SET status = 'resolved', resolved_at = NOW(), resolved_by = ?
                 WHERE id = ?`,
                [req.user.id, cr.id]
            );

            // Update application status
            await conn.query(
                `UPDATE applications SET status = 'interview_scheduled' WHERE id = ? AND deleted_at IS NULL`,
                [cr.application_id]
            );

            await conn.commit();

            // Notify company
            notify(
                cr.company_user_id,
                'interview_confirmed',
                `Interview Confirmed — ${cr.candidate_name}`,
                `Your interview request for ${cr.candidate_name} has been confirmed for ${fmtDateTime(finalDatetime)}. Mode: ${finalMode}.`,
                { request_id: cr.id, application_id: cr.application_id, slot_id: slotResult.insertId }
            );

            // Notify candidate
            const modeLabel = finalMode === 'video' ? 'Video Call' : finalMode === 'phone' ? 'Phone' : 'In-Person';
            notify(
                cr.candidate_user_id,
                'interview_scheduled',
                `Interview Scheduled — ${cr.job_title}`,
                `Your interview for ${cr.job_title} has been scheduled for ${fmtDateTime(finalDatetime)} (${modeLabel}). Please log in to confirm your availability.`,
                { application_id: cr.application_id, slot_id: slotResult.insertId }
            );

            if (cr.company_email) {
                safeEmail({
                    to: cr.company_email,
                    cc: cr.exec_email,
                    subject: `Interview Confirmed — ${cr.candidate_name}`,
                    html: `
                        <p>Hi,</p>
                        <p>Your interview request for <strong>${cr.candidate_name}</strong> (${cr.job_title}) has been confirmed.</p>
                        <p><strong>Date & Time:</strong> ${fmtDateTime(finalDatetime)}</p>
                        <p><strong>Mode:</strong> ${modeLabel}</p>
                        ${finalLink ? `<p><strong>Meeting Link:</strong> ${finalLink}</p>` : ''}
                        ${finalLocation && finalMode === 'in_person' ? `<p><strong>Location:</strong> ${finalLocation}</p>` : ''}
                        <p>The candidate has been notified and will confirm their availability.</p>
                        <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                    `,
                });
            }

            // Email candidate with interview details
            if (cr.candidate_email) {
                safeEmail({
                    to: cr.candidate_email,
                    cc: cr.exec_email,
                    subject: `Interview Scheduled — ${cr.job_title} at ${cr.company_name}`,
                    html: `
                        <p>Hi ${cr.candidate_name},</p>
                        <p>An interview has been scheduled for your application for <strong>${cr.job_title}</strong> at <strong>${cr.company_name}</strong>.</p>
                        <p><strong>Date & Time:</strong> ${fmtDateTime(finalDatetime)}</p>
                        <p><strong>Mode:</strong> ${modeLabel}</p>
                        ${finalLink ? `<p><strong>Meeting Link:</strong> ${finalLink}</p>` : ''}
                        ${finalLocation && finalMode === 'in_person' ? `<p><strong>Location:</strong> ${finalLocation}</p>` : ''}
                        <p>Please log in to your <strong>Candidate Portal → Applications</strong> to confirm your availability.</p>
                        <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                    `,
                });
            }

            res.json({ message: 'Interview approved and slot created.', slot_id: slotResult.insertId });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('[interviewRequest.approve]', err);
        res.status(500).json({ message: 'Failed to approve request.' });
    }
};

// ── GET /api/interview-requests/executive/scheduled ──────────────────────────
// Confirmed/upcoming interviews across the executive's assigned companies, so
// the executive team can notify candidates and run the interview. Executives
// see the candidate's REAL contact details (Ladder is the intermediary).
exports.listExecScheduled = async (req, res) => {
    const { status, scope } = req.query; // scope=upcoming|past|all (default upcoming+active)
    const isAdmin = req.user.role === 'admin';
    const conditions = ['is2.deleted_at IS NULL'];
    const params = [];

    if (!isAdmin) {
        // Assigned-to-company OR sourced-the-candidate — same rule as the queue
        conditions.push('(co.assigned_executive_id = ? OR a.sourced_by = ?)');
        params.push(req.user.id, req.user.id);
    }
    if (status) {
        conditions.push('is2.status = ?');
        params.push(status);
    } else if (scope !== 'all' && scope !== 'past') {
        // Default view: actionable interviews still in play
        conditions.push("is2.status IN ('proposed', 'confirmed', 'rescheduled')");
    }
    if (scope === 'upcoming') conditions.push('is2.slot_datetime >= NOW()');
    if (scope === 'past') conditions.push('is2.slot_datetime < NOW()');

    try {
        const [rows] = await db.query(
            `SELECT is2.id, is2.slot_datetime, is2.duration_mins, is2.mode,
                    is2.meeting_link, is2.location_detail, is2.status, is2.candidate_confirmed,
                    is2.created_at,
                    a.id AS application_id, a.status AS application_status,
                    jp.id AS job_id, jp.title AS job_title,
                    co.id AS company_id, co.company_name,
                    cand.id AS candidate_id,
                    cand_u.name AS candidate_name, cand_u.email AS candidate_email,
                    cand_u.phone AS candidate_phone, cand_u.last_login_at AS candidate_last_login,
                    a.source AS application_source,
                    exec_u.name AS executive_name,
                    io.result AS outcome_result,
                    o.id AS offer_id, o.status AS offer_status
             FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             JOIN candidates cand ON cand.id = a.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             LEFT JOIN users exec_u ON exec_u.id = co.assigned_executive_id
             LEFT JOIN interview_outcomes io ON io.interview_id = is2.id AND io.deleted_at IS NULL
             LEFT JOIN offers o ON o.application_id = a.id AND o.deleted_at IS NULL
             WHERE ${conditions.join(' AND ')}
             ORDER BY is2.slot_datetime ASC`,
            params
        );

        const data = rows.map(r => ({
            ...r,
            candidate_never_logged_in: !r.candidate_last_login,
        }));
        res.json({ success: true, data });
    } catch (err) {
        console.error('[interviewRequest.listScheduled]', err);
        res.status(500).json({ message: 'Failed to fetch scheduled interviews.' });
    }
};

// ── PATCH /api/interview-requests/executive/slots/:id/confirm ─────────────────
// Executive confirms a slot ON BEHALF of the candidate. Essential for
// executive-sourced candidates who never log in to confirm themselves.
exports.execConfirmSlot = async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    try {
        const [[slot]] = await db.query(
            `SELECT is2.id, is2.status, is2.slot_datetime, is2.mode,
                    co.assigned_executive_id, co.user_id AS company_user_id,
                    co.company_name, jp.title AS job_title, a.sourced_by,
                    cand_u.id AS candidate_user_id, cand_u.name AS candidate_name
             FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             JOIN candidates cand ON cand.id = a.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             WHERE is2.id = ? AND is2.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!slot) return res.status(404).json({ message: 'Interview slot not found.' });
        if (!isAdmin && slot.assigned_executive_id !== req.user.id && slot.sourced_by !== req.user.id) {
            return res.status(403).json({ message: 'This interview is not assigned to you.' });
        }
        if (slot.status === 'cancelled' || slot.status === 'completed') {
            return res.status(409).json({ message: `Cannot confirm a ${slot.status} interview.` });
        }

        await db.query(
            `UPDATE interview_slots SET candidate_confirmed = 1, status = 'confirmed' WHERE id = ?`,
            [req.params.id]
        );

        // Notify the company that the slot is confirmed
        notify(
            slot.company_user_id,
            'interview_confirmed',
            `Interview Confirmed — ${slot.candidate_name}`,
            `LadderStep Human Consulting has confirmed the interview for ${slot.candidate_name} (${slot.job_title}) on ${fmtDateTime(slot.slot_datetime)}.`,
            { slot_id: slot.id }
        );
        // Notify the candidate (in case they do log in)
        notify(
            slot.candidate_user_id,
            'interview_confirmed',
            `Interview Confirmed — ${slot.job_title}`,
            `Your interview for ${slot.job_title} on ${fmtDateTime(slot.slot_datetime)} has been confirmed by LadderStep Human Consulting.`,
            { slot_id: slot.id }
        );

        res.json({ message: 'Interview confirmed on behalf of the candidate.' });
    } catch (err) {
        console.error('[interviewRequest.execConfirm]', err);
        res.status(500).json({ message: 'Failed to confirm interview.' });
    }
};

// ── PUT /api/hr/interview-requests/:id/reject ────────────────────────────────
exports.rejectRequest = async (req, res) => {
    const { rejection_reason } = req.body;
    if (!rejection_reason?.trim()) return res.status(400).json({ message: 'rejection_reason is required.' });
    const isAdmin = req.user.role === 'admin';

    try {
        const [[cr]] = await db.query(
            `SELECT cr.id, cr.status,
                    co_u.id AS company_user_id, co_u.email AS company_email,
                    cand_u.name AS candidate_name
             FROM company_requests cr
             JOIN companies co ON co.id = cr.company_id
             JOIN users co_u ON co_u.id = co.user_id
             JOIN applications a ON a.id = cr.application_id
             JOIN candidates cand ON cand.id = cr.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             WHERE cr.id = ? AND cr.deleted_at IS NULL
               AND (? OR co.assigned_executive_id = ? OR a.sourced_by = ?)`,
            [req.params.id, isAdmin, req.user.id, req.user.id]
        );
        if (!cr) return res.status(404).json({ message: 'Request not found.' });
        if (['resolved', 'rejected'].includes(cr.status)) {
            return res.status(409).json({ message: 'Request is already finalized.' });
        }

        await db.query(
            `UPDATE company_requests
             SET status = 'rejected', rejection_reason = ?, resolved_at = NOW(), resolved_by = ?
             WHERE id = ?`,
            [rejection_reason, req.user.id, cr.id]
        );

        notify(
            cr.company_user_id,
            'interview_rejected',
            `Interview Request Not Confirmed — ${cr.candidate_name}`,
            `Your interview request for ${cr.candidate_name} could not be confirmed. Reason: ${rejection_reason}. Please submit a new request with an alternate time.`,
            { request_id: cr.id }
        );

        if (cr.company_email) {
            safeEmail({
                to: cr.company_email,
                subject: `Interview Request — Update`,
                html: `
                    <p>Hi,</p>
                    <p>Your interview request for <strong>${cr.candidate_name}</strong> could not be confirmed at the proposed time.</p>
                    <p><strong>Reason:</strong> ${rejection_reason}</p>
                    <p>Please log in to your <strong>Company Portal → Interviews</strong> to submit a new request with an alternate date/time.</p>
                    <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                `,
            });
        }

        res.json({ message: 'Request rejected.' });
    } catch (err) {
        console.error('[interviewRequest.reject]', err);
        res.status(500).json({ message: 'Failed to reject request.' });
    }
};

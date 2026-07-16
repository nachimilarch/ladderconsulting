const db = require('../config/db');
const { sendEmail } = require('../utils/email');
const { maskName } = require('../utils/maskPII');
const { generateOfferLetterPDF } = require('../utils/offerLetterPdf');
const wa = require('../utils/whatsappNotify');

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (err) { console.error('[notify]', err.message); }
};

// Looks up the executive assigned to the company that owns this application
// (falling back to whoever sourced the candidate, then an active admin) — used
// to keep LadderStep Human Consulting in the loop on company/candidate-initiated actions
// that don't otherwise pass through an executive-approval endpoint.
const getNotifyTarget = async (companyId, sourcedBy = null) => {
    const [[co]] = await db.query(
        `SELECT co.assigned_executive_id, u.email, u.name
         FROM companies co LEFT JOIN users u ON u.id = co.assigned_executive_id
         WHERE co.id = ?`,
        [companyId]
    );
    if (co?.assigned_executive_id) return { userId: co.assigned_executive_id, email: co.email, name: co.name };
    if (sourcedBy) {
        const [[u]] = await db.query(`SELECT id, email, name FROM users WHERE id = ? AND deleted_at IS NULL`, [sourcedBy]);
        if (u) return { userId: u.id, email: u.email, name: u.name };
    }
    const [[admin]] = await db.query(
        `SELECT u.id, u.email, u.name FROM users u JOIN roles ro ON ro.id = u.role_id
         WHERE ro.name = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL LIMIT 1`
    );
    return admin ? { userId: admin.id, email: admin.email, name: admin.name } : null;
};

// ── Shared helpers ─────────────────────────────────────────────────────────────
const getCompanyId = async (userId) => {
    const [rows] = await db.query(
        'SELECT id FROM companies WHERE user_id = ? AND deleted_at IS NULL', [userId]
    );
    if (rows.length) return rows[0].id;
    const [[user]] = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
    const [result] = await db.query(
        'INSERT INTO companies (user_id, company_name, is_approved) VALUES (?, ?, 1)',
        [userId, user.name]
    );
    return result.insertId;
};

const getCandidateId = async (userId) => {
    await db.query('INSERT IGNORE INTO candidates (user_id) VALUES (?)', [userId]);
    const [[row]] = await db.query('SELECT id FROM candidates WHERE user_id = ?', [userId]);
    return row.id;
};

// Fire-and-forget email — interview flow never blocks on email failures
const safeEmail = (opts) => sendEmail(opts).catch(err => console.error('[Email]', err.message));

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }) + ' IST' : '';

// ── POST /api/interviews/slots — DISABLED ──────────────────────────────────────
// Companies may NOT create interview slots directly. Every interview must be
// routed through the approval gate (POST /api/interview-requests), so the
// assigned LadderStep Human Consulting executive reviews and confirms it — that approval
// is what entitles Ladder to its placement cut once the candidate is hired.
// Slots are created only by interviewRequestController.approveRequest.
exports.createSlot = async (req, res) => {
    return res.status(403).json({
        message: 'Interviews must be requested for executive approval. Please submit an interview request — your assigned LadderStep Human Consulting executive will confirm the slot.',
        code: 'APPROVAL_REQUIRED',
    });
};

// ── GET /api/interviews/slots ──────────────────────────────────────────────────
exports.listCompanySlots = async (req, res) => {
    try {
        const companyId = await getCompanyId(req.user.id);

        // Check once at the company level: Package A/B (non-Platinum with any paid order)
        // → no placement fee for any candidate, show real names
        const [[companyRow]] = await db.query(
            'SELECT placement_fee_percent FROM companies WHERE id = ? AND deleted_at IS NULL',
            [companyId]
        );
        const isPackageAB = companyRow?.placement_fee_percent == null;
        let hasPaidPackage = false;
        if (isPackageAB) {
            const [[pkgRow]] = await db.query(
                `SELECT ruo.id FROM resume_unlock_orders ruo
                 JOIN invoices inv ON inv.id = ruo.invoice_id AND inv.status = 'paid'
                 WHERE ruo.company_id = ? LIMIT 1`,
                [companyId]
            );
            hasPaidPackage = !!pkgRow;
        }
        const prepaidUnlock = isPackageAB && hasPaidPackage;

        const [slots] = await db.query(
            `SELECT is2.id, is2.slot_datetime, is2.duration_mins, is2.mode,
                    is2.meeting_link, is2.location_detail, is2.status, is2.candidate_confirmed,
                    a.id AS application_id, a.status AS application_status,
                    jp.id AS job_id, jp.title AS job_title,
                    u.name AS candidate_name, u.email AS candidate_email,
                    io.id AS outcome_id, io.result AS outcome_result,
                    io.feedback AS outcome_feedback, io.rating AS outcome_rating,
                    o.id AS offer_id, o.status AS offer_status, o.ctc, o.joining_date
             FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             LEFT JOIN interview_outcomes io ON io.interview_id = is2.id AND io.deleted_at IS NULL
             LEFT JOIN offers o ON o.application_id = a.id AND o.deleted_at IS NULL
             WHERE jp.company_id = ? AND is2.deleted_at IS NULL
             ORDER BY is2.slot_datetime DESC`,
            [companyId]
        );

        const masked = slots.map(s => {
            const { candidate_email, ...rest } = s;
            return {
                ...rest,
                candidate_name: prepaidUnlock ? s.candidate_name : maskName(s.candidate_name),
                prepaid_unlock: prepaidUnlock,
            };
        });
        res.json({ slots: masked });
    } catch (err) {
        console.error('listCompanySlots error:', err);
        res.status(500).json({ message: 'Failed to fetch interviews.' });
    }
};

// ── PATCH /api/interviews/slots/:id/cancel ────────────────────────────────────
exports.cancelSlot = async (req, res) => {
    try {
        const companyId = await getCompanyId(req.user.id);

        const [check] = await db.query(
            `SELECT is2.id, is2.slot_datetime, a.sourced_by,
                    jp.title AS job_title, co.company_name,
                    cand_u.id AS candidate_user_id, cand_u.name AS candidate_name, cand_u.email AS candidate_email
             FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             JOIN candidates cand ON cand.id = a.candidate_id
             JOIN users cand_u ON cand_u.id = cand.user_id
             WHERE is2.id = ? AND jp.company_id = ? AND is2.deleted_at IS NULL`,
            [req.params.id, companyId]
        );
        if (!check.length) return res.status(404).json({ message: 'Interview slot not found.' });
        const ctx = check[0];

        await db.query(
            `UPDATE interview_slots SET status = 'cancelled', deleted_at = NOW() WHERE id = ?`,
            [req.params.id]
        );

        // Candidate and LadderStep Human Consulting both need to know — neither initiated this.
        notify(
            ctx.candidate_user_id,
            'interview_cancelled',
            `Interview Cancelled — ${ctx.job_title}`,
            `Your interview for ${ctx.job_title} on ${fmtDateTime(ctx.slot_datetime)} has been cancelled by ${ctx.company_name}.`,
            { slot_id: req.params.id }
        );
        if (ctx.candidate_email) {
            safeEmail({
                to: ctx.candidate_email,
                subject: `Interview Cancelled — ${ctx.job_title}`,
                html: `
                    <p>Hi ${ctx.candidate_name},</p>
                    <p>Your interview for <strong>${ctx.job_title}</strong> scheduled for ${fmtDateTime(ctx.slot_datetime)} has been cancelled by <strong>${ctx.company_name}</strong>.</p>
                    <p>Your LadderStep Human Consulting executive will follow up if a new slot is proposed.</p>
                    <br/><p>LadderStep Human Consulting Team</p>
                `,
            });
        }

        const target = await getNotifyTarget(companyId, ctx.sourced_by);
        if (target) {
            notify(
                target.userId,
                'interview_cancelled',
                `Interview Cancelled — ${ctx.company_name}`,
                `${ctx.company_name} cancelled the interview for ${ctx.candidate_name} (${ctx.job_title}), originally set for ${fmtDateTime(ctx.slot_datetime)}.`,
                { slot_id: req.params.id }
            );
            if (target.email) {
                safeEmail({
                    to: target.email,
                    subject: `Interview Cancelled — ${ctx.company_name}`,
                    html: `
                        <p>Hi ${target.name || ''},</p>
                        <p><strong>${ctx.company_name}</strong> cancelled the interview for <strong>${ctx.candidate_name}</strong> (${ctx.job_title}), originally set for ${fmtDateTime(ctx.slot_datetime)}.</p>
                        <br/><p>LadderStep Human Consulting System</p>
                    `,
                });
            }
        }

        // WhatsApp — notify candidate of cancellation
        wa.notifyInterviewCancelledCand(ctx.candidate_email ? null : undefined, ctx.candidate_name, ctx.job_title, ctx.company_name);
        db.query('SELECT phone FROM users WHERE id = ?', [ctx.candidate_user_id]).then(([[u]]) => {
            wa.notifyInterviewCancelledCand(u?.phone, ctx.candidate_name, ctx.job_title, ctx.company_name);
        }).catch(() => {});

        res.json({ message: 'Interview cancelled.' });
    } catch (err) {
        console.error('cancelSlot error:', err);
        res.status(500).json({ message: 'Failed to cancel interview.' });
    }
};

// ── POST /api/interviews/:id/outcome ──────────────────────────────────────────
exports.recordOutcome = async (req, res) => {
    const { result, feedback, rating } = req.body;
    if (!['selected', 'hold', 'rejected'].includes(result)) {
        return res.status(400).json({ message: 'result must be selected, hold, or rejected.' });
    }

    try {
        const companyId = await getCompanyId(req.user.id);

        const [check] = await db.query(
            `SELECT is2.id, a.id AS application_id, a.sourced_by,
                    u.name AS candidate_name, u.email AS candidate_email, jp.title AS job_title,
                    co.company_name, co_u.email AS company_email,
                    eu.email AS exec_email
             FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             JOIN users co_u ON co_u.id = co.user_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             LEFT JOIN users eu ON eu.id = co.assigned_executive_id
             WHERE is2.id = ? AND jp.company_id = ? AND is2.deleted_at IS NULL`,
            [req.params.id, companyId]
        );
        if (!check.length) return res.status(404).json({ message: 'Interview not found.' });

        const ctx = check[0];

        await db.query(
            `INSERT INTO interview_outcomes (interview_id, recorded_by, result, feedback, rating)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 result = VALUES(result), feedback = VALUES(feedback), rating = VALUES(rating)`,
            [req.params.id, req.user.id, result, feedback || null, rating || null]
        );

        await db.query(
            `UPDATE interview_slots SET status = 'completed' WHERE id = ?`, [req.params.id]
        );

        const appStatus = result === 'rejected' ? 'rejected' : 'interviewed';
        await db.query(
            `UPDATE applications SET status = ? WHERE id = ? AND deleted_at IS NULL`,
            [appStatus, ctx.application_id]
        );

        const target = await getNotifyTarget(companyId, ctx.sourced_by);
        const resultLabel = result === 'selected' ? 'Selected' : result === 'hold' ? 'On Hold' : 'Rejected';
        const execCc = ctx.exec_email || target?.email || null;

        if (result === 'selected') {
            if (ctx.candidate_email) {
                safeEmail({
                    to: ctx.candidate_email,
                    cc: execCc,
                    subject: `Exciting update on your ${ctx.job_title} application!`,
                    html: `
                        <p>Hi ${ctx.candidate_name},</p>
                        <p>Congratulations! You have been <strong>selected</strong> after your interview for <strong>${ctx.job_title}</strong> at <strong>${ctx.company_name}</strong>.</p>
                        <p>You will receive a formal offer letter shortly. Please keep an eye on your <strong>Candidate Portal → Applications</strong>.</p>
                        <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                    `,
                });
            }
        }

        if (result === 'rejected') {
            if (ctx.candidate_email) {
                safeEmail({
                    to: ctx.candidate_email,
                    cc: execCc,
                    subject: `Update on your ${ctx.job_title} application`,
                    html: `
                        <p>Hi ${ctx.candidate_name},</p>
                        <p>Thank you for interviewing for <strong>${ctx.job_title}</strong> at <strong>${ctx.company_name}</strong>.</p>
                        <p>After careful consideration, the hiring team has decided not to move forward with your application at this time.</p>
                        ${feedback ? `<p><strong>Feedback:</strong> ${feedback}</p>` : ''}
                        <p>We encourage you to continue exploring other opportunities on the LadderStep Human Consulting platform.</p>
                        <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                    `,
                });
            }
            if (ctx.company_email) {
                safeEmail({
                    to: ctx.company_email,
                    cc: execCc,
                    subject: `Interview Outcome Recorded — ${ctx.candidate_name}`,
                    html: `
                        <p>Hi,</p>
                        <p>The interview outcome for <strong>${ctx.candidate_name}</strong> (${ctx.job_title}) has been recorded as <strong>Not Selected</strong>.</p>
                        ${feedback ? `<p><strong>Your Feedback:</strong> ${feedback}</p>` : ''}
                        <p>You can continue reviewing other candidates via <strong>Company Portal → Shortlist</strong>.</p>
                        <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                    `,
                });
            }
        }

        // LadderStep Human Consulting otherwise has no visibility into outcomes — the executive
        // can't act on the next step (offer-letter request, re-engagement) without this.
        if (target) {
            notify(
                target.userId,
                'interview_outcome',
                `Interview Outcome: ${resultLabel} — ${ctx.candidate_name}`,
                `${ctx.company_name} recorded "${resultLabel}" for ${ctx.candidate_name}'s interview (${ctx.job_title}).${result === 'selected' ? ' Awaiting offer letter request.' : ''}`,
                { application_id: ctx.application_id, slot_id: req.params.id }
            );
            if (target.email) {
                safeEmail({
                    to: target.email,
                    subject: `Interview Outcome: ${resultLabel} — ${ctx.candidate_name}`,
                    html: `
                        <p>Hi ${target.name || ''},</p>
                        <p><strong>${ctx.company_name}</strong> recorded <strong>${resultLabel}</strong> for <strong>${ctx.candidate_name}</strong>'s interview (${ctx.job_title}).</p>
                        ${feedback ? `<p><strong>Feedback:</strong> ${feedback}</p>` : ''}
                        <br/><p>LadderStep Human Consulting System</p>
                    `,
                });
            }
        }

        res.json({ message: 'Outcome recorded.' });
    } catch (err) {
        console.error('recordOutcome error:', err);
        res.status(500).json({ message: 'Failed to record outcome.' });
    }
};

// ── POST /api/interviews/:id/offer ────────────────────────────────────────────
exports.generateOffer = async (req, res) => {
    const { ctc, joining_date, valid_until, notes } = req.body;

    try {
        const companyId = await getCompanyId(req.user.id);

        const [check] = await db.query(
            `SELECT is2.id, a.id AS application_id, a.sourced_by,
                    io.result, jp.title AS job_title,
                    u.name AS candidate_name, u.email AS candidate_email,
                    co.company_name, co_u.email AS company_email,
                    eu.email AS exec_email
             FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             JOIN users co_u ON co_u.id = co.user_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             LEFT JOIN users eu ON eu.id = co.assigned_executive_id
             LEFT JOIN interview_outcomes io ON io.interview_id = is2.id AND io.deleted_at IS NULL
             WHERE is2.id = ? AND jp.company_id = ? AND is2.deleted_at IS NULL`,
            [req.params.id, companyId]
        );
        if (!check.length) return res.status(404).json({ message: 'Interview not found.' });

        const ctx = check[0];
        if (ctx.result !== 'selected') {
            return res.status(400).json({ message: 'Candidate must be marked as selected before sending an offer.' });
        }

        // Offer letter grant check — placement fee must be confirmed by executive
        const [[grant]] = await db.query(
            `SELECT id FROM offer_letter_grants
             WHERE application_id = ? AND deleted_at IS NULL LIMIT 1`,
            [ctx.application_id]
        );
        if (!grant) {
            return res.status(403).json({
                message: 'Offer letter release not approved. Please complete the placement fee process.',
                error_code: 'OFFER_GRANT_REQUIRED',
            });
        }

        const [result] = await db.query(
            `INSERT INTO offers (application_id, issued_by, ctc, joining_date, valid_until, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ctx.application_id, req.user.id, ctc || null,
             joining_date || null, valid_until || null, notes || null]
        );

        await db.query(
            `UPDATE applications SET status = 'offer_sent' WHERE id = ? AND deleted_at IS NULL`,
            [ctx.application_id]
        );

        const ctcFormatted = ctc ? `₹${(ctc / 100000).toFixed(2)}L per annum` : 'As discussed';

        safeEmail({
            to: ctx.candidate_email,
            cc: ctx.exec_email,
            subject: `Offer Letter — ${ctx.job_title}`,
            html: `
                <p>Hi ${ctx.candidate_name},</p>
                <p>We are delighted to extend an offer for the position of <strong>${ctx.job_title}</strong> at <strong>${ctx.company_name}</strong>.</p>
                <table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif;">
                    <tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#374151;">CTC</td><td style="padding:6px 0;color:#111827;">${ctcFormatted}</td></tr>
                    ${joining_date ? `<tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#374151;">Joining Date</td><td style="padding:6px 0;color:#111827;">${fmtDate(joining_date)}</td></tr>` : ''}
                    ${valid_until ? `<tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#374151;">Offer Valid Until</td><td style="padding:6px 0;color:#111827;">${fmtDate(valid_until)}</td></tr>` : ''}
                </table>
                ${notes ? `<p style="color:#6b7280;font-style:italic;">${notes}</p>` : ''}
                <p>Please log in to your <strong>Candidate Portal → Applications</strong> to accept or decline this offer.</p>
                <br/><p>Warm regards,<br/>LadderStep Human Consulting Team</p>
            `,
        });

        // Notify company that the offer has been sent to the candidate
        if (ctx.company_email) {
            safeEmail({
                to: ctx.company_email,
                cc: ctx.exec_email,
                subject: `Offer Sent to ${ctx.candidate_name} — ${ctx.job_title}`,
                html: `
                    <p>Hi,</p>
                    <p>The offer letter for <strong>${ctx.candidate_name}</strong> (${ctx.job_title}) has been sent successfully.</p>
                    <table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif;">
                        <tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#374151;">CTC</td><td style="padding:6px 0;color:#111827;">${ctcFormatted}</td></tr>
                        ${joining_date ? `<tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#374151;">Joining Date</td><td style="padding:6px 0;color:#111827;">${fmtDate(joining_date)}</td></tr>` : ''}
                        ${valid_until ? `<tr><td style="padding:6px 16px 6px 0;font-weight:600;color:#374151;">Offer Valid Until</td><td style="padding:6px 0;color:#111827;">${fmtDate(valid_until)}</td></tr>` : ''}
                    </table>
                    <p>The candidate will accept or decline via their portal. You will be notified of their response.</p>
                    <br/><p>Best regards,<br/>LadderStep Human Consulting Team</p>
                `,
            });
        }

        // WhatsApp — notify candidate about the offer
        db.query('SELECT phone FROM users WHERE email = ?', [ctx.candidate_email]).then(([[u]]) => {
            wa.notifyOfferReceivedCand(u?.phone, ctx.candidate_name, ctx.company_name, ctx.job_title);
        }).catch(() => {});

        res.status(201).json({ message: 'Offer sent.', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'An offer already exists for this application.' });
        }
        console.error('generateOffer error:', err);
        res.status(500).json({ message: 'Failed to generate offer.' });
    }
};

// ── GET /api/interviews/my ─────────────────────────────────────────────────────
exports.getCandidateInterviews = async (req, res) => {
    try {
        const [candidateRows] = await db.query(
            'SELECT id FROM candidates WHERE user_id = ? AND deleted_at IS NULL',
            [req.user.id]
        );
        if (!candidateRows.length) {
            return res.json({ interviews: [] });
        }
        const candidateId = candidateRows[0].id;

        const [interviews] = await db.query(
            `SELECT is2.id, is2.slot_datetime, is2.duration_mins, is2.mode,
                    is2.meeting_link, is2.location_detail, is2.status, is2.candidate_confirmed,
                    a.id AS application_id, a.status AS application_status,
                    jp.title AS job_title, c.company_name,
                    io.result AS outcome_result, io.feedback AS outcome_feedback,
                    io.rating AS outcome_rating
             FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies c ON c.id = jp.company_id
             LEFT JOIN interview_outcomes io ON io.interview_id = is2.id AND io.deleted_at IS NULL
             WHERE a.candidate_id = ? AND is2.deleted_at IS NULL
             ORDER BY is2.slot_datetime DESC`,
            [candidateId]
        );

        res.json({ interviews });
    } catch (err) {
        console.error('[getCandidateInterviews]', err.message, err.stack);
        res.status(500).json({ message: 'Failed to fetch interviews.' });
    }
};

// ── PATCH /api/interviews/slots/:id/confirm ───────────────────────────────────
exports.confirmSlot = async (req, res) => {
    try {
        const candidateId = await getCandidateId(req.user.id);

        const [check] = await db.query(
            `SELECT is2.id, is2.slot_datetime, is2.status, jp.title AS job_title,
                    co.id AS company_id, a.sourced_by,
                    cu.email AS company_email, cu.name AS company_contact,
                    eu.email AS exec_email
             FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             JOIN users cu ON cu.id = co.user_id
             LEFT JOIN users eu ON eu.id = co.assigned_executive_id
             WHERE is2.id = ? AND a.candidate_id = ? AND is2.deleted_at IS NULL`,
            [req.params.id, candidateId]
        );
        if (!check.length) return res.status(404).json({ message: 'Interview not found.' });

        const ctx = check[0];
        if (ctx.status === 'cancelled') {
            return res.status(400).json({ message: 'Cannot confirm a cancelled interview.' });
        }

        await db.query(
            `UPDATE interview_slots SET candidate_confirmed = 1, status = 'confirmed' WHERE id = ?`,
            [req.params.id]
        );

        const [[candidateUser]] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);

        safeEmail({
            to: ctx.company_email,
            cc: ctx.exec_email,
            subject: `Interview Confirmed — ${ctx.job_title}`,
            html: `
                <p>Hi ${ctx.company_contact},</p>
                <p><strong>${candidateUser.name}</strong> has confirmed their interview for <strong>${ctx.job_title}</strong>.</p>
                <p><strong>Confirmed Time:</strong> ${fmtDateTime(ctx.slot_datetime)}</p>
                <br/><p>LadderStep Human Consulting Team</p>
            `,
        });

        const target = await getNotifyTarget(ctx.company_id, ctx.sourced_by);
        if (target) {
            notify(
                target.userId,
                'interview_confirmed',
                `Interview Confirmed — ${candidateUser.name}`,
                `${candidateUser.name} confirmed their interview for ${ctx.job_title} on ${fmtDateTime(ctx.slot_datetime)}.`,
                { slot_id: req.params.id }
            );
        }

        // WhatsApp — notify company contact that candidate confirmed
        wa.notifyInterviewConfirmedCo(ctx.company_email ? undefined : null, candidateUser.name, ctx.job_title, fmtDateTime(ctx.slot_datetime));
        db.query('SELECT phone FROM users WHERE email = ?', [ctx.company_email]).then(([[u]]) => {
            wa.notifyInterviewConfirmedCo(u?.phone, candidateUser.name, ctx.job_title, fmtDateTime(ctx.slot_datetime));
        }).catch(() => {});

        res.json({ message: 'Interview confirmed.' });
    } catch (err) {
        console.error('confirmSlot error:', err);
        res.status(500).json({ message: 'Failed to confirm interview.' });
    }
};

// ── PATCH /api/interviews/slots/:id/reschedule ────────────────────────────────
exports.requestReschedule = async (req, res) => {
    const { reason } = req.body;

    try {
        const candidateId = await getCandidateId(req.user.id);

        const [check] = await db.query(
            `SELECT is2.id, is2.slot_datetime, jp.title AS job_title,
                    co.id AS company_id, co.company_name, a.sourced_by,
                    cu.email AS company_email, cu.name AS company_contact
             FROM interview_slots is2
             JOIN applications a ON a.id = is2.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             JOIN users cu ON cu.id = co.user_id
             WHERE is2.id = ? AND a.candidate_id = ? AND is2.deleted_at IS NULL`,
            [req.params.id, candidateId]
        );
        if (!check.length) return res.status(404).json({ message: 'Interview not found.' });

        const ctx = check[0];

        await db.query(
            `UPDATE interview_slots SET status = 'rescheduled', candidate_confirmed = 0 WHERE id = ?`,
            [req.params.id]
        );

        const [[candidateUser]] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);

        safeEmail({
            to: ctx.company_email,
            subject: `Reschedule Request — ${ctx.job_title}`,
            html: `
                <p>Hi ${ctx.company_contact},</p>
                <p><strong>${candidateUser.name}</strong> has requested a reschedule for the <strong>${ctx.job_title}</strong> interview originally set for ${fmtDateTime(ctx.slot_datetime)}.</p>
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                <p>Please log in to the <strong>Company Portal → Interviews</strong> to propose a new time.</p>
                <br/><p>LadderStep Human Consulting Team</p>
            `,
        });

        const target = await getNotifyTarget(ctx.company_id, ctx.sourced_by);
        if (target) {
            notify(
                target.userId,
                'interview_reschedule_request',
                `Reschedule Requested — ${candidateUser.name}`,
                `${candidateUser.name} requested a reschedule for the ${ctx.job_title} interview originally set for ${fmtDateTime(ctx.slot_datetime)}.${reason ? ` Reason: ${reason}` : ''}`,
                { slot_id: req.params.id }
            );
            if (target.email) {
                safeEmail({
                    to: target.email,
                    subject: `Reschedule Requested — ${candidateUser.name}`,
                    html: `
                        <p>Hi ${target.name || ''},</p>
                        <p><strong>${candidateUser.name}</strong> requested a reschedule for the <strong>${ctx.job_title}</strong> interview at <strong>${ctx.company_name}</strong>, originally set for ${fmtDateTime(ctx.slot_datetime)}.</p>
                        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                        <br/><p>LadderStep Human Consulting System</p>
                    `,
                });
            }
        }

        res.json({ message: 'Reschedule request sent.' });
    } catch (err) {
        console.error('requestReschedule error:', err);
        res.status(500).json({ message: 'Failed to send reschedule request.' });
    }
};

// ── GET /api/interviews/offers/my ─────────────────────────────────────────────
exports.getCandidateOffers = async (req, res) => {
    try {
        const candidateId = await getCandidateId(req.user.id);

        const [offers] = await db.query(
            `SELECT o.id, o.ctc, o.joining_date, o.valid_until, o.status,
                    o.notes, o.created_at, o.candidate_response_at,
                    jp.title AS job_title, jp.id AS job_id,
                    co.company_name, a.id AS application_id
             FROM offers o
             JOIN applications a ON a.id = o.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             WHERE a.candidate_id = ? AND o.deleted_at IS NULL
             ORDER BY o.created_at DESC`,
            [candidateId]
        );

        res.json({ offers });
    } catch (err) {
        console.error('getCandidateOffers error:', err);
        res.status(500).json({ message: 'Failed to fetch offers.' });
    }
};

// ── PATCH /api/interviews/offers/:id/respond ──────────────────────────────────
exports.respondToOffer = async (req, res) => {
    const { response, decline_reason } = req.body;
    if (!['accepted', 'declined'].includes(response)) {
        return res.status(400).json({ message: 'response must be accepted or declined.' });
    }

    try {
        const candidateId = await getCandidateId(req.user.id);

        const [check] = await db.query(
            `SELECT o.id, o.application_id, o.ctc, o.joining_date, o.status AS current_status,
                    jp.title AS job_title, jp.company_id,
                    cu.email AS company_email, cu.name AS company_contact
             FROM offers o
             JOIN applications a ON a.id = o.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             JOIN users cu ON cu.id = co.user_id
             WHERE o.id = ? AND a.candidate_id = ? AND o.deleted_at IS NULL`,
            [req.params.id, candidateId]
        );
        if (!check.length) return res.status(404).json({ message: 'Offer not found.' });

        const ctx = check[0];
        if (!['sent', 'expired'].includes(ctx.current_status)) {
            return res.status(400).json({ message: 'This offer has already been responded to.' });
        }

        await db.query(
            `UPDATE offers SET status = ?, candidate_response_at = NOW() WHERE id = ?`,
            [response, req.params.id]
        );

        const [[candidateUser]] = await db.query(
            'SELECT name, email FROM users WHERE id = ?', [req.user.id]
        );

        if (response === 'accepted') {
            await db.query(
                `UPDATE applications SET status = 'hired' WHERE id = ? AND deleted_at IS NULL`,
                [ctx.application_id]
            );

            const [hireResult] = await db.query(
                `INSERT IGNORE INTO hired_employees
                 (candidate_id, company_id, application_id, offer_id, joining_date, role_title, onboarding_started)
                 VALUES (?, ?, ?, ?, ?, ?, 0)`,
                [candidateId, ctx.company_id, ctx.application_id,
                 req.params.id, ctx.joining_date || null, ctx.job_title]
            );

            // Trigger training auto-assignment for new hires (fire-and-forget)
            if (hireResult.insertId > 0) {
                const hireId = hireResult.insertId;
                setImmediate(() => {
                    require('../services/trainingService')
                        .triggerOnboardingForHire(hireId)
                        .catch(err => console.error('[Training] Onboarding trigger failed:', err.message));
                });
            }

            safeEmail({
                to: ctx.company_email,
                subject: `Offer Accepted — ${ctx.job_title}`,
                html: `
                    <p>Hi ${ctx.company_contact},</p>
                    <p>Great news! <strong>${candidateUser.name}</strong> has <strong>accepted</strong> the offer for <strong>${ctx.job_title}</strong>.</p>
                    ${ctx.joining_date ? `<p><strong>Joining Date:</strong> ${fmtDate(ctx.joining_date)}</p>` : ''}
                    <p>Please log in to the portal to begin onboarding.</p>
                    <br/><p>LadderStep Human Consulting Team</p>
                `,
            });

            // Notify all active HR staff and admins
            const [hrUsers] = await db.query(
                `SELECT u.email FROM users u
                 JOIN roles ro ON ro.id = u.role_id
                 WHERE ro.name IN ('hr_staff', 'admin') AND u.status = 'active' AND u.deleted_at IS NULL`
            );
            for (const hr of hrUsers) {
                safeEmail({
                    to: hr.email,
                    subject: `New Hire — ${ctx.job_title}`,
                    html: `
                        <p>Hi Team,</p>
                        <p><strong>${candidateUser.name}</strong> has accepted the offer for <strong>${ctx.job_title}</strong> and has been added to <em>hired_employees</em>.</p>
                        <p>Onboarding can now be initiated (onboarding_started = 0).</p>
                        <br/><p>LadderStep Human Consulting System</p>
                    `,
                });
            }
        } else {
            safeEmail({
                to: ctx.company_email,
                subject: `Offer Declined — ${ctx.job_title}`,
                html: `
                    <p>Hi ${ctx.company_contact},</p>
                    <p><strong>${candidateUser.name}</strong> has <strong>declined</strong> the offer for <strong>${ctx.job_title}</strong>.</p>
                    ${decline_reason ? `<p><strong>Reason:</strong> ${decline_reason}</p>` : ''}
                    <br/><p>LadderStep Human Consulting Team</p>
                `,
            });

            // Lost placement — LadderStep Human Consulting needs to know too, same audience as an
            // acceptance (all active HR staff + admins), so the team can re-engage.
            const [hrUsers] = await db.query(
                `SELECT u.email FROM users u
                 JOIN roles ro ON ro.id = u.role_id
                 WHERE ro.name IN ('hr_staff', 'admin') AND u.status = 'active' AND u.deleted_at IS NULL`
            );
            for (const hr of hrUsers) {
                safeEmail({
                    to: hr.email,
                    subject: `Offer Declined — ${ctx.job_title}`,
                    html: `
                        <p>Hi Team,</p>
                        <p><strong>${candidateUser.name}</strong> has declined the offer for <strong>${ctx.job_title}</strong>.</p>
                        ${decline_reason ? `<p><strong>Reason:</strong> ${decline_reason}</p>` : ''}
                        <p>Consider re-engaging the company with an alternate candidate.</p>
                        <br/><p>LadderStep Human Consulting System</p>
                    `,
                });
            }
        }

        res.json({ message: `Offer ${response}.` });
    } catch (err) {
        console.error('respondToOffer error:', err);
        res.status(500).json({ message: 'Failed to respond to offer.' });
    }
};

// ── GET /api/interviews/offers/:offerId/pdf  (company + hr_staff/admin) ────────
exports.downloadOfferLetterPDF = async (req, res) => {
    try {
        const offerId = req.params.offerId;
        const role = req.user.role;

        let query, params;

        if (role === 'company') {
            const companyId = await getCompanyId(req.user.id);
            query = `
                SELECT o.*, jp.title AS job_title, jp.job_type,
                       c.company_name, c.headquarters,
                       u_cand.name AS candidate_name, u_cand.email AS candidate_email,
                       u_exec.name AS issued_by_name
                FROM offers o
                JOIN applications a ON a.id = o.application_id
                JOIN job_postings jp ON jp.id = a.job_id
                JOIN companies c ON c.id = jp.company_id
                JOIN candidates cand ON cand.id = a.candidate_id
                JOIN users u_cand ON u_cand.id = cand.user_id
                LEFT JOIN users u_exec ON u_exec.id = o.issued_by
                WHERE o.id = ? AND jp.company_id = ? AND o.deleted_at IS NULL`;
            params = [offerId, companyId];
        } else {
            query = `
                SELECT o.*, jp.title AS job_title, jp.job_type,
                       c.company_name, c.headquarters,
                       u_cand.name AS candidate_name, u_cand.email AS candidate_email,
                       u_exec.name AS issued_by_name
                FROM offers o
                JOIN applications a ON a.id = o.application_id
                JOIN job_postings jp ON jp.id = a.job_id
                JOIN companies c ON c.id = jp.company_id
                JOIN candidates cand ON cand.id = a.candidate_id
                JOIN users u_cand ON u_cand.id = cand.user_id
                LEFT JOIN users u_exec ON u_exec.id = o.issued_by
                WHERE o.id = ? AND o.deleted_at IS NULL`;
            params = [offerId];
        }

        const [[offer]] = await db.query(query, params);
        if (!offer) return res.status(404).json({ message: 'Offer not found.' });

        const ctx = {
            company_name:    offer.company_name,
            headquarters:    offer.headquarters,
            job_title:       offer.job_title,
            job_type:        offer.job_type,
            candidate_name:  offer.candidate_name,
            candidate_email: offer.candidate_email,
            issued_by_name:  offer.issued_by_name,
        };

        const pdf = await generateOfferLetterPDF(offer, ctx);
        const filename = `OfferLetter-${(offer.candidate_name || 'Candidate').replace(/\s+/g, '_')}-${offer.job_title.replace(/\s+/g, '_')}.pdf`;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdf.length,
        });
        res.end(pdf);
    } catch (err) {
        console.error('[offerLetter.pdf]', err.message);
        res.status(500).json({ message: 'Failed to generate offer letter PDF.' });
    }
};

// ── POST /api/interviews/offers/:offerId/letter/send  (company) ───────────────
exports.sendOfferLetterEmail = async (req, res) => {
    try {
        const offerId = req.params.offerId;
        const companyId = await getCompanyId(req.user.id);

        const [[offer]] = await db.query(`
            SELECT o.*, jp.title AS job_title, jp.job_type,
                   c.company_name, c.headquarters,
                   u_cand.name AS candidate_name, u_cand.email AS candidate_email,
                   u_exec.name AS issued_by_name
            FROM offers o
            JOIN applications a ON a.id = o.application_id
            JOIN job_postings jp ON jp.id = a.job_id
            JOIN companies c ON c.id = jp.company_id
            JOIN candidates cand ON cand.id = a.candidate_id
            JOIN users u_cand ON u_cand.id = cand.user_id
            LEFT JOIN users u_exec ON u_exec.id = o.issued_by
            WHERE o.id = ? AND jp.company_id = ? AND o.deleted_at IS NULL`,
            [offerId, companyId]
        );
        if (!offer) return res.status(404).json({ message: 'Offer not found.' });

        const ctx = {
            company_name:    offer.company_name,
            headquarters:    offer.headquarters,
            job_title:       offer.job_title,
            job_type:        offer.job_type,
            candidate_name:  offer.candidate_name,
            candidate_email: offer.candidate_email,
            issued_by_name:  offer.issued_by_name,
        };

        const pdf = await generateOfferLetterPDF(offer, ctx);
        const filename = `OfferLetter-${(offer.candidate_name || 'Candidate').replace(/\s+/g, '_')}-${offer.job_title.replace(/\s+/g, '_')}.pdf`;

        await sendEmail({
            to: offer.candidate_email,
            subject: `Your Offer Letter — ${offer.job_title} at ${offer.company_name}`,
            html: `
                <p>Dear ${(offer.candidate_name || 'Candidate').split(' ')[0]},</p>
                <p>Please find attached your formal offer letter for the position of <strong>${offer.job_title}</strong> at <strong>${offer.company_name}</strong>, facilitated by LadderStep Human Consulting.</p>
                <p>Kindly log in to your <strong>Candidate Portal → Applications</strong> to accept or decline this offer.</p>
                <br/><p>Warm regards,<br/>LadderStep Human Consulting Team</p>
            `,
            attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
        });

        res.json({ message: 'Offer letter sent to candidate.' });
    } catch (err) {
        console.error('[offerLetter.send]', err.message);
        res.status(500).json({ message: 'Failed to send offer letter.' });
    }
};

const db = require('../config/db');

const getEmployeeId = async (userId) => {
    const [[emp]] = await db.query(
        'SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL', [userId]
    );
    return emp?.id ?? null;
};

// ── GET /reports/hiring — executive hiring dashboard ──────────────────────────
// Everything the admin sees about a company's hiring, scoped to the logged-in
// executive's assigned companies (admin sees all). Powers the HR Reports page.
exports.getHiringReport = async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    const me = req.user.id;
    // Validate date inputs to prevent SQL injection (only allow YYYY-MM-DD)
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    const date_from = ISO_DATE.test(req.query.date_from) ? req.query.date_from : null;
    const date_to   = ISO_DATE.test(req.query.date_to)   ? req.query.date_to   : null;

    // Build optional date clause for date-scoped queries
    const dateClause = (col) => {
        if (date_from && date_to) return ` AND DATE(${col}) BETWEEN '${date_from}' AND '${date_to}'`;
        if (date_from) return ` AND DATE(${col}) >= '${date_from}'`;
        if (date_to) return ` AND DATE(${col}) <= '${date_to}'`;
        return '';
    };

    try {
        // Resolve the executive's assigned companies (admin = every company)
        const [cos] = await db.query(
            isAdmin
                ? `SELECT id FROM companies WHERE deleted_at IS NULL`
                : `SELECT id FROM companies WHERE assigned_executive_id = ? AND deleted_at IS NULL`,
            isAdmin ? [] : [me]
        );
        const companyIds = cos.map(c => c.id);

        const empty = {
            scope: { companies: 0, is_admin: isAdmin, date_from: date_from || null, date_to: date_to || null },
            kpis: {
                hires_total: 0, hires_this_month: 0, active_jobs: 0, total_applications: 0,
                candidates_sourced: 0, pending_interview_requests: 0, pending_offer_requests: 0,
                upcoming_interviews: 0, awaiting_candidate_confirmation: 0, offers_pending: 0,
                pending_invoices: 0, outstanding_amount: 0, placement_fees_collected: 0,
            },
            pipeline: [], recent_placements: [],
            pending_actions: { interview_requests: [], offer_requests: [] },
        };
        if (!companyIds.length) return res.json({ success: true, data: empty });

        const inCo = `(${companyIds.map(() => '?').join(',')})`;
        const P = companyIds; // shorthand for the IN params

        // ── KPI counts (one round-trip each; report endpoint, not a hot path) ──
        const [[jobStats]] = await db.query(
            `SELECT
                (SELECT COUNT(*) FROM job_postings WHERE company_id IN ${inCo} AND status='active' AND deleted_at IS NULL) AS active_jobs,
                (SELECT COUNT(*) FROM applications a JOIN job_postings jp ON jp.id=a.job_id
                   WHERE jp.company_id IN ${inCo} AND a.deleted_at IS NULL${dateClause('a.created_at')}) AS total_applications,
                (SELECT COUNT(DISTINCT a.candidate_id) FROM applications a JOIN job_postings jp ON jp.id=a.job_id
                   WHERE jp.company_id IN ${inCo} AND a.source='executive' AND a.deleted_at IS NULL
                   ${isAdmin ? '' : 'AND a.sourced_by = ?'}${dateClause('a.created_at')}) AS candidates_sourced`,
            isAdmin ? [...P, ...P, ...P] : [...P, ...P, ...P, me]
        );

        const [[hireStats]] = await db.query(
            `SELECT
                COUNT(*) AS hires_total,
                SUM(MONTH(o.created_at)=MONTH(NOW()) AND YEAR(o.created_at)=YEAR(NOW())) AS hires_this_month
             FROM offers o
             JOIN applications a ON a.id = o.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             WHERE jp.company_id IN ${inCo} AND o.deleted_at IS NULL${dateClause('o.created_at')}`,
            P
        );

        const [[reqStats]] = await db.query(
            `SELECT
                SUM(request_type IN ('interview_schedule','interview_reschedule','interview_scheduling') AND status IN ('pending','in_progress')) AS pending_interview_requests,
                SUM(request_type='offer_letter_release' AND status='pending') AS pending_offer_requests
             FROM company_requests WHERE company_id IN ${inCo} AND deleted_at IS NULL`,
            P
        );

        const [[ivStats]] = await db.query(
            `SELECT
                SUM(is2.status IN ('proposed','confirmed','rescheduled') AND is2.slot_datetime >= NOW()) AS upcoming_interviews,
                SUM(is2.status IN ('proposed','rescheduled') AND is2.candidate_confirmed=0) AS awaiting_candidate_confirmation
             FROM interview_slots is2 JOIN applications a ON a.id=is2.application_id
             JOIN job_postings jp ON jp.id=a.job_id
             WHERE jp.company_id IN ${inCo} AND is2.deleted_at IS NULL`,
            P
        );

        const [[offerStats]] = await db.query(
            `SELECT COUNT(*) AS offers_pending
             FROM offers o JOIN applications a ON a.id=o.application_id
             JOIN job_postings jp ON jp.id=a.job_id
             WHERE jp.company_id IN ${inCo} AND o.status='sent' AND o.deleted_at IS NULL`,
            P
        );

        const [[invStats]] = await db.query(
            `SELECT
                COUNT(*) AS pending_invoices,
                COALESCE(SUM(amount - amount_paid), 0) AS outstanding_amount
             FROM invoices WHERE company_id IN ${inCo}
               AND status IN ('pending','partially_paid','overdue') AND deleted_at IS NULL`,
            P
        );

        const [[feeStats]] = await db.query(
            `SELECT COALESCE(SUM(placement_fee_amount), 0) AS placement_fees_collected
             FROM placement_fee_invoices WHERE company_id IN ${inCo} AND status='paid' AND deleted_at IS NULL`,
            P
        );

        // ── Pipeline by application status ──
        const [pipeline] = await db.query(
            `SELECT a.status, COUNT(*) AS count
             FROM applications a JOIN job_postings jp ON jp.id=a.job_id
             WHERE jp.company_id IN ${inCo} AND a.deleted_at IS NULL${dateClause('a.created_at')}
             GROUP BY a.status`,
            P
        );

        // ── Recent offers sent (= "placements" per business definition) ──
        const [recentPlacements] = await db.query(
            `SELECT o.id, jp.title AS role_title, o.joining_date, o.created_at,
                    u.name AS candidate_name, co.company_name, o.ctc
             FROM offers o
             JOIN applications a ON a.id = o.application_id
             JOIN job_postings jp ON jp.id = a.job_id
             JOIN companies co ON co.id = jp.company_id
             JOIN candidates c ON c.id = a.candidate_id
             JOIN users u ON u.id = c.user_id
             WHERE jp.company_id IN ${inCo} AND o.deleted_at IS NULL${dateClause('o.created_at')}
             ORDER BY o.created_at DESC LIMIT 10`,
            P
        );

        // ── Pending actions (for the "to do" list) ──
        const [pendingInterviews] = await db.query(
            `SELECT cr.id, co.company_name, cand_u.name AS candidate_name, jp.title AS job_title, cr.created_at
             FROM company_requests cr
             JOIN companies co ON co.id=cr.company_id
             JOIN applications a ON a.id=cr.application_id
             JOIN job_postings jp ON jp.id=a.job_id
             JOIN candidates cand ON cand.id=a.candidate_id
             JOIN users cand_u ON cand_u.id=cand.user_id
             WHERE cr.company_id IN ${inCo}
               AND cr.request_type IN ('interview_schedule','interview_reschedule')
               AND cr.status IN ('pending','in_progress') AND cr.deleted_at IS NULL
             ORDER BY cr.created_at ASC LIMIT 20`,
            P
        );
        const [pendingOffers] = await db.query(
            `SELECT cr.id, co.company_name, cand_u.name AS candidate_name, jp.title AS job_title,
                    pfi.placement_fee_amount, cr.created_at
             FROM company_requests cr
             JOIN companies co ON co.id=cr.company_id
             JOIN applications a ON a.id=cr.application_id
             JOIN job_postings jp ON jp.id=a.job_id
             JOIN candidates cand ON cand.id=a.candidate_id
             JOIN users cand_u ON cand_u.id=cand.user_id
             LEFT JOIN placement_fee_invoices pfi ON pfi.id=cr.invoice_id AND pfi.deleted_at IS NULL
             WHERE cr.company_id IN ${inCo}
               AND cr.request_type='offer_letter_release' AND cr.status='pending' AND cr.deleted_at IS NULL
             ORDER BY cr.created_at ASC LIMIT 20`,
            P
        );

        res.json({
            success: true,
            data: {
                scope: { companies: companyIds.length, is_admin: isAdmin, date_from: date_from || null, date_to: date_to || null },
                kpis: {
                    hires_total: Number(hireStats.hires_total) || 0,
                    hires_this_month: Number(hireStats.hires_this_month) || 0,
                    active_jobs: Number(jobStats.active_jobs) || 0,
                    total_applications: Number(jobStats.total_applications) || 0,
                    candidates_sourced: Number(jobStats.candidates_sourced) || 0,
                    pending_interview_requests: Number(reqStats.pending_interview_requests) || 0,
                    pending_offer_requests: Number(reqStats.pending_offer_requests) || 0,
                    upcoming_interviews: Number(ivStats.upcoming_interviews) || 0,
                    awaiting_candidate_confirmation: Number(ivStats.awaiting_candidate_confirmation) || 0,
                    offers_pending: Number(offerStats.offers_pending) || 0,
                    pending_invoices: Number(invStats.pending_invoices) || 0,
                    outstanding_amount: Number(invStats.outstanding_amount) || 0,
                    placement_fees_collected: Number(feeStats.placement_fees_collected) || 0,
                },
                pipeline,
                recent_placements: recentPlacements,
                pending_actions: { interview_requests: pendingInterviews, offer_requests: pendingOffers },
            },
        });
    } catch (err) {
        console.error('[report.getHiringReport]', err);
        res.status(500).json({ success: false, message: 'Failed to load hiring report.' });
    }
};

// ── GET /reports/hr — combined legacy report ───────────────────────────────────
exports.hrReport = async (req, res) => {
    const { date_from, date_to } = req.query;
    if (!date_from || !date_to) {
        return res.status(400).json({ success: false, message: 'date_from and date_to are required.' });
    }

    const isAdmin = req.user.role === 'admin';
    const empId = isAdmin ? null : await getEmployeeId(req.user.id);

    try {
        const callFilter = empId ? 'AND employee_id = ?' : '';
        const callParams = empId ? [date_from, date_to, empId] : [date_from, date_to];
        const [[callSummary]] = await db.query(
            `SELECT
               COUNT(*) AS total_calls,
               SUM(outcome = 'callback_scheduled') AS callbacks_scheduled,
               SUM(outcome = 'no_answer') AS no_answer,
               SUM(outcome = 'voicemail') AS voicemail,
               SUM(outcome = 'not_interested') AS not_interested,
               SUM(outcome = 'interested') AS interested,
               SUM(outcome = 'converted') AS converted
             FROM call_logs
             WHERE DATE(called_at) BETWEEN ? AND ? ${callFilter} AND deleted_at IS NULL`,
            callParams
        );

        const [callsByEmployee] = isAdmin ? await db.query(
            `SELECT u.name, COUNT(*) AS total,
               SUM(c.outcome = 'converted') AS converted
             FROM call_logs c
             JOIN employees e ON c.employee_id = e.id
             JOIN users u ON u.id = e.user_id
             WHERE DATE(c.called_at) BETWEEN ? AND ? AND c.deleted_at IS NULL
             GROUP BY e.id, u.name ORDER BY total DESC`,
            [date_from, date_to]
        ) : [[]];

        const leadFilter = empId ? 'AND assigned_to = ?' : '';
        const leadParams = empId ? [date_from, date_to, empId] : [date_from, date_to];
        const [[leadSummary]] = await db.query(
            `SELECT
               COUNT(*) AS total_leads,
               SUM(stage = 'new') AS new_leads,
               SUM(stage = 'contacted') AS contacted,
               SUM(stage = 'interested') AS interested,
               SUM(stage = 'proposal') AS proposal,
               SUM(stage = 'converted') AS converted,
               SUM(stage = 'lost') AS lost
             FROM leads
             WHERE deleted_at IS NULL AND DATE(created_at) BETWEEN ? AND ? ${leadFilter}`,
            leadParams
        );

        const taskFilter = empId ? 'AND assigned_to = ?' : '';
        const taskParams = empId ? [date_from, date_to, empId, date_from, date_to, empId] : [date_from, date_to, date_from, date_to];
        const [[taskSummary]] = await db.query(
            `SELECT
               COUNT(*) AS total_tasks,
               SUM(status = 'pending') AS pending,
               SUM(status = 'in_progress') AS in_progress,
               SUM(status = 'completed') AS completed,
               SUM(status = 'completed' AND DATE(completed_at) BETWEEN ? AND ?) AS completed_in_range
             FROM tasks
             WHERE deleted_at IS NULL AND DATE(created_at) BETWEEN ? AND ? ${taskFilter}`,
            taskParams
        );

        const [dailyCalls] = await db.query(
            `SELECT DATE(called_at) AS date, COUNT(*) AS total
             FROM call_logs
             WHERE DATE(called_at) BETWEEN ? AND ? ${callFilter} AND deleted_at IS NULL
             GROUP BY DATE(called_at) ORDER BY date ASC`,
            callParams
        );

        res.json({
            success: true,
            data: {
                period: { date_from, date_to },
                calls: { summary: callSummary, by_employee: callsByEmployee, daily_trend: dailyCalls },
                leads: leadSummary,
                tasks: taskSummary,
            },
        });
    } catch (err) {
        console.error('[report.hrReport]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /reports/calls — call volume report ───────────────────────────────────
exports.getCallReport = async (req, res) => {
    const { date_from, date_to, employee_id } = req.query;
    if (!date_from || !date_to) {
        return res.status(400).json({ success: false, message: 'date_from and date_to are required.' });
    }

    const isAdmin = req.user.role === 'admin';
    const empId = isAdmin ? (employee_id || null) : await getEmployeeId(req.user.id);
    const empFilter = empId ? 'AND c.employee_id = ?' : '';
    const params = empId ? [date_from, date_to, empId] : [date_from, date_to];

    try {
        const [[summary]] = await db.query(
            `SELECT
               COUNT(*) AS total_calls,
               SUM(outcome = 'no_answer') AS no_answer,
               SUM(outcome = 'voicemail') AS voicemail,
               SUM(outcome = 'callback_scheduled') AS callback_scheduled,
               SUM(outcome = 'interested') AS interested,
               SUM(outcome = 'not_interested') AS not_interested,
               SUM(outcome = 'converted') AS converted
             FROM call_logs c
             WHERE DATE(c.called_at) BETWEEN ? AND ? ${empFilter} AND c.deleted_at IS NULL`,
            params
        );

        const [daily] = await db.query(
            `SELECT DATE(c.called_at) AS date,
               COUNT(*) AS total,
               SUM(outcome = 'converted') AS converted,
               SUM(outcome = 'callback_scheduled') AS callbacks
             FROM call_logs c
             WHERE DATE(c.called_at) BETWEEN ? AND ? ${empFilter} AND c.deleted_at IS NULL
             GROUP BY DATE(c.called_at) ORDER BY date ASC`,
            params
        );

        const [byEmployee] = isAdmin ? await db.query(
            `SELECT u.name AS employee_name, e.id AS employee_id,
               COUNT(*) AS total_calls,
               SUM(c.outcome = 'converted') AS converted
             FROM call_logs c
             JOIN employees e ON c.employee_id = e.id
             JOIN users u ON u.id = e.user_id
             WHERE DATE(c.called_at) BETWEEN ? AND ? AND c.deleted_at IS NULL
             GROUP BY e.id, u.name ORDER BY total_calls DESC`,
            [date_from, date_to]
        ) : [[]];

        res.json({ success: true, data: { summary, daily, by_employee: byEmployee } });
    } catch (err) {
        console.error('[report.getCallReport]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /reports/leads — lead conversion report ───────────────────────────────
exports.getLeadReport = async (req, res) => {
    const { date_from, date_to, employee_id } = req.query;
    if (!date_from || !date_to) {
        return res.status(400).json({ success: false, message: 'date_from and date_to are required.' });
    }

    const isAdmin = req.user.role === 'admin';
    const empId = isAdmin ? (employee_id || null) : await getEmployeeId(req.user.id);
    const empFilter = empId ? 'AND l.assigned_to = ?' : '';
    const params = empId ? [date_from, date_to, empId] : [date_from, date_to];

    try {
        const [[summary]] = await db.query(
            `SELECT
               COUNT(*) AS total_leads,
               SUM(stage = 'new') AS new_leads,
               SUM(stage = 'contacted') AS contacted,
               SUM(stage = 'interested') AS interested,
               SUM(stage = 'proposal') AS proposal,
               SUM(stage = 'converted') AS converted,
               SUM(stage = 'lost') AS lost,
               ROUND(SUM(stage = 'converted') / NULLIF(COUNT(*), 0) * 100, 1) AS conversion_rate
             FROM leads l
             WHERE l.deleted_at IS NULL AND DATE(l.created_at) BETWEEN ? AND ? ${empFilter}`,
            params
        );

        const [byStage] = await db.query(
            `SELECT stage, COUNT(*) AS count
             FROM leads l
             WHERE l.deleted_at IS NULL AND DATE(l.created_at) BETWEEN ? AND ? ${empFilter}
             GROUP BY stage ORDER BY FIELD(stage,'new','contacted','interested','proposal','converted','lost')`,
            params
        );

        res.json({ success: true, data: { summary, by_stage: byStage } });
    } catch (err) {
        console.error('[report.getLeadReport]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /reports/productivity — admin only ────────────────────────────────────
exports.getProductivityReport = async (req, res) => {
    const { date_from, date_to, department } = req.query;
    if (!date_from || !date_to) {
        return res.status(400).json({ success: false, message: 'date_from and date_to are required.' });
    }

    const deptFilter = department ? 'AND e.department = ?' : '';
    const params = department ? [date_from, date_to, date_from, date_to, date_from, date_to, department] : [date_from, date_to, date_from, date_to, date_from, date_to];

    try {
        const [rows] = await db.query(
            `SELECT
               e.id, u.name AS employee_name, e.department, e.designation,
               (SELECT COUNT(*) FROM call_logs c WHERE c.employee_id = e.id
                AND DATE(c.called_at) BETWEEN ? AND ? AND c.deleted_at IS NULL) AS calls_made,
               (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = e.id
                AND DATE(l.created_at) BETWEEN ? AND ? AND l.deleted_at IS NULL) AS leads_assigned,
               (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = e.id
                AND l.stage = 'converted' AND DATE(l.updated_at) BETWEEN ? AND ? AND l.deleted_at IS NULL) AS leads_converted,
               (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = e.id AND t.status = 'completed'
                AND t.deleted_at IS NULL) AS tasks_completed,
               (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = e.id AND t.status = 'pending'
                AND t.deleted_at IS NULL) AS tasks_pending
             FROM employees e
             JOIN users u ON u.id = e.user_id
             WHERE e.deleted_at IS NULL ${deptFilter}
             ORDER BY calls_made DESC`,
            params
        );

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[report.getProductivityReport]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

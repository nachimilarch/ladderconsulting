const db = require('../config/db');
const { logAction } = require('../utils/auditLog');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || null;

// ── Shared: look up employees.id for a users.id ──────────────────────────────
const getEmployeeId = async (userId) => {
    const [[emp]] = await db.query(
        'SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL', [userId]
    );
    return emp?.id ?? null;
};

// ── GET /employees ────────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
    const { department, designation, status, search } = req.query;
    const filters = ['e.deleted_at IS NULL'];
    const params = [];

    if (department) { filters.push('e.department = ?'); params.push(department); }
    if (designation) { filters.push('e.designation = ?'); params.push(designation); }
    if (status) { filters.push('u.status = ?'); params.push(status); }
    if (search) {
        filters.push('(u.name LIKE ? OR e.employee_code LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }

    try {
        const [rows] = await db.query(
            `SELECT e.id, e.user_id, e.employee_code, e.department, e.designation,
                    e.date_joined, e.manager_id, e.created_at,
                    u.name, u.email, u.phone, u.status,
                    m.name AS manager_name
             FROM employees e
             JOIN users u ON u.id = e.user_id
             LEFT JOIN employees me ON me.id = e.manager_id
             LEFT JOIN users m ON m.id = me.user_id
             WHERE ${filters.join(' AND ')}
             ORDER BY e.created_at DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[employee.getAll]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /employees/available-users — hr_staff users with no employee record ──
exports.getAvailableUsers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.name, u.email
             FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE r.name = 'hr_staff' AND u.deleted_at IS NULL
               AND u.id NOT IN (SELECT user_id FROM employees WHERE deleted_at IS NULL)
             ORDER BY u.name`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[employee.getAvailableUsers]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /employees/stats — dashboard KPIs (role-scoped) ──────────────────────
exports.getDashboardStats = async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    try {
        const empId = isAdmin ? null : await getEmployeeId(req.user.id);

        const today = new Date().toISOString().split('T')[0];
        const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

        // Total employees (admin only KPI)
        const [[{ total_employees }]] = isAdmin
            ? await db.query('SELECT COUNT(*) AS total_employees FROM employees WHERE deleted_at IS NULL')
            : [[{ total_employees: null }]];

        // Calls today
        const callFilter = empId ? 'employee_id = ? AND' : '';
        const callParams = empId ? [empId, today, today] : [today, today];
        const [[{ calls_today }]] = await db.query(
            `SELECT COUNT(*) AS calls_today FROM call_logs
             WHERE ${callFilter} DATE(called_at) BETWEEN ? AND ? AND deleted_at IS NULL`,
            callParams
        );

        // Active leads
        const leadFilter = empId ? 'assigned_to = ? AND' : '';
        const leadParams = empId ? [empId] : [];
        const [[{ active_leads }]] = await db.query(
            `SELECT COUNT(*) AS active_leads FROM leads
             WHERE ${leadFilter} stage NOT IN ('converted','lost') AND deleted_at IS NULL`,
            leadParams
        );

        // Tasks pending
        const taskFilter = empId ? 'assigned_to = ? AND' : '';
        const taskParams = empId ? [empId] : [];
        const [[{ tasks_pending }]] = await db.query(
            `SELECT COUNT(*) AS tasks_pending FROM tasks
             WHERE ${taskFilter} status = 'pending' AND deleted_at IS NULL`,
            taskParams
        );

        // Tasks completed this week
        const taskWeekParams = empId ? [empId, weekStart, today] : [weekStart, today];
        const [[{ tasks_completed_week }]] = await db.query(
            `SELECT COUNT(*) AS tasks_completed_week FROM tasks
             WHERE ${taskFilter} status = 'completed'
               AND DATE(completed_at) BETWEEN ? AND ? AND deleted_at IS NULL`,
            taskWeekParams
        );

        // Lead conversion rate
        const [[leadConv]] = await db.query(
            `SELECT
               COUNT(*) AS total_leads,
               SUM(stage = 'converted') AS converted_leads
             FROM leads
             WHERE ${leadFilter} deleted_at IS NULL`,
            leadParams
        );
        const conversion_rate = leadConv.total_leads > 0
            ? Math.round((leadConv.converted_leads / leadConv.total_leads) * 100)
            : 0;

        // Pending callbacks (calls with outcome=callback_scheduled and callback_at in future)
        const cbParams = empId ? [empId] : [];
        const cbFilter = empId ? 'employee_id = ? AND' : '';
        const [pending_callbacks] = await db.query(
            `SELECT cl.id, cl.callback_at, cl.notes, l.company_name, l.contact_name
             FROM call_logs cl
             LEFT JOIN leads l ON l.id = cl.lead_id
             WHERE ${cbFilter} cl.outcome = 'callback_scheduled'
               AND cl.callback_at > NOW() AND cl.deleted_at IS NULL
             ORDER BY cl.callback_at ASC LIMIT 10`,
            cbParams
        );

        res.json({
            success: true,
            data: {
                total_employees,
                calls_today,
                active_leads,
                tasks_pending,
                tasks_completed_week,
                conversion_rate,
                pending_callbacks,
            },
        });
    } catch (err) {
        console.error('[employee.getDashboardStats]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /employees/:id ────────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
    try {
        const [[row]] = await db.query(
            `SELECT e.id, e.user_id, e.employee_code, e.department, e.designation,
                    e.date_joined, e.manager_id, e.created_at,
                    u.name, u.email, u.phone, u.status, r.name AS role,
                    m.name AS manager_name
             FROM employees e
             JOIN users u ON u.id = e.user_id
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN employees me ON me.id = e.manager_id
             LEFT JOIN users m ON m.id = me.user_id
             WHERE e.id = ? AND e.deleted_at IS NULL`,
            [req.params.id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Employee not found.' });

        // Quick stats
        const [[stats]] = await db.query(
            `SELECT
               (SELECT COUNT(*) FROM call_logs WHERE employee_id = e.id AND deleted_at IS NULL) AS calls_made,
               (SELECT COUNT(*) FROM leads WHERE assigned_to = e.id AND deleted_at IS NULL) AS leads_assigned,
               (SELECT COUNT(*) FROM tasks WHERE assigned_to = e.id AND status = 'completed' AND deleted_at IS NULL) AS tasks_completed
             FROM employees e WHERE e.id = ?`,
            [req.params.id]
        );

        res.json({ success: true, data: { ...row, stats } });
    } catch (err) {
        console.error('[employee.getOne]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /employees — admin only ──────────────────────────────────────────────
exports.create = async (req, res) => {
    const { user_id, employee_code, department, designation, date_joined, manager_id } = req.body;
    if (!user_id) return res.status(422).json({ success: false, message: 'user_id is required.' });
    try {
        const [[user]] = await db.query(
            'SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', [user_id]
        );
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const [result] = await db.query(
            `INSERT INTO employees (user_id, employee_code, department, designation, date_joined, manager_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [user_id, employee_code || null, department || null,
             designation || null, date_joined || null, manager_id || null]
        );

        logAction(req.user.id, 'create_employee', 'employee', result.insertId,
            { user_id, department, designation }, ip(req));

        res.status(201).json({ success: true, message: 'Employee created.', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Employee record already exists for this user.' });
        }
        console.error('[employee.create]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /employees/:id — admin only ──────────────────────────────────────────
exports.update = async (req, res) => {
    const { name, phone, department, designation, date_joined, manager_id, employee_code } = req.body;
    try {
        const [[emp]] = await db.query(
            'SELECT id, user_id FROM employees WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

        if (name !== undefined || phone !== undefined) {
            const userFields = [];
            const userVals = [];
            if (name !== undefined) { userFields.push('name = ?'); userVals.push(name); }
            if (phone !== undefined) { userFields.push('phone = ?'); userVals.push(phone); }
            userVals.push(emp.user_id);
            await db.query(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, userVals);
        }

        const empFields = [];
        const empVals = [];
        if (department !== undefined) { empFields.push('department = ?'); empVals.push(department); }
        if (designation !== undefined) { empFields.push('designation = ?'); empVals.push(designation); }
        if (date_joined !== undefined) { empFields.push('date_joined = ?'); empVals.push(date_joined); }
        if (manager_id !== undefined) { empFields.push('manager_id = ?'); empVals.push(manager_id); }
        if (employee_code !== undefined) { empFields.push('employee_code = ?'); empVals.push(employee_code); }
        if (empFields.length) {
            empVals.push(req.params.id);
            await db.query(`UPDATE employees SET ${empFields.join(', ')} WHERE id = ?`, empVals);
        }

        logAction(req.user.id, 'update_employee', 'employee', req.params.id, req.body, ip(req));
        res.json({ success: true, message: 'Employee updated.' });
    } catch (err) {
        console.error('[employee.update]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /employees/:id/assign-role-department — admin only ───────────────────
exports.assignRoleDept = async (req, res) => {
    const { role, department, designation } = req.body;
    const ALLOWED_ROLES = ['hr_staff', 'trainer', 'admin'];
    try {
        const [[emp]] = await db.query(
            'SELECT id, user_id FROM employees WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

        if (role !== undefined) {
            if (!ALLOWED_ROLES.includes(role)) {
                return res.status(422).json({ success: false, message: `Role must be one of: ${ALLOWED_ROLES.join(', ')}` });
            }
            await db.query(
                'UPDATE users SET role_id = (SELECT id FROM roles WHERE name = ?) WHERE id = ?',
                [role, emp.user_id]
            );
        }

        const empFields = [];
        const empVals = [];
        if (department !== undefined) { empFields.push('department = ?'); empVals.push(department); }
        if (designation !== undefined) { empFields.push('designation = ?'); empVals.push(designation); }
        if (empFields.length) {
            empVals.push(req.params.id);
            await db.query(`UPDATE employees SET ${empFields.join(', ')} WHERE id = ?`, empVals);
        }

        logAction(req.user.id, 'assign_role_dept', 'employee', req.params.id, { role, department, designation }, ip(req));
        res.json({ success: true, message: 'Role and department updated.' });
    } catch (err) {
        console.error('[employee.assignRoleDept]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── DELETE /employees/:id — admin only ───────────────────────────────────────
exports.remove = async (req, res) => {
    try {
        const [[emp]] = await db.query(
            'SELECT id FROM employees WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

        await db.query('UPDATE employees SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
        logAction(req.user.id, 'delete_employee', 'employee', req.params.id, {}, ip(req));
        res.json({ success: true, message: 'Employee deleted.' });
    } catch (err) {
        console.error('[employee.remove]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /employees/:id/attendance ─────────────────────────────────────────────
exports.getAttendance = async (req, res) => {
    const { month } = req.query; // e.g. "2026-05"
    const filters = ['a.employee_id = ?', 'a.deleted_at IS NULL'];
    const params = [req.params.id];
    if (month) { filters.push('DATE_FORMAT(a.date, "%Y-%m") = ?'); params.push(month); }

    try {
        const [rows] = await db.query(
            `SELECT * FROM attendance a WHERE ${filters.join(' AND ')} ORDER BY a.date DESC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[employee.getAttendance]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /employees/:id/attendance — admin only ──────────────────────────────
exports.addAttendance = async (req, res) => {
    const { date, check_in, check_out, status = 'present', notes } = req.body;
    if (!date) return res.status(422).json({ success: false, message: 'date is required.' });
    try {
        const [[emp]] = await db.query(
            'SELECT id FROM employees WHERE id = ? AND deleted_at IS NULL', [req.params.id]
        );
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

        await db.query(
            `INSERT INTO attendance (employee_id, date, check_in, check_out, status, notes)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE check_in=VALUES(check_in), check_out=VALUES(check_out),
             status=VALUES(status), notes=VALUES(notes)`,
            [req.params.id, date, check_in || null, check_out || null, status, notes || null]
        );
        res.status(201).json({ success: true, message: 'Attendance recorded.' });
    } catch (err) {
        console.error('[employee.addAttendance]', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

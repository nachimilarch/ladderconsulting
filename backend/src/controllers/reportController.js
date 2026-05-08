const db = require('../config/db');

exports.hrReport = async (req, res) => {
    const { date_from, date_to } = req.query;
    if (!date_from || !date_to) {
        return res.status(400).json({ message: 'date_from and date_to are required.' });
    }

    try {
        // Calls summary
        const [[callSummary]] = await db.query(
            `SELECT
         COUNT(*) AS total_calls,
         SUM(outcome = 'connected') AS connected,
         SUM(outcome = 'converted') AS converted,
         SUM(outcome = 'callback_scheduled') AS callbacks_scheduled,
         SUM(outcome = 'no_answer') AS no_answer,
         SUM(outcome = 'not_interested') AS not_interested
       FROM call_logs
       WHERE DATE(called_at) BETWEEN ? AND ?`,
            [date_from, date_to]
        );

        // Calls per employee
        const [callsByEmployee] = await db.query(
            `SELECT e.name, COUNT(*) AS total,
         SUM(c.outcome = 'connected') AS connected,
         SUM(c.outcome = 'converted') AS converted
       FROM call_logs c
       JOIN employees e ON c.employee_id = e.id
       WHERE DATE(c.called_at) BETWEEN ? AND ?
       GROUP BY e.id, e.name
       ORDER BY total DESC`,
            [date_from, date_to]
        );

        // Leads summary
        const [[leadSummary]] = await db.query(
            `SELECT
         COUNT(*) AS total_leads,
         SUM(stage = 'new') AS new_leads,
         SUM(stage = 'contacted') AS contacted,
         SUM(stage = 'warm') AS warm,
         SUM(stage = 'converted') AS converted,
         SUM(stage = 'lost') AS lost
       FROM leads
       WHERE deleted_at IS NULL AND DATE(created_at) BETWEEN ? AND ?`,
            [date_from, date_to]
        );

        // Tasks summary
        const [[taskSummary]] = await db.query(
            `SELECT
         COUNT(*) AS total_tasks,
         SUM(status = 'pending') AS pending,
         SUM(status = 'in_progress') AS in_progress,
         SUM(status = 'done') AS done,
         SUM(status = 'done' AND DATE(completed_at) BETWEEN ? AND ?) AS completed_in_range
       FROM tasks
       WHERE deleted_at IS NULL AND DATE(created_at) BETWEEN ? AND ?`,
            [date_from, date_to, date_from, date_to]
        );

        // Daily call trend
        const [dailyCalls] = await db.query(
            `SELECT DATE(called_at) AS date, COUNT(*) AS total
       FROM call_logs
       WHERE DATE(called_at) BETWEEN ? AND ?
       GROUP BY DATE(called_at)
       ORDER BY date ASC`,
            [date_from, date_to]
        );

        res.json({
            period: { date_from, date_to },
            calls: { summary: callSummary, by_employee: callsByEmployee, daily_trend: dailyCalls },
            leads: leadSummary,
            tasks: taskSummary,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
};
/**
 * Candidate job-status reminders.
 *
 * Asks candidates who have a real account (they have logged in at least once) to say whether
 * they are working or looking for a job, when that answer is missing or has gone stale. Each
 * reminder is an in-app notification plus an email that links to the portal, where a prompt
 * collects the answer.
 *
 * Deliberately gentle:
 *  - only accounts that have logged in before: resume-sourced records that never signed up
 *    (most of the candidate table) are never contacted;
 *  - at most MAX_REMINDERS reminders, GAP_DAYS apart, and the count restarts only when the
 *    candidate answers;
 *  - skips anyone who logged in during the last day (they get the in-portal prompt anyway),
 *    and anyone already hired;
 *  - sends only between 09:00 and 19:00 India time, a few at a time;
 *  - off until an admin enables `candidate_status_reminders_enabled`.
 *
 * Started once from server.js (same single-instance rule as the other background loops).
 */

const db = require('../config/db');
const { sendEmail } = require('../utils/email');
const { DEFAULT_REFRESH_DAYS } = require('../utils/employmentStatus');

const TICK_MS = 30 * 60 * 1000;
const MAX_PER_TICK = 25;
const MAX_REMINDERS = 3;
const GAP_DAYS = 14;
const NEW_ACCOUNT_GRACE_DAYS = 3;   // a new account is not nagged straight away
const SEND_GAP_MS = 1500;           // be kind to the mail API
const OPEN_HOUR_IST = 9;
const CLOSE_HOUR_IST = 19;

let active = false;
let running = false;
let timer = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const getSetting = async (key, fallback) => {
    const [[row]] = await db.query('SELECT value FROM platform_settings WHERE setting_key = ?', [key]);
    return row ? row.value : fallback;
};

const hourInIndia = () => parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date()), 10) % 24;

const portalLink = () => {
    const base = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/^http:\/\//, 'https://');
    return `${base}/candidate?update-status=1`;
};

const buildEmail = (row, link) => {
    const first = esc((row.name || '').trim().split(/\s+/)[0] || 'there');
    const stale = !!row.employment_status;
    const subject = stale ? 'Is your job status still up to date?' : 'Quick question: are you working or looking for a job?';
    const lead = stale
        ? 'It has been a while since you told us where you are in your career. Please confirm whether it is still right.'
        : 'Please tell us whether you are currently working or looking for a job. It takes about ten seconds.';
    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.55;">
        <h2 style="color: #3e2a7a; margin-bottom: 8px;">Hi ${first},</h2>
        <p>${lead}</p>
        <p>With an up-to-date status our team can suggest you for the right roles, and stop suggesting them when you are not looking.</p>
        <p style="margin: 28px 0;">
          <a href="${link}" style="display: inline-block; background: #6a47d4; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Update my status</a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">Only the LadderStep team can see this, never companies. You are receiving this because you have a LadderStep account, and we will send at most ${MAX_REMINDERS} reminders.</p>
      </div>`;
    return { subject, html };
};

// Who is due a reminder right now. `limit` keeps each run small.
const findDue = async (limit) => {
    const base = parseInt(await getSetting('candidate_status_refresh_days', String(DEFAULT_REFRESH_DAYS)), 10) || DEFAULT_REFRESH_DAYS;
    const [rows] = await db.query(
        `SELECT c.id AS candidate_id, c.user_id, u.name, u.email,
                c.employment_status, c.status_reminders_sent
         FROM candidates c
         JOIN users u ON u.id = c.user_id
         WHERE c.deleted_at IS NULL AND u.deleted_at IS NULL
           AND u.status = 'active' AND u.is_email_verified = 1
           AND u.last_login_at IS NOT NULL AND u.last_login_at < NOW() - INTERVAL 1 DAY
           AND c.status_reminders_sent < ?
           AND (c.status_last_reminder_at IS NULL OR c.status_last_reminder_at < NOW() - INTERVAL ? DAY)
           AND NOT EXISTS (SELECT 1 FROM applications a
                           WHERE a.candidate_id = c.id AND a.status = 'hired' AND a.deleted_at IS NULL)
           AND (
                (c.employment_status IS NULL AND u.created_at < NOW() - INTERVAL ? DAY)
             OR (c.employment_status IN ('looking','open') AND c.employment_status_updated_at < NOW() - INTERVAL ? DAY)
             OR (c.employment_status = 'working' AND c.employment_status_updated_at < NOW() - INTERVAL ? DAY)
           )
         ORDER BY c.status_reminders_sent ASC, u.last_login_at DESC
         LIMIT ?`,
        [MAX_REMINDERS, GAP_DAYS, NEW_ACCOUNT_GRACE_DAYS, base, base * 3, limit]
    );
    return rows;
};

/**
 * One pass. `dryRun` only reports who would be reminded; `force` ignores the admin switch and the
 * business-hours window (used by dry runs and tests). `send` can be swapped out in tests.
 */
const runReminderCycle = async ({ dryRun = false, force = false, send = sendEmail, limit = MAX_PER_TICK } = {}) => {
    if (running) return { skipped: 'already running' };
    running = true;
    try {
        if (!force) {
            if ((await getSetting('candidate_status_reminders_enabled', 'false')) !== 'true') return { skipped: 'switched off' };
            const h = hourInIndia();
            if (h < OPEN_HOUR_IST || h >= CLOSE_HOUR_IST) return { skipped: 'outside 09:00-19:00 IST' };
        }

        const due = await findDue(limit);
        if (dryRun) {
            return {
                dryRun: true,
                due: due.length,
                candidates: due.map((r) => ({
                    candidate_id: r.candidate_id,
                    reminder_no: r.status_reminders_sent + 1,
                    kind: r.employment_status ? 'confirm' : 'first-ask',
                })),
            };
        }

        const link = portalLink();
        let sent = 0;
        let failed = 0;
        for (const row of due) {
            // Count the attempt first, so a crash or a failed send can never make us repeat an email.
            await db.query(
                'UPDATE candidates SET status_reminders_sent = status_reminders_sent + 1, status_last_reminder_at = NOW() WHERE id = ?',
                [row.candidate_id]
            );
            try {
                await db.query(
                    `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, 'status_reminder', ?, ?, ?)`,
                    [row.user_id,
                     'Update your job status',
                     'Are you working or looking for a job? A quick update helps us suggest the right roles.',
                     JSON.stringify({ link: '/candidate?update-status=1', reminder_no: row.status_reminders_sent + 1 })]
                );
            } catch (e) {
                console.error('[candidateStatusReminders] notify failed:', e.message);
            }
            try {
                const { subject, html } = buildEmail(row, link);
                await send({ to: row.email, subject, html });
                sent += 1;
            } catch (e) {
                failed += 1;
                console.error('[candidateStatusReminders] email failed for candidate', row.candidate_id, '-', e.message);
            }
            await sleep(SEND_GAP_MS);
        }
        if (due.length) console.log(`[candidateStatusReminders] reminded ${sent} candidate(s), ${failed} email failure(s)`);
        return { due: due.length, sent, failed };
    } finally {
        running = false;
    }
};

const startCandidateStatusReminders = () => {
    if (active) return;
    active = true;
    console.log('[candidateStatusReminders] started — checks every 30 min, sends only when enabled, 09:00-19:00 IST');
    setTimeout(() => runReminderCycle().catch((e) => console.error('[candidateStatusReminders] initial cycle:', e.message)), 60 * 1000);
    timer = setInterval(() => runReminderCycle().catch((e) => console.error('[candidateStatusReminders] cycle:', e.message)), TICK_MS);
};

const stopCandidateStatusReminders = () => {
    if (timer) clearInterval(timer);
    timer = null;
    active = false;
};

module.exports = { startCandidateStatusReminders, stopCandidateStatusReminders, runReminderCycle, findDue };

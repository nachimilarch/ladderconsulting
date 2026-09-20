// Sends scheduled outreach campaigns when their time comes.
//
// A campaign created (or edited) with a future scheduled_at is stored as 'scheduled'.
// Every minute this looks for ones that are due and starts them exactly as the Send button
// would. A campaign is claimed with a conditional UPDATE, so two servers or two ticks can
// never send the same one twice. If the server was down and the time is long past, nothing
// is sent automatically: the campaign goes back to draft and its owner is told.
//
// Started once from server.js. The 'campaign_scheduler_enabled' platform setting stops it.
const db = require('../config/db');
const emailCtrl = require('../controllers/outreachCampaignController');
const waCtrl = require('../controllers/whatsappController');

const TICK_MS = 60 * 1000;
const MAX_LATE_MS = 6 * 60 * 60 * 1000;

let timer = null;
let running = false;

const notify = async (userId, type, title, body, metadata = null) => {
    if (!userId) return;
    try {
        await db.query('INSERT INTO notifications (user_id, type, title, body, metadata) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, body, metadata ? JSON.stringify(metadata) : null]);
    } catch (err) {
        console.error('[campaignScheduler:notify]', err.message);
    }
};

async function enabled() {
    try {
        const [[row]] = await db.query("SELECT value FROM platform_settings WHERE setting_key = 'campaign_scheduler_enabled'");
        return !row || String(row.value).toLowerCase() !== 'false';
    } catch { return true; }
}

async function tick() {
    if (running) return;
    running = true;
    try {
        if (!(await enabled())) return;
        const [due] = await db.query(
            `SELECT id, created_by, campaign_name, scheduled_at FROM outreach_campaigns
             WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= UTC_TIMESTAMP()
               AND deleted_at IS NULL ORDER BY scheduled_at ASC LIMIT 5`
        );
        for (const c of due) {
            const late = Date.now() - new Date(c.scheduled_at).getTime();
            if (late > MAX_LATE_MS) {
                await db.query("UPDATE outreach_campaigns SET status = 'draft' WHERE id = ? AND status = 'scheduled'", [c.id]);
                await notify(c.created_by, 'campaign_missed', 'Scheduled campaign was not sent',
                    `"${c.campaign_name}" was due more than 6 hours ago (the server was probably down), so it was not sent automatically. It is a draft again: review it and send when ready.`,
                    { campaign_id: c.id });
                continue;
            }
            // Claim it. If someone edited or started it in the meantime, nothing changes.
            const [claim] = await db.query("UPDATE outreach_campaigns SET status = 'sending' WHERE id = ? AND status = 'scheduled'", [c.id]);
            if (!claim.affectedRows) continue;
            try {
                const [[campaign]] = await db.query('SELECT * FROM outreach_campaigns WHERE id = ?', [c.id]);
                const started = campaign.campaign_type === 'whatsapp'
                    ? await waCtrl.beginWASend(campaign)
                    : await emailCtrl.beginEmailSend(campaign, campaign.created_by);
                if (started.error) throw new Error(started.error);
                await notify(c.created_by, 'campaign_started', 'Scheduled campaign started',
                    `"${c.campaign_name}" is sending now to ${started.total} contacts.`, { campaign_id: c.id, total: started.total });
                console.log(`[campaignScheduler] Started campaign ${c.id} (${started.total} recipients)`);
            } catch (err) {
                console.error('[campaignScheduler] Could not start campaign', c.id, err.message);
                await db.query("UPDATE outreach_campaigns SET status = 'failed' WHERE id = ?", [c.id]);
                await notify(c.created_by, 'campaign_failed', 'Scheduled campaign could not start',
                    `"${c.campaign_name}" failed to start: ${err.message}`, { campaign_id: c.id });
            }
        }
    } catch (err) {
        console.error('[campaignScheduler]', err.message);
    } finally {
        running = false;
    }
}

const startCampaignScheduler = () => {
    if (timer) return;
    timer = setInterval(tick, TICK_MS);
    console.log('[campaignScheduler] Started (checks every minute)');
};

module.exports = { startCampaignScheduler, tick };

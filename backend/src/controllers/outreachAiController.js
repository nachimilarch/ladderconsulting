// Outreach AI endpoints. Rule-based analysis answers instantly; writing tasks go through the
// local model as background tasks (see services/outreachAiTasks.js). Nothing here changes
// data unless the request says so explicitly (apply / save / confirm).
const axios = require('axios');
const db = require('../config/db');
const rules = require('../services/outreachAiRules');
const tasks = require('../services/outreachAiTasks');
const { isEnabled } = require('../services/llmJobs');
const campaignCtrl = require('./outreachCampaignController');
const waCtrl = require('./whatsappController');
const { logAction } = require('../utils/auditLog');

const ip = (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || null;
const fail = (status, message) => Object.assign(new Error(message), { status, userFacing: true });
const wrap = (fn, tag) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err.userFacing) return res.status(err.status || 422).json({ success: false, message: err.message });
        console.error(`[outreachAi.${tag}]`, err);
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    }
};

const MAX_CONTACTS = 20000;

// A list this user may work with (staff see their own lists, admin sees all).
async function loadList(user, id) {
    const listId = parseInt(id, 10);
    const [[list]] = await db.query(
        'SELECT id, uploaded_by, list_name, total_contacts FROM outreach_contact_lists WHERE id = ? AND deleted_at IS NULL', [listId]);
    if (!list) throw fail(404, 'Contact list not found.');
    if (user.role === 'hr_staff' && list.uploaded_by !== user.id) throw fail(403, 'You do not own this contact list.');
    return list;
}

// Every contact in the list with what has happened to it so far (emails sent, bounced, replied).
async function loadContacts(listId) {
    const [contacts] = await db.query(
        'SELECT * FROM outreach_contacts WHERE list_id = ? AND deleted_at IS NULL ORDER BY id ASC LIMIT ?', [listId, MAX_CONTACTS]);
    const [hist] = await db.query(
        `SELECT cl.contact_id,
                SUM(cl.status IN ('sent','replied')) AS sent, SUM(cl.status = 'failed') AS failed,
                SUM(cl.status = 'replied') AS replied, MAX(cl.sent_at) AS last_sent
         FROM outreach_campaign_logs cl JOIN outreach_contacts c ON c.id = cl.contact_id
         WHERE c.list_id = ? AND cl.channel = 'email' GROUP BY cl.contact_id`, [listId]);
    const [replied] = await db.query(
        `SELECT DISTINCT r.contact_id FROM outreach_email_replies r
         JOIN outreach_contacts c ON c.id = r.contact_id WHERE c.list_id = ? AND r.deleted_at IS NULL`, [listId]);
    const repliedIds = new Set(replied.map((r) => r.contact_id));
    const byId = new Map(hist.map((h) => [h.contact_id, h]));
    const seenEmails = new Set();
    const facts = contacts.map((c) => {
        const h = byId.get(c.id);
        const key = rules.firstEmail(c.email);
        const duplicate = !!key && seenEmails.has(key);
        if (key) seenEmails.add(key);
        return rules.buildFacts({ ...c, duplicate }, {
            contacted: !!h && Number(h.sent) > 0,
            lastSentAt: h?.last_sent || null,
            replied: repliedIds.has(c.id) || (!!h && Number(h.replied) > 0),
            failed: !!h && Number(h.failed) > 0 && Number(h.sent) === 0,
        });
    });
    return { contacts, facts };
}

const factsById = (facts) => new Map(facts.map((f) => [f.id, f]));

// Members of a segment, best prospects first.
function segmentMembers(contacts, facts, key, channel) {
    const seg = rules.segmentTest(key);
    if (!seg) throw fail(404, 'Unknown segment.');
    const now = Date.now();
    const fmap = factsById(facts);
    let rows = contacts.filter((c) => seg.test(fmap.get(c.id), now));
    if (channel === 'email') rows = rows.filter((c) => { const e = fmap.get(c.id).email; return e.status === 'valid' && !e.isDisposable && !fmap.get(c.id).hist.failed; });
    if (channel === 'whatsapp') rows = rows.filter((c) => fmap.get(c.id).waReady);
    return rows
        .map((c) => ({ contact: c, ...rules.contactScore(fmap.get(c.id), now) }))
        .sort((a, b) => b.score - a.score || a.contact.id - b.contact.id);
}

const shape = (row) => ({
    id: row.contact.id, name: row.contact.full_name, company: row.contact.company_name, designation: row.contact.designation,
    email: row.contact.email, phone: row.contact.phone, score: row.score, reasons: row.reasons,
});

// ── Lists ────────────────────────────────────────────────────────────────────
// GET /ai/lists/:id/analysis
exports.analyseList = wrap(async (req, res) => {
    const list = await loadList(req.user, req.params.id);
    const { contacts, facts } = await loadContacts(list.id);
    const now = Date.now();
    const { health, issues } = rules.listHealth(contacts, facts);
    const segments = rules.summariseSegments(facts, now).filter((s) => s.count > 0);

    const scored = contacts
        .map((c, i) => ({ contact: c, ...rules.contactScore(facts[i], now) }))
        .filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
    const bySeniority = {};
    for (const f of facts) if (f.hasDesignation) bySeniority[rules.SENIORITY_LABEL[f.seniority]] = (bySeniority[rules.SENIORITY_LABEL[f.seniority]] || 0) + 1;

    res.json({
        success: true,
        data: {
            list: { id: list.id, name: list.list_name, total: contacts.length },
            health, issues, segments,
            seniority: bySeniority,
            top_prospects: scored.slice(0, 12).map(shape),
            fixable: { email_typos: health.email_typos, duplicates: health.email_duplicates },
        },
    });
}, 'analyseList');

// GET /ai/lists/:id/segments/:key/contacts?channel=
exports.segmentContacts = wrap(async (req, res) => {
    const list = await loadList(req.user, req.params.id);
    const { contacts, facts } = await loadContacts(list.id);
    const rows = segmentMembers(contacts, facts, req.params.key, ['email', 'whatsapp'].includes(req.query.channel) ? req.query.channel : null);
    res.json({ success: true, data: { total: rows.length, contacts: rows.slice(0, 100).map(shape) } });
}, 'segmentContacts');

async function copyContactsToNewList(user, { name, description, rows, sourceTag }) {
    const [ins] = await db.query(
        `INSERT INTO outreach_contact_lists (uploaded_by, list_name, description, total_contacts, imported_contacts, import_status)
         VALUES (?, ?, ?, ?, ?, 'done')`, [user.id, name.slice(0, 250), description || null, rows.length, rows.length]);
    const listId = ins.insertId;
    for (let i = 0; i < rows.length; i += 200) {
        const part = rows.slice(i, i + 200);
        await db.query(
            `INSERT INTO outreach_contacts (list_id, uploaded_by, full_name, email, phone, whatsapp_number, company_name, designation, city, source, tags)
             VALUES ${part.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',')}`,
            part.flatMap((r) => {
                const c = r.contact;
                let tags = [];
                try { tags = Array.isArray(c.tags) ? c.tags : JSON.parse(c.tags || '[]'); } catch { tags = []; }
                if (sourceTag && !tags.includes(sourceTag)) tags = [...tags, sourceTag];
                return [listId, user.id, c.full_name, c.email, c.phone, c.whatsapp_number, c.company_name, c.designation, c.city, 'ai_segment', JSON.stringify(tags)];
            })
        );
    }
    return listId;
}

// POST /ai/lists/:id/segments/:key/save  { name?, channel? }: copy a segment into a new list
exports.saveSegment = wrap(async (req, res) => {
    const list = await loadList(req.user, req.params.id);
    const { contacts, facts } = await loadContacts(list.id);
    const rows = segmentMembers(contacts, facts, req.params.key, ['email', 'whatsapp'].includes(req.body?.channel) ? req.body.channel : null);
    if (!rows.length) throw fail(422, 'Nobody is in this segment.');
    if (rows.length > 5000) throw fail(422, 'That segment is larger than 5,000 contacts. Pick a narrower one.');
    const seg = rules.segmentTest(req.params.key);
    const name = String(req.body?.name || `${list.list_name} – ${seg.label}`).trim();
    const listId = await copyContactsToNewList(req.user, {
        name, description: `Created by AI from "${list.list_name}": ${seg.label}. Best prospects first.`, rows, sourceTag: req.params.key.replace(/^industry:/, 'ind_'),
    });
    await logAction(req.user.id, 'outreach_ai_save_segment', 'contact_list', listId, { from_list: list.id, segment: req.params.key, count: rows.length }, ip(req));
    res.status(201).json({ success: true, data: { list_id: listId, name, count: rows.length } });
}, 'saveSegment');

// POST /ai/lists/:id/tags  { apply: true }: add descriptive tags to every contact (merges, never removes)
exports.applyTags = wrap(async (req, res) => {
    const list = await loadList(req.user, req.params.id);
    const { contacts, facts } = await loadContacts(list.id);
    const now = Date.now();
    const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const plan = contacts.map((c, i) => {
        const f = facts[i];
        const add = [];
        if (f.isHr) add.push('hr');
        if (f.seniority !== 'unknown' && f.seniority !== 'staff') add.push(f.seniority);
        if (f.email.status === 'valid') add.push(f.email.isFree ? 'personal_email' : 'company_email');
        if (f.email.status === 'valid' && f.email.isRole) add.push('shared_inbox');
        if (f.waReady) add.push('whatsapp_ready');
        if (f.industry !== 'Unclassified') add.push(`ind_${slug(f.industry)}`);
        if (f.hist.replied) add.push('warm');
        if (rules.segmentTest('follow_up').test(f, now)) add.push('follow_up');
        if (f.hist.failed) add.push('bounced');
        let existing = [];
        try { existing = Array.isArray(c.tags) ? c.tags : JSON.parse(c.tags || '[]'); } catch { existing = []; }
        const merged = [...new Set([...(existing || []), ...add])];
        return { id: c.id, merged, added: merged.length - (existing || []).length };
    });
    const changed = plan.filter((p) => p.added > 0);
    if (!req.body?.apply) return res.json({ success: true, data: { dry_run: true, contacts_to_tag: changed.length, tags_added: changed.reduce((s, p) => s + p.added, 0) } });
    for (const p of changed) await db.query('UPDATE outreach_contacts SET tags = ? WHERE id = ?', [JSON.stringify(p.merged), p.id]);
    await logAction(req.user.id, 'outreach_ai_apply_tags', 'contact_list', list.id, { contacts: changed.length }, ip(req));
    res.json({ success: true, data: { dry_run: false, contacts_tagged: changed.length } });
}, 'applyTags');

// POST /ai/lists/:id/cleanup  { actions: ['fix_email_typos','remove_duplicates'], apply?: bool }
exports.cleanupList = wrap(async (req, res) => {
    const list = await loadList(req.user, req.params.id);
    const { contacts, facts } = await loadContacts(list.id);
    const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];
    const typoFixes = [];
    const dupIds = [];
    const seen = new Set();
    contacts.forEach((c, i) => {
        const e = facts[i].email;
        if (e.status !== 'valid') return;
        if (e.typoFix) typoFixes.push({ id: c.id, from: e.email, to: e.typoFix });
        const key = e.typoFix || e.email;
        if (seen.has(key)) dupIds.push(c.id); else seen.add(key);
    });
    const summary = {
        fix_email_typos: actions.includes('fix_email_typos') ? typoFixes.length : 0,
        remove_duplicates: actions.includes('remove_duplicates') ? dupIds.length : 0,
    };
    if (!req.body?.apply) return res.json({ success: true, data: { dry_run: true, ...summary, sample_typos: typoFixes.slice(0, 5) } });
    if (summary.fix_email_typos) for (const t of typoFixes) await db.query('UPDATE outreach_contacts SET email = ? WHERE id = ?', [t.to, t.id]);
    if (summary.remove_duplicates && dupIds.length) await db.query(`UPDATE outreach_contacts SET deleted_at = NOW() WHERE id IN (${dupIds.map(() => '?').join(',')})`, dupIds);
    await logAction(req.user.id, 'outreach_ai_cleanup', 'contact_list', list.id, summary, ip(req));
    res.json({ success: true, data: { dry_run: false, ...summary } });
}, 'cleanupList');

// ── Copy, replies ────────────────────────────────────────────────────────────
// POST /ai/check-copy  { channel, subject, body }
exports.checkCopy = wrap(async (req, res) => {
    const { channel, subject, body } = req.body || {};
    res.json({ success: true, data: rules.checkCopy({ channel: channel === 'whatsapp' ? 'whatsapp' : 'email', subject, body }) });
}, 'checkCopy');

// GET /ai/replies/triage?ids=1,2,3  (up to 100)
exports.triageReplies = wrap(async (req, res) => {
    const ids = String(req.query.ids || '').split(',').map((x) => parseInt(x, 10)).filter(Boolean).slice(0, 100);
    if (!ids.length) return res.json({ success: true, data: {} });
    const own = req.user.role === 'admin' ? '' : 'AND assigned_to = ?';
    const [rows] = await db.query(
        `SELECT id, subject, body_text, from_email FROM outreach_email_replies
         WHERE id IN (${ids.map(() => '?').join(',')}) AND deleted_at IS NULL ${own}`, req.user.role === 'admin' ? ids : [...ids, req.user.id]);
    const out = {};
    for (const r of rows) out[r.id] = rules.classifyReply({ subject: r.subject, body: r.body_text, fromEmail: r.from_email });
    res.json({ success: true, data: out });
}, 'triageReplies');

// ── Insights (numbers only, instant) ─────────────────────────────────────────
exports.insightStats = wrap(async (req, res) => {
    res.json({ success: true, data: await tasks.campaignStats(req.user, Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 90))) });
}, 'insightStats');

// ── Schedule planner ─────────────────────────────────────────────────────────
async function senderWarmth(userId, channel) {
    const [[r]] = await db.query(
        `SELECT COUNT(*) AS n FROM outreach_campaign_logs cl JOIN outreach_campaigns c ON c.id = cl.campaign_id
         WHERE c.created_by = ? AND cl.channel = ? AND cl.status IN ('sent','replied') AND cl.sent_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)`,
        [userId, channel]);
    return Number(r.n) || 0;
}
async function waCredits() {
    if (!process.env.VAARTABOT_API_KEY) return null;
    try {
        const { data } = await axios.get('https://vaartabot.com/api/v1/credits/balance', { headers: { 'X-API-Key': process.env.VAARTABOT_API_KEY }, timeout: 8000 });
        const n = data?.data?.creditsBalance;
        return Number.isFinite(Number(n)) ? Number(n) : null;
    } catch { return null; }
}

async function buildPlan(req) {
    const { channel, list_id, segment_key, start_date, daily_cap } = req.body || {};
    if (!['email', 'whatsapp'].includes(channel)) throw fail(422, 'channel must be email or whatsapp.');
    const list = await loadList(req.user, list_id);
    const key = segment_key || (channel === 'email' ? 'fresh_email' : 'whatsapp_ready');
    const { contacts, facts } = await loadContacts(list.id);
    const rows = segmentMembers(contacts, facts, key, channel);
    const plan = rules.planSchedule({
        channel, total: rows.length, startDate: start_date, dailyCap: daily_cap,
        warmth: await senderWarmth(req.user.id, channel), credits: channel === 'whatsapp' ? await waCredits() : null,
    });
    return { list, key, rows, plan, segment: rules.segmentTest(key) };
}

// POST /ai/schedule-plan  { channel, list_id, segment_key?, start_date?, daily_cap? }
exports.schedulePlan = wrap(async (req, res) => {
    const { list, key, rows, plan, segment } = await buildPlan(req);
    res.json({ success: true, data: { list: { id: list.id, name: list.list_name }, segment: { key, label: segment.label }, eligible: rows.length, plan } });
}, 'schedulePlan');

// POST /ai/schedule-plan/apply  { ...plan inputs, confirm: true, content: {...} }
// Creates one list and one scheduled campaign per batch (best prospects in the first batches).
exports.applyPlan = wrap(async (req, res) => {
    if (req.body?.confirm !== true) throw fail(422, 'Confirm to create the scheduled campaigns.');
    const content = req.body.content || {};
    const { list, key, rows, plan, segment } = await buildPlan(req);
    if (!plan.batches.length) throw fail(422, 'Nobody is eligible in this selection.');
    if (plan.batches.length > 20) throw fail(422, `That is ${plan.batches.length} sending days. Raise the daily cap or choose a smaller segment.`);
    const channel = req.body.channel;

    if (channel === 'email') {
        if (!content.campaign_name || !content.subject || !content.message_body) throw fail(422, 'Campaign name, subject and body are required.');
        const check = rules.checkCopy({ channel: 'email', subject: content.subject, body: content.message_body });
        const blocking = check.issues.filter((i) => ['placeholder', 'unknown_tag', 'no_subject'].includes(i.code));
        if (blocking.length) throw fail(422, `Fix this before scheduling: ${blocking[0].message}`);
    } else if (!content.campaign_name || !content.whatsapp_template_id) {
        throw fail(422, 'Campaign name and WhatsApp template are required.');
    }

    const created = [];
    let cursor = 0;
    for (const b of plan.batches) {
        const part = rows.slice(cursor, cursor + b.size);
        cursor += b.size;
        const batchList = await copyContactsToNewList(req.user, {
            name: `${content.campaign_name} – batch ${b.n} of ${plan.batches.length}`,
            description: `AI schedule plan for "${list.list_name}" (${segment.label}), sending ${b.date} ${b.time_ist} IST.`,
            rows: part, sourceTag: 'ai_plan',
        });
        const name = `${content.campaign_name} (${b.n}/${plan.batches.length})`;
        const { id } = channel === 'email'
            ? await campaignCtrl.createEmailCampaignRecord(req.user, { campaign_name: name, list_id: batchList, subject: content.subject, message_body: content.message_body, from_name: content.from_name, scheduled_at: b.scheduled_at })
            : await waCtrl.createWACampaignRecord(req.user, { campaign_name: name, list_id: batchList, whatsapp_template_id: content.whatsapp_template_id, variable_mapping: content.variable_mapping, scheduled_at: b.scheduled_at });
        created.push({ campaign_id: id, list_id: batchList, batch: b.n, date: b.date, time_ist: b.time_ist, size: part.length });
    }
    await logAction(req.user.id, 'outreach_ai_apply_plan', 'campaign', created[0]?.campaign_id || null, { channel, batches: created.length, segment: key, from_list: list.id }, ip(req));
    res.status(201).json({ success: true, data: { campaigns: created } });
}, 'applyPlan');

// ── Background AI tasks ──────────────────────────────────────────────────────
exports.status = wrap(async (req, res) => {
    res.json({
        success: true,
        data: {
            ai_enabled: await isEnabled(tasks.FLAG),
            scheduler_enabled: await isEnabled('campaign_scheduler_enabled'),
            model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        },
    });
}, 'status');

// POST /ai/tasks  { kind, input }
exports.startTask = wrap(async (req, res) => {
    const out = await tasks.startTask({ user: req.user, kind: req.body?.kind, input: req.body?.input });
    res.status(202).json({ success: true, data: out });
}, 'startTask');

// GET /ai/tasks/:id
exports.getTask = wrap(async (req, res) => {
    const t = await tasks.getTask(parseInt(req.params.id, 10), req.user);
    if (!t) throw fail(404, 'Task not found.');
    res.json({ success: true, data: t });
}, 'getTask');

// GET /ai/tasks?kind=&limit=  (your recent finished tasks, so a good draft is never lost)
exports.listTasks = wrap(async (req, res) => {
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const kinds = Object.keys(tasks.KINDS);
    const kind = kinds.includes(req.query.kind) ? req.query.kind : null;
    const [rows] = await db.query(
        `SELECT id, kind, status, input, result, created_at FROM ai_tasks
         WHERE user_id = ? AND deleted_at IS NULL AND status = 'done' ${kind ? 'AND kind = ?' : ''}
         ORDER BY id DESC LIMIT ?`, kind ? [req.user.id, kind, limit] : [req.user.id, limit]);
    const j = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
    res.json({ success: true, data: rows.map((r) => ({ id: r.id, kind: r.kind, input: j(r.input), result: j(r.result), created_at: r.created_at })) });
}, 'listTasks');

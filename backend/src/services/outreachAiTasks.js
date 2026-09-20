// Outreach AI writing tasks, run by the local model (Ollama) in the background.
//
// The pattern that works with a small model on a slow CPU box: one JSON-mode call per
// task, a tight schema, and a sanitiser that never trusts the reply. A task is stored in
// ai_tasks; the caller starts it and polls for the result, so a page never hangs.
// Anything that can be computed with rules (scores, segments, schedule, copy checks) is
// done in outreachAiRules.js and never comes here.
const db = require('../config/db');
const { chatCompletion } = require('./localLlmService');
const { enqueue, isEnabled, parseJsonReply, cleanText } = require('./llmJobs');
const rules = require('./outreachAiRules');

const FLAG = 'outreach_ai_enabled';
const MAX_PENDING_PER_USER = 3;
const MAX_TASKS_PER_DAY = 100;

const BUSINESS = [
    'LadderStep Human Consulting is an HR and recruitment company in India.',
    'It helps companies hire: candidates are sourced and screened, and companies post jobs on its portal.',
    'It also runs corporate training programmes and a job portal for candidates.',
    'Do not quote prices, discounts, client names, statistics, awards or guarantees unless the brief gives them.',
].join(' ');

const TAGS = ['first_name', 'full_name', 'company_name', 'designation', 'city', 'executive_name'];
const TAG_ALIASES = {
    company: 'company_name', companyname: 'company_name', organisation: 'company_name', organization: 'company_name',
    name: 'first_name', firstname: 'first_name', 'first name': 'first_name', fname: 'first_name', first: 'first_name',
    fullname: 'full_name', 'full name': 'full_name', title: 'designation', role: 'designation', position: 'designation',
    location: 'city', sender: 'executive_name', executive: 'executive_name', sendername: 'executive_name',
};

// The model sometimes invents {{company}} or {{name}}. Map the obvious ones to real merge tags.
function fixTags(text) {
    return String(text ?? '').replace(/\{\{\s*([^{}]{1,30}?)\s*\}\}/g, (all, raw) => {
        const key = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');
        if (TAGS.includes(key)) return `{{${key}}}`;
        const alias = TAG_ALIASES[key] || TAG_ALIASES[key.replace(/_/g, '')] || TAG_ALIASES[raw.toLowerCase().trim()];
        return alias ? `{{${alias}}}` : '';
    });
}

// Email bodies are HTML that goes to real people, so keep only a small set of safe tags.
const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a']);
function cleanHtml(html, max = 4000) {
    let s = String(html ?? '').slice(0, max * 2);
    s = s.replace(/<(script|style|iframe|object|embed|form|svg|math)[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<\/?(\w+)([^>]*)>/g, (all, tag, attrs) => {
        const t = tag.toLowerCase();
        if (!ALLOWED_TAGS.has(t)) return '';
        if (all.startsWith('</')) return `</${t}>`;
        if (t === 'a') {
            const href = (attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i) || [])[1] || '';
            return /^(https?:\/\/|mailto:)/i.test(href) ? `<a href="${href.replace(/"/g, '')}">` : '<a>';
        }
        return `<${t}>`;
    });
    s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/javascript:/gi, '');
    return fixTags(s).trim().slice(0, max);
}

// Follow-ups came back without a greeting or sign-off. Make sure every email has both.
function ensureFraming(html) {
    let out = String(html || '').trim();
    if (!out) return out;
    if (!/^\s*<p>\s*(hi|hello|dear)\b/i.test(out)) out = `<p>Hi {{first_name}},</p>${out}`;
    if (!/\{\{executive_name\}\}/.test(out)) out += '<p>{{executive_name}}<br>LadderStep Human Consulting</p>';
    return out;
}

const plainWords = (html) => String(html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const TONES = ['professional', 'friendly', 'direct', 'warm', 'formal'];

// ── The tasks ────────────────────────────────────────────────────────────────
// prepare(): validate the input and load anything from the database the prompt needs.
// messages(): build the prompt. sanitize(): turn the model's JSON into the safe result.
const KINDS = {
    email_campaign: {
        prepare: async ({ input }) => {
            const goal = cleanText(input.goal, 400);
            if (goal.length < 8) throw badInput('Say what the campaign is for (a sentence is enough).');
            return {
                goal,
                audience: cleanText(input.audience, 300) || 'HR heads, founders and hiring managers at small and mid-sized companies',
                offer: cleanText(input.offer, 400),
                cta: cleanText(input.cta, 200) || 'a short introductory call',
                tone: oneOf(input.tone, TONES, 'professional'),
                length: oneOf(input.length, ['short', 'medium'], 'short'),
            };
        },
        messages: (i) => ({
            system: `${BUSINESS}\nYou write cold outreach emails that people actually answer: specific, human, no hype.\nReply with one JSON object: {"subject_options": ["3 different subject lines, each under 60 characters"], "preheader": "one line of preview text under 90 characters", "body_html": "the email body", "notes": ["2 short tips for the sender"]}\nRules for body_html: start with <p>Hi {{first_name}},</p>. Use only <p>, <br>, <strong>, <ul>, <li>. ${i.length === 'short' ? 'Under 100 words.' : 'Under 160 words.'} One idea and one clear ask. Where natural use the merge tags {{company_name}}, {{designation}}, {{city}}. End with one short line offering to stop: for example "If this is not relevant, reply STOP and I will not write again." Then sign off with <p>{{executive_name}}<br>LadderStep Human Consulting</p>. Never use any other {{tags}}, placeholders in square brackets, or exclamation marks.`,
            user: `Campaign goal: ${i.goal}\nWho it is for: ${i.audience}\n${i.offer ? `What we offer: ${i.offer}\n` : ''}Call to action: ${i.cta}\nTone: ${i.tone}`,
            maxTokens: 650,
        }),
        sanitize: (j) => {
            const subjects = (Array.isArray(j.subject_options) ? j.subject_options : [j.subject]).map((s) => fixTags(cleanText(s, 90)).replace(/^["'“”]+|["'“”]+$/g, '')).filter(Boolean).slice(0, 3);
            const body = ensureFraming(cleanHtml(j.body_html));
            if (!subjects.length || !body) throw new Error('the model did not return a subject and a body');
            return { subject_options: subjects, preheader: cleanText(j.preheader, 100), body_html: body, word_count: plainWords(body), notes: (Array.isArray(j.notes) ? j.notes : []).map((n) => cleanText(n, 200)).filter(Boolean).slice(0, 3) };
        },
    },

    subject_lines: {
        prepare: async ({ input }) => {
            const subject = cleanText(input.subject, 200);
            const body = cleanText(String(input.body || '').replace(/<[^>]+>/g, ' '), 900);
            const goal = cleanText(input.goal, 300);
            if (!subject && !body && !goal) throw badInput('Give me the current subject, the email body, or the goal.');
            return { subject, body, goal };
        },
        messages: (i) => ({
            system: `${BUSINESS}\nYou write email subject lines for cold outreach. Reply with one JSON object: {"options": [{"text": "subject line", "angle": "benefit|curiosity|question|personal|direct"}]}. Give 8 options, two or more different angles, each under 60 characters, no exclamation marks, no ALL CAPS, no spam words like free or guaranteed. You may use {{first_name}} or {{company_name}} in some of them.`,
            user: `${i.subject ? `Current subject: ${i.subject}\n` : ''}${i.body ? `Email: ${i.body}\n` : ''}${i.goal ? `Goal: ${i.goal}` : ''}`,
            maxTokens: 350,
        }),
        sanitize: (j) => {
            const options = (Array.isArray(j.options) ? j.options : []).map((o) => ({
                text: fixTags(cleanText(o?.text ?? o, 90)).replace(/^["'“”]+|["'“”]+$/g, ''),
                angle: oneOf(String(o?.angle || '').toLowerCase(), ['benefit', 'curiosity', 'question', 'personal', 'direct'], 'direct'),
            })).filter((o) => o.text).slice(0, 8);
            if (!options.length) throw new Error('the model returned no subject lines');
            return { options: options.map((o) => ({ ...o, check: rules.checkCopy({ channel: 'email', subject: o.text, body: '' }).issues.filter((x) => ['spam_words', 'subject_caps', 'subject_long', 'punctuation'].includes(x.code)).map((x) => x.message) })) };
        },
    },

    improve_copy: {
        prepare: async ({ input }) => {
            const text = String(input.text || '').trim().slice(0, 4000);
            if (text.length < 15) throw badInput('Paste the text you want improved.');
            return {
                text,
                channel: oneOf(input.channel, ['email', 'whatsapp'], 'email'),
                instruction: oneOf(input.instruction, ['shorter', 'friendlier', 'more_formal', 'clearer', 'stronger_cta', 'fix_grammar'], 'clearer'),
            };
        },
        messages: (i) => {
            const how = {
                shorter: 'Make it about 40% shorter without losing the main point or the ask.',
                friendlier: 'Make it warmer and more conversational, like a message from a helpful person.',
                more_formal: 'Make it more formal and polished.',
                clearer: 'Make it clearer and more direct: plain words, short sentences, one ask.',
                stronger_cta: 'Keep the message but make the call to action clear, specific and easy to say yes to.',
                fix_grammar: 'Fix grammar, spelling and punctuation only. Keep the wording and structure.',
            }[i.instruction];
            return {
                system: `${BUSINESS}\nYou edit outreach copy. ${how} Keep every {{merge_tag}} exactly as written, keep the opt-out line if there is one, and do not add facts, prices or claims. ${i.channel === 'email' ? 'The text may contain HTML: keep it as simple HTML using only <p>, <br>, <strong>, <ul>, <li>.' : 'This is a WhatsApp message: plain text, keep the {{1}} {{2}} numbered variables exactly.'} Reply with one JSON object: {"text": "the edited text", "changes": ["up to 3 short notes on what you changed"]}`,
                user: i.text,
                maxTokens: 700,
            };
        },
        sanitize: (j, i) => {
            const text = i.channel === 'email' ? cleanHtml(j.text) : String(j.text ?? '').replace(/\s+\n/g, '\n').trim().slice(0, 1200);
            if (!text) throw new Error('the model returned no text');
            return { text, changes: (Array.isArray(j.changes) ? j.changes : []).map((c) => cleanText(c, 160)).filter(Boolean).slice(0, 3) };
        },
    },

    follow_up_sequence: {
        prepare: async ({ input }) => {
            const body = cleanText(String(input.body || '').replace(/<[^>]+>/g, ' '), 1200);
            const subject = cleanText(input.subject, 200);
            if (body.length < 20 && !subject) throw badInput('Give me the first email (subject and body) so the follow-ups build on it.');
            return { subject, body, steps: Math.min(4, Math.max(2, parseInt(input.steps, 10) || 3)), tone: oneOf(input.tone, TONES, 'professional') };
        },
        messages: (i) => ({
            system: `${BUSINESS}\nYou write follow-up emails for people who did not reply to a first cold email. Each one is shorter than the last and gives a new reason to answer (a new angle, a useful question, a simple yes/no ask); none repeats the first email or sounds annoyed. The last one politely says you will stop writing. A good follow-up sounds like: "<p>Hi {{first_name}},</p><p>I wrote last week about hiring support for {{company_name}}. One quick question: are you hiring for any roles in the next two months? If it is not a priority right now, tell me and I will check back later.</p>". Write in full friendly sentences like that, never one-line fragments. Reply with one JSON object: {"steps": [{"after_days": number, "subject": "under 60 characters", "body_html": "the email", "purpose": "one short line"}]} with exactly ${i.steps} steps. after_days counts from the previous email: use 3, then 4 to 7. Rules for body_html: start with <p>Hi {{first_name}},</p>, use only <p>, <br>, <strong>, under 70 words, end with <p>{{executive_name}}<br>LadderStep Human Consulting</p>. Only the merge tags {{first_name}}, {{company_name}}, {{designation}}, {{city}}, {{executive_name}}. No exclamation marks.`,
            user: `First email subject: ${i.subject}\nFirst email: ${i.body}\nTone: ${i.tone}`,
            maxTokens: 900,
        }),
        sanitize: (j, i) => {
            const steps = (Array.isArray(j.steps) ? j.steps : []).map((s) => ({
                after_days: Math.min(21, Math.max(1, parseInt(s?.after_days, 10) || 3)),
                subject: fixTags(cleanText(s?.subject, 90)),
                body_html: ensureFraming(cleanHtml(s?.body_html, 2000)),
                purpose: cleanText(s?.purpose, 120),
            })).filter((s) => s.subject && s.body_html).slice(0, i.steps);
            if (!steps.length) throw new Error('the model returned no follow-ups');
            return { steps };
        },
    },

    wa_template: {
        prepare: async ({ input }) => {
            const goal = cleanText(input.goal, 400);
            if (goal.length < 8) throw badInput('Say what the message is for.');
            return { goal, tone: oneOf(input.tone, TONES, 'friendly'), category: oneOf(input.category, ['MARKETING', 'UTILITY'], 'MARKETING') };
        },
        messages: (i) => ({
            system: `${BUSINESS}\nYou draft WhatsApp Business message templates that Meta approves. Reply with one JSON object: {"template_name": "lowercase_with_underscores, under 40 characters", "body_text": "the message", "footer": "short footer", "variable_hints": [{"n": 1, "field": "first_name|company_name|designation|city|full_name", "example": "sample value"}], "notes": ["up to 3 short tips"]}. Rules for body_text: under 500 characters, plain text, at most 1 emoji, no exclamation marks, no ALL CAPS, no URL shorteners, no promises or prices, and no pushy phrases such as "call us now". Give one reason the person should care, then ask a simple question they can answer with a reply, for example whether they are hiring right now. Use numbered variables {{1}}, {{2}} in order with no gaps, and at most 3. Start with a greeting using {{1}} for the first name. One clear ask. footer must be "Reply STOP to opt out". ${i.category === 'MARKETING' ? 'This is a marketing message.' : 'This is a utility message about an existing request.'}`,
            user: `Purpose: ${i.goal}\nTone: ${i.tone}`,
            maxTokens: 450,
        }),
        sanitize: (j, i) => {
            let body = String(j.body_text ?? '').replace(/\r/g, '').replace(/[<>]/g, '').trim().slice(0, 1000);
            // Variables must be {{1}}..{{n}}: turn any named tag into the next number, drop the rest.
            let n = 0;
            const map = new Map();
            body = body.replace(/\{\{\s*([^{}]{1,30}?)\s*\}\}/g, (all, raw) => {
                if (/^\d+$/.test(raw)) { if (!map.has(raw)) map.set(raw, ++n); return `{{${map.get(raw)}}}`; }
                const key = raw.toLowerCase().trim();
                if (!map.has(key)) map.set(key, ++n);
                return `{{${map.get(key)}}}`;
            });
            if (!body) throw new Error('the model returned no message');
            const count = n;
            const hints = (Array.isArray(j.variable_hints) ? j.variable_hints : []).map((h) => ({ n: parseInt(h?.n, 10) || 0, field: oneOf(String(h?.field || ''), ['first_name', 'company_name', 'designation', 'city', 'full_name'], 'first_name'), example: cleanText(h?.example, 40) })).filter((h) => h.n >= 1 && h.n <= count);
            const name = cleanText(j.template_name, 60).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'outreach_message';
            const footer = /stop/i.test(String(j.footer || '')) ? cleanText(j.footer, 60) : 'Reply STOP to opt out';
            return {
                template_name: name, category: i.category, language_code: 'en', body_text: body, footer_text: footer,
                variable_count: count, variable_hints: hints, notes: (Array.isArray(j.notes) ? j.notes : []).map((x) => cleanText(x, 180)).filter(Boolean).slice(0, 3),
                check: rules.checkCopy({ channel: 'whatsapp', body: `${body}\n${footer}` }),
            };
        },
    },

    reply_draft: {
        prepare: async ({ input, user }) => {
            const id = parseInt(input.reply_id, 10);
            if (!id) throw badInput('Which reply?');
            const [[r]] = await db.query(
                `SELECT r.id, r.from_name, r.from_email, r.subject, r.body_text, r.assigned_to, r.campaign_id,
                        c.subject AS campaign_subject, c.message_body AS campaign_body
                 FROM outreach_email_replies r LEFT JOIN outreach_campaigns c ON c.id = r.campaign_id
                 WHERE r.id = ? AND r.deleted_at IS NULL`, [id]);
            if (!r || (user.role === 'hr_staff' && r.assigned_to !== user.id)) throw badInput('Reply not found.', 404);
            const [[me]] = await db.query('SELECT name FROM users WHERE id = ?', [user.id]);
            const triage = rules.classifyReply({ subject: r.subject, body: r.body_text, fromEmail: r.from_email });
            return {
                reply_id: r.id, intent: triage.intent, intent_label: triage.label,
                who: cleanText(r.from_name, 60).split(/\s+/).filter((t) => !/^(dr|mr|mrs|ms|miss|prof|shri|smt|sri|the)\.?$/i.test(t))[0] || 'there',
                subject: cleanText(r.subject, 200),
                their: rules.freshText(r.body_text).slice(0, 700),
                ours: cleanText(String(r.campaign_body || '').replace(/<[^>]+>/g, ' '), 500),
                sender: cleanText(me?.name, 60) || 'the LadderStep team',
                tip: input.tip ? cleanText(input.tip, 300) : '',
            };
        },
        messages: (i) => ({
            system: `${BUSINESS}\nYou write the reply an executive sends to a prospect who answered a cold email. Be human and brief (under 90 words), answer exactly what they asked, and end with one easy next step (offer two time slots for a call if they showed interest). Never invent prices, dates, names or claims: if they asked something you cannot know, say you will confirm and come back. If they want to stop, apologise briefly, confirm you will not write again, and do not sell. Reply with one JSON object: {"subject": "reply subject", "body_html": "the reply", "next_step": "one line telling the executive what to do after sending"}. body_html: start with <p>Hi ${i.who},</p>, only <p> and <br>, sign off with <p>${i.sender}<br>LadderStep Human Consulting</p>.`,
            user: `Our first email said: ${i.ours || '(not available)'}\nTheir subject: ${i.subject}\nTheir reply: ${i.their}\nOur reading of their intent: ${i.intent_label}${i.tip ? `\nExtra instruction from the executive: ${i.tip}` : ''}`,
            maxTokens: 450,
        }),
        sanitize: (j, i) => {
            const body = cleanHtml(j.body_html, 2000);
            if (!body) throw new Error('the model returned no reply');
            return { reply_id: i.reply_id, intent: i.intent, intent_label: i.intent_label, subject: cleanText(j.subject, 200) || (i.subject.startsWith('Re:') ? i.subject : `Re: ${i.subject}`), body_html: body, next_step: cleanText(j.next_step, 200) };
        },
    },

    call_script: {
        prepare: async ({ input, user }) => {
            const purpose = cleanText(input.purpose, 300) || 'introduce our hiring support and book a short meeting';
            const company = cleanText(input.company, 120);
            const person = cleanText(input.person, 80);
            if (!company && !person) throw badInput('Who are you calling? Give a company or a person.');
            const [[me]] = await db.query('SELECT name FROM users WHERE id = ?', [user.id]);
            return { purpose, company, person, designation: cleanText(input.designation, 100), notes: cleanText(input.notes, 500), sender: cleanText(me?.name, 60) || 'an executive at LadderStep' };
        },
        messages: (i) => ({
            system: `${BUSINESS}\nYou write a short cold-call script for a recruitment executive in India. Natural spoken language, no jargon, never invent facts about the prospect beyond what is given. The caller is ${i.sender}: use that name and never a placeholder in square brackets. Reply with one JSON object: {"opening": "the first 2 sentences to say", "questions": ["3 discovery questions"], "talking_points": ["3 short points about how we can help"], "objections": [{"objection": "...", "response": "..."}], "closing": "how to ask for the next step", "voicemail": "a 15-second voicemail"} with exactly 3 objections (for example: we already have a vendor, send an email, not hiring now).`,
            user: `Purpose of the call: ${i.purpose}\n${i.person ? `Person: ${i.person}${i.designation ? `, ${i.designation}` : ''}\n` : ''}${i.company ? `Company: ${i.company}\n` : ''}${i.notes ? `Notes: ${i.notes}` : ''}`,
            maxTokens: 800,
        }),
        sanitize: (j, i) => {
            const list = (a, n, m) => (Array.isArray(a) ? a : []).map((x) => cleanText(x, m)).filter(Boolean).slice(0, n);
            const fixName = (t) => String(t || '').replace(/\[\s*your name\s*\]/gi, i.sender);
            const out = {
                opening: fixName(cleanText(j.opening, 400)), questions: list(j.questions, 4, 200), talking_points: list(j.talking_points, 4, 220),
                objections: (Array.isArray(j.objections) ? j.objections : []).map((o) => ({ objection: cleanText(o?.objection, 120), response: cleanText(o?.response, 300) })).filter((o) => o.objection && o.response).slice(0, 4),
                closing: cleanText(j.closing, 300), voicemail: fixName(cleanText(j.voicemail, 350)),
            };
            if (!out.opening) throw new Error('the model returned no script');
            return out;
        },
    },

    campaign_insights: {
        prepare: async ({ input, user }) => {
            const days = Math.min(365, Math.max(7, parseInt(input.days, 10) || 90));
            return { days, stats: await campaignStats(user, days) };
        },
        messages: (i) => ({
            system: `${BUSINESS}\nYou are an analyst for an outreach team. Given real campaign numbers, explain what they mean in plain words for the person who ran the campaigns. Use ONLY the numbers given; do not invent any figure. The people contacted are business prospects (HR heads, founders, hiring managers), not job candidates. Quote the numbers exactly as given and do not compare two numbers unless both are given. Say honestly when there is too little data to conclude. Reply with one JSON object: {"headline": "one sentence summary", "findings": ["3 short findings that cite the numbers"], "recommendations": ["3 concrete things to try next"]}`,
            user: JSON.stringify(i.stats),
            maxTokens: 450,
        }),
        sanitize: (j, i) => {
            const list = (a) => (Array.isArray(a) ? a : []).map((x) => cleanText(x, 260)).filter(Boolean).slice(0, 4);
            const out = { headline: cleanText(j.headline, 240), findings: list(j.findings), recommendations: list(j.recommendations), days: i.days };
            if (!out.headline && !out.findings.length) throw new Error('the model returned no analysis');
            return out;
        },
    },
};

function badInput(message, status = 422) {
    const e = new Error(message);
    e.status = status;
    e.userFacing = true;
    return e;
}

// Rule-based numbers behind the insights task (also served on their own, instantly).
async function campaignStats(user, days) {
    const own = user.role === 'admin' ? '' : 'AND c.created_by = ?';
    const params = user.role === 'admin' ? [days] : [days, user.id];
    const [camps] = await db.query(
        `SELECT c.id, c.campaign_name, c.campaign_type AS type, c.status, c.sent_count, c.failed_count, c.reply_count, c.total_recipients, c.sent_at
         FROM outreach_campaigns c
         WHERE c.deleted_at IS NULL AND c.campaign_type IN ('email','whatsapp') AND c.status IN ('sent','paused','sending')
           AND COALESCE(c.sent_at, c.created_at) >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY) ${own}`, params);
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
    const channel = (t) => {
        const rows = camps.filter((c) => c.type === t);
        const sent = rows.reduce((s, c) => s + Number(c.sent_count || 0), 0);
        const replies = rows.reduce((s, c) => s + Number(c.reply_count || 0), 0);
        const failed = rows.reduce((s, c) => s + Number(c.failed_count || 0), 0);
        return { campaigns: rows.length, sent, failed, replies, reply_rate_pct: pct(replies, sent), failure_rate_pct: pct(failed, sent + failed) };
    };
    const ranked = camps.filter((c) => Number(c.sent_count) >= 20)
        .map((c) => ({ name: c.campaign_name, type: c.type, sent: Number(c.sent_count), replies: Number(c.reply_count), reply_rate_pct: pct(Number(c.reply_count), Number(c.sent_count)) }))
        .sort((a, b) => b.reply_rate_pct - a.reply_rate_pct);

    const [replies] = await db.query(
        `SELECT r.subject, r.body_text, r.from_email, r.received_at FROM outreach_email_replies r
         JOIN outreach_campaigns c ON c.id = r.campaign_id
         WHERE r.deleted_at IS NULL AND r.received_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY) ${own} LIMIT 2000`, params);
    const intents = {};
    const weekdays = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const names = Object.keys(weekdays);
    for (const r of replies) {
        const k = rules.classifyReply({ subject: r.subject, body: r.body_text, fromEmail: r.from_email }).intent;
        intents[k] = (intents[k] || 0) + 1;
        weekdays[names[new Date(new Date(r.received_at).getTime() + 330 * 60000).getUTCDay()]] += 1;
    }
    return {
        period_days: days,
        totals: { campaigns: camps.length, sent: channel('email').sent + channel('whatsapp').sent, replies: channel('email').replies + channel('whatsapp').replies },
        email: channel('email'), whatsapp: channel('whatsapp'),
        best_campaigns: ranked.slice(0, 3), weakest_campaigns: ranked.slice(-2).reverse(),
        reply_outcomes: intents, replies_by_weekday_ist: weekdays,
    };
}

// ── Running a task ───────────────────────────────────────────────────────────
async function run(taskId, kind, prepared) {
    const def = KINDS[kind];
    try {
        const m = def.messages(prepared);
        const reply = await chatCompletion({
            messages: [{ role: 'system', content: m.system }, { role: 'user', content: m.user }],
            json: true, temperature: 0.5, maxTokens: m.maxTokens, timeoutMs: 420000,
        });
        const parsed = parseJsonReply(reply.content);
        if (!parsed) throw new Error('the model did not return JSON');
        const result = def.sanitize(parsed, prepared);
        await db.query("UPDATE ai_tasks SET status = 'done', result = ?, finished_at = UTC_TIMESTAMP() WHERE id = ?", [JSON.stringify(result), taskId]);
    } catch (err) {
        console.error(`[outreach ai:${kind}]`, err.message);
        await db.query("UPDATE ai_tasks SET status = 'failed', error = ?, finished_at = UTC_TIMESTAMP() WHERE id = ?", [cleanText(err.message, 250), taskId]);
    }
}

// Returns { id, status }. Throws an Error with .status/.userFacing for bad input or limits.
async function startTask({ user, kind, input }) {
    if (!KINDS[kind]) throw badInput('Unknown AI task.');
    if (!(await isEnabled(FLAG))) throw badInput('AI writing help is switched off by an admin.', 403);

    const [[busy]] = await db.query(
        "SELECT COUNT(*) AS n FROM ai_tasks WHERE user_id = ? AND status = 'pending' AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)", [user.id]);
    if (Number(busy.n) >= MAX_PENDING_PER_USER) throw badInput('You already have AI tasks running. Wait for one to finish.', 429);
    const [[today]] = await db.query('SELECT COUNT(*) AS n FROM ai_tasks WHERE user_id = ? AND created_at >= UTC_DATE()', [user.id]);
    if (Number(today.n) >= MAX_TASKS_PER_DAY) throw badInput('Daily AI limit reached. Try again tomorrow.', 429);

    const prepared = await KINDS[kind].prepare({ input: input || {}, user });
    const [ins] = await db.query("INSERT INTO ai_tasks (user_id, kind, input, status) VALUES (?, ?, ?, 'pending')",
        [user.id, kind, JSON.stringify(kind === 'campaign_insights' ? { days: prepared.days } : { ...prepared, stats: undefined })]);
    if (!enqueue(`outreach:${kind}`, () => run(ins.insertId, kind, prepared))) {
        await db.query("UPDATE ai_tasks SET status = 'failed', error = 'The AI is busy with other requests.' WHERE id = ?", [ins.insertId]);
        throw badInput('The AI is busy with other requests. Try again in a minute.', 503);
    }
    return { id: ins.insertId, status: 'pending' };
}

const STALE_MINUTES = 12;
async function getTask(id, user) {
    const [[t]] = await db.query('SELECT id, user_id, kind, status, result, error, created_at, finished_at FROM ai_tasks WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!t || (user.role !== 'admin' && t.user_id !== user.id)) return null;
    let status = t.status;
    if (status === 'pending' && Date.now() - new Date(t.created_at).getTime() > STALE_MINUTES * 60000) status = 'failed'; // lost in a restart
    return {
        id: t.id, kind: t.kind, status,
        result: status === 'done' ? (typeof t.result === 'string' ? JSON.parse(t.result) : t.result) : null,
        error: status === 'failed' ? (t.error || 'The AI did not finish. Please try again.') : null,
        created_at: t.created_at, finished_at: t.finished_at,
    };
}

module.exports = { startTask, getTask, campaignStats, KINDS, cleanHtml, fixTags, FLAG };

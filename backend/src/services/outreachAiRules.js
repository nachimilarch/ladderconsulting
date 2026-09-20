// Rule-based outreach intelligence: instant, deterministic, no model involved.
//
// Everything that has to run over a whole contact list, or that a person waits on with
// the page open, lives here. The AI model (outreachAiTasks.js) is only used where it
// has to write something. Pure functions, no database access, so they are easy to test.

// ── Email ────────────────────────────────────────────────────────────────────
const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;

const FREE_MAIL = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'ymail.com', 'hotmail.com',
    'outlook.com', 'live.com', 'msn.com', 'rediffmail.com', 'icloud.com', 'me.com', 'aol.com',
    'proton.me', 'protonmail.com', 'gmx.com', 'mail.com',
]);
const DISPOSABLE = new Set([
    'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com',
    'trashmail.com', 'sharklasers.com', 'getnada.com', 'temp-mail.org',
]);
const DOMAIN_TYPOS = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.co': 'gmail.com',
    'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com',
    'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yhoo.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com',
    'rediffmail.co': 'rediffmail.com',
};
const ROLE_LOCALS = new Set([
    'info', 'contact', 'hello', 'admin', 'support', 'sales', 'hr', 'careers', 'career', 'jobs', 'recruitment',
    'enquiry', 'enquiries', 'inquiry', 'office', 'mail', 'team', 'marketing', 'accounts', 'billing', 'noreply',
    'no-reply', 'webmaster', 'help', 'service', 'services', 'feedback', 'hiring', 'talent', 'reception',
]);

// One address out of a cell that may hold several ("a@x.com; b@y.com").
function firstEmail(raw) {
    const m = String(raw || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
    return m ? m[0].toLowerCase() : null;
}

function analyseEmail(raw) {
    const email = firstEmail(raw);
    if (!raw || !String(raw).trim()) return { status: 'missing' };
    if (!email || !EMAIL_RE.test(email)) return { status: 'invalid' };
    const [local, domain] = email.split('@');
    const fix = DOMAIN_TYPOS[domain] ? `${local}@${DOMAIN_TYPOS[domain]}` : null;
    return {
        status: 'valid',
        email,
        domain,
        typoFix: fix,
        isFree: FREE_MAIL.has(domain) || !!fix,
        isRole: ROLE_LOCALS.has(local.replace(/[0-9]+$/, '')),
        isDisposable: DISPOSABLE.has(domain),
    };
}

// ── Phone ────────────────────────────────────────────────────────────────────
// India first (this platform's market). Returns { e164, mobile } or null.
function normalisePhone(raw, defaultCountry = '91') {
    if (!raw) return null;
    let digits = String(raw).replace(/[^\d+]/g, '');
    const plus = digits.startsWith('+');
    digits = digits.replace(/\D/g, '');
    if (!digits) return null;
    if (!plus) {
        if (digits.startsWith('00')) digits = digits.slice(2);
        else if (digits.length === 11 && digits.startsWith('0')) digits = defaultCountry + digits.slice(1);
        else if (digits.length === 10) digits = defaultCountry + digits;
    }
    if (digits.length < 8 || digits.length > 15) return null;
    const isIndia = digits.startsWith('91') && digits.length === 12;
    const mobile = isIndia ? /^[6-9]/.test(digits.slice(2)) : true;
    if (isIndia && !mobile) return { e164: `+${digits}`, mobile: false }; // landline
    return { e164: `+${digits}`, mobile };
}

// ── Designation → seniority and HR relevance ─────────────────────────────────
const SENIORITY_RANK = { owner: 5, c_level: 4, director: 3, manager: 2, staff: 1, unknown: 0 };
const SENIORITY_LABEL = {
    owner: 'Owner / Founder', c_level: 'C-level', director: 'Director / VP / Head',
    manager: 'Manager', staff: 'Executive / Staff', unknown: 'Unknown',
};

function analyseDesignation(raw) {
    const d = String(raw || '').toLowerCase().trim();
    if (!d) return { seniority: 'unknown', isHr: false, known: false };
    const isHr = /\b(hr|h\.r|chro|cpo|human resources?|talent|recruit\w*|hiring|people|staffing|acquisition|placement)\b/.test(d);
    let seniority = 'staff';
    if (/\b(founder|co-?founder|owner|proprietor|partner|promoter|chairman|chairperson|managing director|md|ceo|president|chief executive)\b/.test(d)) seniority = 'owner';
    else if (/\b(cto|cfo|coo|cmo|chro|cio|cxo|chief)\b/.test(d)) seniority = 'c_level';
    else if (/\b(vp|vice president|avp|director|head|general manager|gm|dgm|agm)\b/.test(d)) seniority = 'director';
    else if (/\b(manager|lead|supervisor|team lead)\b/.test(d)) seniority = 'manager';
    return { seniority, isHr, known: true };
}

// ── Company → industry guess ─────────────────────────────────────────────────
const INDUSTRY_RULES = [
    ['IT / Software', /\b(tech|technolog\w*|software|infotech|infosys|it services|digital|cloud|cyber|data|labs?|systems|apps?|web|ai|analytics|computers?)\b/],
    ['Pharma / Healthcare', /\b(pharma\w*|health\w*|hospital|clinic|medical|medic\w*|biotech|bio|diagnostic\w*|life ?sciences?|care|dental|wellness)\b/],
    ['Finance / Banking / Insurance', /\b(bank|finance|financial|capital|insurance|assurance|invest\w*|wealth|loans?|nbfc|securities|credit|fintech|fincorp|mutual)\b/],
    ['Manufacturing / Engineering', /\b(manufactur\w*|industries|industrial|engineering|engineers|steel|metals?|plastics?|chemicals?|machin\w*|tools?|fabricat\w*|foundry|forge|pumps?|electricals?|electronics)\b/],
    ['Education / Training', /\b(school|college|university|institute|academy|education\w*|training|coaching|learning|edu|classes)\b/],
    ['Real Estate / Construction', /\b(real ?estate|realty|construction|builders?|developers?|infra\w*|properties|housing|estates?|interiors?|architect\w*)\b/],
    ['Retail / E-commerce', /\b(retail|mart|stores?|supermarket|shopping|ecommerce|e-commerce|fashion|apparel|garments?|textiles?|trading|traders|enterprises)\b/],
    ['Logistics / Transport', /\b(logistic\w*|transport\w*|cargo|freight|shipping|courier|supply chain|warehous\w*|movers|travels?)\b/],
    ['Hospitality / Travel', /\b(hotel|resort|hospitality|restaurant|foods?|catering|tourism|holidays|cafe)\b/],
    ['Consulting / Services', /\b(consult\w*|services|solutions|advisory|associates|outsourc\w*|management|staffing|recruit\w*|hr)\b/],
    ['Media / Marketing', /\b(media|marketing|advertis\w*|creative|design|studio|pr|communications|entertainment|production)\b/],
    ['Energy / Power', /\b(energy|power|solar|renewable|electric\w*|oil|gas|petro\w*|fuel)\b/],
    ['Automotive', /\b(auto\w*|motors?|automotive|vehicles?|cars?|tyres?|wheels?)\b/],
    ['Agriculture / Food', /\b(agri\w*|farms?|seeds|fertili\w*|dairy|food|beverages?|organic)\b/],
];

function guessIndustry(company, emailDomain) {
    const name = String(company || '').toLowerCase().replace(/[^a-z0-9& ]/g, ' ');
    const domain = emailDomain && !FREE_MAIL.has(emailDomain) ? emailDomain.split('.')[0].replace(/[-_]/g, ' ') : '';
    for (const text of [name, domain]) {
        if (!text.trim()) continue;
        for (const [industry, re] of INDUSTRY_RULES) if (re.test(text)) return industry;
    }
    return 'Unclassified';
}

// ── Per-contact facts, scoring and segments ──────────────────────────────────
// `hist` = { contacted (bool), lastSentAt (Date|null), replied (bool), failed (bool) } for email.
function buildFacts(contact, hist = {}) {
    const em = analyseEmail(contact.email);
    const wa = normalisePhone(contact.whatsapp_number) || normalisePhone(contact.phone);
    const ph = normalisePhone(contact.phone);
    const des = analyseDesignation(contact.designation);
    return {
        id: contact.id,
        unsub: !!contact.is_unsubscribed,
        email: em,
        phone: ph,
        waReady: !!(wa && wa.mobile),
        seniority: des.seniority,
        isHr: des.isHr,
        hasDesignation: des.known,
        duplicate: !!contact.duplicate,
        industry: guessIndustry(contact.company_name, em.domain),
        hist: {
            contacted: !!hist.contacted,
            lastSentAt: hist.lastSentAt || null,
            replied: !!hist.replied,
            failed: !!hist.failed,
        },
    };
}

const DAY_MS = 86400000;

function contactScore(f, now = Date.now()) {
    if (f.unsub) return { score: 0, reasons: ['Unsubscribed'] };
    let score = 40;
    const reasons = [];
    if (f.isHr) { score += 25; reasons.push('HR / talent role'); }
    if (f.seniority === 'owner') { score += 22; reasons.push('Owner / founder'); }
    else if (f.seniority === 'c_level') { score += 20; reasons.push('C-level'); }
    else if (f.seniority === 'director') { score += 15; reasons.push('Director / head'); }
    else if (f.seniority === 'manager') { score += 8; reasons.push('Manager'); }
    if (f.email.status === 'valid') {
        score += 8;
        if (!f.email.isFree) { score += 10; reasons.push('Company email'); }
        if (f.email.isRole) { score -= 10; reasons.push('Shared inbox (info@, hr@ ...)'); }
        if (f.email.isDisposable) { score -= 40; reasons.push('Disposable address'); }
        if (f.email.typoFix) { score -= 15; reasons.push('Mistyped email domain'); }
        if (f.duplicate) { score -= 30; reasons.push('Duplicate of another contact'); }
    } else {
        score -= 15;
        reasons.push(f.email.status === 'missing' ? 'No email' : 'Invalid email');
    }
    if (f.waReady) { score += 6; reasons.push('Reachable on WhatsApp'); }
    if (f.hist.replied) { score += 25; reasons.push('Already replied'); }
    else if (f.hist.failed) { score -= 35; reasons.push('Email bounced before'); }
    else if (f.hist.contacted) {
        const days = f.hist.lastSentAt ? (now - new Date(f.hist.lastSentAt).getTime()) / DAY_MS : 99;
        if (days < 3) { score -= 25; reasons.push('Emailed very recently'); }
        else { score += 5; reasons.push('Emailed before, no reply: follow up'); }
    } else if (f.email.status === 'valid') {
        score += 6; reasons.push('Never contacted');
    }
    return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

const SEGMENTS = [
    { key: 'fresh_email', label: 'Fresh prospects', desc: 'Valid email, never contacted. The safest first send.',
      test: (f, now) => !f.unsub && f.email.status === 'valid' && !f.email.isDisposable && !f.email.typoFix && !f.duplicate && !f.hist.contacted },
    { key: 'follow_up', label: 'Follow-up candidates', desc: 'Emailed 3+ days ago with no reply and no bounce.',
      test: (f, now) => !f.unsub && f.hist.contacted && !f.hist.replied && !f.hist.failed && f.email.status === 'valid' && !f.duplicate
          && f.hist.lastSentAt && (now - new Date(f.hist.lastSentAt).getTime()) >= 3 * DAY_MS },
    { key: 'warm', label: 'Warm: already replied', desc: 'Have replied to a campaign. Talk to them personally.',
      test: (f) => !f.unsub && f.hist.replied },
    { key: 'hr_talent', label: 'HR / talent people', desc: 'Designation mentions HR, talent, recruitment or hiring.',
      test: (f) => !f.unsub && f.isHr },
    { key: 'decision_makers', label: 'Decision makers', desc: 'Owners, founders, C-level and directors.',
      test: (f) => !f.unsub && ['owner', 'c_level', 'director'].includes(f.seniority) },
    { key: 'corporate_email', label: 'Company email addresses', desc: 'Valid address on a company domain (not Gmail, Yahoo and similar).',
      test: (f) => !f.unsub && f.email.status === 'valid' && !f.email.isFree && !f.email.isDisposable },
    { key: 'free_mail', label: 'Personal email addresses', desc: 'Gmail, Yahoo, Outlook and similar. Often small businesses or individuals.',
      test: (f) => !f.unsub && f.email.status === 'valid' && f.email.isFree },
    { key: 'whatsapp_ready', label: 'WhatsApp-ready', desc: 'Has a valid mobile number for WhatsApp.',
      test: (f) => !f.unsub && f.waReady },
    { key: 'phone_only', label: 'Call-only', desc: 'Has a phone number but no usable email. Good for cold calls.',
      test: (f) => !f.unsub && !!f.phone && f.email.status !== 'valid' },
    { key: 'needs_cleanup', label: 'Needs cleanup', desc: 'Invalid or mistyped email, duplicate, shared inbox, disposable address or previous bounce.',
      test: (f) => !f.unsub && (f.email.status === 'invalid' || f.email.typoFix || f.email.isRole || f.email.isDisposable || f.duplicate || f.hist.failed) },
];

function segmentTest(key) {
    if (key.startsWith('industry:')) {
        const name = key.slice('industry:'.length);
        return { label: name, desc: `Companies that look like ${name}.`, test: (f) => !f.unsub && f.industry === name };
    }
    return SEGMENTS.find((s) => s.key === key) || null;
}

function summariseSegments(factsList, now = Date.now()) {
    const out = SEGMENTS.map((s) => ({ key: s.key, label: s.label, description: s.desc, count: factsList.filter((f) => s.test(f, now)).length }));
    const byIndustry = new Map();
    for (const f of factsList) if (!f.unsub) byIndustry.set(f.industry, (byIndustry.get(f.industry) || 0) + 1);
    for (const [name, count] of [...byIndustry.entries()].sort((a, b) => b[1] - a[1])) {
        if (name === 'Unclassified' || count < 3) continue;
        out.push({ key: `industry:${name}`, label: name, description: `Companies that look like ${name}.`, count, group: 'industry' });
    }
    return out;
}

// ── List health ──────────────────────────────────────────────────────────────
function listHealth(contacts, factsList) {
    const seen = new Map();
    let duplicates = 0;
    for (const f of factsList) {
        if (f.email.status !== 'valid') continue;
        if (seen.has(f.email.email)) duplicates += 1;
        else seen.set(f.email.email, f.id);
    }
    const count = (fn) => factsList.filter(fn).length;
    const total = contacts.length;
    const health = {
        total,
        unsubscribed: count((f) => f.unsub),
        email_valid: count((f) => f.email.status === 'valid'),
        email_missing: count((f) => f.email.status === 'missing'),
        email_invalid: count((f) => f.email.status === 'invalid'),
        email_typos: count((f) => !!f.email.typoFix),
        email_role_based: count((f) => f.email.status === 'valid' && f.email.isRole),
        email_disposable: count((f) => f.email.status === 'valid' && f.email.isDisposable),
        email_company_domain: count((f) => f.email.status === 'valid' && !f.email.isFree),
        email_free_domain: count((f) => f.email.status === 'valid' && f.email.isFree),
        email_duplicates: duplicates,
        whatsapp_ready: count((f) => f.waReady),
        has_phone: count((f) => !!f.phone),
        has_designation: count((f) => f.hasDesignation),
        previously_contacted: count((f) => f.hist.contacted),
        bounced: count((f) => f.hist.failed),
        replied: count((f) => f.hist.replied),
    };
    const issues = [];
    const add = (severity, n, message, fix) => { if (n > 0) issues.push({ severity, count: n, message, fix }); };
    add('high', health.email_invalid, 'Emails that are not valid addresses', 'Fix or remove them; they will fail to send.');
    add('high', health.email_typos, 'Emails on a mistyped domain (for example gmial.com)', 'Use "Fix typos" to correct them.');
    add('high', health.bounced, 'Emails that bounced in an earlier campaign', 'Skip them; sending again hurts your sender reputation.');
    add('medium', health.email_duplicates, 'Duplicate email addresses in this list', 'Keep one row per address so people are not emailed twice.');
    add('medium', health.email_role_based, 'Shared inboxes (info@, hr@, sales@ ...)', 'They rarely reach a decision maker. Send to a named person where you can.');
    add('medium', health.email_disposable, 'Disposable email domains', 'Remove them; nobody reads these inboxes.');
    add('low', health.email_missing, 'Contacts with no email', 'Use WhatsApp or a call for these.');
    if (total && health.has_designation / total < 0.3) {
        issues.push({ severity: 'low', count: total - health.has_designation, message: 'Most contacts have no designation',
            fix: 'Add a designation column to your next upload so campaigns can target HR heads and owners.' });
    }
    return { health, issues };
}

// ── Copy checker ─────────────────────────────────────────────────────────────
const SPAM_WORDS = [
    'free', 'guarantee', 'guaranteed', '100%', 'act now', 'limited time', 'urgent', 'winner', 'cash', 'earn money',
    'click here', 'buy now', 'no cost', 'risk-free', 'risk free', 'congratulations', 'lowest price', 'make money',
    'double your', 'no obligation', 'once in a lifetime', 'apply now', 'don\'t miss', 'exclusive deal', 'best price',
];
const KNOWN_TAGS = new Set(['first_name', 'last_name', 'full_name', 'company_name', 'designation', 'city', 'executive_name']);

const stripHtml = (s) => String(s || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function checkCopy({ channel = 'email', subject = '', body = '' }) {
    const text = stripHtml(body);
    const lower = `${subject} ${text}`.toLowerCase();
    const words = text ? text.split(/\s+/).length : 0;
    const links = (String(body).match(/https?:\/\/|www\./gi) || []).length;
    const issues = [];
    const add = (severity, code, message, fix) => issues.push({ severity, code, message, fix });

    // Placeholders that were never filled in are the most embarrassing mistake.
    const brackets = String(subject + ' ' + body).match(/\[[A-Za-z][A-Za-z ]{1,25}\]/g);
    if (brackets) add('high', 'placeholder', `Unfilled placeholder: ${[...new Set(brackets)].slice(0, 3).join(', ')}`, 'Replace it with real text or a merge tag like {{first_name}}.');
    const tags = [...String(subject + ' ' + body).matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)].map((m) => m[1]);
    const unknown = [...new Set(tags.filter((t) => !KNOWN_TAGS.has(t)))];
    if (channel === 'email' && unknown.length) add('high', 'unknown_tag', `Unknown merge tag: {{${unknown[0]}}}`, 'Use {{first_name}}, {{full_name}}, {{company_name}}, {{designation}}, {{city}} or {{executive_name}}.');

    const hits = SPAM_WORDS.filter((w) => lower.includes(w));
    if (hits.length) add(hits.length > 2 ? 'high' : 'medium', 'spam_words', `Spam-trigger words: ${hits.slice(0, 5).join(', ')}`, 'Reword them; filters and readers distrust hype.');
    if ((subject.match(/!/g) || []).length > 1 || /!!|\?\?/.test(body)) add('medium', 'punctuation', 'Too many exclamation or question marks', 'Keep to one at most.');

    if (channel === 'email') {
        const subj = String(subject).trim();
        if (!subj) add('high', 'no_subject', 'The subject is empty', 'Write a short, specific subject.');
        else {
            if (subj.length > 60) add('medium', 'subject_long', `Subject is ${subj.length} characters (about 50 shows fully on phones)`, 'Shorten it.');
            const caps = subj.split(/\s+/).filter((w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
            if (caps.length) add('medium', 'subject_caps', 'Words in ALL CAPS in the subject', 'Use normal capitalisation.');
            if (!/\{\{/.test(subj) && subj.length < 12) add('low', 'subject_short', 'Very short subject', 'Add a few words of context.');
        }
        if (words > 200) add('medium', 'long', `${words} words is long for a cold email`, 'Cold emails work best under 150 words: one idea, one ask.');
        else if (words && words < 25) add('low', 'short', 'Very short body', 'Add a line on who you are and why you are writing.');
        if (links > 2) add('medium', 'links', `${links} links in one email`, 'One link at most for a first email.');
        if (!/\{\{\s*(first_name|full_name)\s*\}\}/.test(subject + ' ' + body)) add('low', 'no_personalisation', 'Not personalised', 'Start with {{first_name}}.');
        if (!/(unsubscribe|opt[- ]?out|stop|not relevant|no longer|remove you|don't want)/i.test(text)) {
            add('medium', 'no_opt_out', 'No opt-out line', 'Add a line like: "If this is not relevant, reply STOP and I will not write again."');
        }
        if (/<img/i.test(body) && words < 40) add('medium', 'image_heavy', 'Mostly images with little text', 'Filters treat image-only emails as spam.');
    } else {
        if (text.length > 1024) add('high', 'wa_long', `Body is ${text.length} characters (limit 1024)`, 'Shorten it.');
        const nums = [...String(body).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
        const distinct = [...new Set(nums)].sort((a, b) => a - b);
        if (distinct.some((n, i) => n !== i + 1)) add('high', 'wa_vars', 'Variables must be numbered {{1}}, {{2}}, {{3}} in order with no gaps', 'Renumber them.');
        if (/\b(bit\.ly|tinyurl|t\.co)\b/i.test(body)) add('medium', 'wa_short_links', 'URL shorteners are often rejected by WhatsApp', 'Use your full link.');
        if (!/(stop|opt[- ]?out|unsubscribe)/i.test(text)) add('low', 'wa_opt_out', 'No opt-out line', 'Marketing messages should say how to stop, for example: Reply STOP to opt out.');
    }

    const penalty = { high: 22, medium: 10, low: 4 };
    const score = Math.max(0, 100 - issues.reduce((s, i) => s + penalty[i.severity], 0));
    return {
        score,
        level: score >= 80 ? 'good' : score >= 55 ? 'ok' : 'risky',
        issues,
        stats: { words, links, reading_seconds: Math.round((words / 220) * 60) },
    };
}

// ── Reply triage ─────────────────────────────────────────────────────────────
// Only the new text matters: drop quoted history ("On ... wrote:", "> ...", "From: ...").
function freshText(text) {
    const lines = String(text || '').split(/\r?\n/);
    const keep = [];
    for (const line of lines) {
        if (/^\s*>/.test(line)) continue;
        if (/^\s*(on .{5,120} wrote:|from:|-{2,}\s*original message|sent from my)/i.test(line)) break;
        keep.push(line);
    }
    return keep.join(' ').replace(/\s+/g, ' ').trim().slice(0, 900);
}

const INTENTS = {
    auto_generated: { label: 'Automatic message', tone: 'gray', action: 'No action needed. This is a bounce or system message.' },
    out_of_office: { label: 'Out of office', tone: 'gray', action: 'Follow up after they are back.' },
    unsubscribe: { label: 'Wants to stop', tone: 'red', action: 'Mark as unsubscribed and do not email again.' },
    not_interested: { label: 'Not interested', tone: 'red', action: 'Reply with thanks, then mark ignored.' },
    meeting_request: { label: 'Wants a call or meeting', tone: 'green', action: 'Reply today with two time slots and convert to a lead.' },
    interested: { label: 'Interested', tone: 'green', action: 'Reply today with the details they asked for and convert to a lead.' },
    pricing_question: { label: 'Asking about price', tone: 'amber', action: 'Answer the pricing question and offer a short call.' },
    referral: { label: 'Points to someone else', tone: 'amber', action: 'Thank them and write to the person they named.' },
    question: { label: 'Has a question', tone: 'amber', action: 'Answer the question clearly and suggest a next step.' },
    other: { label: 'Needs a human read', tone: 'gray', action: 'Read it and decide.' },
};

// Our own sending mailboxes. Mail from one of these is never a prospect answering.
const ownMailboxes = () => [process.env.GODADDY_SMTP_USER, process.env.SMTP_USER, process.env.GODADDY_IMAP_USER]
    .filter(Boolean).map((a) => String(a).trim().toLowerCase());
const SYSTEM_SENDER = /^(microsoftexchange[0-9a-f]*|postmaster|mailer-daemon|noreply|no-reply|donotreply|do-not-reply|bounce|auto-?reply)[@+]/i;

function classifyReply({ subject = '', body = '', fromEmail = '' }) {
    const text = freshText(body);
    const s = `${subject} ${text}`.toLowerCase();
    const has = (re) => re.test(s);
    let intent = 'other';
    let confidence = 'low';
    const signals = [];
    const hit = (i, c, why) => { intent = i; confidence = c; signals.push(why); };

    const from = String(fromEmail || '').trim().toLowerCase();
    if (from && ownMailboxes().includes(from)) hit('auto_generated', 'high', 'sent from our own mailbox');
    else if (SYSTEM_SENDER.test(from) || has(/\b(undeliverable|delivery status|mail delivery failed|message rate limit)\b/)) hit('auto_generated', 'high', 'bounce or system sender');
    else if (has(/\b(out of (the )?office|on leave|automatic reply|auto[- ]?reply|away from (my )?desk|currently unavailable|on vacation)\b/)) hit('out_of_office', 'high', 'auto-reply wording');
    else if (has(/\b(unsubscribe|remove me|stop (sending|emailing|mailing)|do not (email|contact|send)|don'?t (email|contact|send)|opt[- ]?out|take me off)\b/) || /^\s*stop\W*$/i.test(text)) hit('unsubscribe', 'high', 'asks to stop');
    else if (has(/\b(not interested|no thanks|no thank you|not looking|no requirement|no need|not required|already (have|using|working)|not relevant|not now|we are good|don'?t need)\b/)) hit('not_interested', 'high', 'declines');
    else if (has(/\b(schedule a call|call me|give me a call|let'?s (talk|connect|catch up|discuss)|can we (meet|talk|speak|connect)|available (on|at|tomorrow|today)|set up a (call|meeting)|book a (slot|call|meeting)|demo|free (for|to) (a )?(call|chat)|meeting)\b/)) hit('meeting_request', 'high', 'asks for a call or meeting');
    else if (has(/\b(price|pricing|cost|charges?|fees?|quote|quotation|how much|rates?|commission|budget)\b/)) hit('pricing_question', 'medium', 'mentions price');
    else if (has(/\b(not the right person|wrong person|forward(ed)? (this|your)|please (contact|reach out to|write to)|you (may|can|should) (contact|reach)|my colleague|another department)\b/)) hit('referral', 'medium', 'points to someone else');
    else if (has(/\b(interested|tell me more|send (me )?(the )?(details|more|information|info|profile|proposal|brochure)|share (more|the details|your)|sounds good|looks good|please share|kindly share|more information|yes\b)/)) hit('interested', 'medium', 'shows interest');
    else if (/\?/.test(text)) hit('question', 'low', 'asks a question');

    const meta = INTENTS[intent];
    const urgency = ['meeting_request', 'interested'].includes(intent) ? 'high'
        : ['pricing_question', 'question', 'referral', 'not_interested'].includes(intent) ? 'normal' : 'low';
    return { intent, label: meta.label, tone: meta.tone, confidence, urgency, suggested_action: meta.action, signals };
}

// ── Schedule planner ─────────────────────────────────────────────────────────
// Business days in India. Fixed-date national holidays only; festivals move every year.
const FIXED_HOLIDAYS = new Set(['01-26', '05-01', '08-15', '10-02', '12-25']);
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Calendar dates are handled as plain YYYY-MM-DD strings (no time zone maths needed).
const addDays = (ymd, n) => {
    const d = new Date(`${ymd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
const dayOfWeek = (ymd) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const isHoliday = (ymd) => FIXED_HOLIDAYS.has(ymd.slice(5));

const EMAIL_SLOTS = { 1: '11:00', 2: '10:15', 3: '10:15', 4: '10:30', 5: '10:30' }; // IST; Tue-Thu are the best days
const WA_SLOTS = { 1: '11:15', 2: '11:00', 3: '11:00', 4: '17:30', 5: '11:00', 6: '11:00' };

// IST is UTC+05:30 all year (no daylight saving).
function istToUtcIso(ymd, hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const ms = Date.parse(`${ymd}T00:00:00Z`) + ((h * 60 + m) - 330) * 60000;
    return new Date(ms).toISOString();
}

// `total` recipients, first allowed date (YYYY-MM-DD, IST), channel and optional daily cap.
// `warmth` is how many messages this sender sent in the last two weeks (drives the ramp-up).
function planSchedule({ channel = 'email', total, startDate, dailyCap, warmth = 0, credits = null, nowMs = Date.now() }) {
    total = Math.max(0, parseInt(total, 10) || 0);
    const warnings = [];
    const isEmail = channel === 'email';
    const hardMax = isEmail ? 500 : 1000;
    const capIn = parseInt(dailyCap, 10);
    const cap = capIn > 0 ? Math.min(hardMax, Math.max(10, capIn)) : null;

    // Ramp: a new or quiet mailbox must build reputation. WhatsApp starts lower on a new number tier.
    const start = isEmail ? (warmth >= 200 ? 150 : warmth >= 50 ? 80 : 40) : (warmth >= 200 ? 250 : 100);
    const ramp = isEmail ? [start, start * 1.5, start * 2, start * 3, start * 4] : [start, start * 1.5, start * 2, start * 3];
    const ceiling = cap || (isEmail ? 300 : 500);

    if (isEmail && warmth < 50) warnings.push('This mailbox has sent little recently, so the plan starts small (40 a day) and grows. Sending a big list on day one risks the spam folder.');
    if (!isEmail && credits != null && credits < total) warnings.push(`Only ${credits} WhatsApp credits are left for ${total} messages. Top up on vaartabot.com/billing before the later batches.`);
    if (total === 0) return { batches: [], summary: { total: 0, days: 0 }, warnings: ['Nobody is eligible in this selection.'], follow_ups: [] };

    let date = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null;
    if (!date) date = new Date(nowMs + 330 * 60000).toISOString().slice(0, 10);
    const slots = isEmail ? EMAIL_SLOTS : WA_SLOTS;
    const okDay = (d) => { const w = dayOfWeek(d); return slots[w] && !isHoliday(d); };
    // The first batch must still be in the future (with a little margin) when the plan is applied.
    const tooSoon = (d) => Date.parse(istToUtcIso(d, slots[dayOfWeek(d)])) < nowMs + 15 * 60000;
    while (!okDay(date) || tooSoon(date)) date = addDays(date, 1);

    const batches = [];
    let remaining = total;
    let day = 0;
    while (remaining > 0 && batches.length < 30) {
        const size = Math.min(remaining, Math.min(ceiling, Math.round(ramp[Math.min(day, ramp.length - 1)])));
        const w = dayOfWeek(date);
        batches.push({
            n: batches.length + 1,
            date,
            weekday: WEEKDAY[w],
            time_ist: slots[w],
            scheduled_at: istToUtcIso(date, slots[w]),
            size,
            reason: w >= 2 && w <= 4 && isEmail ? 'Tuesday to Thursday mornings get the best open rates' : isEmail ? 'Quieter day, so the send goes out mid-morning' : 'Business hours, when people check WhatsApp',
        });
        remaining -= size;
        day += 1;
        date = addDays(date, 1);
        while (!okDay(date)) date = addDays(date, 1);
    }
    if (remaining > 0) warnings.push(`${remaining} contacts do not fit in 30 sending days at this pace. Raise the daily cap or split the list.`);
    let cum = 0;
    for (const b of batches) { cum += b.size; b.cumulative = cum; }

    const follow_ups = isEmail
        ? [{ after_days: 3, note: 'First nudge to everyone who has not replied, in a new thread with a fresh angle.' },
           { after_days: 7, note: 'Second nudge, shorter, with a clear yes/no question.' },
           { after_days: 14, note: 'Break-up email: say you will stop writing unless they want more.' }]
        : [{ after_days: 4, note: 'One WhatsApp follow-up only. More than one per contact risks reports and a lower quality rating.' }];
    return {
        batches,
        summary: { total, days: batches.length, first: batches[0]?.date, last: batches[batches.length - 1]?.date, channel },
        warnings,
        follow_ups,
    };
}

module.exports = {
    firstEmail, analyseEmail, normalisePhone, analyseDesignation, guessIndustry,
    buildFacts, contactScore, SEGMENTS, segmentTest, summariseSegments, listHealth,
    checkCopy, freshText, classifyReply, INTENTS, planSchedule, istToUtcIso, SENIORITY_LABEL, SENIORITY_RANK,
};

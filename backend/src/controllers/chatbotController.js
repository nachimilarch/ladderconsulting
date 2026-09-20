const db = require('../config/db');
const { streamChatCompletion, chatCompletion } = require('../services/localLlmService');
const { SCHEMAS, IMPLEMENTATIONS } = require('../services/chatbotTools');
const { hasActiveAiSubscription } = require('../utils/aiSubscription');
const jobController = require('../controllers/jobController');
const { updateCandidateProfileFields } = require('../utils/candidateProfile');
const { applyToJob } = require('../utils/candidateApplications');

const MAX_TOOL_ITERATIONS = 4;

// Kept compact on purpose: this model runs on CPU (every prompt token costs
// latency) and small models follow short, imperative rules far more reliably.
const STYLE = `Style: warm, upbeat and natural, like a helpful colleague. Short replies (a few sentences). Use their first name occasionally, not every message. Ask ONE question at a time. Say what you did and what happens next. Plain everyday words. At most one emoji. You are an AI, so say so if asked. If something fails, explain kindly and ask for what's missing.`;

const buildSystemPrompt = (persona, { firstName, companyName, extra }) => {
    if (persona === 'company') {
        return `You are LadderStep's friendly AI hiring assistant, chatting with ${firstName || 'a hiring manager'}${companyName ? ` from ${companyName}` : ''}.
RULES:
1. To create a job post, CALL propose_job_post. To improve or edit one, CALL get_job_details, then CALL propose_job_update with the complete new title and description. Never write the job out as chat text, and never claim it was posted or changed: the user confirms a preview first.
2. Do the task, don't narrate or ask permission to look something up.
3. Use only details the user gave. Never invent salary, experience or openings; leave them out.
4. Money is in full rupees: "15-25 LPA" means salary_min 1500000 and salary_max 2500000.
5. For "who fits this job?", CALL find_matching_candidates. If they have several jobs and didn't say which, ask which. The app shows the results.
${extra || ''}
${STYLE}`.trim();
    }
    return `You are LadderStep's friendly AI career assistant, chatting with ${firstName || 'a candidate'}.
RULES:
1. To change anything on their profile, CALL propose_profile_update with the new values. Never write the new values out as chat text, and never claim it was saved: the user confirms a preview first.
2. Their current profile is below, so never ask them to paste it. To polish or improve something, write the better version yourself and CALL the tool straight away. Don't narrate or ask permission.
3. To apply for a job, first find it with find_matching_jobs, then CALL propose_apply_to_job.
4. Use only details the user gave. Never invent values.
5. Money is in full rupees: "18 LPA" means 1800000.
6. For "what jobs suit me?", CALL find_matching_jobs. The app shows the results.
${extra || ''}
${STYLE}`.trim();
};

// Small models sometimes *act out* a tool call: they write the values as chat text
// and even print the tool's name instead of calling it. Detect that so we can retry.
const looksLikeFakeToolCall = (text, persona) => {
    if (!text) return false;
    if (/\b(propose_[a-z_]+|get_job_details|find_matching_(jobs|candidates)|propos(e|al|ed))\b/i.test(text)) return true;
    return persona === 'candidate'
        ? /^\s*(headline|summary)\s*:/im.test(text)
        : /^\s*(title|description)\s*:/im.test(text);
};

// "Find candidates for my job" / "improve my job description": never ask a person
// for a job ID. One job -> just do it; several -> offer their job titles as choices.
const FIND_CANDIDATES = /\b(find|show|get|who|match|matching|suggest|recommend|rank|search)\b[^.?!]*\b(candidates?|people|profiles?|applicants?|talent)\b|\bwho (fits|matches|would fit|is right)\b/i;
const IMPROVE_JOB = /\b(improve|polish|rewrite|re-?write|sharpen|refine|enhance|update|edit|fix)\b[^.?!]*\b(job|description|jd|posting|post)\b/i;

const draftJobImprovement = async (job) => {
    const facts = JSON.stringify({
        title: job.title, description: job.description, requirements: job.requirements || null,
        location: job.location || null, job_type: job.job_type, work_mode: job.work_mode,
    });
    const reply = await chatCompletion({
        json: true,
        messages: [
            { role: 'system', content: `You improve job postings. Use ONLY the facts in this posting: ${facts}\nDo not add facts: no benefits, tools, salary, team size, perks or requirements that are not already there. Improve clarity, structure and tone only. Reply with ONLY a JSON object: {"description": "...", "requirements": "..."} (use an empty string for requirements if the posting has none).` },
            { role: 'user', content: 'Improve this job posting.' },
        ],
    });
    let parsed;
    try { parsed = JSON.parse((reply.content || '').replace(/^```(?:json)?|```$/gim, '').trim()); } catch { return null; }
    const description = typeof parsed?.description === 'string' ? parsed.description.trim().slice(0, 4000) : '';
    const requirements = typeof parsed?.requirements === 'string' ? parsed.requirements.trim().slice(0, 3000) : '';
    if (!description || description === String(job.description || '').trim()) return null;
    return { description, ...(job.requirements && requirements ? { requirements } : {}) };
};

// "Polish my profile" is the flagship request and a 7B model too often answers it
// with prose instead of a tool call. For clear rewrite requests we skip the
// tool-calling gamble: ask for JSON (reliable), then create the draft ourselves.
const isQuestion = /^\s*(what|which|how|why|should|is|are|do|does|could you tell|can you tell)\b/i;
const PROFILE_REWRITE = /\b(polish|improve|refine|rewrite|re-?write|enhance|revamp|sharpen|update|fix|redo|tweak|rework|write|spruce|touch up)\b[^.?!]*\b(profile|headline|summary|bio|about me)\b/i;
const wantsProfileRewrite = (text) => !isQuestion.test(text) && PROFILE_REWRITE.test(text);

const draftProfileRewrite = async (userId, userText) => {
    // Only touch what they asked about ("rewrite my summary" leaves the headline alone).
    const asksHeadline = /\b(headline|title|tagline)\b/i.test(userText);
    const asksSummary = /\b(summary|bio|about me)\b/i.test(userText);
    const wantHeadline = asksHeadline || !asksSummary;
    const wantSummary = asksSummary || !asksHeadline;

    const { profile, skills } = await IMPLEMENTATIONS.get_profile_summary({ user: { id: userId } });
    if (!profile) return null;
    const facts = JSON.stringify({
        headline: profile.headline || null, summary: profile.summary || null,
        years_of_experience: profile.total_experience ?? null, location: profile.current_location || null,
        skills: (skills || []).slice(0, 25),
    });
    const reply = await chatCompletion({
        json: true,
        messages: [
            { role: 'system', content: `You rewrite career profiles. Use ONLY the facts in this profile: ${facts}\nDo not add or change any fact: no new employers, degrees, tools, achievements or years of experience, and never inflate numbers. Improve the wording only: a specific, professional headline (max 100 characters) and a summary of 2-4 sentences in first person. If a field is empty, write it from the skills and experience given. Reply with ONLY a JSON object: {"headline": "...", "summary": "..."}` },
            { role: 'user', content: userText },
        ],
    });
    let parsed;
    try { parsed = JSON.parse((reply.content || '').replace(/^```(?:json)?|```$/gim, '').trim()); } catch { return null; }
    const norm = (v) => (typeof v === 'string' ? v.trim() : '');
    let headline = wantHeadline ? norm(parsed?.headline).slice(0, 160) : '';
    let summary = wantSummary ? norm(parsed?.summary).slice(0, 900) : '';
    if (headline === norm(profile.headline)) headline = ''; // no-op changes aren't worth a card
    if (summary === norm(profile.summary)) summary = '';
    if (!headline && !summary) return null;
    return { ...(headline ? { headline } : {}), ...(summary ? { summary } : {}) };
};

// After a draft is created, the user gets a natural lead-in before the preview
// card instead of a bare card. Deterministic (no extra model pass = no extra
// 30s of CPU), varied by draft id so it doesn't read as a script.
const PROPOSAL_ACTION_TYPE = {
    propose_job_post: 'create_job',
    propose_job_update: 'update_job',
    propose_profile_update: 'update_profile',
    propose_apply_to_job: 'apply_to_job',
};
const PROPOSAL_INTRO = {
    propose_job_post: [
        "I've drafted that job post for you. Have a read below and confirm when it looks right, or tell me what to tweak.",
        "Here's a first draft of the job post. Take a look, and I can adjust anything before you confirm.",
    ],
    propose_job_update: [
        "Here are the changes I'd make to that job. Take a look and confirm if you're happy with them.",
        "I've lined up those edits. Have a look below and confirm when they look right.",
    ],
    propose_profile_update: [
        "Here's what I'd change on your profile. Have a look, and confirm if you like it, or tell me what to adjust.",
        "I've put together a polished version for you. Take a look below and confirm when it feels right.",
    ],
    propose_apply_to_job: [
        "Ready to apply! Check the details below and confirm, and I'll send it in.",
        "This one looks like a good fit. Have a look below, and confirm if you'd like me to apply.",
    ],
};
const pickIntro = (toolName, id) => {
    const options = PROPOSAL_INTRO[toolName] || PROPOSAL_INTRO.propose_profile_update;
    return options[Number(id) % options.length];
};

// What the assistant says once the user confirms or cancels a draft. Saved to the
// conversation too, so the model's own history knows the outcome (otherwise it
// would still think the draft is pending).
const CONFIRMED_REPLY = {
    update_profile: "All saved! Your profile is updated. Want me to look for jobs that match it now?",
    apply_to_job: "Your application is on its way. Good luck! I can keep an eye out for other roles that suit you if you like.",
    create_job: "Your job post is live! Want me to check which candidates fit it best?",
    update_job: "Done, the job is updated. Want me to check which candidates fit it best?",
};
const PAYMENT_REPLY = "Almost there! Finish the payment and your job post goes live.";
const DISCARDED_REPLY = "No problem, nothing was changed. Tell me what you'd like different and I'll take another pass.";

const rememberReply = (conversationId, text) =>
    db.query(`INSERT INTO chatbot_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)`, [conversationId, text])
        .catch(e => console.error('[chatbot.rememberReply]', e.message));

const FALLBACK_REPLY = "Sorry, I got a bit tangled up there. Could you say that another way?";
const UNAVAILABLE_REPLY = "Sorry, I'm having trouble thinking right now. Give me a moment and try again.";

// Facts the model would otherwise have to fetch with a tool (each tool round-trip
// costs a full model pass, ~30s on our CPU box). Stripped of odd characters
// since it goes into a prompt.
const clean = (v, n = 40) => String(v ?? '').replace(/[^\p{L}\p{N} .,'&()/+#-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

const getPromptContext = async (userId, persona) => {
    const [[row]] = await db.query(
        `SELECT u.name, co.id AS company_id, co.company_name
         FROM users u LEFT JOIN companies co ON co.user_id = u.id AND co.deleted_at IS NULL
         WHERE u.id = ?`,
        [userId]
    );
    const ctx = { firstName: clean(row?.name).split(' ')[0] || '', companyName: clean(row?.company_name), extra: '' };

    if (persona === 'candidate') {
        const { profile, skills } = await IMPLEMENTATIONS.get_profile_summary({ user: { id: userId } });
        if (profile) {
            const bits = [
                ['headline', clean(profile.headline, 160)], ['summary', clean(profile.summary, 500)],
                ['experience', profile.total_experience != null ? `${profile.total_experience} years` : ''],
                ['location', clean(profile.current_location)], ['expected salary (rupees)', profile.expected_salary || ''],
                ['notice period (days)', profile.notice_period_days ?? ''],
                ['skills', (skills || []).slice(0, 25).map((x) => clean(x)).join(', ')],
            ].filter(([, v]) => v !== '' && v !== null && v !== undefined);
            ctx.extra = `Their current profile: ${bits.length ? bits.map(([k, v]) => `${k}: ${v}`).join('; ') : 'still empty. Offer to build it together, starting with a headline.'}.`;
        }
    } else if (row?.company_id) {
        const [jobs] = await db.query(
            `SELECT id, title FROM job_postings WHERE company_id = ? AND deleted_at IS NULL
             AND status IN ('active','draft','paused') ORDER BY id DESC LIMIT 15`,
            [row.company_id]
        );
        ctx.jobs = jobs.map((j) => ({ id: j.id, title: j.title }));
        ctx.extra = jobs.length
            ? `Their jobs (id: title): ${jobs.map((j) => `${j.id}: ${clean(j.title, 80)}`).join('; ')}.`
            : 'They have no job postings yet.';
    }
    return ctx;
};

// The words that go with match cards. Built from the data, not by the model:
// a 7B model called a 43% match "strong" and skipped the real best fit, and a
// second model pass costs ~30s. Still varies its phrasing so it isn't a script.
const listOf = (arr) => (arr.length > 1 ? `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}` : arr[0] || '');

const summarizeJobMatches = (jobs) => {
    const open = jobs.filter((j) => !j.already_applied);
    if (!open.length) return "You've already applied to all of these, nice work! I'll keep an eye out for new roles. Anything else I can help with?";
    const scored = open.filter((j) => j.match_score !== null);
    if (!scored.length) {
        return `I found ${jobs.length} open role${jobs.length === 1 ? '' : 's'}, but I can't score them against your profile yet. That usually means it's missing skills. Want me to help you add some?`;
    }
    const top = scored[0]; // already ranked best-first
    const why = top.matched_skills?.length ? `, thanks to your ${listOf(top.matched_skills)}` : '';
    const fit = top.match_score >= 70 ? 'looks like a great fit' : top.match_score >= 40 ? 'is your best match so far' : 'is the closest I found';
    const ask = top.job_id % 2 ? 'Want me to apply for you? Or tap Apply on any of the others.' : 'Shall I apply for you? You can also tap Apply on any of the others.';
    return `I found ${jobs.length} role${jobs.length === 1 ? '' : 's'} for you. **${top.title}** at ${top.company} ${fit} (${top.match_score}% match${why}). ${ask}`;
};

const summarizeCandidateMatches = (jobTitle, matches) => {
    const top = matches[0];
    const why = top.matched_skills?.length ? `, with ${listOf(top.matched_skills)}` : '';
    const premium = matches.some((m) => m.is_premium) ? ' Premium ⭐ candidates are listed first, then by skill match.' : '';
    return `Here are the best fits for **${jobTitle}**.${premium} ${top.name} is at the top with a ${top.match_score}% match${why}. You can open them in Talent Pool, or ask me to sharpen the job description to attract even more.`;
};

const resolvePersona = (role) => (role === 'company' ? 'company' : role === 'candidate' ? 'candidate' : null);

const getPayer = async (user, persona) => {
    if (persona === 'company') {
        const [[row]] = await db.query('SELECT id FROM companies WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
        return { payerType: 'company', payerId: row?.id || null };
    }
    const [[row]] = await db.query('SELECT id FROM candidates WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
    return { payerType: 'candidate', payerId: row?.id || null };
};

// ── GET /api/chatbot/conversations ────────────────────────────────────────────
exports.listConversations = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, title, created_at, updated_at FROM chatbot_conversations
             WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 50`,
            [req.user.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[chatbot.listConversations]', err.message);
        res.status(500).json({ message: 'Failed to load conversations.' });
    }
};

// ── POST /api/chatbot/conversations ───────────────────────────────────────────
exports.createConversation = async (req, res) => {
    try {
        const persona = resolvePersona(req.user.role);
        if (!persona) return res.status(403).json({ message: 'Chatbot is available to companies and candidates only.' });

        const [result] = await db.query(
            `INSERT INTO chatbot_conversations (user_id, persona, title) VALUES (?, ?, ?)`,
            [req.user.id, persona, req.body?.title || null]
        );
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        console.error('[chatbot.createConversation]', err.message);
        res.status(500).json({ message: 'Failed to start conversation.' });
    }
};

// ── GET /api/chatbot/conversations/:id ────────────────────────────────────────
exports.getConversation = async (req, res) => {
    try {
        const [[conv]] = await db.query(
            `SELECT id, persona, title FROM chatbot_conversations WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
            [req.params.id, req.user.id]
        );
        if (!conv) return res.status(404).json({ message: 'Conversation not found.' });

        const [messages] = await db.query(
            `SELECT id, role, content, tool_calls, created_at FROM chatbot_messages
             WHERE conversation_id = ? ORDER BY id ASC`,
            [conv.id]
        );
        const [pendingActions] = await db.query(
            `SELECT id, action_type, payload, preview_text, status, result_ref_id, created_at FROM chatbot_pending_actions
             WHERE conversation_id = ? ORDER BY id ASC`,
            [conv.id]
        );

        res.json({ success: true, data: { ...conv, messages, pending_actions: pendingActions } });
    } catch (err) {
        console.error('[chatbot.getConversation]', err.message);
        res.status(500).json({ message: 'Failed to load conversation.' });
    }
};

// ── POST /api/chatbot/conversations/:id/messages ──────────────────────────────
// Streams the assistant's reply over SSE. Wire protocol (our own, not
// OpenAI's — the frontend reads this via a raw fetch + ReadableStream, see
// api/chatbot.js): each line is `data: {"type": "...", ...}\n\n`.
//   token          { type:'token', text }               — a content fragment
//   pending_action { type:'pending_action', id, preview } — a write tool fired
//   done           { type:'done' }
//   error          { type:'error', message }
exports.sendMessage = async (req, res) => {
    const persona = resolvePersona(req.user.role);
    if (!persona) return res.status(403).json({ message: 'Chatbot is available to companies and candidates only.' });

    const { payerType, payerId } = await getPayer(req.user, persona);
    if (!(await hasActiveAiSubscription(payerType, payerId))) {
        return res.status(402).json({ message: 'An active AI Assistant subscription (₹299/mo) is required to use the chatbot.', code: 'SUBSCRIPTION_REQUIRED' });
    }

    const conversationId = parseInt(req.params.id);
    const [[conv]] = await db.query(
        `SELECT id FROM chatbot_conversations WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [conversationId, req.user.id]
    );
    if (!conv) return res.status(404).json({ message: 'Conversation not found.' });

    const userText = req.body?.message;
    if (!userText || typeof userText !== 'string') {
        return res.status(400).json({ message: 'message is required.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    // no-transform stops the compression() middleware from buffering the stream
    // (browsers send Accept-Encoding: gzip); X-Accel-Buffering does the same for nginx.
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    // CPU inference can be silent for 30–90s (cold model load), longer than nginx's
    // 60s read timeout. A comment line keeps the connection alive; the client only
    // parses `data:` lines so it ignores these.
    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 10000);
    res.on('close', () => clearInterval(heartbeat));

    try {
        await db.query(
            `INSERT INTO chatbot_messages (conversation_id, role, content) VALUES (?, 'user', ?)`,
            [conversationId, userText]
        );

        const [history] = await db.query(
            `SELECT role, content, tool_calls FROM chatbot_messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 40`,
            [conversationId]
        );
        const promptContext = await getPromptContext(req.user.id, persona);
        const messages = [
            { role: 'system', content: buildSystemPrompt(persona, promptContext) },
            ...history.map(h => {
                const toolCalls = h.tool_calls ? (typeof h.tool_calls === 'string' ? JSON.parse(h.tool_calls) : h.tool_calls) : null;
                if (h.role === 'tool') {
                    // Stored as [{id, name}] (see the tool-execution loop below) —
                    // a tool-response message needs the singular tool_call_id it's
                    // replying to, not the plural tool_calls array shape assistant
                    // turns use.
                    return { role: 'tool', tool_call_id: toolCalls?.[0]?.id, content: h.content || '' };
                }
                return {
                    role: h.role,
                    content: h.content || '',
                    ...(toolCalls ? { tool_calls: toolCalls } : {}),
                };
            }),
        ];

        const tools = SCHEMAS[persona];
        let replied = false; // did the user get any words this turn?
        let nudged = false;  // retried once after a fake tool call?

        const saySomething = async (text) => {
            send({ type: 'token', text });
            await db.query(
                `INSERT INTO chatbot_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)`,
                [conversationId, text]
            );
            replied = true;
        };

        // A draft is ready: say so like a person would, then show the card.
        const presentProposals = async (proposals) => {
            await saySomething(pickIntro(proposals[0].toolName, proposals[0].id));
            for (const pr of proposals) {
                const [[row]] = await db.query('SELECT payload FROM chatbot_pending_actions WHERE id = ?', [pr.id]);
                const payload = typeof row?.payload === 'string' ? JSON.parse(row.payload) : row?.payload;
                send({ type: 'pending_action', id: pr.id, preview: pr.preview, action_type: PROPOSAL_ACTION_TYPE[pr.toolName], payload });
            }
        };

        // Clear "polish my profile" requests: draft via JSON mode instead of hoping the
        // model chooses to call a tool. Any failure falls through to the normal loop.
        if (persona === 'candidate' && wantsProfileRewrite(userText)) {
            try {
                const fields = await draftProfileRewrite(req.user.id, userText);
                if (fields) {
                    const made = await IMPLEMENTATIONS.propose_profile_update({ user: req.user, conversationId }, fields);
                    if (made?.pending_action_id) {
                        await presentProposals([{ id: made.pending_action_id, preview: made.preview, toolName: 'propose_profile_update' }]);
                        send({ type: 'done' });
                        res.end();
                        return;
                    }
                }
            } catch (e) {
                console.error('[chatbot.profileRewrite]', e.message);
            }
        }

        if (persona === 'company' && !isQuestion.test(userText)) {
            const intent = FIND_CANDIDATES.test(userText) ? 'find' : IMPROVE_JOB.test(userText) ? 'improve' : null;
            if (intent) {
                try {
                    const jobs = promptContext.jobs || [];
                    const lower = userText.toLowerCase();
                    const named = jobs.filter((j) => j.title && lower.includes(j.title.toLowerCase()));
                    const job = named.length === 1 ? named[0] : (jobs.length === 1 ? jobs[0] : null);
                    const verb = intent === 'find' ? 'Find candidates for' : 'Improve the description of';

                    if (!jobs.length) {
                        await saySomething("You don't have any job postings yet. Want me to draft one, so we can start finding people?");
                        send({ type: 'choices', options: [{ label: 'Draft a job post', text: 'Draft a job post' }] });
                    } else if (!job) {
                        await saySomething(`Which job should I ${intent === 'find' ? 'look for candidates for' : 'improve'}?`);
                        send({ type: 'choices', options: jobs.slice(0, 6).map((j) => ({ label: j.title, text: `${verb} ${j.title}` })) });
                    } else if (intent === 'find') {
                        const result = await IMPLEMENTATIONS.find_matching_candidates({ user: req.user, conversationId }, { job_id: job.id });
                        if (result?.matches?.length) {
                            send({ type: 'candidate_matches', job_id: job.id, job_title: result.job_title, matches: result.matches });
                            await saySomething(summarizeCandidateMatches(result.job_title, result.matches));
                        } else {
                            await saySomething(`I couldn't find any scored candidates for **${job.title}** yet. That usually means the posting needs a fuller description so I can match on skills. Want me to sharpen it?`);
                            send({ type: 'choices', options: [{ label: 'Yes, improve it', text: `Improve the description of ${job.title}` }] });
                        }
                    } else {
                        const { job: current } = await IMPLEMENTATIONS.get_job_details({ user: req.user }, { job_id: job.id });
                        const fields = current && await draftJobImprovement(current);
                        const made = fields && await IMPLEMENTATIONS.propose_job_update(
                            { user: req.user, conversationId }, { job_id: job.id, title: current.title, ...fields }
                        );
                        if (made?.pending_action_id) {
                            await presentProposals([{ id: made.pending_action_id, preview: made.preview, toolName: 'propose_job_update' }]);
                        } else {
                            await saySomething(`I had another look at **${job.title}** and it already reads well, so I'd leave it as it is. Want me to find candidates for it instead?`);
                            send({ type: 'choices', options: [{ label: 'Find candidates', text: `Find candidates for ${job.title}` }] });
                        }
                    }
                    send({ type: 'done' });
                    res.end();
                    return;
                } catch (e) {
                    console.error('[chatbot.companyIntent]', e.message);
                }
            }
        }

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
            const reply = await streamChatCompletion({
                messages,
                tools,
                onToken: (text) => send({ type: 'token', text }),
            });

            if (!reply.tool_calls?.length) {
                const text = (reply.content || '').trim();
                if (!nudged && !isQuestion.test(userText) && looksLikeFakeToolCall(text, persona)) {
                    nudged = true;
                    send({ type: 'reset' }); // the client drops what it already streamed
                    messages.push({ role: 'assistant', content: text });
                    messages.push({ role: 'user', content: 'That was only written as text, so nothing was drafted. Make the tool call now with those values.' });
                    continue;
                }
                if (text) {
                    await db.query(
                        `INSERT INTO chatbot_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)`,
                        [conversationId, text]
                    );
                    replied = true;
                }
                break;
            }

            // Persist the assistant's tool-call turn, then execute each call.
            await db.query(
                `INSERT INTO chatbot_messages (conversation_id, role, content, tool_calls) VALUES (?, 'assistant', ?, ?)`,
                [conversationId, reply.content || '', JSON.stringify(reply.tool_calls)]
            );
            messages.push({ role: 'assistant', content: reply.content || '', tool_calls: reply.tool_calls });

            const proposals = []; // drafts created this turn, shown after a lead-in
            let matchSummary = null; // words for match cards, built from the data
            for (const call of reply.tool_calls) {
                const name = call.function.name;
                const impl = IMPLEMENTATIONS[name];
                let args = {};
                try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* leave {} */ }

                let result;
                if (!impl) {
                    result = { error: `Unknown tool: ${name}` };
                } else {
                    try {
                        result = await impl({ user: req.user, conversationId }, args);
                    } catch (e) {
                        console.error(`[chatbot.tool.${name}]`, e.message);
                        result = { error: 'Tool call failed.' };
                    }
                }

                if (result?.pending_action_id) {
                    proposals.push({ id: result.pending_action_id, preview: result.preview, toolName: name });
                } else if (name === 'find_matching_jobs' && result?.jobs?.length) {
                    send({ type: 'job_matches', jobs: result.jobs });
                    matchSummary = matchSummary || summarizeJobMatches(result.jobs);
                } else if (name === 'find_matching_candidates' && result?.matches?.length) {
                    send({ type: 'candidate_matches', job_id: args.job_id, job_title: result.job_title, matches: result.matches });
                    matchSummary = matchSummary || summarizeCandidateMatches(result.job_title, result.matches);
                }

                await db.query(
                    `INSERT INTO chatbot_messages (conversation_id, role, content, tool_calls) VALUES (?, 'tool', ?, ?)`,
                    [conversationId, JSON.stringify(result), JSON.stringify([{ id: call.id, name }])]
                );
                messages.push({ role: 'tool', tool_call_id: call.id, name, content: JSON.stringify(result) });
            }

            // A draft is ready: say so like a person would, then show the card, and stop
            // (another model pass would just cost ~30s to repeat what the card shows).
            // If a draft attempt FAILED (missing field, already applied...) there are no
            // proposals, so we loop back and let the model explain it in plain words.
            if (proposals.length) {
                await presentProposals(proposals);
                break;
            }

            if (matchSummary) {
                await saySomething(matchSummary);
                break;
            }
        }

        // Never leave the user staring at silence (e.g. the model kept calling tools).
        if (!replied) await saySomething(FALLBACK_REPLY);

        send({ type: 'done' });
        res.end();
    } catch (err) {
        console.error('[chatbot.sendMessage]', err.message);
        send({ type: 'error', message: UNAVAILABLE_REPLY });
        res.end();
    } finally {
        clearInterval(heartbeat);
    }
};

// ── POST /api/chatbot/actions/:id/confirm ─────────────────────────────────────
exports.confirmAction = async (req, res) => {
    try {
        const [[action]] = await db.query(
            `SELECT id, conversation_id, action_type, payload, status FROM chatbot_pending_actions WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );
        if (!action) return res.status(404).json({ message: 'Action not found.' });
        if (action.status !== 'pending_confirmation') {
            return res.status(409).json({ message: `This action is already ${action.status}.` });
        }

        const payload = typeof action.payload === 'string' ? JSON.parse(action.payload) : action.payload;
        let resultRefId = null;
        let payment = null;

        if (action.action_type === 'create_job') {
            const [[company]] = await db.query('SELECT id, company_tier FROM companies WHERE user_id = ? AND deleted_at IS NULL', [req.user.id]);
            if (company.company_tier === 'premium') {
                resultRefId = await jobController.createJobRecord(company.id, req.user.id, payload);
            } else {
                // Standard tier: ₹3,999 per job — creates the job as
                // 'pending_payment' and a Cashfree order; the frontend
                // (ChatbotActionCard) redirects to checkout using `payment`.
                payment = await jobController.initiateJobPostingPayment(company.id, req.user.id, payload);
                resultRefId = payment.job_id;
            }
        } else if (action.action_type === 'update_job') {
            const { job_id, ...fields } = payload;
            const [[company]] = await db.query('SELECT id FROM companies WHERE user_id = ? AND deleted_at IS NULL', [req.user.id]);
            // updateJobRecord REPLACES every column, so a draft that only carries the
            // fields being changed would reset the rest (status -> 'draft', salary,
            // location...). Overlay the changes onto the job's current values first.
            const [[current]] = await db.query(
                `SELECT title, description, requirements, location, job_type, work_mode, salary_min, salary_max,
                        experience_min, experience_max, openings, status
                 FROM job_postings WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
                [job_id, company.id]
            );
            if (!current) return res.status(404).json({ message: 'That job no longer exists.' });
            const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== ''));
            await jobController.updateJobRecord(company.id, job_id, { ...current, ...changes });
            resultRefId = job_id;
        } else if (action.action_type === 'update_profile') {
            await updateCandidateProfileFields(req.user.id, payload);
        } else if (action.action_type === 'apply_to_job') {
            resultRefId = await applyToJob(req.user.id, payload.job_id, payload.cover_letter);
        }

        await db.query(
            `UPDATE chatbot_pending_actions SET status = 'confirmed', resolved_at = NOW(), result_ref_id = ? WHERE id = ?`,
            [resultRefId, action.id]
        );

        const followup = payment ? PAYMENT_REPLY : (CONFIRMED_REPLY[action.action_type] || 'Done!');
        await rememberReply(action.conversation_id, followup);

        res.json({
            success: true,
            message: payment ? 'Complete payment to publish this job.' : 'Done.',
            followup,
            result_ref_id: resultRefId,
            ...(payment ? { payment_session_id: payment.payment_session_id, cashfree_env: payment.cashfree_env } : {}),
        });
    } catch (err) {
        if (err.gatewayError) return res.status(502).json({ message: err.message });
        if (err.status) return res.status(err.status).json({ message: err.message, code: err.code });
        console.error('[chatbot.confirmAction]', err.message);
        res.status(500).json({ message: 'Failed to apply the action.' });
    }
};

// ── POST /api/chatbot/actions/:id/discard ─────────────────────────────────────
exports.discardAction = async (req, res) => {
    try {
        const [[action]] = await db.query(
            `SELECT id, conversation_id FROM chatbot_pending_actions
             WHERE id = ? AND user_id = ? AND status = 'pending_confirmation'`,
            [req.params.id, req.user.id]
        );
        if (!action) return res.status(404).json({ message: 'Action not found or already resolved.' });

        await db.query(
            `UPDATE chatbot_pending_actions SET status = 'discarded', resolved_at = NOW() WHERE id = ?`,
            [action.id]
        );
        await rememberReply(action.conversation_id, DISCARDED_REPLY);
        res.json({ success: true, message: 'Discarded.', followup: DISCARDED_REPLY });
    } catch (err) {
        console.error('[chatbot.discardAction]', err.message);
        res.status(500).json({ message: 'Failed to discard.' });
    }
};

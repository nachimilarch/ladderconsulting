const db = require('../config/db');
const { streamChatCompletion } = require('../services/localLlmService');
const { SCHEMAS, IMPLEMENTATIONS, isWriteTool } = require('../services/chatbotTools');
const { hasActiveAiSubscription } = require('../utils/aiSubscription');
const jobController = require('../controllers/jobController');
const { saveCandidateProfile } = require('../utils/candidateProfile');
const { applyToJob } = require('../utils/candidateApplications');

const MAX_TOOL_ITERATIONS = 4;

const SYSTEM_PROMPTS = {
    company: `You are the AI hiring assistant on LadderStep, a recruitment platform. You help this company draft and publish job postings, and find AI-matched candidates for their roles.
Rules:
- To create or edit a job posting, you MUST call propose_job_post / propose_job_update. Never claim you've posted or changed a job without calling the tool — those tools only draft a preview, they don't publish anything themselves. After calling one, tell the user to review and confirm it.
- Only fill in tool parameters the user actually stated or clearly implied. Never invent values (experience range, openings, salary, etc.) for anything they didn't mention — leave those parameters out entirely rather than guessing.
- All money amounts are full rupee numbers, never lakhs/crore shorthand. "15-25 LPA" means salary_min=1500000, salary_max=2500000, NOT 150000/250000 — always multiply lakhs by 100000 before calling a tool.
- Use find_matching_candidates to answer "who matches this job" questions — don't guess.
- Keep replies concise and concrete.`,
    candidate: `You are the AI career assistant on LadderStep, a recruitment platform. You help this candidate fill out their profile, find matching jobs, and apply to them.
Rules:
- To change any profile field, you MUST call propose_profile_update. Never claim you've updated the profile without calling the tool — it only drafts a preview, it doesn't save anything itself. After calling it, tell the user to review and confirm.
- To apply to a job, you MUST call propose_apply_to_job. Never claim you've submitted an application without calling the tool — it only drafts a preview pending confirmation, it doesn't submit anything itself. After calling it, tell the user to review and confirm.
- Only fill in fields the user actually stated or clearly implied. Never invent values for anything they didn't mention.
- expected_salary and current_salary are full rupee numbers, never lakhs/crore shorthand. "18 LPA" means expected_salary=1800000, NOT 18 — always multiply lakhs by 100000 before calling a tool.
- Use get_profile_summary before suggesting profile edits, so your suggestions build on what's actually there.
- Use find_matching_jobs to answer "what jobs match me" questions, or before applying to a job on the candidate's behalf — don't guess job IDs.
- Keep replies concise and concrete.`,
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
        const messages = [
            { role: 'system', content: SYSTEM_PROMPTS[persona] },
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
        let finalText = '';

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
            const reply = await streamChatCompletion({
                messages,
                tools,
                onToken: (text) => send({ type: 'token', text }),
            });

            if (!reply.tool_calls?.length) {
                finalText = reply.content || '';
                await db.query(
                    `INSERT INTO chatbot_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)`,
                    [conversationId, finalText]
                );
                break;
            }

            // Persist the assistant's tool-call turn, then execute each call.
            await db.query(
                `INSERT INTO chatbot_messages (conversation_id, role, content, tool_calls) VALUES (?, 'assistant', ?, ?)`,
                [conversationId, reply.content || '', JSON.stringify(reply.tool_calls)]
            );
            messages.push({ role: 'assistant', content: reply.content || '', tool_calls: reply.tool_calls });

            let sawWriteTool = false;
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
                    send({ type: 'pending_action', id: result.pending_action_id, preview: result.preview });
                }

                await db.query(
                    `INSERT INTO chatbot_messages (conversation_id, role, content, tool_calls) VALUES (?, 'tool', ?, ?)`,
                    [conversationId, JSON.stringify(result), JSON.stringify([{ id: call.id, name }])]
                );
                messages.push({ role: 'tool', tool_call_id: call.id, name, content: JSON.stringify(result) });

                if (isWriteTool(name)) sawWriteTool = true;
            }

            // A propose_* tool already produced its own preview — no need to
            // loop back for more model text, the pending_action event is the answer.
            if (sawWriteTool) { finalText = ''; break; }
        }

        send({ type: 'done' });
        res.end();
    } catch (err) {
        console.error('[chatbot.sendMessage]', err.message);
        send({ type: 'error', message: 'The assistant is unavailable right now. Please try again.' });
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
            await jobController.updateJobRecord(company.id, job_id, fields);
            resultRefId = job_id;
        } else if (action.action_type === 'update_profile') {
            await saveCandidateProfile(req.user.id, payload);
        } else if (action.action_type === 'apply_to_job') {
            resultRefId = await applyToJob(req.user.id, payload.job_id, payload.cover_letter);
        }

        await db.query(
            `UPDATE chatbot_pending_actions SET status = 'confirmed', resolved_at = NOW(), result_ref_id = ? WHERE id = ?`,
            [resultRefId, action.id]
        );

        res.json({
            success: true,
            message: payment ? 'Complete payment to publish this job.' : 'Done.',
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
        const [result] = await db.query(
            `UPDATE chatbot_pending_actions SET status = 'discarded', resolved_at = NOW()
             WHERE id = ? AND user_id = ? AND status = 'pending_confirmation'`,
            [req.params.id, req.user.id]
        );
        if (!result.affectedRows) return res.status(404).json({ message: 'Action not found or already resolved.' });
        res.json({ success: true, message: 'Discarded.' });
    } catch (err) {
        console.error('[chatbot.discardAction]', err.message);
        res.status(500).json({ message: 'Failed to discard.' });
    }
};

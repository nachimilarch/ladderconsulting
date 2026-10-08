/**
 * Claude (Anthropic Messages API) connector for LAILA.
 *
 * The rest of the app talks to models in the OpenAI chat shape that Ollama speaks (system / user /
 * assistant / tool messages, `tools` as functions, `tool_calls` with JSON-string arguments). This
 * file translates that shape to Claude's and back, so the chatbot code does not change:
 *
 *   chatCompletion({ messages, tools, json, maxTokens, timeoutMs, meta })        -> message
 *   streamChatCompletion({ messages, tools, onToken, maxTokens, meta })          -> message
 *
 * where `message` is { role:'assistant', content, tool_calls?, finish_reason }.
 *
 * Plain axios is used (no SDK): the surface we need is small and this keeps the Docker install
 * unchanged. Settings come from process.env, which platform_settings overrides at boot and on save:
 * ANTHROPIC_API_KEY, CLAUDE_MODEL, CLAUDE_EFFORT, ANTHROPIC_BASE_URL (tests only).
 */

const axios = require('axios');
const db = require('../config/db');

const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-5-5';
const EFFORTS = ['low', 'medium', 'high'];
const CHAT_TIMEOUT_MS = 120000;
const JSON_TIMEOUT_MS = 90000;

// USD per million tokens (https://platform.claude.com/docs/en/about-claude/pricing). Used only to
// estimate spend in our own usage table; Anthropic's invoice is the source of truth.
const PRICES = {
    'claude-haiku-5-5':  { in: 0.10, out: 0.50, cacheRead: 0.01, cacheWrite: 0.125 },
    'claude-sonnet-5-5': { in: 2.00, out: 10.0, cacheRead: 0.10, cacheWrite: 2.50 },
    'claude-opus-5-5':   { in: 4.00, out: 20.0, cacheRead: 0.20, cacheWrite: 5.00 },
};

const getKey = () => process.env.ANTHROPIC_API_KEY || '';
const getModel = () => (process.env.CLAUDE_MODEL || DEFAULT_MODEL).trim();
const getEffort = () => (EFFORTS.includes(process.env.CLAUDE_EFFORT) ? process.env.CLAUDE_EFFORT : 'medium');
const baseUrl = () => (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const isConfigured = () => !!getKey();

// Haiku 5.5 turns thinking off with "disabled"; Sonnet 5.5 uses "between_tools" (no up-front thinking).
// Either keeps a chat reply quick and cheap. Other models: leave the API default.
const thinkingFor = (model) => {
    if (/haiku-5-5/.test(model)) return { type: 'disabled' };
    if (/sonnet-5-5/.test(model)) return { type: 'between_tools' };
    return undefined;
};
const supportsEffort = (model) => /claude-(haiku|sonnet|opus|fable)-5/.test(model);

// ── OpenAI-shape -> Claude-shape ────────────────────────────────────────────
const toolId = (id, fallback) => (String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || fallback);
const parseArgs = (a) => {
    if (a && typeof a === 'object') return a;
    try { const v = JSON.parse(a || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
};

function convertTools(tools) {
    return (tools || []).map((t) => ({
        name: t.function.name,
        description: t.function.description || '',
        input_schema: t.function.parameters && t.function.parameters.type ? t.function.parameters : { type: 'object', properties: {} },
    }));
}

function mergeSameRole(msgs) {
    const out = [];
    for (const m of msgs) {
        const last = out[out.length - 1];
        if (last && last.role === m.role) last.content = [...last.content, ...m.content];
        else out.push({ role: m.role, content: [...m.content] });
    }
    return out;
}

/** Turn the app's message list into Claude's. Claude is strict: roles alternate, and every tool call
 *  needs its result in the very next user message. Stored history can break that (a cut-off window,
 *  a failed tool), so unpaired pieces are dropped rather than sent. */
function convertMessages(messages) {
    const system = messages.filter((m) => m.role === 'system').map((m) => String(m.content || '')).filter(Boolean).join('\n\n');
    let n = 0;
    const raw = [];
    for (const m of messages) {
        if (m.role === 'system') continue;
        if (m.role === 'user') {
            if (String(m.content || '').trim()) raw.push({ role: 'user', content: [{ type: 'text', text: String(m.content) }] });
        } else if (m.role === 'assistant') {
            const blocks = [];
            if (String(m.content || '').trim()) blocks.push({ type: 'text', text: String(m.content) });
            for (const tc of m.tool_calls || []) {
                blocks.push({ type: 'tool_use', id: toolId(tc.id, `toolu_${++n}`), name: tc.function?.name || tc.name, input: parseArgs(tc.function?.arguments) });
            }
            if (blocks.length) raw.push({ role: 'assistant', content: blocks });
        } else if (m.role === 'tool') {
            if (!m.tool_call_id) continue;
            raw.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolId(m.tool_call_id), content: String(m.content ?? '') }] });
        }
    }

    // Merge neighbours, then enforce the tool-call pairing, then merge again.
    const merged = mergeSameRole(raw);
    const paired = [];
    for (let i = 0; i < merged.length; i++) {
        const m = merged[i];
        if (m.role === 'assistant') {
            const next = merged[i + 1];
            const answered = new Set(((next && next.role === 'user') ? next.content : []).filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id));
            m.content = m.content.filter((b) => b.type !== 'tool_use' || answered.has(b.id));
        } else {
            const prev = paired[paired.length - 1];
            const asked = new Set(((prev && prev.role === 'assistant') ? prev.content : []).filter((b) => b.type === 'tool_use').map((b) => b.id));
            m.content = m.content.filter((b) => b.type !== 'tool_result' || asked.has(b.tool_use_id));
        }
        if (m.content.length) paired.push(m);
    }
    const out = mergeSameRole(paired);
    while (out.length && out[0].role !== 'user') out.shift();              // must start with the user
    for (const m of out) {                                                  // results come before any text
        if (m.role === 'user') m.content.sort((a, b) => (a.type === 'tool_result' ? 0 : 1) - (b.type === 'tool_result' ? 0 : 1));
    }
    if (!out.length || out[out.length - 1].role !== 'user') out.push({ role: 'user', content: [{ type: 'text', text: 'Please continue.' }] });
    return { system, messages: out };
}

function buildRequest({ messages, tools, json, maxTokens, stream }) {
    const model = getModel();
    const { system, messages: msgs } = convertMessages(messages);
    const jsonRule = json ? '\n\nReply with ONE valid JSON object and nothing else: no explanation, no code fences.' : '';
    const body = {
        model,
        max_tokens: maxTokens || (json ? 1500 : 2048),
        // One cache breakpoint at the end of the system block caches the tool list and the prompt.
        system: [{ type: 'text', text: (system || 'You are a helpful assistant.') + jsonRule, cache_control: { type: 'ephemeral' } }],
        messages: msgs,
    };
    if (tools?.length) { body.tools = convertTools(tools); body.tool_choice = { type: 'auto' }; }
    const thinking = thinkingFor(model);
    if (thinking) body.thinking = thinking;
    if (supportsEffort(model)) body.output_config = { effort: getEffort() };
    if (stream) body.stream = true;
    return { body, model };
}

const headers = () => ({ 'x-api-key': getKey(), 'anthropic-version': API_VERSION, 'content-type': 'application/json' });

// ── Claude-shape -> OpenAI-shape ────────────────────────────────────────────
const FINISH = { tool_use: 'tool_calls', max_tokens: 'length', end_turn: 'stop', stop_sequence: 'stop', refusal: 'stop' };
const REFUSAL_TEXT = "Sorry, I can't help with that one. Is there something else about your profile or jobs I can do?";

function toOpenAIMessage({ blocks, stopReason }) {
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const calls = blocks.filter((b) => b.type === 'tool_use').map((b) => ({
        id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
    }));
    return {
        role: 'assistant',
        content: text || (stopReason === 'refusal' && !calls.length ? REFUSAL_TEXT : ''),
        tool_calls: calls.length ? calls : undefined,
        finish_reason: FINISH[stopReason] || 'stop',
    };
}

// In JSON mode pull the object out of whatever wrapped it.
function extractJson(msg) {
    const c = msg.content || '';
    const a = c.indexOf('{'), z = c.lastIndexOf('}');
    return a >= 0 && z > a ? { ...msg, content: c.slice(a, z + 1) } : msg;
}

// ── Spend tracking ──────────────────────────────────────────────────────────
function estimateCostUsd(model, u) {
    const p = PRICES[model];
    if (!p) return null;
    return ((u.input_tokens || 0) * p.in + (u.output_tokens || 0) * p.out
        + (u.cache_read_input_tokens || 0) * p.cacheRead + (u.cache_creation_input_tokens || 0) * p.cacheWrite) / 1e6;
}

async function logUsage(meta, model, u) {
    try {
        await db.query(
            `INSERT INTO llm_usage (user_id, feature, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd)
             VALUES (?, ?, 'claude', ?, ?, ?, ?, ?, ?)`,
            [meta?.userId || null, meta?.feature || 'laila_chat', model, u.input_tokens || 0, u.output_tokens || 0,
             u.cache_read_input_tokens || 0, u.cache_creation_input_tokens || 0, estimateCostUsd(model, u)]
        );
    } catch (e) { console.error('[claude:usage]', e.message); }
}

// ── Errors ──────────────────────────────────────────────────────────────────
async function readErrorBody(err) {
    const d = err.response?.data;
    if (!d) return err.message;
    if (typeof d === 'object' && typeof d.pipe === 'function') {
        const chunks = [];
        for await (const c of d) chunks.push(c);
        d.raw = Buffer.concat(chunks).toString('utf8');
        try { return JSON.parse(d.raw)?.error?.message || d.raw.slice(0, 200); } catch { return d.raw.slice(0, 200); }
    }
    return d?.error?.message || (typeof d === 'string' ? d.slice(0, 200) : err.message);
}

async function toClaudeError(err) {
    const e = new Error(`Claude request failed (${err.response?.status || err.code || 'network'}): ${await readErrorBody(err)}`);
    e.status = err.response?.status;
    return e;
}

// ── Non-streaming call ──────────────────────────────────────────────────────
async function chatCompletion({ messages, tools, json = false, maxTokens, timeoutMs, meta }) {
    if (!isConfigured()) throw new Error('Claude is not configured (no API key).');
    const { body, model } = buildRequest({ messages, tools, json, maxTokens });
    let res;
    try {
        res = await axios.post(`${baseUrl()}/v1/messages`, body, { headers: headers(), timeout: timeoutMs || (json ? JSON_TIMEOUT_MS : CHAT_TIMEOUT_MS) });
    } catch (err) { throw await toClaudeError(err); }
    logUsage(meta, model, res.data.usage || {});
    const msg = toOpenAIMessage({ blocks: res.data.content || [], stopReason: res.data.stop_reason });
    return json ? extractJson(msg) : msg;
}

// ── Streaming call ──────────────────────────────────────────────────────────
async function streamChatCompletion({ messages, tools, onToken, maxTokens, meta }) {
    if (!isConfigured()) throw new Error('Claude is not configured (no API key).');
    const { body, model } = buildRequest({ messages, tools, maxTokens, stream: true });
    let res;
    try {
        res = await axios.post(`${baseUrl()}/v1/messages`, body, { headers: headers(), responseType: 'stream', timeout: CHAT_TIMEOUT_MS });
    } catch (err) { throw await toClaudeError(err); }

    return new Promise((resolve, reject) => {
        const blocks = [];            // by content-block index
        const usage = {};
        let stopReason = null;
        let buffer = '';
        let failed = false;

        const handle = (ev) => {
            switch (ev.type) {
                case 'message_start':
                    Object.assign(usage, ev.message?.usage || {});
                    break;
                case 'content_block_start': {
                    const b = ev.content_block || {};
                    blocks[ev.index] = b.type === 'tool_use'
                        ? { type: 'tool_use', id: b.id, name: b.name, _json: '' }
                        : { type: b.type, text: b.text || '' };
                    break;
                }
                case 'content_block_delta': {
                    const b = blocks[ev.index];
                    const d = ev.delta || {};
                    if (!b) break;
                    if (d.type === 'text_delta' && b.type === 'text') { b.text += d.text; onToken?.(d.text); }
                    else if (d.type === 'input_json_delta' && b.type === 'tool_use') b._json += d.partial_json || '';
                    break;
                }
                case 'message_delta':
                    if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
                    Object.assign(usage, ev.usage || {});
                    break;
                case 'error':
                    failed = true;
                    reject(new Error(`Claude stream error: ${ev.error?.message || ev.error?.type || 'unknown'}`));
                    break;
                default: break;
            }
        };

        res.data.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                const t = line.trim();
                if (!t.startsWith('data:')) continue;
                try { handle(JSON.parse(t.slice(5).trim())); } catch { /* ignore a malformed line */ }
            }
        });
        res.data.on('error', (e) => { if (!failed) { failed = true; reject(e); } });
        res.data.on('end', () => {
            if (failed) return;
            const finished = blocks.filter(Boolean).map((b) => (b.type === 'tool_use' ? { type: 'tool_use', id: b.id, name: b.name, input: parseArgs(b._json) } : b));
            logUsage(meta, model, usage);
            resolve(toOpenAIMessage({ blocks: finished, stopReason }));
        });
    });
}

module.exports = {
    isConfigured, getModel, getEffort, chatCompletion, streamChatCompletion, estimateCostUsd,
    // exported for tests
    _convertMessages: convertMessages, _buildRequest: buildRequest,
};

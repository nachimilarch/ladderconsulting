// Background work for the local model (resume enrichment, match notes).
// Ollama runs one request at a time on a small shared box, so these jobs go through a
// single serial queue with a small cap; when it is full a job is refused rather than
// piling up behind the chat assistant.
const db = require('../config/db');

const MAX_PENDING = 8;
let chain = Promise.resolve();
let pending = 0;

// Returns false when the queue is full. Errors are logged, never thrown.
function enqueue(label, fn) {
    if (pending >= MAX_PENDING) return false;
    pending += 1;
    chain = chain
        .then(fn)
        .catch((err) => console.error(`[llm:${label}]`, err.message))
        .finally(() => { pending -= 1; });
    return true;
}

// Admin switches live in platform_settings ('true'/'false'); missing means on.
const FLAG_TTL_MS = 60 * 1000;
const flagCache = new Map();

async function isEnabled(key) {
    const hit = flagCache.get(key);
    if (hit && Date.now() - hit.at < FLAG_TTL_MS) return hit.on;
    let on = true;
    try {
        const [[row]] = await db.query('SELECT value FROM platform_settings WHERE setting_key = ?', [key]);
        if (row) on = String(row.value).toLowerCase() !== 'false';
    } catch (err) {
        console.error('[llm:flag]', err.message);
    }
    flagCache.set(key, { on, at: Date.now() });
    return on;
}

// Pull the first JSON object out of a model reply (JSON mode is reliable, but be forgiving).
function parseJsonReply(content) {
    const text = String(content || '').trim();
    try { return JSON.parse(text); } catch { /* fall through */ }
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
}

// One line of plain text: no control characters or markup, capped in length.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]+', 'g');
const cleanText = (s, max) =>
    String(s ?? '').replace(CONTROL_CHARS, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

module.exports = { enqueue, isEnabled, parseJsonReply, cleanText };

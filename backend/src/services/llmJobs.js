// Background AI work (resume enrichment, match notes, outreach writing).
// With Ollama (one request at a time on a small shared box) jobs go through a single serial
// queue with a small cap; when it is full a job is refused rather than piling up behind the
// chat assistant. With Claude there is nothing to protect, so jobs run immediately, a few at
// a time, and never wait for the chat to go quiet.
const db = require('../config/db');
const { claudeActive } = require('./lailaLlm');

const MAX_PENDING = 8;
const CLAUDE_MAX_PENDING = 30;
const CLAUDE_CONCURRENCY = 4;
let chain = Promise.resolve();
let pending = 0;
let claudeRunning = 0;
const claudeWaiting = [];

// The chat assistant has priority. A background job does not START while a chat request is
// in flight or just finished (a short quiet gap), so people asking the assistant something
// are not queued behind a resume or a fit note that has not begun yet. It waits at most
// MAX_WAIT_MS, then runs anyway. (A job already running still holds the model.)
const QUIET_MS = 20 * 1000;
const MAX_WAIT_MS = 5 * 60 * 1000;
let activeChats = 0;
let lastChatEnd = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Call when a chat request starts; call the returned function when it ends (safe to call twice).
function chatStarted() {
    activeChats += 1;
    let done = false;
    return () => {
        if (done) return;
        done = true;
        activeChats -= 1;
        lastChatEnd = Date.now();
    };
}

async function waitForQuiet() {
    const startedWaiting = Date.now();
    while ((activeChats > 0 || Date.now() - lastChatEnd < QUIET_MS) && Date.now() - startedWaiting < MAX_WAIT_MS) {
        await sleep(2000);
    }
}

// Returns false when the queue is full. Errors are logged, never thrown.
function enqueueClaude(label, fn) {
    if (pending >= CLAUDE_MAX_PENDING) return false;
    pending += 1;
    const start = async () => {
        claudeRunning += 1;
        try { await fn(); } catch (err) { console.error(`[llm:${label}]`, err.message); }
        finally {
            claudeRunning -= 1;
            pending -= 1;
            const next = claudeWaiting.shift();
            if (next) next();
        }
    };
    if (claudeRunning < CLAUDE_CONCURRENCY) start(); else claudeWaiting.push(start);
    return true;
}

function enqueue(label, fn) {
    if (claudeActive()) return enqueueClaude(label, fn);
    if (pending >= MAX_PENDING) return false;
    pending += 1;
    chain = chain
        .then(async () => { await waitForQuiet(); return fn(); })
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

module.exports = { enqueue, chatStarted, isEnabled, parseJsonReply, cleanText };

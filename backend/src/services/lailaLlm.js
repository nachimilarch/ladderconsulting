/**
 * Which model answers LAILA.
 *
 * Settings (platform_settings, loaded into process.env at boot and on save):
 *   LAILA_USE_CLAUDE = 'true'  and  ANTHROPIC_API_KEY set   -> Claude
 *   anything else                                           -> the local Ollama model
 *
 * If Claude is switched on but a call fails (network, overload, rate limit, bad key) the same request
 * is retried on Ollama, as long as nothing has been streamed to the person yet, so LAILA keeps
 * answering. Only LAILA's chat uses this. Resume suggestions, match notes and the outreach tools stay
 * on Ollama by calling localLlmService directly.
 */

const local = require('./localLlmService');
const claude = require('./claudeLlmService');
const db = require('../config/db');

const DEFAULT_CAP = 300;

const claudeActive = () => process.env.LAILA_USE_CLAUDE === 'true' && claude.isConfigured();

function provider() {
    return claudeActive() ? 'claude' : 'ollama';
}

async function streamChatCompletion(opts) {
    if (claudeActive()) {
        let emitted = false;
        try {
            return await claude.streamChatCompletion({
                ...opts,
                onToken: (t) => { emitted = true; opts.onToken?.(t); },
            });
        } catch (err) {
            console.error('[laila] Claude failed, ', emitted ? 'cannot fall back (already streaming):' : 'falling back to Ollama:', err.message);
            if (emitted) throw err;
        }
    }
    return local.streamChatCompletion(opts);
}

async function chatCompletion(opts) {
    if (claudeActive()) {
        try {
            return await claude.chatCompletion(opts);
        } catch (err) {
            console.error('[laila] Claude failed, falling back to Ollama:', err.message);
        }
    }
    return local.chatCompletion(opts);
}

// A cap on messages per person per calendar month, only while Claude is answering (Ollama is free).
const monthlyCap = () => {
    const n = parseInt(process.env.LAILA_MONTHLY_MESSAGE_CAP, 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP;
};

async function messagesThisMonth(userId) {
    const [[row]] = await db.query(
        `SELECT COUNT(*) AS n FROM chatbot_messages m
         JOIN chatbot_conversations c ON c.id = m.conversation_id
         WHERE c.user_id = ? AND m.role = 'user' AND m.created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
        [userId]
    );
    return row.n;
}

/** null if the person may send another message, otherwise the text to show them. */
async function capReached(userId) {
    if (!claudeActive()) return null;
    const cap = monthlyCap();
    if ((await messagesThisMonth(userId)) < cap) return null;
    return `You have used all ${cap} of your LAILA messages for this month. They reset on the 1st. You can still do everything yourself from the menu.`;
}

module.exports = { streamChatCompletion, chatCompletion, provider, claudeActive, capReached, monthlyCap };

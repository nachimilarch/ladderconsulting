const db = require('../config/db');
const claude = require('../services/claudeLlmService');
const laila = require('../services/lailaLlm');

// GET /api/admin/llm-usage — what Claude has cost this calendar month, and whether it is switched on.
exports.usage = async (req, res) => {
    try {
        const [[m]] = await db.query(
            `SELECT COUNT(*) AS calls, COUNT(DISTINCT user_id) AS people,
                    COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens,
                    COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens, COALESCE(SUM(cost_usd), 0) AS cost_usd
             FROM llm_usage WHERE provider = 'claude' AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`
        );
        res.json({
            success: true,
            data: {
                configured: claude.isConfigured(),
                active: laila.claudeActive(),
                model: claude.getModel(),
                effort: claude.getEffort(),
                monthly_message_cap: laila.monthlyCap(),
                month: {
                    calls: Number(m.calls), people: Number(m.people),
                    input_tokens: Number(m.input_tokens), output_tokens: Number(m.output_tokens),
                    cache_read_tokens: Number(m.cache_read_tokens), cost_usd: Number(m.cost_usd),
                },
            },
        });
    } catch (err) {
        console.error('[llm.usage]', err.message);
        res.status(500).json({ success: false, message: 'Could not load usage.' });
    }
};

// POST /api/admin/llm-test — one tiny real request, so the key and model can be checked after saving.
exports.test = async (req, res) => {
    if (!claude.isConfigured()) {
        return res.status(400).json({ success: false, message: 'No Anthropic API key is saved yet. Add it, press Save, then test again.' });
    }
    const started = Date.now();
    try {
        const reply = await claude.chatCompletion({
            messages: [
                { role: 'system', content: 'You are a connection test for a hiring platform.' },
                { role: 'user', content: 'Reply with exactly the word OK.' },
            ],
            maxTokens: 20,
            meta: { userId: req.user.id, feature: 'admin_test' },
        });
        res.json({ success: true, data: { model: claude.getModel(), reply: (reply.content || '').trim().slice(0, 60), ms: Date.now() - started } });
    } catch (err) {
        console.error('[llm.test]', err.message);
        res.status(502).json({ success: false, message: err.message });
    }
};

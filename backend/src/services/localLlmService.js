// Local LLM service — mirrors trainingService.js's callAI axios-call shape
// (the only other LLM usage in this codebase), but points at a self-hosted
// Ollama instance instead of OpenAI: no API key, model/endpoint configurable
// via env vars, and adds `tools` (function-calling) support since the chatbot
// needs it and trainingService.js's plain JSON-mode call didn't.
//
// Verified against a real local Ollama instance (qwen2.5:7b) — its
// OpenAI-compatible /v1/chat/completions endpoint returns tool_calls as
// choices[0].message.tool_calls[].function.{name, arguments (JSON string)},
// and streams as standard OpenAI SSE chunks (data: {...}\n\n, ending with
// data: [DONE]), with tool_calls appearing in choices[0].delta.tool_calls.

const axios = require('axios');

const getBaseUrl = () => process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const getModel = () => process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const getTimeout = () => parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || 120000;

// Non-streaming call — used for internal tool-loop iterations (e.g. after a
// read-only tool result comes back, ask the model to continue) where there's
// no user-facing stream to write to.
async function chatCompletion({ messages, tools, json = false }) {
    const res = await axios.post(
        `${getBaseUrl()}/v1/chat/completions`,
        {
            model: getModel(),
            messages,
            // JSON mode is far more reliable than tool-calling for small models.
            ...(json ? { response_format: { type: 'json_object' }, temperature: 0.4 } : {}),
            ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
        },
        { timeout: getTimeout() }
    );
    return res.data.choices[0].message; // { role, content, tool_calls? }
}

// Streaming call — used for the user-facing reply. Resolves with the same
// shape as chatCompletion once the stream ends (assembled content +
// tool_calls), calling onToken(text) for each content fragment as it arrives
// so the frontend can render it live.
async function streamChatCompletion({ messages, tools, onToken }) {
    const res = await axios.post(
        `${getBaseUrl()}/v1/chat/completions`,
        {
            model: getModel(),
            messages,
            stream: true,
            ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
        },
        { timeout: getTimeout(), responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
        let content = '';
        let finishReason = null;
        const toolCallsByIndex = new Map();
        let buffer = '';

        res.data.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep the last (possibly incomplete) line for next chunk

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') continue;

                let parsed;
                try { parsed = JSON.parse(data); } catch { continue; }

                const choice = parsed.choices?.[0];
                if (!choice) continue;
                if (choice.finish_reason) finishReason = choice.finish_reason;

                const delta = choice.delta || {};
                if (delta.content) {
                    content += delta.content;
                    onToken?.(delta.content);
                }
                if (Array.isArray(delta.tool_calls)) {
                    for (const tc of delta.tool_calls) {
                        const idx = tc.index ?? 0;
                        const existing = toolCallsByIndex.get(idx) || { id: tc.id, type: 'function', function: { name: '', arguments: '' } };
                        if (tc.id) existing.id = tc.id;
                        if (tc.function?.name) existing.function.name += tc.function.name;
                        if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
                        toolCallsByIndex.set(idx, existing);
                    }
                }
            }
        });

        res.data.on('end', () => {
            const toolCalls = [...toolCallsByIndex.values()];
            resolve({
                role: 'assistant',
                content,
                tool_calls: toolCalls.length ? toolCalls : undefined,
                finish_reason: finishReason,
            });
        });

        res.data.on('error', reject);
    });
}

module.exports = { chatCompletion, streamChatCompletion };

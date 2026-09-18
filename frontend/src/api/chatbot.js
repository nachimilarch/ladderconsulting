import api from './axios';

export const chatbotAPI = {
    listConversations:  ()          => api.get('/chatbot/conversations'),
    createConversation: (title)     => api.post('/chatbot/conversations', { title }),
    getConversation:    (id)        => api.get(`/chatbot/conversations/${id}`),
    confirmAction:      (id)        => api.post(`/chatbot/actions/${id}/confirm`),
    discardAction:      (id)        => api.post(`/chatbot/actions/${id}/discard`),
};

const API_BASE = api.defaults.baseURL;

// Streaming needs a raw fetch + ReadableStream reader — axios in this codebase
// isn't set up for SSE. Cookie auth still applies via credentials:'include'
// (mirrors axios's withCredentials:true). Calls `onEvent({type, ...})` for
// each `data: {...}` line the backend writes — see chatbotController.sendMessage
// for the exact event shapes (token / pending_action / done / error).
export async function sendChatMessage(conversationId, message, onEvent) {
    const res = await fetch(`${API_BASE}/chatbot/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
    });

    if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try { msg = (await res.json())?.message || msg; } catch { /* not JSON */ }
        throw Object.assign(new Error(msg), { status: res.status });
    }
    if (!res.body) throw new Error('Streaming not supported by this browser.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data) continue;
            try { onEvent(JSON.parse(data)); } catch { /* ignore malformed line */ }
        }
    }
}

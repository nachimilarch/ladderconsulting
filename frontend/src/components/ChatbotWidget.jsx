import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { aiSubscriptionAPI } from '../api/aiSubscription';
import { chatbotAPI, sendChatMessage } from '../api/chatbot';
import AiSubscriptionCard from './AiSubscriptionCard';
import ChatbotActionCard from './ChatbotActionCard';
import { OPEN_CHATBOT_EVENT } from './AiAssistantPromo';

const PLACEHOLDER = {
    company: 'Ask me to draft a job post, or find candidates for one you’ve already posted…',
    candidate: 'Ask me to update your profile, or find jobs that match you…',
};

// Floating chatbot launcher + panel. Mounted in CompanyLayout/CandidateLayout
// only — the chatbot personas are company + candidate, per spec (not hr/admin).
export default function ChatbotWidget() {
    const { user } = useAuth();
    const persona = user?.role === 'company' ? 'company' : user?.role === 'candidate' ? 'candidate' : null;

    const [open, setOpen] = useState(false);
    const [loadingGate, setLoadingGate] = useState(true);
    const [subscribed, setSubscribed] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [items, setItems] = useState([]); // { kind:'message', role, content } | { kind:'pending_action', id, preview }
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const scrollRef = useRef(null);

    useEffect(() => {
        if (!open || !persona) return;
        let cancelled = false;

        (async () => {
            setLoadingGate(true);
            try {
                const { data: sub } = await aiSubscriptionAPI.status();
                if (cancelled) return;
                const isSubscribed = sub?.subscription && ['active', 'grace'].includes(sub.subscription.status);
                setSubscribed(!!isSubscribed);
                if (!isSubscribed) return;

                const { data: convos } = await chatbotAPI.listConversations();
                let convId = convos?.data?.[0]?.id;
                if (!convId) {
                    const { data: created } = await chatbotAPI.createConversation();
                    convId = created.data.id;
                }
                if (cancelled) return;
                setConversationId(convId);

                const { data: full } = await chatbotAPI.getConversation(convId);
                if (cancelled) return;
                const history = (full.data.messages || [])
                    .filter(m => m.role === 'user' || m.role === 'assistant')
                    .filter(m => m.content) // an assistant turn that only made a tool call has empty content
                    .map(m => ({ kind: 'message', role: m.role, content: m.content }));
                const pending = (full.data.pending_actions || [])
                    .filter(a => a.status === 'pending_confirmation')
                    .map(a => ({ kind: 'pending_action', id: a.id, preview: a.preview_text }));
                setItems([...history, ...pending]);
            } catch {
                setSubscribed(false);
            } finally {
                if (!cancelled) setLoadingGate(false);
            }
        })();

        return () => { cancelled = true; };
    }, [open, persona]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [items, streamingText]);

    // Lets promo callouts elsewhere on the page (AiAssistantPromo) open this
    // widget without any prop-drilling or shared state — it's mounted once
    // per layout, so a DOM event is simpler than threading context through.
    useEffect(() => {
        if (!persona) return;
        const openFromPromo = () => setOpen(true);
        window.addEventListener(OPEN_CHATBOT_EVENT, openFromPromo);
        return () => window.removeEventListener(OPEN_CHATBOT_EVENT, openFromPromo);
    }, [persona]);

    if (!persona) return null;

    const handleSend = async (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || sending || !conversationId) return;

        setItems(prev => [...prev, { kind: 'message', role: 'user', content: text }]);
        setInput('');
        setSending(true);
        setStreamingText('');

        let buffer = '';
        try {
            await sendChatMessage(conversationId, text, (event) => {
                if (event.type === 'token') {
                    buffer += event.text;
                    setStreamingText(buffer);
                } else if (event.type === 'pending_action') {
                    setItems(prev => [...prev, { kind: 'pending_action', id: event.id, preview: event.preview }]);
                } else if (event.type === 'error') {
                    setItems(prev => [...prev, { kind: 'message', role: 'assistant', content: `⚠️ ${event.message}` }]);
                }
            });
            if (buffer) {
                setItems(prev => [...prev, { kind: 'message', role: 'assistant', content: buffer }]);
            }
        } catch (err) {
            const msg = err.status === 402
                ? 'Your AI subscription is no longer active.'
                : 'The assistant is unavailable right now (it may be offline or timed out). Please try again.';
            setItems(prev => [...prev, { kind: 'message', role: 'assistant', content: `⚠️ ${msg}` }]);
            if (err.status === 402) setSubscribed(false);
        } finally {
            setStreamingText('');
            setSending(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(o => !o)}
                className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition flex items-center justify-center text-2xl"
                aria-label="AI Assistant"
            >
                {open ? '×' : '✨'}
            </button>

            {open && (
                <div className="fixed bottom-24 right-5 z-40 w-96 max-w-[92vw] h-[32rem] max-h-[75vh] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
                    <div className="px-4 py-3 bg-indigo-600 text-white flex items-center justify-between shrink-0">
                        <p className="font-semibold text-sm">✨ AI Assistant</p>
                        <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white text-lg leading-none">×</button>
                    </div>

                    {loadingGate ? (
                        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>
                    ) : !subscribed ? (
                        <div className="flex-1 overflow-y-auto p-4">
                            <AiSubscriptionCard />
                        </div>
                    ) : (
                        <>
                            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                                {items.length === 0 && !streamingText && (
                                    <p className="text-xs text-gray-400 text-center mt-6">{PLACEHOLDER[persona]}</p>
                                )}
                                {items.map((item, i) => item.kind === 'pending_action' ? (
                                    <ChatbotActionCard
                                        key={`pa-${item.id}`}
                                        id={item.id}
                                        preview={item.preview}
                                        onResolved={() => {}}
                                    />
                                ) : (
                                    <div
                                        key={i}
                                        className={`text-sm rounded-xl px-3 py-2 max-w-[85%] whitespace-pre-line ${
                                            item.role === 'user'
                                                ? 'bg-indigo-600 text-white self-end'
                                                : 'bg-gray-100 text-gray-800 self-start'
                                        }`}
                                    >
                                        {item.content}
                                    </div>
                                ))}
                                {streamingText && (
                                    <div className="text-sm rounded-xl px-3 py-2 max-w-[85%] whitespace-pre-line bg-gray-100 text-gray-800 self-start">
                                        {streamingText}
                                    </div>
                                )}
                                {sending && !streamingText && (
                                    <div className="text-sm rounded-xl px-3 py-2 bg-gray-100 text-gray-400 self-start">…</div>
                                )}
                            </div>

                            <form onSubmit={handleSend} className="border-t border-gray-100 p-2 flex gap-2 shrink-0">
                                <input
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    placeholder="Type a message…"
                                    disabled={sending}
                                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                                />
                                <button
                                    type="submit"
                                    disabled={sending || !input.trim()}
                                    className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
                                >
                                    Send
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}
        </>
    );
}

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { aiSubscriptionAPI } from '../api/aiSubscription';
import { chatbotAPI, sendChatMessage } from '../api/chatbot';
import AiSubscriptionCard from './AiSubscriptionCard';
import ChatbotActionCard from './ChatbotActionCard';
import ChatMarkdown from './chat/ChatMarkdown';
import { JobMatchCards, CandidateMatchCards } from './chat/ChatCards';
import ChatHelp from './chat/ChatHelp';
import { OPEN_CHATBOT_EVENT } from '../utils/assistant';

const GREETING = {
    candidate: (name) => `Hi${name ? ` ${name}` : ''}! 👋 I'm your LadderStep assistant. I can polish your profile, find jobs that suit you, and even apply for you. What would you like to start with?`,
    company: (name) => `Hi${name ? ` ${name}` : ''}! 👋 I'm your LadderStep assistant. I can draft job posts, improve existing ones, and find candidates who fit your roles. What shall we work on?`,
};

const STARTERS = {
    candidate: ['Polish my profile', 'Find jobs that match me', 'What should I improve on my profile?'],
    company: ['Draft a job post', 'Find candidates for my job', 'Improve one of my job descriptions'],
};

// "What can you do?" style questions are answered by the help card, instantly and
// without a model call. Anchored to the whole message so real requests aren't caught.
const HELP_ASK = /^(hi|hello|hey)?[\s,!.]*(help( me)?|what can you do|what do you do|what can i ask( you)?|how can you help( me)?|what are you able to do|what are your (features|capabilities)|how do (i|you) use (this|you))[\s?!.]*$/i;

// Suggested next steps once a draft has been confirmed.
const CHIPS_AFTER = {
    update_profile: ['Find jobs that match me'],
    apply_to_job: ['Find more matching jobs'],
    create_job: ['Find candidates for my job'],
    update_job: ['Find candidates for my job'],
};

// Local CPU inference is slow; say so honestly instead of a silent spinner.
const waitNote = (secs) => {
    if (secs >= 60) return 'Warming up after a quiet spell. The first reply takes a little longer.';
    if (secs >= 25) return 'Still on it, thanks for your patience.';
    if (secs >= 8) return 'Thinking it through…';
    return null;
};

const UNAVAILABLE = "Sorry, I couldn't reach my brain just now. Please try again in a moment.";

const asJson = (v) => {
    if (!v) return null;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
    return v;
};

// Rebuild the transcript (including result cards) from a saved conversation.
const buildItems = (conv) => {
    const items = [];
    for (const m of conv.messages || []) {
        if (m.role === 'user' || m.role === 'assistant') {
            if (m.content) items.push({ kind: 'message', role: m.role, content: m.content });
        } else if (m.role === 'tool') {
            const name = asJson(m.tool_calls)?.[0]?.name;
            const result = asJson(m.content);
            if (name === 'find_matching_jobs' && result?.jobs?.length) items.push({ kind: 'job_matches', jobs: result.jobs });
            if (name === 'find_matching_candidates' && result?.matches?.length) {
                items.push({ kind: 'candidate_matches', jobTitle: result.job_title, matches: result.matches });
            }
        }
    }
    for (const a of conv.pending_actions || []) {
        if (a.status === 'pending_confirmation') {
            items.push({ kind: 'pending_action', id: a.id, preview: a.preview_text, actionType: a.action_type, payload: asJson(a.payload) });
        }
    }
    return items;
};

const Avatar = ({ small = false }) => (
    <div className={`${small ? 'w-7 h-7 text-sm' : 'w-9 h-9 text-lg'} shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-sm`}>
        ✨
    </div>
);

const AssistantBubble = ({ children }) => (
    <div className="flex items-start gap-2 max-w-[94%]">
        <Avatar small />
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13.5px] text-gray-800 min-w-0">
            {children}
        </div>
    </div>
);

function TypingIndicator({ note }) {
    return (
        <AssistantBubble>
            <div className="flex items-center gap-1 h-4">
                {[0, 150, 300].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
            </div>
            {note && <p className="text-xs text-gray-400 mt-1.5">{note}</p>}
        </AssistantBubble>
    );
}

// Floating chatbot launcher + panel. Mounted in CompanyLayout/CandidateLayout
// only — the chatbot personas are company + candidate, per spec (not hr/admin).
// mobileLauncher=false hides the floating button below `md` (the layout supplies its own, e.g. a tab-bar button).
export default function ChatbotWidget({ mobileLauncher = true }) {
    const { user } = useAuth();
    const persona = user?.role === 'company' ? 'company' : user?.role === 'candidate' ? 'candidate' : null;
    const firstName = (user?.name || '').trim().split(' ')[0];

    const [open, setOpen] = useState(false);
    const [loadingGate, setLoadingGate] = useState(true);
    const [subscribed, setSubscribed] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [items, setItems] = useState([]);
    const [chips, setChips] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [waitSecs, setWaitSecs] = useState(0);
    const [pendingPrompt, setPendingPrompt] = useState(null); // a message another button asked us to send
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
                if (!isSubscribed) { setPendingPrompt(null); return; }

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
                const history = buildItems(full.data);
                setItems(history);
                setChips(history.length ? STARTERS[persona] : []); // brand-new chats show the help card instead
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
    }, [items, streamingText, sending, chips]);

    // Lets promo callouts elsewhere on the page (AiAssistantPromo) open this
    // widget without any prop-drilling or shared state — it's mounted once
    // per layout, so a DOM event is simpler than threading context through.
    useEffect(() => {
        if (!persona) return;
        const openFromPromo = (e) => {
            setOpen(true);
            if (e.detail?.text) setPendingPrompt(e.detail.text);
        };
        window.addEventListener(OPEN_CHATBOT_EVENT, openFromPromo);
        return () => window.removeEventListener(OPEN_CHATBOT_EVENT, openFromPromo);
    }, [persona]);

    useEffect(() => {
        if (!sending) return;
        const t = setInterval(() => setWaitSecs((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, [sending]);

    // Send a message that a dashboard button handed over, once the chat is ready.
    useEffect(() => {
        if (pendingPrompt && open && !loadingGate && subscribed && conversationId && !sending) {
            sendText(pendingPrompt);
        }
    }, [pendingPrompt, open, loadingGate, subscribed, conversationId, sending]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!persona) return null;

    async function sendText(raw) {
        setPendingPrompt(null);
        const text = (raw || '').trim();
        if (!text || sending || !conversationId) return;

        if (HELP_ASK.test(text)) {
            setItems((prev) => [...prev, { kind: 'message', role: 'user', content: text }, { kind: 'help' }]);
            setInput('');
            setChips([]);
            return;
        }

        setItems((prev) => [...prev, { kind: 'message', role: 'user', content: text }]);
        setInput('');
        setChips([]);
        setSending(true);
        setWaitSecs(0);
        setStreamingText('');

        let buffer = '';
        // Whatever the assistant has said so far becomes a bubble, so a card that
        // arrives next lands after its lead-in text rather than before it.
        const flush = () => {
            if (buffer.trim()) {
                const content = buffer;
                setItems((prev) => [...prev, { kind: 'message', role: 'assistant', content }]);
            }
            buffer = '';
            setStreamingText('');
        };
        const add = (item) => setItems((prev) => [...prev, item]);

        try {
            await sendChatMessage(conversationId, text, (event) => {
                if (event.type === 'token') {
                    buffer += event.text;
                    setStreamingText(buffer);
                } else if (event.type === 'reset') {
                    // The assistant is retrying (its first try was unusable): drop what streamed.
                    buffer = '';
                    setStreamingText('');
                } else if (event.type === 'choices') {
                    // e.g. "Which job?" -> their job titles as tappable options
                    flush();
                    setChips(event.options || []);
                } else if (event.type === 'job_matches') {
                    flush();
                    add({ kind: 'job_matches', jobs: event.jobs });
                } else if (event.type === 'candidate_matches') {
                    flush();
                    add({ kind: 'candidate_matches', jobTitle: event.job_title, matches: event.matches });
                } else if (event.type === 'pending_action') {
                    flush();
                    add({ kind: 'pending_action', id: event.id, preview: event.preview, actionType: event.action_type, payload: event.payload });
                } else if (event.type === 'error') {
                    flush();
                    add({ kind: 'message', role: 'assistant', content: event.message });
                }
            });
            flush();
        } catch (err) {
            flush();
            const msg = err.status === 402
                ? "Your AI Assistant subscription isn't active right now. You can renew it from your profile page."
                : UNAVAILABLE;
            add({ kind: 'message', role: 'assistant', content: msg });
            if (err.status === 402) setSubscribed(false);
        } finally {
            setStreamingText('');
            setSending(false);
        }
    }

    const handleSubmit = (e) => { e.preventDefault(); sendText(input); };

    const handleResolved = (status, { actionType, data }) => {
        if (data?.followup) setItems((prev) => [...prev, { kind: 'message', role: 'assistant', content: data.followup }]);
        setChips(status === 'confirmed' ? (CHIPS_AFTER[actionType] || []) : []);
    };

    const handleNewChat = async () => {
        if (sending) return;
        try {
            const { data } = await chatbotAPI.createConversation();
            setConversationId(data.data.id);
            setItems([]);
            setInput('');
            setChips([]);
        } catch { /* keep the current chat */ }
    };

    const showHelp = () => {
        if (sending) return;
        setItems((prev) => (prev[prev.length - 1]?.kind === 'help' ? prev : [...prev, { kind: 'help' }]));
        setChips([]);
    };

    const showGreeting = items.length === 0 && !streamingText && !sending;

    return (
        <>
            <button
                onClick={() => setOpen(o => !o)}
                className={`fixed bottom-5 right-4 sm:right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition items-center justify-center text-2xl ${
                    mobileLauncher ? (open ? 'hidden sm:flex' : 'flex') : 'hidden md:flex'
                }`}
                aria-label="AI Assistant"
            >
                {open ? '×' : '✨'}
            </button>

            {open && (
                <div className="fixed z-50 inset-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[26rem] h-[100dvh] sm:h-[36rem] sm:max-h-[78vh] bg-white sm:rounded-2xl sm:shadow-2xl sm:border sm:border-gray-100 flex flex-col overflow-hidden">
                    <div
                        className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center gap-3 shrink-0"
                        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
                    >
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">✨</div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm leading-tight">LadderStep Assistant</p>
                            <p className="text-[11px] text-white/80 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-300" />
                                {sending ? 'Typing…' : 'Here to help'}
                            </p>
                        </div>
                        {subscribed && !loadingGate && (
                            <button
                                onClick={showHelp}
                                disabled={sending}
                                title="What can I ask?"
                                className="w-6 h-6 rounded-full text-xs font-bold bg-white/15 hover:bg-white/25 disabled:opacity-50 transition"
                            >
                                ?
                            </button>
                        )}
                        {subscribed && !loadingGate && (
                            <button
                                onClick={handleNewChat}
                                disabled={sending}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-50 transition"
                            >
                                New chat
                            </button>
                        )}
                        <button onClick={() => setOpen(false)} aria-label="Close assistant" className="text-white/80 hover:text-white text-2xl leading-none w-9 h-9 -mr-2 flex items-center justify-center">×</button>
                    </div>

                    {loadingGate ? (
                        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Getting things ready…</div>
                    ) : !subscribed ? (
                        <div className="flex-1 overflow-y-auto p-4">
                            <p className="text-sm text-gray-600 mb-3">
                                Hi{firstName ? ` ${firstName}` : ''}! 👋 Turn on the AI Assistant and I'll help with your day-to-day work right here in the chat.
                            </p>
                            <div className="mb-3"><ChatHelp persona={persona} preview /></div>
                            <AiSubscriptionCard />
                        </div>
                    ) : (
                        <>
                            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3 bg-gray-50">
                                {showGreeting && (
                                    <>
                                        <AssistantBubble>{GREETING[persona](firstName)}</AssistantBubble>
                                        <div className="pl-9"><ChatHelp persona={persona} onAsk={sendText} disabled={sending} /></div>
                                    </>
                                )}

                                {items.map((item, i) => {
                                    if (item.kind === 'pending_action') {
                                        return (
                                            <div key={`pa-${item.id}`} className="pl-9">
                                                <ChatbotActionCard
                                                    id={item.id}
                                                    preview={item.preview}
                                                    actionType={item.actionType}
                                                    payload={item.payload}
                                                    onResolved={handleResolved}
                                                />
                                            </div>
                                        );
                                    }
                                    if (item.kind === 'help') {
                                        return <div key={i} className="pl-9"><ChatHelp persona={persona} onAsk={sendText} disabled={sending} /></div>;
                                    }
                                    if (item.kind === 'job_matches') {
                                        return (
                                            <div key={i} className="pl-9">
                                                <JobMatchCards
                                                    jobs={item.jobs}
                                                    disabled={sending}
                                                    onApply={(j) => sendText(`Please apply me to "${j.title}" at ${j.company} (job #${j.job_id})`)}
                                                />
                                            </div>
                                        );
                                    }
                                    if (item.kind === 'candidate_matches') {
                                        return (
                                            <div key={i} className="pl-9">
                                                <CandidateMatchCards jobTitle={item.jobTitle} matches={item.matches} />
                                            </div>
                                        );
                                    }
                                    return item.role === 'user' ? (
                                        <div key={i} className="self-end max-w-[85%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-[13.5px] whitespace-pre-line">
                                            {item.content}
                                        </div>
                                    ) : (
                                        <AssistantBubble key={i}><ChatMarkdown text={item.content} /></AssistantBubble>
                                    );
                                })}

                                {streamingText && <AssistantBubble><ChatMarkdown text={streamingText} /></AssistantBubble>}
                                {sending && !streamingText && <TypingIndicator note={waitNote(waitSecs)} />}

                                {!sending && chips.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pl-9">
                                        {chips.map((c) => (
                                            <button
                                                key={typeof c === 'string' ? c : c.label}
                                                onClick={() => sendText(typeof c === 'string' ? c : c.text)}
                                                className="text-xs px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 transition"
                                            >
                                                {typeof c === 'string' ? c : c.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-100 bg-white shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                                <form onSubmit={handleSubmit} className="p-2.5 pb-1.5 flex gap-2">
                                    <input
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        placeholder="Type your message…"
                                        disabled={sending || !conversationId}
                                        className="flex-1 min-w-0 border border-gray-200 rounded-full px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
                                    />
                                    <button
                                        type="submit"
                                        disabled={sending || !input.trim() || !conversationId}
                                        className="bg-indigo-600 text-white w-11 h-11 sm:w-9 sm:h-9 shrink-0 rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center"
                                        aria-label="Send"
                                    >
                                        ➤
                                    </button>
                                </form>
                                <p className="text-[10px] text-gray-400 text-center pb-2 px-3">
                                    I'm an AI, so I can slip up. You always confirm before anything changes.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
}

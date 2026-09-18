// Small dismissible-free callout pointing at the floating ChatbotWidget —
// shown on both Standard and Platinum company pages and all candidate pages
// (the AI assistant itself carries no tier gating, only a subscription gate;
// this is just making sure everyone actually notices it exists). Clicking it
// dispatches the same event ChatbotWidget listens for to open itself, rather
// than duplicating any chat UI here.
export const OPEN_CHATBOT_EVENT = 'ladderstep:open-chatbot';

export default function AiAssistantPromo({ text }) {
    return (
        <button
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CHATBOT_EVENT))}
            className="w-full flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3 mb-6 text-sm text-left hover:bg-indigo-100 transition"
        >
            <span className="text-indigo-800">
                <strong>✨ AI Assistant</strong> — {text}
            </span>
            <span className="text-indigo-600 font-semibold text-xs shrink-0 whitespace-nowrap">Try it →</span>
        </button>
    );
}

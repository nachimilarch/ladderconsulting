import { askAssistant } from '../../utils/assistant';

const PROMPTS = [
    { icon: '✏️', label: 'Polish my profile', text: 'Polish my profile' },
    { icon: '🔍', label: 'Find jobs that match me', text: 'Find jobs that match me' },
    { icon: '📨', label: 'Help me apply', text: 'Help me apply to a job' },
    { icon: '💡', label: 'What should I improve?', text: 'What should I improve on my profile?' },
];

// Tells the candidate what the AI assistant does for them, with one-tap starters.
export default function AssistantPanel({ subscribed, price }) {
    return (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
            <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-sm flex items-center justify-center">✨</span>
                        Let AI do the heavy lifting
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Your assistant can rewrite your profile, rank jobs by fit, and prepare applications for you.
                    </p>
                </div>
                <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${subscribed ? 'bg-green-100 text-green-700' : 'bg-white text-gray-500 border border-gray-200'}`}>
                    {subscribed ? 'On' : `₹${price || 299}/mo`}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                {PROMPTS.map((p) => (
                    <button
                        key={p.label}
                        onClick={() => askAssistant(p.text)}
                        className="flex items-center gap-3 text-left bg-white border border-indigo-100 rounded-xl px-4 py-3 hover:border-indigo-300 hover:shadow-sm transition active:scale-[0.99]"
                    >
                        <span className="text-xl" aria-hidden="true">{p.icon}</span>
                        <span className="text-sm font-medium text-gray-800">{p.label}</span>
                    </button>
                ))}
            </div>

            <p className="text-[11px] text-gray-400 mt-3 leading-snug">
                {subscribed
                    ? 'You always see a preview and confirm before anything changes.'
                    : 'Tap any option to see how to turn the assistant on. You always confirm before anything changes.'}
            </p>
        </div>
    );
}

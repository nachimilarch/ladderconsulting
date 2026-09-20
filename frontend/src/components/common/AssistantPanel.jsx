import { askAssistant } from '../../utils/assistant';

// Tells the person what the AI assistant does for them, with one-tap starters.
// `prompts` are { icon, label, text }; the persona-specific ones live with each dashboard.
export default function AssistantPanel({ subscribed, price, blurb, prompts }) {
    return (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
            <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-sm flex items-center justify-center">✨</span>
                        Let AI do the heavy lifting
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{blurb}</p>
                </div>
                <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${subscribed ? 'bg-success-100 text-success-700' : 'bg-white text-gray-500 border border-gray-200'}`}>
                    {subscribed ? 'On' : `₹${price || 299}/mo`}
                </span>
            </div>

            <div className={`grid grid-cols-1 gap-2 mt-4 ${prompts.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {prompts.map((p) => (
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

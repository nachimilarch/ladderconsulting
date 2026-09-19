// Tells people what the assistant can actually do, with one-tap examples, so they
// know what to ask. Keep this in step with the tools in backend chatbotTools.js.
const CAPABILITIES = {
    candidate: [
        { icon: '✏️', title: 'Polish your profile', text: "I'll rewrite your headline, summary and skills so they stand out.", example: 'Polish my profile' },
        { icon: '🔍', title: 'Find jobs that fit you', text: 'See open roles ranked by how well they match your skills.', example: 'Find jobs that match me' },
        { icon: '📨', title: 'Apply for you', text: "Pick a role and I'll prepare the application, or tap Apply on any job card.", example: 'Help me apply to a job' },
        { icon: '💡', title: 'Get profile advice', text: 'Find out what to improve to get noticed by more companies.', example: 'What should I improve on my profile?' },
    ],
    company: [
        { icon: '📝', title: 'Draft a job post', text: "Tell me the role and I'll write the posting for you to review.", example: 'Draft a job post' },
        { icon: '✨', title: 'Improve a job', text: "I'll sharpen the description of a job you've already posted.", example: 'Improve one of my job descriptions' },
        { icon: '🎯', title: 'Find matching candidates', text: 'Rank people in the talent pool by how well they fit one of your jobs.', example: 'Find candidates for my job' },
    ],
};

const LIMITS = {
    candidate: "I can't upload your resume or schedule interviews yet. Use the menu for those.",
    company: "I can't contact candidates, schedule interviews or send offers yet. Use the menu for those.",
};

export default function ChatHelp({ persona, onAsk, disabled }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-3.5 w-full">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">What I can help with</p>
            <div className="space-y-3">
                {(CAPABILITIES[persona] || []).map((c) => (
                    <div key={c.title} className="flex gap-2.5">
                        <span className="text-lg leading-none mt-0.5">{c.icon}</span>
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-gray-800 leading-tight">{c.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{c.text}</p>
                            <button
                                onClick={() => onAsk?.(c.example)}
                                disabled={disabled}
                                className="mt-1.5 text-xs px-2.5 py-1 rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 disabled:opacity-50 transition"
                            >
                                Try: “{c.example}”
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-3 pt-2.5 border-t border-gray-100 leading-snug">
                I always show you a preview and wait for your OK before anything changes. {LIMITS[persona]}
            </p>
        </div>
    );
}

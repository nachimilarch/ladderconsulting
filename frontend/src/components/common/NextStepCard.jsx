import { Link } from 'react-router-dom';
import { askAssistant } from '../../utils/assistant';

const TONES = {
    indigo: 'from-indigo-600 to-violet-600',
    amber: 'from-warning-500 to-warning-600',
    blue: 'from-sky-600 to-indigo-600',
    green: 'from-success-500 to-success-700',
};

// The one thing the person should do right now (candidate: journey.js, hiring staff: hrWorkflow.js).
export default function NextStepCard({ next }) {
    return (
        <div className={`rounded-2xl bg-gradient-to-br ${TONES[next.tone] || TONES.indigo} text-white p-5 sm:p-6 shadow-md`}>
            <p className="text-[11px] uppercase tracking-wider font-semibold opacity-80">
                {next.urgent ? 'Needs your attention' : 'Your next step'}
            </p>
            <div className="flex items-start gap-3 mt-2">
                <span className="text-3xl leading-none mt-0.5" aria-hidden="true">{next.icon}</span>
                <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold leading-snug text-white">{next.title}</h2>
                    <p className="text-sm opacity-90 mt-1 leading-relaxed">{next.text}</p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Link
                    to={next.to}
                    className="inline-flex items-center justify-center bg-white text-gray-900 font-semibold text-sm px-5 py-3 sm:py-2.5 rounded-xl hover:bg-gray-50 transition shadow-sm"
                >
                    {next.cta} →
                </Link>
                {next.ai && (
                    <button
                        onClick={() => askAssistant(next.ai)}
                        className="inline-flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 text-white font-semibold text-sm px-5 py-3 sm:py-2.5 rounded-xl transition"
                    >
                        ✨ Let AI help
                    </button>
                )}
            </div>
        </div>
    );
}

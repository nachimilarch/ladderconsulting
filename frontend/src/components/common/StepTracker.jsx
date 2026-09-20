import { Link } from 'react-router-dom';

// One stepper for every portal. Each step: { key, label, detail, to, done?, current?, attention?, count? }.
// done = green tick, attention = amber (with its count) because something is waiting,
// current = the next stage to work on, otherwise a plain numbered circle.
export default function StepTracker({ title, steps }) {
    return (
        <div className="card-p">
            <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
            <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
                {steps.map((s, i) => (
                    <li key={s.key} className="relative">
                        {i < steps.length - 1 && (
                            <span className={`absolute top-4 left-1/2 w-full h-0.5 ${s.done ? 'bg-success-400' : 'bg-gray-200'}`} aria-hidden="true" />
                        )}
                        <Link to={s.to} className="relative flex flex-col items-center text-center group">
                            <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ${
                                s.attention ? 'bg-warning-500 border-warning-500 text-white ring-4 ring-warning-100'
                                : s.done ? 'bg-success-500 border-success-500 text-white'
                                : s.current ? 'bg-white border-brand-600 text-brand-700 ring-4 ring-brand-100'
                                : 'bg-white border-gray-200 text-gray-400 group-hover:border-brand-400'
                            }`}>
                                {s.attention && s.count ? s.count : s.done ? '✓' : i + 1}
                            </span>
                            <span className={`mt-2 text-[11px] sm:text-xs leading-tight ${
                                s.attention ? 'font-bold text-warning-800'
                                : s.current ? 'font-bold text-brand-700'
                                : s.done ? 'font-semibold text-gray-800'
                                : 'text-gray-600'
                            }`}>
                                {s.label}
                            </span>
                            <span className={`mt-0.5 text-[10px] sm:text-[11px] leading-tight px-0.5 ${s.attention ? 'text-warning-700' : 'text-gray-400'}`}>
                                {s.detail}
                            </span>
                        </Link>
                    </li>
                ))}
            </ol>
        </div>
    );
}

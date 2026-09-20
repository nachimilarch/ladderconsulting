import { Link } from 'react-router-dom';

// Five stages in order. Done = green tick, current = highlighted, later = grey.
export default function JourneyStepper({ steps }) {
    return (
        <div className="card-p">
            <h3 className="font-semibold text-gray-800 mb-4">Your journey</h3>
            <ol className="grid grid-cols-5">
                {steps.map((s, i) => (
                    <li key={s.key} className="relative">
                        {i < steps.length - 1 && (
                            <span className={`absolute top-4 left-1/2 w-full h-0.5 ${s.done ? 'bg-green-400' : 'bg-gray-200'}`} aria-hidden="true" />
                        )}
                        <Link to={s.to} className="relative flex flex-col items-center text-center group">
                            <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ${
                                s.done ? 'bg-green-500 border-green-500 text-white'
                                : s.current ? 'bg-white border-indigo-600 text-indigo-700 ring-4 ring-indigo-100'
                                : 'bg-white border-gray-200 text-gray-400'
                            }`}>
                                {s.done ? '✓' : i + 1}
                            </span>
                            <span className={`mt-2 text-[11px] sm:text-xs leading-tight ${s.current ? 'font-bold text-indigo-700' : s.done ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                                {s.label}
                            </span>
                            <span className="mt-0.5 text-[10px] sm:text-[11px] leading-tight text-gray-400 px-0.5">{s.detail}</span>
                        </Link>
                    </li>
                ))}
            </ol>
        </div>
    );
}

import { Link } from 'react-router-dom';

// The five stages of the hiring workflow. A stage turns amber, with its count, when
// something in it is waiting for you; otherwise it just shows where things stand.
export default function WorkflowStepper({ steps }) {
    return (
        <div className="card-p">
            <h3 className="font-semibold text-gray-800 mb-4">Your hiring workflow</h3>
            <ol className="grid grid-cols-5">
                {steps.map((s, i) => (
                    <li key={s.key} className="relative">
                        {i < steps.length - 1 && (
                            <span className="absolute top-4 left-1/2 w-full h-0.5 bg-gray-200" aria-hidden="true" />
                        )}
                        <Link to={s.to} className="relative flex flex-col items-center text-center group">
                            <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ${
                                s.attention
                                    ? 'bg-warning-500 border-warning-500 text-white ring-4 ring-warning-100'
                                    : 'bg-white border-brand-200 text-brand-700 group-hover:border-brand-500'
                            }`}>
                                {s.attention && s.count ? s.count : i + 1}
                            </span>
                            <span className={`mt-2 text-[11px] sm:text-xs leading-tight ${s.attention ? 'font-bold text-warning-800' : 'font-semibold text-gray-800'}`}>
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

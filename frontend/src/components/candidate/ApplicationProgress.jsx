// Where an application stands, at a glance: Applied -> Shortlisted -> Interview -> Offer -> Hired.
const STAGES = ['Applied', 'Shortlisted', 'Interview', 'Offer', 'Hired'];
const AT = { applied: 0, under_review: 0, shortlisted: 1, interview_scheduled: 2, interviewed: 2, offer_sent: 3, hired: 4 };

export default function ApplicationProgress({ status }) {
    if (status === 'withdrawn') return null;
    if (status === 'rejected') {
        return <p className="mt-3 text-xs text-gray-400">This one didn't move forward. There are more roles that fit you, so keep applying.</p>;
    }
    const at = AT[status] ?? 0;
    const finished = status === 'hired';

    return (
        <ol className="mt-4 grid grid-cols-5" aria-label="Application progress">
            {STAGES.map((label, i) => {
                const done = i < at || finished;
                const current = i === at && !finished;
                return (
                    <li key={label} className="relative flex flex-col items-center text-center">
                        {i < STAGES.length - 1 && (
                            <span className={`absolute top-2.5 left-1/2 w-full h-0.5 ${i < at || finished ? 'bg-green-400' : 'bg-gray-200'}`} aria-hidden="true" />
                        )}
                        <span className={`relative z-10 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border-2 ${
                            done ? 'bg-green-500 border-green-500 text-white'
                            : current ? 'bg-white border-indigo-600 ring-4 ring-indigo-100'
                            : 'bg-white border-gray-200'
                        }`}>
                            {done ? '✓' : ''}
                        </span>
                        <span className={`mt-1.5 text-[10px] sm:text-[11px] leading-tight ${current ? 'font-bold text-indigo-700' : done ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                            {label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

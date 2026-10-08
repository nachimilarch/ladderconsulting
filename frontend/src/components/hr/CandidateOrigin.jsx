// How a candidate got into the portal, whether they are willing to look for a job, and when they
// last logged in. Shared by the executive Resume Sourcing screens and the admin Candidates page.
//
//   Registered = created an account and logs in themselves.
//   Sourced    = a record our executives uploaded from a resume; has never logged in.

const IST = { timeZone: 'Asia/Kolkata' };

const timeAgo = (d) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.round(hrs / 24);
    if (days < 60) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.round(days / 30);
    return `${months} months ago`;
};

const fmtLogin = (d) => new Date(d).toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const STATUS = {
    looking: { label: 'Looking for a job', cls: 'bg-success-50 text-success-700 ring-success-600/20', dot: 'bg-success-500' },
    open: { label: 'Open to offers', cls: 'bg-warning-50 text-warning-800 ring-warning-600/25', dot: 'bg-warning-500' },
    working: { label: 'Working, not looking', cls: 'bg-gray-100 text-gray-600 ring-gray-500/15', dot: 'bg-gray-400' },
};

export function StatusBadge({ status, updatedAt }) {
    const s = STATUS[status];
    if (!s) return <span className="text-[10px] text-gray-400">Job status not set</span>;
    return (
        <span
            title={updatedAt ? `Updated ${timeAgo(updatedAt)}` : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${s.cls}`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
            {s.label}
        </span>
    );
}

export function OriginBadge({ registered }) {
    return registered ? (
        <span title="Created an account and logs in themselves" className="badge-green text-[10px]">Registered</span>
    ) : (
        <span title="Uploaded from a resume by a Ladder executive. Has never logged in." className="badge-gray text-[10px]">Sourced by Ladder</span>
    );
}

// Origin, job status and login time on one tidy line, for a candidate card or a table cell.
export function CandidateOriginLine({ candidate, className = '' }) {
    const registered = !!Number(candidate.self_registered) || candidate.self_registered === true;
    return (
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
            <OriginBadge registered={registered} />
            {registered && <StatusBadge status={candidate.employment_status} updatedAt={candidate.employment_status_updated_at} />}
            {registered && candidate.last_login_at ? (
                <span className="text-[11px] text-gray-400" title={fmtLogin(candidate.last_login_at)}>
                    Last login {timeAgo(candidate.last_login_at)} · {fmtLogin(candidate.last_login_at)}
                </span>
            ) : (
                <span className="text-[11px] text-gray-400">Never logged in</span>
            )}
        </div>
    );
}

const AVAILABILITY = [
    ['', 'Any job status'],
    ['open_to_work', 'Open to work (looking or open to offers)'],
    ['looking', 'Looking for a job'],
    ['open', 'Working, open to offers'],
    ['working', 'Working, not looking'],
    ['unset', 'Status not set yet'],
];

// The switch at the top of a candidate list: who registered themselves vs who we sourced.
export function OriginFilters({ origin, onOrigin, availability, onAvailability, counts }) {
    const registered = counts?.registered ?? 0;
    const sourced = counts?.sourced ?? 0;
    const tabs = [
        ['', 'All', registered + sourced],
        ['registered', 'Registered themselves', registered],
        ['sourced', 'Sourced by Ladder', sourced],
    ];
    return (
        <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl bg-gray-100 p-1" role="group" aria-label="Candidate origin">
                {tabs.map(([value, label, n]) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() => onOrigin(value)}
                        aria-pressed={origin === value}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${origin === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        {label} <span className="ml-0.5 text-xs text-gray-400">{n}</span>
                    </button>
                ))}
            </div>
            <select
                value={availability}
                onChange={(e) => onAvailability(e.target.value)}
                className="form-input-sm max-w-[19rem]"
                aria-label="Job status"
            >
                {AVAILABILITY.map(([v, l]) => (
                    <option key={v} value={v}>{v === 'open_to_work' && counts ? `${l} (${counts.open_to_work ?? 0})` : l}</option>
                ))}
            </select>
        </div>
    );
}

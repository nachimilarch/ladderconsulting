import { Link } from 'react-router-dom';
import { JOB_TYPE, WORK_MODE, salaryRange } from './chatFormat';

// null = the engine couldn't score it (e.g. the profile has no skills yet).
export function MatchBadge({ score }) {
    if (score === null || score === undefined) {
        return <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">Not scored yet</span>;
    }
    const cls = score >= 70 ? 'bg-green-100 text-green-700'
        : score >= 40 ? 'bg-amber-100 text-amber-700'
        : 'bg-orange-100 text-orange-700';
    return <span className={`text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${cls}`}>{score}% match</span>;
}

const Chip = ({ children, tone = 'gray' }) => (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tone === 'violet' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-gray-100 text-gray-600'}`}>
        {children}
    </span>
);

export function JobMatchCards({ jobs, onApply, disabled }) {
    return (
        <div className="flex flex-col gap-2 w-full">
            {jobs.map((j) => {
                const salary = salaryRange(j.salary_min, j.salary_max);
                return (
                    <div key={j.job_id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 hover:shadow transition">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 leading-snug">{j.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {j.company}{j.location ? ` · ${j.location}` : ''}
                                </p>
                            </div>
                            <MatchBadge score={j.match_score} />
                        </div>

                        <div className="flex flex-wrap gap-1 mt-2">
                            {j.job_type && <Chip>{JOB_TYPE[j.job_type] || j.job_type}</Chip>}
                            {j.work_mode && <Chip>{WORK_MODE[j.work_mode] || j.work_mode}</Chip>}
                            {salary && <Chip>{salary}</Chip>}
                            {(j.matched_skills || []).map((s) => <Chip key={s} tone="violet">{s}</Chip>)}
                        </div>

                        <div className="mt-2.5 flex justify-end">
                            {j.already_applied ? (
                                <span className="text-xs font-medium text-green-700">✓ You've applied</span>
                            ) : (
                                <button
                                    onClick={() => onApply?.(j)}
                                    disabled={disabled}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                                >
                                    Apply with my profile
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function CandidateMatchCards({ jobTitle, matches }) {
    return (
        <div className="flex flex-col gap-2 w-full">
            {jobTitle && <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Best fits for {jobTitle}</p>}
            {matches.map((m) => (
                <div key={m.candidate_id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                    <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                            {(m.name || 'C')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                                {m.is_premium && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">⭐ Premium</span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {[m.headline, m.experience_years != null ? `${m.experience_years} yrs experience` : null].filter(Boolean).join(' · ') || 'Profile details in Talent Pool'}
                            </p>
                        </div>
                        <MatchBadge score={m.match_score} />
                    </div>
                    {m.matched_skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {m.matched_skills.map((s) => <Chip key={s} tone="violet">{s}</Chip>)}
                        </div>
                    )}
                </div>
            ))}
            <Link to="/company/talent" className="text-xs font-semibold text-indigo-600 hover:underline self-end">
                See them in Talent Pool →
            </Link>
        </div>
    );
}

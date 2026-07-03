import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { recruitmentAPI } from '../../api/recruitment';
import toast from 'react-hot-toast';

// ── Shared helpers ────────────────────────────────────────────────────────────
const fmtExp  = (min, max) => { const lo = min != null ? parseFloat(min) : null; const hi = max != null ? parseFloat(max) : null; if (lo != null && hi != null) return `${lo}–${hi} yrs`; if (lo != null) return `${lo}+ yrs`; if (hi != null) return `up to ${hi} yrs`; return ''; };
const fmtSal  = (min, max) => { const lac = n => `₹${(parseFloat(n)/100000).toLocaleString('en-IN',{maximumFractionDigits:1})}L`; if (min && max) return `${lac(min)}–${lac(max)}`; if (min) return `${lac(min)}+`; if (max) return `up to ${lac(max)}`; return ''; };
const ITEM_ST = { pending:'badge-gray', parsing:'badge-blue', done:'badge-green', skipped:'badge-yellow', failed:'badge-red' };
const ACCEPTED = ['.pdf','.doc','.docx'];
const MAX_FILES = 20;
const MAX_MB    = 5 * 1024 * 1024;
const SCORE_COLOR = (s) => s >= 70 ? 'text-green-600' : s >= 40 ? 'text-yellow-600' : 'text-red-500';
const SCORE_BG    = (s) => s >= 70 ? 'bg-green-50 border-green-200 text-green-700' : s >= 40 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-600';

const parseBatchNote = (status, msg) => {
    if (!msg) return { tag: null, text: null };
    if (msg.startsWith('[hired]'))            return { tag: 'hired',     text: msg.replace('[hired]', '').trim() };
    if (msg.startsWith('[duplicate-job]'))    return { tag: 'dup-job',   text: msg.replace('[duplicate-job]', '').trim() };
    if (msg.startsWith('[existing-profile]')) return { tag: 'existing',  text: msg.replace('[existing-profile]', '').trim() };
    if (msg.startsWith('[pool]'))             return { tag: 'pool',      text: msg.replace('[pool]', '').trim() };
    return { tag: null, text: msg };
};

function BatchResultCell({ status, errorMessage }) {
    const { tag, text } = parseBatchNote(status, errorMessage);
    if (status === 'done' && tag === 'existing') return <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded-full" title={text}>Pool profile matched</span>;
    if (status === 'done' && tag === 'pool')     return <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full" title={text}>Added to pool</span>;
    if (status === 'done')                       return <span className="text-[10px] text-green-600 font-medium">New profile created</span>;
    if (status === 'skipped' && tag === 'hired') return <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full" title={text}>Hired — off market</span>;
    if (status === 'skipped' && tag === 'dup-job') return <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full" title={text}>Already in this JD</span>;
    if (status === 'skipped')                    return <span className="text-[10px] text-yellow-700">{text || 'Skipped'}</span>;
    if (status === 'failed')                     return <span className="text-[10px] text-red-600">{text || 'Failed'}</span>;
    return <span className="text-[10px] text-gray-400">—</span>;
}

// ── HR Candidate Profile Drawer (full PII, no masking) ────────────────────────
function CandidateProfileDrawer({ candidateId, jobId, onClose }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        recruitmentAPI.getCandidateProfile(candidateId, jobId)
            .then(r => setData(r.data?.data || null))
            .catch(() => toast.error('Failed to load candidate profile.'))
            .finally(() => setLoading(false));
    }, [candidateId, jobId]);

    const education = (() => {
        try { return Array.isArray(data?.education) ? data.education : JSON.parse(data?.education || '[]'); }
        catch { return []; }
    })();

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40" onClick={onClose} />
            <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <h2 className="font-semibold text-gray-900 text-base">Candidate Profile</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center flex-1 text-gray-400 text-sm">Loading…</div>
                ) : !data ? (
                    <div className="flex items-center justify-center flex-1 text-gray-400 text-sm">Could not load profile.</div>
                ) : (
                    <div className="px-5 py-4 flex flex-col gap-5">
                        {/* Identity */}
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-base font-bold shrink-0">
                                    {(data.candidate_name || 'C')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{data.candidate_name}</p>
                                    {data.headline && <p className="text-xs text-gray-500">{data.headline}</p>}
                                </div>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-2 text-xs text-gray-500">
                                {data.candidate_email && <span>✉ {data.candidate_email}</span>}
                                {data.candidate_phone && <span>📞 {data.candidate_phone}</span>}
                                {data.linkedin_url   && <a href={data.linkedin_url}  target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">LinkedIn ↗</a>}
                                {data.portfolio_url  && <a href={data.portfolio_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Portfolio ↗</a>}
                            </div>
                        </div>

                        {/* Fit score (when job context provided) */}
                        {jobId && data.fit_score != null && (
                            <div className={`rounded-xl border px-4 py-3 ${SCORE_BG(data.fit_score)}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide">Fit Score</span>
                                    <span className="text-lg font-bold">{data.fit_score}%</span>
                                </div>
                                {data.matched_skills?.length > 0 && (
                                    <div className="mb-1">
                                        <p className="text-[10px] font-medium mb-1 opacity-70">Matched</p>
                                        <div className="flex flex-wrap gap-1">
                                            {data.matched_skills.map(s => <span key={s} className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded capitalize">{s}</span>)}
                                        </div>
                                    </div>
                                )}
                                {data.missing_skills?.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-medium mb-1 opacity-70">Missing</p>
                                        <div className="flex flex-wrap gap-1">
                                            {data.missing_skills.map(s => <span key={s} className="text-[10px] bg-white/60 text-gray-500 px-1.5 py-0.5 rounded line-through capitalize">{s}</span>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quick stats */}
                        <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-500">
                            {data.total_experience != null && <span>💼 {parseFloat(data.total_experience).toFixed(1)} yrs exp</span>}
                            {data.current_location && <span>📍 {data.current_location}</span>}
                            {data.notice_period_days != null && <span>🕐 {data.notice_period_days}d notice</span>}
                            {data.expected_salary   && <span>💰 ₹{(parseFloat(data.expected_salary)/100000).toFixed(1)}L/yr expected</span>}
                        </div>

                        {/* Summary */}
                        {data.summary && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Summary</h3>
                                <p className="text-sm text-gray-700 leading-relaxed">{data.summary}</p>
                            </div>
                        )}

                        {/* Skills */}
                        {data.skills?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Skills</h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {data.skills.map(s => (
                                        <span key={s.name} className="bg-indigo-50 text-indigo-700 text-[11px] px-2 py-1 rounded-full border border-indigo-100 capitalize">
                                            {s.name}{s.years_exp ? ` · ${s.years_exp}y` : ''}{s.proficiency && s.proficiency !== 'intermediate' ? ` · ${s.proficiency}` : ''}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Education */}
                        {education.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Education</h3>
                                <div className="flex flex-col gap-2">
                                    {education.map((e, i) => (
                                        <div key={i} className="text-sm">
                                            <p className="font-medium text-gray-800">{e.degree}{e.field ? ` in ${e.field}` : ''}</p>
                                            {e.institution && <p className="text-xs text-gray-500">{e.institution}{e.end_year ? ` · ${e.end_year}` : ''}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Resumes on file */}
                        {data.resumes?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Resumes on file</h3>
                                <div className="flex flex-col gap-1">
                                    {data.resumes.map(r => (
                                        <div key={r.id} className="flex items-center gap-2 text-xs text-gray-600">
                                            <span className="text-gray-300">📄</span>
                                            <span className="truncate flex-1">{r.file_name}</span>
                                            {r.is_primary ? <span className="badge-blue text-[10px] shrink-0">Primary</span> : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Job Picker (shared between Upload + Pool tabs) ────────────────────────────
function JobPicker({ jobs, selected, onSelect }) {
    const [q, setQ] = useState('');
    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        return s ? jobs.filter(j => j.title.toLowerCase().includes(s) || j.company_name.toLowerCase().includes(s)) : jobs;
    }, [jobs, q]);

    return (
        <div className="card-p">
            <h2 className="section-title mb-2">Select Job Posting</h2>
            <input type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search title or company…" className="form-input-sm w-full mb-3" />
            <div className="max-h-72 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {!filtered.length && <p className="text-sm text-gray-400 py-6 text-center">No active job postings.</p>}
                {filtered.map(j => (
                    <button key={j.id} type="button" onClick={() => onSelect(j)}
                        className={`text-left rounded-xl border px-4 py-3 transition ${selected?.id === j.id
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                        <div className="font-semibold text-sm text-gray-900">{j.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{j.company_name}{j.location ? ` · ${j.location}` : ''}{j.openings ? ` · ${j.openings} opening(s)` : ''}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{j.applicant_count} applicant(s) · {j.sourced_count} sourced by Ladder</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── JD Detail block ───────────────────────────────────────────────────────────
function JDDetail({ job, jobDetail, loading }) {
    if (!job) return null;
    return (
        <div className="card-p mb-6">
            <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                    <h2 className="text-lg font-display font-bold text-gray-900">{jobDetail?.title || job.title}</h2>
                    <p className="text-sm text-gray-500">{jobDetail?.company_name || job.company_name}{jobDetail?.industry ? ` · ${jobDetail.industry}` : ''}</p>
                </div>
                <span className="badge-blue shrink-0">Active Requirement</span>
            </div>
            {loading ? <p className="text-sm text-gray-400 py-4">Loading…</p> : !jobDetail ? null : (
                <>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {jobDetail.location && <span className="badge-gray">📍 {jobDetail.location}</span>}
                        {jobDetail.work_mode && <span className="badge-gray capitalize">{jobDetail.work_mode.replace('_',' ')}</span>}
                        {jobDetail.job_type  && <span className="badge-gray capitalize">{jobDetail.job_type.replace('_',' ')}</span>}
                        {(jobDetail.experience_min != null || jobDetail.experience_max != null) && <span className="badge-gray">💼 {fmtExp(jobDetail.experience_min, jobDetail.experience_max)}</span>}
                        {(jobDetail.salary_min || jobDetail.salary_max) && <span className="badge-gray">💰 {fmtSal(jobDetail.salary_min, jobDetail.salary_max)}</span>}
                        {jobDetail.openings && <span className="badge-gray">{jobDetail.openings} opening(s)</span>}
                    </div>
                    {(jobDetail.required_skills?.length > 0 || jobDetail.preferred_skills?.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {jobDetail.required_skills?.length > 0 && (
                                <div><h3 className="section-title">Must-have</h3>
                                    <div className="flex flex-wrap gap-1.5">{jobDetail.required_skills.map(s => <span key={s} className="badge-green capitalize">{s}</span>)}</div>
                                </div>
                            )}
                            {jobDetail.preferred_skills?.length > 0 && (
                                <div><h3 className="section-title">Nice-to-have</h3>
                                    <div className="flex flex-wrap gap-1.5">{jobDetail.preferred_skills.map(s => <span key={s} className="badge-gray capitalize">{s}</span>)}</div>
                                </div>
                            )}
                        </div>
                    )}
                    {jobDetail.description && (
                        <details className="mt-3">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Show full description</summary>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mt-2">{jobDetail.description}</p>
                        </details>
                    )}
                </>
            )}
        </div>
    );
}

// ── Pool Card (Assign from Pool tab) ─────────────────────────────────────────
function PoolCard({ candidate, jobSelected, onAssign, assigning, onViewProfile, jobId }) {
    const exp = candidate.total_experience != null ? `${candidate.total_experience} yr${candidate.total_experience !== 1 ? 's' : ''}` : null;
    return (
        <div className={`bg-white rounded-2xl border shadow-sm p-4 transition ${candidate.already_applied ? 'border-green-200 opacity-90' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-sm text-gray-900">{candidate.candidate_name}</span>
                        {candidate.already_applied && <span className="badge-green text-[10px]">Assigned ✓</span>}
                        {!candidate.latest_resume_id && <span className="badge-yellow text-[10px]">No resume</span>}
                        {candidate.already_applied && candidate.fit_score != null && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${SCORE_BG(candidate.fit_score)}`}>
                                {candidate.fit_score}% fit
                            </span>
                        )}
                    </div>
                    {candidate.headline && <p className="text-xs text-gray-600 mb-1 truncate">{candidate.headline}</p>}
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                        {exp && <span>💼 {exp}</span>}
                        {candidate.current_location && <span>📍 {candidate.current_location}</span>}
                        {candidate.notice_period_days != null && <span>🕐 {candidate.notice_period_days}d notice</span>}
                        {candidate.expected_salary && <span>💰 {fmtSal(candidate.expected_salary)}</span>}
                    </div>
                    {candidate.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {candidate.skills.slice(0, 6).map(s => <span key={s} className="badge-gray text-[10px] capitalize">{s}</span>)}
                            {candidate.skills.length > 6 && <span className="text-[10px] text-gray-400">+{candidate.skills.length - 6}</span>}
                        </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{candidate.total_applications || 0} application(s) on record</p>
                </div>
                <div className="shrink-0 flex flex-col gap-1.5 items-end">
                    <button
                        onClick={() => onViewProfile(candidate.candidate_id, jobId)}
                        className="text-[11px] text-indigo-600 hover:underline whitespace-nowrap"
                    >
                        View Profile
                    </button>
                    {candidate.already_applied ? (
                        <span className="text-xs text-green-600 font-medium">Assigned</span>
                    ) : !jobSelected ? (
                        <span className="text-[11px] text-gray-400">Select JD first</span>
                    ) : !candidate.latest_resume_id ? (
                        <span className="text-[11px] text-yellow-600">Upload resume first</span>
                    ) : (
                        <button
                            onClick={() => onAssign(candidate.candidate_id)}
                            disabled={assigning === candidate.candidate_id}
                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition whitespace-nowrap"
                        >
                            {assigning === candidate.candidate_id ? 'Assigning…' : 'Assign to JD'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Free Pool Card ────────────────────────────────────────────────────────────
function FreePoolCard({ candidate, onDelete, deleting, onViewProfile }) {
    const exp = candidate.total_experience != null ? `${candidate.total_experience} yr${candidate.total_experience !== 1 ? 's' : ''}` : null;
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
                <button
                    type="button"
                    onClick={() => onViewProfile(candidate.candidate_id, null)}
                    className="flex-1 min-w-0 text-left"
                >
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-sm text-gray-900 hover:text-indigo-700 transition">{candidate.candidate_name}</span>
                        {!candidate.latest_resume_id && <span className="badge-yellow text-[10px]">No resume</span>}
                        {candidate.total_applications > 0 && <span className="badge-blue text-[10px]">{candidate.total_applications} application(s)</span>}
                    </div>
                    {candidate.headline && <p className="text-xs text-gray-600 mb-1 truncate">{candidate.headline}</p>}
                    <p className="text-xs text-gray-400 truncate">{candidate.candidate_email}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400 mt-1">
                        {exp && <span>💼 {exp}</span>}
                        {candidate.current_location && <span>📍 {candidate.current_location}</span>}
                        {candidate.notice_period_days != null && <span>🕐 {candidate.notice_period_days}d notice</span>}
                    </div>
                    {candidate.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {candidate.skills.slice(0, 6).map(s => <span key={s} className="badge-gray text-[10px] capitalize">{s}</span>)}
                            {candidate.skills.length > 6 && <span className="text-[10px] text-gray-400">+{candidate.skills.length - 6}</span>}
                        </div>
                    )}
                </button>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-[11px] text-indigo-600">Click name to view</span>
                    <button
                        onClick={() => onDelete(candidate.candidate_id, candidate.candidate_name)}
                        disabled={deleting === candidate.candidate_id}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50 whitespace-nowrap"
                    >
                        {deleting === candidate.candidate_id ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Interest Card ─────────────────────────────────────────────────────────────
function InterestCard({ interest, jobs, onAssign, assigning, onViewProfile }) {
    const [jobOverride, setJobOverride] = useState(interest.job_id || '');
    const isHired = interest.is_hired;

    return (
        <div className={`bg-white rounded-2xl border shadow-sm p-4 transition ${
            isHired ? 'border-red-200 opacity-80' :
            !interest.is_read ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-gray-100'
        }`}>
            <div className="flex items-start gap-3">
                {!interest.is_read && !isHired && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
                {isHired && <span className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900">{interest.company_name}</span>
                            {isHired && (
                                <span className="text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">
                                    Candidate Hired — Unavailable
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-gray-400">{new Date(interest.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-xs text-gray-600">
                            Interested in: <span className={`font-medium ${isHired ? 'line-through text-gray-400' : 'text-gray-800'}`}>{interest.candidate_name}</span>
                            {interest.headline && <span className="text-gray-400"> · {interest.headline}</span>}
                        </p>
                        <button
                            onClick={() => onViewProfile(interest.candidate_id, null)}
                            className="text-[11px] text-indigo-600 hover:underline shrink-0"
                        >
                            View Profile
                        </button>
                    </div>
                    {interest.job_title && <p className="text-xs text-indigo-600 mb-1">For: {interest.job_title}</p>}
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-2">
                        {interest.total_experience != null && <span>💼 {interest.total_experience} yrs</span>}
                        {interest.current_location && <span>📍 {interest.current_location}</span>}
                    </div>
                    {interest.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {interest.skills.slice(0,5).map(s => <span key={s} className="badge-gray text-[10px] capitalize">{s}</span>)}
                        </div>
                    )}
                    <p className="text-xs text-gray-500 italic mb-3 line-clamp-2">{interest.interest_notes}</p>

                    {isHired ? (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            This candidate has been placed through LadderStep Human Consulting and is no longer available. Consider proposing an alternative candidate to {interest.company_name}.
                        </p>
                    ) : interest.already_assigned ? (
                        <span className="badge-green text-xs">Already assigned to this job ✓</span>
                    ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                            <select
                                value={jobOverride}
                                onChange={e => setJobOverride(e.target.value)}
                                className="form-input-sm flex-1 min-w-0 text-xs"
                            >
                                <option value="">— Select job to assign —</option>
                                {jobs.map(j => <option key={j.id} value={j.id}>{j.company_name} · {j.title}</option>)}
                            </select>
                            <button
                                onClick={() => onAssign(interest.notif_id, jobOverride || null)}
                                disabled={!jobOverride || assigning === interest.notif_id}
                                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition whitespace-nowrap"
                            >
                                {assigning === interest.notif_id ? 'Actioning…' : 'Assign & Notify'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ResumeSourcing() {
    const [tab, setTab] = useState('upload');

    // Shared state
    const [jobs, setJobs]               = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [jobDetail, setJobDetail]     = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Upload tab
    const [uploadMode, setUploadMode] = useState('jd');
    const [files, setFiles]           = useState([]);
    const [uploading, setUploading]   = useState(false);
    const [batches, setBatches]       = useState([]);
    const [expandedBatch, setExpandedBatch] = useState(null);
    const [batchDetail, setBatchDetail] = useState(null);
    const [dragOver, setDragOver]     = useState(false);
    const [deletingCandidate, setDeletingCandidate] = useState(null);
    const fileInputRef = useRef(null);
    const pollRef      = useRef(null);

    // Pool tab
    const [poolSearch, setPoolSearch] = useState('');
    const [poolSkill,  setPoolSkill]  = useState('');
    const [poolExpMin, setPoolExpMin] = useState('');
    const [poolExpMax, setPoolExpMax] = useState('');
    const [poolPage,   setPoolPage]   = useState(1);
    const [pool,       setPool]       = useState([]);
    const [poolTotal,  setPoolTotal]  = useState(0);
    const [poolLoading, setPoolLoading] = useState(false);
    const [assigning,  setAssigning]  = useState(null);

    // Interests tab
    const [interests,  setInterests]  = useState([]);
    const [intLoading, setIntLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [actioning,  setActioning]  = useState(null);

    // Free Pool tab
    const [fpSearch, setFpSearch] = useState('');
    const [fpSkill,  setFpSkill]  = useState('');
    const [fpExpMin, setFpExpMin] = useState('');
    const [fpExpMax, setFpExpMax] = useState('');
    const [fpPage,   setFpPage]   = useState(1);
    const [freePool, setFreePool] = useState([]);
    const [fpTotal,  setFpTotal]  = useState(0);
    const [fpLoading, setFpLoading] = useState(false);
    const [deletingFP, setDeletingFP] = useState(null);

    // Profile drawer
    const [profileOpen,   setProfileOpen]   = useState(false);
    const [profileCandId, setProfileCandId] = useState(null);
    const [profileJobId,  setProfileJobId]  = useState(null);

    const openProfile = useCallback((candidateId, jobId = null) => {
        setProfileCandId(candidateId);
        setProfileJobId(jobId || null);
        setProfileOpen(true);
    }, []);

    const closeProfile = useCallback(() => {
        setProfileOpen(false);
        setProfileCandId(null);
        setProfileJobId(null);
    }, []);

    // ── Data loaders ──────────────────────────────────────────────────────────
    const loadJobs = useCallback(() => {
        recruitmentAPI.listJobs()
            .then(r => setJobs(r.data?.data || []))
            .catch(() => toast.error('Failed to load jobs.'));
    }, []);

    const loadBatches = useCallback(() => {
        recruitmentAPI.listBatches()
            .then(r => setBatches(r.data?.data || []))
            .catch(console.error);
    }, []);

    const loadBatchDetail = useCallback((id) => {
        recruitmentAPI.getBatch(id).then(r => setBatchDetail(r.data?.data || null)).catch(console.error);
    }, []);

    const loadPool = useCallback(() => {
        if (!selectedJob) return;
        setPoolLoading(true);
        recruitmentAPI.listTalentPool({
            search: poolSearch, skill: poolSkill,
            experience_min: poolExpMin, experience_max: poolExpMax,
            page: poolPage, jobId: selectedJob.id,
        })
            .then(r => { setPool(r.data?.data || []); setPoolTotal(r.data?.total || 0); })
            .catch(() => toast.error('Failed to load talent pool.'))
            .finally(() => setPoolLoading(false));
    }, [selectedJob, poolSearch, poolSkill, poolExpMin, poolExpMax, poolPage]);

    const loadInterests = useCallback(() => {
        setIntLoading(true);
        recruitmentAPI.listTalentInterests()
            .then(r => { setInterests(r.data?.data || []); setUnreadCount(r.data?.unread_count || 0); })
            .catch(() => toast.error('Failed to load interest inbox.'))
            .finally(() => setIntLoading(false));
    }, []);

    const loadFreePool = useCallback(() => {
        setFpLoading(true);
        recruitmentAPI.listTalentPool({
            search: fpSearch, skill: fpSkill,
            experience_min: fpExpMin, experience_max: fpExpMax,
            page: fpPage,
        })
            .then(r => { setFreePool(r.data?.data || []); setFpTotal(r.data?.total || 0); })
            .catch(() => toast.error('Failed to load free pool.'))
            .finally(() => setFpLoading(false));
    }, [fpSearch, fpSkill, fpExpMin, fpExpMax, fpPage]);

    useEffect(() => { loadJobs(); loadBatches(); loadInterests(); loadFreePool(); }, [loadJobs, loadBatches, loadInterests, loadFreePool]);

    useEffect(() => {
        if (tab === 'pool' && selectedJob) loadPool();
    }, [tab, selectedJob, poolSearch, poolSkill, poolExpMin, poolExpMax, poolPage, loadPool]);

    useEffect(() => {
        if (tab === 'freepool') loadFreePool();
    }, [tab, fpSearch, fpSkill, fpExpMin, fpExpMax, fpPage, loadFreePool]);

    // Poll while any batch is processing
    useEffect(() => {
        const hasActive = batches.some(b => b.status === 'processing');
        if (hasActive && !pollRef.current) {
            pollRef.current = setInterval(() => {
                loadBatches();
                if (expandedBatch) loadBatchDetail(expandedBatch);
            }, 4000);
        }
        if (!hasActive && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    }, [batches, expandedBatch, loadBatches, loadBatchDetail]);

    const selectJob = (job) => {
        setSelectedJob(job);
        setJobDetail(null);
        setPoolPage(1);
        setLoadingDetail(true);
        recruitmentAPI.getJob(job.id)
            .then(r => setJobDetail(r.data?.data || null))
            .catch(() => toast.error('Failed to load job details.'))
            .finally(() => setLoadingDetail(false));
    };

    // ── Upload handlers ───────────────────────────────────────────────────────
    const addFiles = (incoming) => {
        const next = [...files];
        for (const f of incoming) {
            const ext = '.' + f.name.split('.').pop().toLowerCase();
            if (!ACCEPTED.includes(ext)) { toast.error(`${f.name}: only PDF, DOC, DOCX.`); continue; }
            if (f.size > MAX_MB) { toast.error(`${f.name}: exceeds 5MB.`); continue; }
            if (next.some(x => x.name === f.name && x.size === f.size)) continue;
            if (next.length >= MAX_FILES) { toast.error(`Max ${MAX_FILES} files.`); break; }
            next.push(f);
        }
        setFiles(next);
    };

    const handleUpload = async () => {
        if (uploadMode === 'jd' && !selectedJob) return toast.error('Select a job posting first.');
        if (!files.length) return toast.error('Add at least one resume.');
        setUploading(true);
        try {
            const r = uploadMode === 'jd'
                ? await recruitmentAPI.uploadResumes(selectedJob.id, files)
                : await recruitmentAPI.uploadResumesToPool(files);
            toast.success(r.data?.message || 'Upload started.');
            setFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadBatches();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed.');
        } finally { setUploading(false); }
    };

    const handleDeleteCandidate = async (candidateId, name) => {
        if (!window.confirm(`Delete profile for ${name || 'this candidate'}?`)) return;
        setDeletingCandidate(candidateId);
        try {
            await recruitmentAPI.deleteCandidate(candidateId);
            toast.success('Profile deleted.');
            if (expandedBatch) loadBatchDetail(expandedBatch);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete.');
        } finally { setDeletingCandidate(null); }
    };

    const toggleBatch = (id) => {
        if (expandedBatch === id) { setExpandedBatch(null); setBatchDetail(null); }
        else { setExpandedBatch(id); setBatchDetail(null); loadBatchDetail(id); }
    };

    // ── Pool handlers ─────────────────────────────────────────────────────────
    const handleAssign = async (candidateId) => {
        if (!selectedJob) return toast.error('Select a job posting first.');
        setAssigning(candidateId);
        try {
            const r = await recruitmentAPI.assignCandidateToJob(selectedJob.id, candidateId);
            toast.success(r.data?.message || 'Candidate assigned.');
            setPool(prev => prev.map(c => c.candidate_id === candidateId ? { ...c, already_applied: true } : c));
            loadJobs();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to assign candidate.');
        } finally { setAssigning(null); }
    };

    // ── Interest handlers ─────────────────────────────────────────────────────
    const handleActOnInterest = async (notifId, jobId) => {
        if (!jobId) return toast.error('Select a job posting to assign this candidate.');
        setActioning(notifId);
        try {
            const r = await recruitmentAPI.actOnTalentInterest(notifId, jobId);
            toast.success(r.data?.message || 'Candidate assigned and company notified.');
            setInterests(prev => prev.map(i => i.notif_id === notifId ? { ...i, is_read: true, already_assigned: true } : i));
            setUnreadCount(c => Math.max(0, c - 1));
            loadJobs();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to action interest.');
        } finally { setActioning(null); }
    };

    // ── Free Pool handlers ────────────────────────────────────────────────────
    const handleDeleteFromPool = async (candidateId, name) => {
        if (!window.confirm(`Permanently delete ${name || 'this candidate'} and all of their resumes? This cannot be undone.`)) return;
        setDeletingFP(candidateId);
        try {
            await recruitmentAPI.deleteCandidate(candidateId);
            toast.success('Candidate deleted.');
            setFreePool(prev => prev.filter(c => c.candidate_id !== candidateId));
            setFpTotal(t => Math.max(0, t - 1));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete candidate.');
        } finally { setDeletingFP(null); }
    };

    const POOL_LIMIT = 20;
    const totalPages   = Math.ceil(poolTotal / POOL_LIMIT);
    const fpTotalPages = Math.ceil(fpTotal / POOL_LIMIT);

    return (
        <div className="max-w-6xl mx-auto">
            {/* Profile drawer */}
            {profileOpen && profileCandId && (
                <CandidateProfileDrawer
                    candidateId={profileCandId}
                    jobId={profileJobId}
                    onClose={closeProfile}
                />
            )}

            <div className="mb-5">
                <h1 className="text-2xl font-bold text-gray-900">Resume Sourcing</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Upload new resumes, manage the free pool, assign existing pool candidates to client JDs, or action company interest requests.
                </p>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 border-b border-gray-200 mb-6">
                {[
                    { key: 'upload',    label: 'Upload Resumes' },
                    { key: 'freepool',  label: `Free Pool${fpTotal > 0 ? ` (${fpTotal})` : ''}` },
                    { key: 'pool',      label: 'Assign from Pool' },
                    { key: 'interests', label: `Company Interests${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.key
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── UPLOAD TAB ── */}
            {tab === 'upload' && (
                <>
                    <div className="flex gap-1.5 mb-5">
                        {[
                            { mode: 'jd',   icon: '🎯', label: 'Target a Job' },
                            { mode: 'pool', icon: '🗂️', label: 'Free Talent Pool' },
                        ].map(m => (
                            <button key={m.mode} type="button" onClick={() => setUploadMode(m.mode)}
                                className={`text-sm font-medium px-4 py-2 rounded-xl border transition ${uploadMode === m.mode
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                {m.icon} {m.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {uploadMode === 'jd' ? (
                            <JobPicker jobs={jobs} selected={selectedJob} onSelect={selectJob} />
                        ) : (
                            <div className="card-p">
                                <h2 className="section-title mb-2">Free Talent Pool</h2>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    Resumes uploaded here are parsed, profiled, and AI skill-tagged immediately —
                                    but <span className="font-medium text-gray-700">no application is created against any job</span>.
                                    Candidates land in <span className="font-medium text-gray-700">"Assign from Pool"</span>, ready
                                    for you or any executive to match to a JD later.
                                </p>
                            </div>
                        )}

                        <div className="card-p flex flex-col">
                            <h2 className="section-title">Upload Resumes</h2>
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles([...e.dataTransfer.files]); }}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
                            >
                                <p className="text-sm font-medium text-gray-700">Drag &amp; drop resumes here, or click to browse</p>
                                <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX · up to {MAX_FILES} files · 5MB each</p>
                                <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx"
                                    className="hidden" onChange={e => addFiles([...e.target.files])} />
                            </div>
                            {files.length > 0 && (
                                <div className="mt-3 flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                                    {files.map((f, i) => (
                                        <div key={`${f.name}-${i}`} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                                            <span className="truncate text-gray-700">{f.name}</span>
                                            <button type="button" onClick={() => setFiles(files.filter((_,idx)=>idx!==i))} className="text-red-500 hover:text-red-700 ml-2 shrink-0">✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="mt-auto pt-4">
                                {uploadMode === 'jd' && selectedJob && <p className="text-xs text-gray-500 mb-2">Sourcing for: <span className="font-semibold text-gray-700">{selectedJob.title}</span> — {selectedJob.company_name}</p>}
                                {uploadMode === 'pool' && <p className="text-xs text-gray-500 mb-2">These resumes go straight into the <span className="font-semibold text-gray-700">free talent pool</span> — no JD required.</p>}
                                <button onClick={handleUpload} disabled={uploading || (uploadMode === 'jd' && !selectedJob) || !files.length} className="btn-primary">
                                    {uploading ? 'Uploading…' : `Upload ${files.length || ''} Resume${files.length===1?'':'s'} & AI Parse`}
                                </button>
                            </div>
                        </div>
                    </div>

                    {uploadMode === 'jd' && <JDDetail job={selectedJob} jobDetail={jobDetail} loading={loadingDetail} />}

                    <h2 className="section-title mb-3">Upload History</h2>
                    {batches.length === 0 ? (
                        <div className="card p-10 text-center text-sm text-gray-400">No uploads yet.</div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {batches.map(b => (
                                <div key={b.id} className="card">
                                    <button type="button" onClick={() => toggleBatch(b.id)}
                                        className="w-full text-left p-5 flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {b.job_title ? (
                                                    <>
                                                        <span className="font-semibold text-sm text-gray-900">{b.job_title}</span>
                                                        <span className="text-xs text-gray-400">· {b.company_name}</span>
                                                    </>
                                                ) : (
                                                    <span className="badge-purple text-xs">🗂️ Free Talent Pool</span>
                                                )}
                                                <span className={b.status==='processing'?'badge-blue':b.status==='done'?'badge-green':'badge-red'}>
                                                    {b.status==='processing'?`processing ${b.processed_files}/${b.total_files}`:b.status}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {b.created_count} added · {b.skipped_count} skipped · {b.failed_count} failed · by {b.uploaded_by_name} · {new Date(b.created_at).toLocaleString()}
                                            </div>
                                            {b.status === 'processing' && (
                                                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 max-w-xs">
                                                    <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{width:`${b.total_files?(b.processed_files/b.total_files)*100:0}%`}} />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-gray-400 text-sm shrink-0">{expandedBatch===b.id?'▲':'▼'}</span>
                                    </button>
                                    {expandedBatch === b.id && (
                                        <div className="border-t border-gray-100 px-5 pb-4 overflow-x-auto">
                                            {!batchDetail ? <p className="text-sm text-gray-400 py-4">Loading…</p> : (
                                                <table className="table mt-2">
                                                    <thead><tr><th>File</th><th>Candidate</th><th>Email</th><th>Status</th><th>Fit Score</th><th>Result</th><th></th></tr></thead>
                                                    <tbody>
                                                        {batchDetail.items?.map(item => (
                                                            <tr key={item.id}>
                                                                <td className="max-w-[160px] truncate" title={item.file_name}>{item.file_name}</td>
                                                                <td>
                                                                    {item.candidate_id && item.status === 'done' ? (
                                                                        <button
                                                                            onClick={() => openProfile(item.candidate_id, b.job_id || null)}
                                                                            className="text-indigo-600 hover:underline text-xs font-medium text-left"
                                                                        >
                                                                            {item.extracted_name || '—'}
                                                                        </button>
                                                                    ) : (item.extracted_name || '—')}
                                                                </td>
                                                                <td>{item.extracted_email||'—'}</td>
                                                                <td><span className={ITEM_ST[item.status]||'badge-gray'}>{item.status}</span></td>
                                                                <td>
                                                                    {item.fit_score != null
                                                                        ? <span className={`font-semibold ${SCORE_COLOR(item.fit_score)}`}>{item.fit_score}%</span>
                                                                        : '—'}
                                                                </td>
                                                                <td><BatchResultCell status={item.status} errorMessage={item.error_message} /></td>
                                                                <td>
                                                                    {item.candidate_id && item.status !== 'skipped' && item.status !== 'failed' && (
                                                                        <button
                                                                            onClick={() => handleDeleteCandidate(item.candidate_id, item.extracted_name)}
                                                                            disabled={deletingCandidate === item.candidate_id}
                                                                            className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
                                                                        >
                                                                            {deletingCandidate === item.candidate_id ? '…' : 'Delete'}
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ── FREE POOL TAB ── */}
            {tab === 'freepool' && (
                <>
                    <div className="mb-4">
                        <h2 className="text-lg font-display font-bold text-gray-900">{fpTotal} candidate{fpTotal !== 1 ? 's' : ''} in the free pool</h2>
                        <p className="text-sm text-gray-500 mt-0.5">All sourced and self-registered candidates, available for placement. Click any name to view their full profile. Hired candidates are excluded.</p>
                    </div>
                    <div className="card-p mb-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <input value={fpSearch} onChange={e=>{setFpSearch(e.target.value);setFpPage(1);}} placeholder="Search name / headline…" className="form-input-sm col-span-2" />
                            <input value={fpSkill}  onChange={e=>{setFpSkill(e.target.value);setFpPage(1);}}  placeholder="Skill (e.g. React)" className="form-input-sm" />
                            <div className="flex gap-1">
                                <input type="number" value={fpExpMin} onChange={e=>{setFpExpMin(e.target.value);setFpPage(1);}} placeholder="Min exp" className="form-input-sm w-full" />
                                <input type="number" value={fpExpMax} onChange={e=>{setFpExpMax(e.target.value);setFpPage(1);}} placeholder="Max exp" className="form-input-sm w-full" />
                            </div>
                        </div>
                    </div>
                    {fpLoading ? (
                        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
                    ) : freePool.length === 0 ? (
                        <div className="card p-10 text-center text-sm text-gray-400">No candidates match these filters.</div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                {freePool.map(c => (
                                    <FreePoolCard key={c.candidate_id} candidate={c} onDelete={handleDeleteFromPool} deleting={deletingFP} onViewProfile={openProfile} />
                                ))}
                            </div>
                            {fpTotalPages > 1 && (
                                <div className="flex items-center justify-center gap-3 mt-2">
                                    <button disabled={fpPage<=1} onClick={()=>setFpPage(p=>p-1)} className="text-sm text-indigo-600 disabled:opacity-40 hover:underline">← Prev</button>
                                    <span className="text-sm text-gray-500">Page {fpPage} of {fpTotalPages}</span>
                                    <button disabled={fpPage>=fpTotalPages} onClick={()=>setFpPage(p=>p+1)} className="text-sm text-indigo-600 disabled:opacity-40 hover:underline">Next →</button>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* ── ASSIGN FROM POOL TAB ── */}
            {tab === 'pool' && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                        <div className="lg:col-span-2">
                            <JobPicker jobs={jobs} selected={selectedJob} onSelect={selectJob} />
                        </div>
                        <div className="lg:col-span-3">
                            {!selectedJob ? (
                                <div className="card-p h-full flex items-center justify-center text-sm text-gray-400 min-h-[120px]">
                                    Select a job posting on the left to browse matching candidates.
                                </div>
                            ) : (
                                <div className="card-p">
                                    <h2 className="section-title mb-3">Filter Candidates</h2>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <input value={poolSearch} onChange={e=>{setPoolSearch(e.target.value);setPoolPage(1);}} placeholder="Search name / headline…" className="form-input-sm col-span-2" />
                                        <input value={poolSkill}  onChange={e=>{setPoolSkill(e.target.value);setPoolPage(1);}}  placeholder="Skill (e.g. React)" className="form-input-sm" />
                                        <div className="flex gap-1">
                                            <input type="number" value={poolExpMin} onChange={e=>{setPoolExpMin(e.target.value);setPoolPage(1);}} placeholder="Min" className="form-input-sm w-full" />
                                            <input type="number" value={poolExpMax} onChange={e=>{setPoolExpMax(e.target.value);setPoolPage(1);}} placeholder="Max" className="form-input-sm w-full" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        {poolTotal} candidate{poolTotal !== 1 ? 's' : ''} in pool
                                        {selectedJob && <> · assigning to <span className="font-medium text-gray-600">{selectedJob.title} — {selectedJob.company_name}</span></>}
                                    </p>
                                    <p className="text-[11px] text-red-400 mt-1">Hired candidates are automatically excluded.</p>
                                    <p className="text-[11px] text-indigo-400 mt-0.5">Fit score shown on already-assigned candidates. Click "View Profile" to see full details.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedJob && <JDDetail job={selectedJob} jobDetail={jobDetail} loading={loadingDetail} />}

                    {selectedJob && (
                        poolLoading ? (
                            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading pool…</div>
                        ) : pool.length === 0 ? (
                            <div className="card p-10 text-center text-sm text-gray-400">No candidates match these filters.</div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                    {pool.map(c => (
                                        <PoolCard
                                            key={c.candidate_id}
                                            candidate={c}
                                            jobSelected={!!selectedJob}
                                            onAssign={handleAssign}
                                            assigning={assigning}
                                            onViewProfile={openProfile}
                                            jobId={selectedJob?.id}
                                        />
                                    ))}
                                </div>
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-3 mt-2">
                                        <button disabled={poolPage<=1} onClick={()=>setPoolPage(p=>p-1)} className="text-sm text-indigo-600 disabled:opacity-40 hover:underline">← Prev</button>
                                        <span className="text-sm text-gray-500">Page {poolPage} of {totalPages}</span>
                                        <button disabled={poolPage>=totalPages} onClick={()=>setPoolPage(p=>p+1)} className="text-sm text-indigo-600 disabled:opacity-40 hover:underline">Next →</button>
                                    </div>
                                )}
                            </>
                        )
                    )}
                </>
            )}

            {/* ── INTERESTS TAB ── */}
            {tab === 'interests' && (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-gray-600">Companies who expressed interest in pool candidates. Assign the candidate to their open JD to notify them.</p>
                        <button onClick={loadInterests} className="text-xs text-indigo-600 hover:underline">Refresh</button>
                    </div>
                    {intLoading ? (
                        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
                    ) : interests.length === 0 ? (
                        <div className="card p-12 text-center shadow-sm">
                            <div className="text-4xl mb-3">📩</div>
                            <h3 className="font-semibold text-gray-700 mb-1">No interest requests yet</h3>
                            <p className="text-sm text-gray-500">When a hiring company expresses interest in a talent pool candidate, it appears here for you to action.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {interests.map(interest => (
                                <InterestCard
                                    key={interest.notif_id}
                                    interest={interest}
                                    jobs={jobs}
                                    onAssign={handleActOnInterest}
                                    assigning={actioning}
                                    onViewProfile={openProfile}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

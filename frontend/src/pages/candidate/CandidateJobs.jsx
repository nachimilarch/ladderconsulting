import { useEffect, useState, useCallback } from 'react';
import { jobAPI, applicationAPI } from '../../api/candidate';

const JOB_TYPE_MAP = {
    full_time:  { label: 'Full Time',   cls: 'badge-blue' },
    part_time:  { label: 'Part Time',   cls: 'badge-yellow' },
    contract:   { label: 'Contract',    cls: 'badge-purple' },
    internship: { label: 'Internship',  cls: 'badge-green' },
};

const formatSalary = (min, max) => {
    if (!min && !max) return 'Not disclosed';
    const fmt = (v) => `₹${(v / 100000).toFixed(1)}L`;
    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    return min ? `From ${fmt(min)}` : `Up to ${fmt(max)}`;
};

const formatExp = (min, max) => {
    if (min == null && max == null) return null;
    if (min != null && max != null) return `${min}–${max} yrs`;
    if (min != null) return `${min}+ yrs`;
    return `up to ${max} yrs`;
};

// ── Full job requirement modal ────────────────────────────────────────────────
function JobDetailModal({ jobId, isHired, onClose, onApply, applying, applyMsg, appliedOverride }) {
    const [job, setJob]       = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        jobAPI.getJob(jobId)
            .then(({ data }) => setJob(data.data || null))
            .catch(() => setJob(null))
            .finally(() => setLoading(false));
    }, [jobId]);

    const typeInfo = job ? (JOB_TYPE_MAP[job.job_type] || { label: job.job_type, cls: 'badge-gray' }) : null;
    const isApplied = Boolean(job?.already_applied) || Boolean(appliedOverride);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading job details…</div>
                ) : !job ? (
                    <div className="p-10 text-center text-gray-400 text-sm">
                        This job is no longer available.
                        <div className="mt-4"><button onClick={onClose} className="text-indigo-600 hover:underline text-sm">Close</button></div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4 z-10">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h2 className="text-lg font-bold text-gray-900">{job.title}</h2>
                                    {typeInfo && <span className={typeInfo.cls}>{typeInfo.label}</span>}
                                    {job.work_mode && <span className="badge-gray capitalize">{job.work_mode.replace('_', '-')}</span>}
                                </div>
                                <p className="text-sm text-gray-600">
                                    {job.company_name}
                                    {job.industry && <span className="text-gray-400"> • {job.industry}</span>}
                                    {job.location && <span className="text-gray-400"> • {job.location}</span>}
                                </p>
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0">✕</button>
                        </div>

                        <div className="px-6 py-5 flex flex-col gap-5">
                            {/* Key facts */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                <div><p className="text-xs text-gray-400">Salary</p><p className="font-medium text-gray-700">{formatSalary(job.salary_min, job.salary_max)}</p></div>
                                {formatExp(job.experience_min, job.experience_max) && (
                                    <div><p className="text-xs text-gray-400">Experience</p><p className="font-medium text-gray-700">{formatExp(job.experience_min, job.experience_max)}</p></div>
                                )}
                                {job.openings != null && <div><p className="text-xs text-gray-400">Openings</p><p className="font-medium text-gray-700">{job.openings}</p></div>}
                                <div><p className="text-xs text-gray-400">Posted</p><p className="font-medium text-gray-700">{new Date(job.created_at).toLocaleDateString()}</p></div>
                                {job.deadline && <div><p className="text-xs text-gray-400">Apply by</p><p className="font-medium text-orange-600">{new Date(job.deadline).toLocaleDateString()}</p></div>}
                            </div>

                            {/* Required / preferred skills */}
                            {(job.required_skills?.length > 0 || job.preferred_skills?.length > 0) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {job.required_skills?.length > 0 && (
                                        <div>
                                            <h3 className="section-title">Must-have skills</h3>
                                            <div className="flex flex-wrap gap-1.5">
                                                {job.required_skills.map(s => <span key={s} className="badge-green capitalize">{s}</span>)}
                                            </div>
                                        </div>
                                    )}
                                    {job.preferred_skills?.length > 0 && (
                                        <div>
                                            <h3 className="section-title">Nice-to-have skills</h3>
                                            <div className="flex flex-wrap gap-1.5">
                                                {job.preferred_skills.map(s => <span key={s} className="badge-gray capitalize">{s}</span>)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Full description */}
                            {job.description && (
                                <div>
                                    <h3 className="section-title">Job Description</h3>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{job.description}</p>
                                </div>
                            )}

                            {/* Full requirements */}
                            {job.requirements && (
                                <div>
                                    <h3 className="section-title">Requirements</h3>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{job.requirements}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer action */}
                        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between gap-3">
                            <div className="text-xs">
                                {applyMsg && (
                                    <span className={applyMsg.type === 'success' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{applyMsg.text}</span>
                                )}
                            </div>
                            {job.is_hired || isHired ? (
                                <span className="badge-gray">Hired — off the market</span>
                            ) : isApplied ? (
                                <span className="badge-green">Applied ✓</span>
                            ) : (
                                <button
                                    onClick={() => onApply(job.id)}
                                    disabled={applying === job.id}
                                    className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
                                >
                                    {applying === job.id ? 'Applying…' : 'Apply Now'}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function CandidateJobs() {
    const [jobs, setJobs]       = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]   = useState('');
    const [page, setPage]       = useState(1);
    const [total, setTotal]     = useState(0);
    const [applying, setApplying] = useState(null); // jobId currently being applied to
    const [applyMsg, setApplyMsg] = useState({});    // { [jobId]: { type, text } }
    const [isHired, setIsHired]   = useState(false); // candidate hired → off the market
    const [detailJobId, setDetailJobId] = useState(null); // open full-requirement modal
    const limit = 10;

    const load = useCallback(() => {
        setLoading(true);
        const params = { page, limit };
        if (search) params.search = search;

        jobAPI.getJobs(params)
            .then(({ data }) => {
                // Backend: { success, data: [...jobs], total, page, limit, is_hired }
                setJobs(Array.isArray(data.data) ? data.data : []);
                setTotal(data.total || 0);
                setIsHired(Boolean(data.is_hired));
            })
            .catch(() => setJobs([]))
            .finally(() => setLoading(false));
    }, [page, search]);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [load]);

    const handleApply = async (jobId) => {
        setApplying(jobId);
        setApplyMsg(m => ({ ...m, [jobId]: null }));
        try {
            await applicationAPI.apply(jobId, {});
            // Optimistically mark as applied
            setJobs(prev => prev.map(j =>
                j.id === jobId
                    ? { ...j, already_applied: 1, application_status: 'applied' }
                    : j
            ));
            setApplyMsg(m => ({ ...m, [jobId]: { type: 'success', text: 'Application submitted!' } }));
        } catch (err) {
            const msg = err.response?.data?.message || 'Application failed';
            setApplyMsg(m => ({ ...m, [jobId]: { type: 'error', text: msg } }));
        } finally {
            setApplying(null);
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="max-w-4xl mx-auto animate-slide-up">
            <div className="page-header">
                <h1 className="page-title">Browse Jobs</h1>
                <span className="text-sm text-gray-500">{total} job{total !== 1 ? 's' : ''} found</span>
            </div>

            {isHired && (
                <div className="alert-success mb-5">
                    🎉 Congratulations on your placement through LadderStep Human Consulting! As a hired candidate,
                    you're now off the market and new applications are disabled.
                </div>
            )}

            {/* Search */}
            <div className="mb-5">
                <input
                    type="text"
                    placeholder="Search job title or company…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                    Loading jobs...
                </div>
            ) : jobs.length === 0 ? (
                <div className="card-p text-center py-16">
                    <div className="text-4xl mb-3">🔍</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">No jobs found</h3>
                    <p className="text-sm text-gray-500">
                        {search ? 'Try a different search term.' : 'No active job postings right now — check back soon.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-4">
                        {jobs.map((job) => {
                            const isApplied   = Boolean(job.already_applied);
                            const isApplying  = applying === job.id;
                            const typeInfo    = JOB_TYPE_MAP[job.job_type] || { label: job.job_type, cls: 'badge-gray' };
                            const msg         = applyMsg[job.id];

                            return (
                                <div
                                    key={job.id}
                                    onClick={() => setDetailJobId(job.id)}
                                    className="card-p hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                                                <span className={typeInfo.cls}>{typeInfo.label}</span>
                                                {job.work_mode && (
                                                    <span className="badge-gray capitalize">
                                                        {job.work_mode.replace('_', '-')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-600 mb-2">
                                                {job.company_name}
                                                {job.location && (
                                                    <span className="text-gray-400"> • {job.location}</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                                                {job.description}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                                <span>💰 {formatSalary(job.salary_min, job.salary_max)}</span>
                                                {job.experience_min != null && (
                                                    <span>
                                                        📈 {job.experience_min}
                                                        {job.experience_max ? `–${job.experience_max}` : '+'} yrs
                                                    </span>
                                                )}
                                                <span>📅 {new Date(job.created_at).toLocaleDateString()}</span>
                                                {job.deadline && (
                                                    <span className="text-orange-500">
                                                        ⏰ Deadline: {new Date(job.deadline).toLocaleDateString()}
                                                    </span>
                                                )}
                                                <span className="text-indigo-600 font-medium ml-auto">View full details →</span>
                                            </div>

                                            {/* Per-job feedback message */}
                                            {msg && (
                                                <p className={`mt-2 text-xs font-medium ${
                                                    msg.type === 'success' ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {msg.text}
                                                </p>
                                            )}
                                        </div>

                                        {/* Apply / Applied */}
                                        <div className="shrink-0 flex flex-col items-end gap-2" onClick={e => e.stopPropagation()}>
                                            {isHired ? (
                                                <span className="badge-gray whitespace-nowrap">Hired</span>
                                            ) : isApplied ? (
                                                <span className="badge-green whitespace-nowrap">Applied ✓</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleApply(job.id)}
                                                    disabled={isApplying}
                                                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition whitespace-nowrap"
                                                >
                                                    {isApplying ? 'Applying…' : 'Apply Now'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination mt-6">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="pagination-btn"
                            >
                                ← Prev
                            </button>
                            <span>Page {page} of {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="pagination-btn"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}

            {detailJobId && (
                <JobDetailModal
                    jobId={detailJobId}
                    isHired={isHired}
                    onClose={() => setDetailJobId(null)}
                    onApply={handleApply}
                    applying={applying}
                    applyMsg={applyMsg[detailJobId]}
                    appliedOverride={Boolean(jobs.find(j => j.id === detailJobId)?.already_applied)}
                />
            )}
        </div>
    );
}

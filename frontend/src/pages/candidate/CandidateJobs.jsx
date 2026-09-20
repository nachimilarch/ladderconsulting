import { useEffect, useState, useCallback } from 'react';
import { jobAPI, applicationAPI } from '../../api/candidate';
import JobDetailModal from '../../components/candidate/JobDetailModal';
import AiAssistantPromo from '../../components/AiAssistantPromo';

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

const scoreCls = (s) => (s >= 70 ? 'bg-green-100 text-green-700' : s >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700');

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
    const [recommended, setRecommended] = useState([]); // jobs ranked by live match %, best first
    const [tab, setTab] = useState(null);               // 'recommended' | 'all' (chosen once matches load)
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

    // Match % for every active job, scored against this candidate's skills.
    useEffect(() => {
        jobAPI.getMatched({ page: 1, limit: 50 })
            .then(({ data }) => {
                const ranked = (data.jobs || []).filter((j) => j.match_computed && j.match_score > 0);
                setRecommended(ranked);
                setTab(ranked.length ? 'recommended' : 'all');
            })
            .catch(() => setTab('all'));
    }, []);

    const scoreById = Object.fromEntries(recommended.map((j) => [j.id, j.match_score]));

    const handleApply = async (jobId) => {
        setApplying(jobId);
        setApplyMsg(m => ({ ...m, [jobId]: null }));
        try {
            await applicationAPI.apply(jobId, {});
            // Optimistically mark as applied
            const markApplied = (j) => (j.id === jobId ? { ...j, already_applied: 1, application_status: 'applied' } : j);
            setJobs(prev => prev.map(markApplied));
            setRecommended(prev => prev.map(markApplied));
            setApplyMsg(m => ({ ...m, [jobId]: { type: 'success', text: 'Application submitted!' } }));
        } catch (err) {
            const msg = err.response?.data?.message || 'Application failed';
            setApplyMsg(m => ({ ...m, [jobId]: { type: 'error', text: msg } }));
        } finally {
            setApplying(null);
        }
    };

    const isRecommended = tab === 'recommended';
    const q = search.trim().toLowerCase();
    const shown = isRecommended
        ? recommended.filter((j) => !q || `${j.title} ${j.company_name}`.toLowerCase().includes(q))
        : jobs;
    const count = isRecommended ? shown.length : total;
    const totalPages = isRecommended ? 1 : Math.ceil(total / limit);
    const busy = loading || tab === null;

    return (
        <div className="max-w-4xl mx-auto animate-slide-up">
            <div className="page-header">
                <h1 className="page-title">Browse Jobs</h1>
                <span className="text-sm text-gray-500">{count} job{count !== 1 ? 's' : ''} {isRecommended ? 'for you' : 'found'}</span>
            </div>

            {isHired && (
                <div className="alert-success mb-5">
                    🎉 Congratulations on your placement through LadderStep Human Consulting! As a hired candidate,
                    you're now off the market and new applications are disabled.
                </div>
            )}

            {!isHired && (
                <AiAssistantPromo
                    text="ask it to find jobs that match your profile, or apply to one for you."
                    prompt="Find jobs that match me"
                />
            )}

            {/* Recommended (ranked by fit) vs. everything */}
            {recommended.length > 0 && (
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4 w-full sm:w-fit">
                    {[
                        { id: 'recommended', label: '⭐ Recommended for you' },
                        { id: 'all', label: 'All jobs' },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => { setTab(t.id); setPage(1); }}
                            className={`flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition ${
                                tab === t.id ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Search */}
            <div className="mb-5">
                <input
                    type="text"
                    placeholder="Search job title or company…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {busy ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                    Loading jobs...
                </div>
            ) : shown.length === 0 ? (
                <div className="card-p text-center py-16">
                    <div className="text-4xl mb-3">🔍</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">No jobs found</h3>
                    <p className="text-sm text-gray-500">
                        {search ? 'Try a different search term.' : 'No active job postings right now. Check back soon.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-4">
                        {shown.map((job) => {
                            const isApplied   = Boolean(job.already_applied);
                            const isApplying  = applying === job.id;
                            const typeInfo    = JOB_TYPE_MAP[job.job_type] || { label: job.job_type, cls: 'badge-gray' };
                            const msg         = applyMsg[job.id];
                            const score       = scoreById[job.id];

                            return (
                                <div
                                    key={job.id}
                                    onClick={() => setDetailJobId(job.id)}
                                    className="card-p hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <h3 className="font-semibold text-gray-900 leading-snug">{job.title}</h3>
                                                {score > 0 && (
                                                    <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${scoreCls(score)}`}>{score}% match</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className={typeInfo.cls}>{typeInfo.label}</span>
                                                {job.work_mode && (
                                                    <span className="badge-gray capitalize">{job.work_mode.replace('_', '-')}</span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-600 mb-2">
                                                {job.company_name}
                                                {job.location && <span className="text-gray-400"> • {job.location}</span>}
                                            </div>
                                            <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                                                {job.description}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                                <span>💰 {formatSalary(job.salary_min, job.salary_max)}</span>
                                                {job.experience_min != null && (
                                                    <span>
                                                        📈 {job.experience_min}
                                                        {job.experience_max ? `–${job.experience_max}` : '+'} yrs
                                                    </span>
                                                )}
                                                <span className="text-indigo-600 font-medium sm:ml-auto">View full details →</span>
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

                                        {/* Apply / Applied: full-width tap target on phones */}
                                        <div className="shrink-0 sm:flex sm:flex-col sm:items-end gap-2" onClick={e => e.stopPropagation()}>
                                            {isHired ? (
                                                <span className="badge-gray whitespace-nowrap">Hired</span>
                                            ) : isApplied ? (
                                                <span className="badge-green whitespace-nowrap">Applied ✓</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleApply(job.id)}
                                                    disabled={isApplying}
                                                    className="w-full sm:w-auto px-4 py-3 sm:py-1.5 bg-indigo-600 text-white text-sm sm:text-xs font-semibold sm:font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition whitespace-nowrap"
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
                    onClose={() => setDetailJobId(null)}
                    onApplied={(id) => {
                        const markApplied = (j) => (j.id === id ? { ...j, already_applied: 1, application_status: 'applied' } : j);
                        setJobs(prev => prev.map(markApplied));
                        setRecommended(prev => prev.map(markApplied));
                    }}
                />
            )}
        </div>
    );
}

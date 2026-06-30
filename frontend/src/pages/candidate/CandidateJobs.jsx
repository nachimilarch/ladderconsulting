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

export default function CandidateJobs() {
    const [jobs, setJobs]       = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]   = useState('');
    const [page, setPage]       = useState(1);
    const [total, setTotal]     = useState(0);
    const [applying, setApplying] = useState(null); // jobId currently being applied to
    const [applyMsg, setApplyMsg] = useState({});    // { [jobId]: { type, text } }
    const [isHired, setIsHired]   = useState(false); // candidate hired → off the market
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
                                <div key={job.id} className="card-p hover:shadow-md transition-shadow duration-200">
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
                                        <div className="shrink-0 flex flex-col items-end gap-2">
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
        </div>
    );
}

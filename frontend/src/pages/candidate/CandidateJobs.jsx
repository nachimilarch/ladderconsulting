import { useEffect, useState } from 'react';
import { jobAPI } from '../../api/candidate';

export default function CandidateJobs() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    useEffect(() => {
        setLoading(true);
        jobAPI.getMatched({ page, limit })
            .then(({ data }) => {
                setJobs(data.jobs || []);
                setTotal(data.pagination?.total || 0);
            })
            .catch(() => setJobs([]))
            .finally(() => setLoading(false));
    }, [page]);

    const totalPages = Math.ceil(total / limit);

    const formatSalary = (min, max) => {
        if (!min && !max) return 'Not disclosed';
        const fmt = (v) => `₹${(v / 100000).toFixed(1)}L`;
        if (min && max) return `${fmt(min)} – ${fmt(max)}`;
        return min ? `From ${fmt(min)}` : `Up to ${fmt(max)}`;
    };

    const jobTypeBadge = (type) => {
        const map = {
            full_time: { label: 'Full Time', cls: 'badge-blue' },
            part_time: { label: 'Part Time', cls: 'badge-yellow' },
            contract: { label: 'Contract', cls: 'badge-purple' },
            internship: { label: 'Internship', cls: 'badge-green' },
        };
        const info = map[type] || { label: type, cls: 'badge-gray' };
        return <span className={info.cls}>{info.label}</span>;
    };

    return (
        <div className="max-w-4xl mx-auto animate-slide-up">
            <div className="page-header">
                <h1 className="page-title">Browse Jobs</h1>
                <span className="text-sm text-gray-500">{total} job{total !== 1 ? 's' : ''} found</span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading jobs...</div>
            ) : jobs.length === 0 ? (
                <div className="card-p text-center py-16">
                    <div className="text-4xl mb-3">🔍</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">No jobs found</h3>
                    <p className="text-sm text-gray-500">Complete your profile and upload a resume to get matched with relevant jobs.</p>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-4">
                        {jobs.map((job) => (
                            <div key={job.id} className="card-p hover:shadow-md transition-shadow duration-200">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                                            {jobTypeBadge(job.job_type)}
                                        </div>
                                        <div className="text-sm text-gray-600 mb-2">
                                            {job.company_name}
                                            {job.location && <span className="text-gray-400"> • {job.location}</span>}
                                        </div>
                                        <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                                            {job.description}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                            <span>💰 {formatSalary(job.salary_min, job.salary_max)}</span>
                                            <span>📅 {new Date(job.created_at).toLocaleDateString()}</span>
                                        </div>

                                        {/* Match info */}
                                        {job.match_score > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-semibold text-gray-600">Match Score:</span>
                                                    <span className={`text-xs font-bold ${
                                                        job.match_score >= 70 ? 'text-green-600' :
                                                        job.match_score >= 40 ? 'text-yellow-600' : 'text-red-500'
                                                    }`}>
                                                        {job.match_score}%
                                                    </span>
                                                </div>
                                                {job.matched_skills && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {(typeof job.matched_skills === 'string' ? JSON.parse(job.matched_skills) : job.matched_skills).map((s, i) => (
                                                            <span key={i} className="badge-green text-[10px]">{s}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {job.missing_skills && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {(typeof job.missing_skills === 'string' ? JSON.parse(job.missing_skills) : job.missing_skills).map((s, i) => (
                                                            <span key={i} className="badge-red text-[10px]">{s}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="shrink-0">
                                        {job.already_applied > 0 ? (
                                            <span className="badge-green">Applied ✓</span>
                                        ) : (
                                            <span className="badge-gray">Not applied</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
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

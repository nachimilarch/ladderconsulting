import { useEffect, useState } from 'react';
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

/**
 * Self-contained full job-requirement modal for candidates.
 * Fetches the complete posting, shows description + requirements + skills,
 * and handles the Apply flow internally.
 *
 * Props:
 *   jobId       — the job to display
 *   onClose()   — close the modal
 *   onApplied(jobId)  — optional; called after a successful application so the
 *                       parent can refresh its own list/state
 */
export default function JobDetailModal({ jobId, onClose, onApplied }) {
    const [job, setJob]         = useState(null);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [applied, setApplied]   = useState(false);
    const [msg, setMsg]           = useState(null); // { type, text }

    useEffect(() => {
        let active = true;
        jobAPI.getJob(jobId)
            .then(({ data }) => {
                if (!active) return;
                setJob(data.data || null);
                setApplied(Boolean(data.data?.already_applied));
            })
            .catch(() => { if (active) setJob(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [jobId]);

    const handleApply = async () => {
        setApplying(true);
        setMsg(null);
        try {
            await applicationAPI.apply(jobId, {});
            setApplied(true);
            setMsg({ type: 'success', text: 'Application submitted!' });
            onApplied?.(jobId);
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.message || 'Application failed' });
        } finally {
            setApplying(false);
        }
    };

    const typeInfo = job ? (JOB_TYPE_MAP[job.job_type] || { label: job.job_type, cls: 'badge-gray' }) : null;

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
                                {msg && (
                                    <span className={msg.type === 'success' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{msg.text}</span>
                                )}
                            </div>
                            {job.is_hired ? (
                                <span className="badge-gray">Hired — off the market</span>
                            ) : applied ? (
                                <span className="badge-green">Applied ✓</span>
                            ) : (
                                <button
                                    onClick={handleApply}
                                    disabled={applying}
                                    className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
                                >
                                    {applying ? 'Applying…' : 'Apply Now'}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

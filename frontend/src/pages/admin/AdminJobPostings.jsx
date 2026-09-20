import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { adminJobAPI } from '../../api/admin';

// Statuses an admin can set. `pending_payment` is system-controlled — a job is
// created that way when a Standard company hasn't paid its ₹3,999 posting fee
// yet, and only the fee invoice being paid publishes it.
const STATUS_OPTIONS = ['active', 'draft', 'paused', 'closed'];
const FILTER_OPTIONS = [...STATUS_OPTIONS, 'pending_payment'];
const STATUS_LABEL = (s) => s === 'pending_payment' ? 'Awaiting payment' : s.charAt(0).toUpperCase() + s.slice(1);

const STATUS_COLORS = {
    pending_payment: 'bg-amber-100 text-amber-700',
    active: 'bg-green-100 text-green-700',
    draft:  'bg-gray-100 text-gray-600',
    paused: 'bg-yellow-100 text-yellow-700',
    closed: 'bg-red-100 text-red-600',
};

export default function AdminJobPostings() {
    const [jobs, setJobs]         = useState([]);
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [updating, setUpdating] = useState(null); // job id being updated

    const load = useCallback(() => {
        setLoading(true);
        const params = {};
        if (search)       params.search = search;
        if (statusFilter) params.status = statusFilter;
        adminJobAPI.list(params)
            .then(r => setJobs(r.data.data || []))
            .catch(() => toast.error('Failed to load job postings'))
            .finally(() => setLoading(false));
    }, [search, statusFilter]);

    useEffect(() => { load(); }, [load]);

    const handleStatusChange = async (job, newStatus) => {
        setUpdating(job.id);
        try {
            await adminJobAPI.setStatus(job.id, newStatus);
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
            toast.success(`"${job.title}" set to ${newStatus}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        } finally {
            setUpdating(null);
        }
    };

    const handleDelete = async (job) => {
        if (!window.confirm(`Delete "${job.title}" from ${job.company_name}? This cannot be undone.`)) return;
        setUpdating(job.id);
        try {
            await adminJobAPI.remove(job.id);
            setJobs(prev => prev.filter(j => j.id !== job.id));
            toast.success('Job posting deleted');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete');
        } finally {
            setUpdating(null);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage all company job postings — change status or remove listings</p>
                </div>
                <span className="text-sm text-gray-400">{jobs.length} posting{jobs.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search title or company…"
                    className="border border-gray-300 rounded-xl px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                    <option value="">All statuses</option>
                    {FILTER_OPTIONS.map(s => (
                        <option key={s} value={s}>{STATUS_LABEL(s)}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : jobs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                    <div className="text-4xl mb-3">💼</div>
                    <p className="text-gray-500 text-sm">No job postings found.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                {['Job Title', 'Company', 'Type / Mode', 'Location', 'Applicants', 'Posting Fee', 'Status', 'Posted', 'Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {jobs.map(job => (
                                <tr key={job.id} className={`hover:bg-gray-50 ${updating === job.id ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-800">{job.title}</div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {job.company_name}
                                        {job.company_tier === 'premium' && (
                                            <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">⭐ Platinum</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 capitalize text-xs">
                                        {job.job_type?.replace('_', ' ')}<br />
                                        <span className="text-gray-400">{job.work_mode}</span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{job.location || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">{job.applicant_count}</td>
                                    <td className="px-4 py-3 text-xs">
                                        {job.company_tier === 'premium' ? (
                                            <span className="text-gray-500">Included</span>
                                        ) : job.fee_status ? (
                                            <div>
                                                <span className={`font-medium ${job.fee_status === 'paid' ? 'text-green-700' : 'text-amber-700'}`}>
                                                    ₹3,999 · {job.fee_status.replace('_', ' ')}
                                                </span>
                                                <p className="font-mono text-[10px] text-gray-400">{job.fee_invoice_number}</p>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {job.status === 'pending_payment' ? (
                                            <span
                                                title="Publishes automatically once the posting fee is paid. To record an offline payment, mark the fee invoice paid in Payments."
                                                className={`text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap ${STATUS_COLORS.pending_payment}`}
                                            >
                                                Awaiting payment
                                            </span>
                                        ) : (
                                            <select
                                                value={job.status}
                                                disabled={updating === job.id}
                                                onChange={e => handleStatusChange(job, e.target.value)}
                                                className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 ${STATUS_COLORS[job.status]}`}
                                            >
                                                {STATUS_OPTIONS.map(s => (
                                                    <option key={s} value={s}>{STATUS_LABEL(s)}</option>
                                                ))}
                                            </select>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 text-xs">
                                        {new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => handleDelete(job)}
                                            disabled={updating === job.id}
                                            className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-40"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { interviewRequestAPI } from '../../api/payments';

const STATUS_COLORS = {
    pending:    'bg-yellow-100 text-yellow-700',
    in_progress:'bg-blue-100 text-blue-700',
    resolved:   'bg-green-100 text-green-700',
    rejected:   'bg-red-100 text-red-600',
    cancelled:  'bg-gray-100 text-gray-500',
};

const TYPE_LABELS = {
    interview_schedule:   'New Request',
    interview_reschedule: 'Reschedule',
};

const fmtDT = (d) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function InterviewRequests({ embedded = false }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending');

    useEffect(() => {
        const params = statusFilter ? { status: statusFilter } : {};
        interviewRequestAPI.listExec(params)
            .then(r => setRequests(r.data?.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [statusFilter]);

    return (
        <div className={embedded ? '' : 'max-w-5xl mx-auto'}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    {!embedded && <h1 className="text-2xl font-bold text-gray-900">Interview Requests</h1>}
                    <p className="text-sm text-gray-500 mt-0.5">Company-submitted interview schedule requests awaiting your approval.</p>
                </div>
                <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setLoading(true); }}
                    className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : requests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <p className="text-gray-500 text-sm">No interview requests found.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {requests.map(req => {
                        const meta = req.metadata ? (typeof req.metadata === 'string' ? JSON.parse(req.metadata) : req.metadata) : {};
                        return (
                            <Link
                                key={req.id}
                                to={`/hr/interview-requests/${req.id}`}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-blue-300 hover:shadow-md transition"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-semibold text-gray-900">{req.company_name}</h3>
                                            <span className="text-xs text-gray-400">→</span>
                                            <span className="text-sm text-gray-700">{req.candidate_name}</span>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-500'}`}>
                                                {req.status}
                                            </span>
                                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                                                {TYPE_LABELS[req.request_type] || req.request_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2">{req.job_title}</p>
                                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                                            {meta.proposed_datetime && (
                                                <span>Proposed: {fmtDT(meta.proposed_datetime)}</span>
                                            )}
                                            {meta.mode && <span className="capitalize">{meta.mode}</span>}
                                            <span>Submitted: {fmtDT(req.created_at)}</span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-blue-600 font-medium shrink-0">Review →</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { offerRequestAPI } from '../../api/interview';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    pending:     'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved:    'bg-green-100 text-green-700',
    rejected:    'bg-red-100 text-red-600',
    cancelled:   'bg-gray-100 text-gray-500',
};

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

const fmtINR = (n) => n != null
    ? `₹${parseFloat(n).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', maximumFractionDigits: 0 })}`
    : '—';

export default function OfferRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    const load = () => {
        setLoading(true);
        const params = statusFilter ? { status: statusFilter } : {};
        offerRequestAPI.listExec(params)
            .then(r => setRequests(r.data?.data || []))
            .catch(() => toast.error('Failed to load offer requests'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [statusFilter]);

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Offer Letter Requests</h1>
                    {pendingCount > 0 && (
                        <p className="text-sm text-yellow-600 mt-0.5">{pendingCount} pending request{pendingCount !== 1 ? 's' : ''} awaiting your action</p>
                    )}
                </div>
                <div className="flex gap-3 items-center">
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">
                        <option value="">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <button onClick={load} className="text-sm text-indigo-600 hover:underline">Refresh</button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
            ) : requests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="text-3xl mb-3 text-gray-300">&#128179;</div>
                    <h3 className="font-semibold text-gray-700 mb-1">No offer letter requests</h3>
                    <p className="text-sm text-gray-500">Requests will appear here once companies submit them.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h3 className="font-semibold text-gray-900">{req.company_name}</h3>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {req.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">
                                        {req.candidate_name} &mdash; {req.job_title}
                                    </p>
                                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
                                        <span>Annual CTC: <strong className="text-gray-800">{fmtINR(req.offered_ctc)}</strong></span>
                                        <span>Placement Fee: <strong className="text-indigo-700">{fmtINR(req.placement_fee_amount)}</strong></span>
                                        <span>Submitted: {fmtDate(req.created_at)}</span>
                                        {req.resolved_at && <span>Approved: {fmtDate(req.resolved_at)}</span>}
                                    </div>

                                    {/* Payable invoice progress — visible once the executive approves */}
                                    {req.payable && (() => {
                                        const amt = parseFloat(req.payable.amount);
                                        const paid = parseFloat(req.payable.amount_paid);
                                        const pct = amt > 0 ? Math.min(100, Math.round((paid / amt) * 100)) : 0;
                                        const remaining = Math.max(amt - paid, 0);
                                        const STATUS = {
                                            pending: ['Awaiting payment', 'bg-yellow-100 text-yellow-700'],
                                            partially_paid: ['Partially paid', 'bg-blue-100 text-blue-700'],
                                            paid: ['Paid in full', 'bg-green-100 text-green-700'],
                                            overdue: ['Overdue', 'bg-red-100 text-red-600'],
                                        };
                                        const [label, cls] = STATUS[req.payable.status] || ['Invoice', 'bg-gray-100 text-gray-600'];
                                        return (
                                            <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                                                    <span className="text-xs font-mono text-gray-600">{req.payable.invoice_number}</span>
                                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-gray-700">Paid <strong>{fmtINR(paid)}</strong> of {fmtINR(amt)}</span>
                                                    {remaining > 0 && <span className="text-orange-600">Outstanding {fmtINR(remaining)}</span>}
                                                    {req.payable.due_date && <span className="text-gray-400">Due {fmtDate(req.payable.due_date)}</span>}
                                                </div>
                                                <div className="w-full bg-white rounded-full h-1.5 mt-2 overflow-hidden">
                                                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {req.request_note && (
                                        <p className="text-xs text-gray-400 italic mt-2">"{req.request_note}"</p>
                                    )}
                                </div>
                                <Link
                                    to={`/hr/offer-requests/${req.id}`}
                                    className="shrink-0 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-100 transition">
                                    Review
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

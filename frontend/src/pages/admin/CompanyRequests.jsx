import { useEffect, useState } from 'react';
import { adminOfferRequestAPI } from '../../api/admin';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
    cancelled: 'bg-gray-100 text-gray-500',
};

const fmtINR = (n) => n != null
    ? `₹${parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : '—';

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

export default function CompanyRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [selected, setSelected] = useState(null);
    const [rejectMode, setRejectMode] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [saving, setSaving] = useState(false);

    const load = () => {
        setLoading(true);
        adminOfferRequestAPI.listAll(statusFilter ? { status: statusFilter } : {})
            .then(r => setRequests(r.data?.data || []))
            .catch(() => { toast.error('Failed to load requests'); setRequests([]); })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line

    const openDetail = (req) => {
        setSelected(req);
        setRejectMode(false);
        setRejectReason('');
    };

    const handleApprove = async () => {
        if (!selected) return;
        if (!window.confirm('Confirm that the placement fee has been received and approve this offer letter?')) return;
        setSaving(true);
        try {
            await adminOfferRequestAPI.approve(selected.id);
            toast.success('Approved — offer letter unlocked for the company.');
            setSelected(null);
            load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Approval failed');
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async (e) => {
        e.preventDefault();
        if (!rejectReason.trim()) return;
        setSaving(true);
        try {
            await adminOfferRequestAPI.reject(selected.id, rejectReason);
            toast.success('Request rejected. Company has been notified.');
            setSelected(null);
            load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Rejection failed');
        } finally {
            setSaving(false);
        }
    };

    const isActionable = selected && ['pending', 'in_progress'].includes(selected.status) && !selected.grant_id;

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Offer Letter Requests</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Review and approve offer letter releases.
                    </p>
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            <div className="flex gap-6">
                {/* List */}
                <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden">
                    {loading ? (
                        <p className="p-6 text-gray-400 text-sm">Loading…</p>
                    ) : requests.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-gray-400 text-sm">No offer letter requests found.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    {['Company', 'Candidate', 'Job Role', 'Annual CTC', 'Placement Fee', 'Status', 'Date', ''].map(h => (
                                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {requests.map(req => (
                                    <tr key={req.id} className={`hover:bg-gray-50 ${selected?.id === req.id ? 'bg-indigo-50' : ''}`}>
                                        <td className="px-3 py-3 font-medium text-gray-800">{req.company_name}</td>
                                        <td className="px-3 py-3 text-gray-600">{req.candidate_name}</td>
                                        <td className="px-3 py-3 text-gray-500 text-xs">{req.job_title}</td>
                                        <td className="px-3 py-3 text-gray-700">{fmtINR(req.offered_ctc)}</td>
                                        <td className="px-3 py-3 font-semibold text-indigo-700">{fmtINR(req.placement_fee_amount)}</td>
                                        <td className="px-3 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-500'}`}>
                                                {req.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-gray-400 text-xs">{fmtDate(req.created_at)}</td>
                                        <td className="px-3 py-3">
                                            <button
                                                onClick={() => openDetail(req)}
                                                className="text-indigo-600 hover:underline text-xs"
                                            >
                                                Review →
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Detail panel */}
                {selected && (
                    <div className="w-80 bg-white rounded-lg shadow-sm p-5 shrink-0 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-800">{selected.company_name}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Offer Letter Release Request</p>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                        </div>

                        {/* Request details */}
                        <dl className="text-xs space-y-2">
                            <div className="flex justify-between">
                                <dt className="text-gray-400">Candidate</dt>
                                <dd className="font-medium text-gray-700">{selected.candidate_name}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-400">Job Role</dt>
                                <dd className="font-medium text-gray-700 truncate max-w-[160px]">{selected.job_title}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-400">Assigned Executive</dt>
                                <dd className="font-medium text-gray-700">{selected.executive_name || '—'}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-400">Submitted</dt>
                                <dd className="text-gray-600">{fmtDate(selected.created_at)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-400">Status</dt>
                                <dd>
                                    <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selected.status] || 'bg-gray-100 text-gray-500'}`}>
                                        {selected.status.replace('_', ' ')}
                                    </span>
                                </dd>
                            </div>
                        </dl>

                        {/* Fee summary */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Placement Fee</p>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Annual CTC</span>
                                <span className="font-semibold text-gray-800">{fmtINR(selected.offered_ctc)}</span>
                            </div>
                            <div className="flex justify-between text-xs border-t border-indigo-200 pt-2">
                                <span className="text-gray-500">Fee Due (1× monthly)</span>
                                <span className="font-bold text-indigo-700 text-sm">{fmtINR(selected.placement_fee_amount)}</span>
                            </div>
                        </div>

                        {/* Grant confirmation */}
                        {selected.grant_id && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700 font-medium">
                                Offer letter approved — company can now generate the letter.
                            </div>
                        )}

                        {/* Rejection reason */}
                        {selected.status === 'rejected' && selected.rejection_reason && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                                <span className="font-semibold">Reason: </span>{selected.rejection_reason}
                            </div>
                        )}

                        {/* Actions */}
                        {isActionable && (
                            <div className="border-t pt-3 space-y-3">
                                <p className="text-xs font-semibold text-gray-600">Actions</p>

                                {!rejectMode ? (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={handleApprove}
                                            disabled={saving}
                                            className="w-full py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                                        >
                                            {saving ? 'Processing…' : 'Approve Request'}
                                        </button>
                                        <button
                                            onClick={() => setRejectMode(true)}
                                            className="w-full py-2 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50 transition"
                                        >
                                            Reject Request
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleReject} className="space-y-2">
                                        <label className="text-xs text-gray-500 block">Rejection reason *</label>
                                        <textarea
                                            value={rejectReason}
                                            onChange={e => setRejectReason(e.target.value)}
                                            required
                                            rows={3}
                                            placeholder="Explain why the request is rejected…"
                                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
                                        />
                                        <div className="flex gap-2">
                                            <button type="submit" disabled={saving || !rejectReason.trim()}
                                                className="flex-1 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50">
                                                {saving ? 'Rejecting…' : 'Confirm Rejection'}
                                            </button>
                                            <button type="button" onClick={() => { setRejectMode(false); setRejectReason(''); }}
                                                className="flex-1 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50">
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

import { useEffect, useState, useCallback } from 'react';
import { recruitmentAPI } from '../../api/recruitment';
import toast from 'react-hot-toast';
import { fmtDateTime } from '../../utils/date';

const STATUS_CLS = {
    pending:     'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    approved:    'bg-green-100 text-green-700',
    rejected:    'bg-red-100 text-red-600',
};

export default function ProfileUnlockRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [acting,  setActing]    = useState(null); // requestId
    const [rejectModal, setRejectModal] = useState(null); // { id }
    const [rejectReason, setRejectReason] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        recruitmentAPI.listProfileUnlockRequests()
            .then(r => setRequests(r.data?.data || []))
            .catch(() => toast.error('Failed to load requests.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const approve = async (id) => {
        setActing(id);
        try {
            await recruitmentAPI.approveProfileUnlock(id);
            toast.success('Profile unlock approved. Company now has full access.');
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to approve.');
        } finally { setActing(null); }
    };

    const reject = async () => {
        const id = rejectModal?.id;
        if (!id) return;
        setActing(id);
        try {
            await recruitmentAPI.rejectProfileUnlock(id, rejectReason);
            toast.success('Request rejected.');
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
            setRejectModal(null);
            setRejectReason('');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reject.');
        } finally { setActing(null); }
    };

    const pending   = requests.filter(r => r.status === 'pending' || r.status === 'in_progress');
    const resolved  = requests.filter(r => r.status === 'approved' || r.status === 'rejected');

    return (
        <div className="max-w-4xl mx-auto">
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setRejectModal(null)} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h2 className="font-semibold text-gray-900 mb-2">Reject Profile Unlock</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Optionally provide a reason. The company will be notified.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            rows={3}
                            placeholder="Reason for rejection (optional)…"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={reject}
                                disabled={acting === rejectModal?.id}
                                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60"
                            >
                                {acting === rejectModal?.id ? 'Rejecting…' : 'Confirm Reject'}
                            </button>
                            <button onClick={() => setRejectModal(null)}
                                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Profile Unlock Requests</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Platinum companies request full candidate profile access after shortlisting. Review and approve/reject here.
                    </p>
                </div>
                <button onClick={load} className="text-xs text-indigo-600 hover:underline">Refresh</button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : (
                <>
                    {/* Pending */}
                    <h2 className="section-title mb-3">Pending ({pending.length})</h2>
                    {pending.length === 0 ? (
                        <div className="card p-10 text-center text-sm text-gray-400 mb-6">No pending requests.</div>
                    ) : (
                        <div className="flex flex-col gap-3 mb-6">
                            {pending.map(req => {
                                const meta = (() => { try { return typeof req.metadata === 'string' ? JSON.parse(req.metadata) : req.metadata; } catch { return {}; } })();
                                return (
                                    <div key={req.id} className="card-p border-l-4 border-yellow-400">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="font-semibold text-gray-900">{req.company_name}</span>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[req.status]}`}>{req.status}</span>
                                                </div>
                                                <p className="text-sm text-gray-700">
                                                    Requesting full profile access for: <strong>{req.candidate_name}</strong>
                                                    {req.candidate_headline && <span className="text-gray-500"> · {req.candidate_headline}</span>}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {req.total_experience != null && `${req.total_experience} yrs exp · `}
                                                    Requested {fmtDateTime(req.created_at)}
                                                </p>
                                                {meta.notes && <p className="text-xs text-gray-500 mt-1 italic">"{meta.notes}"</p>}
                                            </div>
                                            <div className="shrink-0 flex gap-2">
                                                <button
                                                    onClick={() => approve(req.id)}
                                                    disabled={acting === req.id}
                                                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-60"
                                                >
                                                    {acting === req.id ? '…' : 'Approve'}
                                                </button>
                                                <button
                                                    onClick={() => { setRejectModal({ id: req.id }); setRejectReason(''); }}
                                                    disabled={acting === req.id}
                                                    className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-60"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Resolved */}
                    {resolved.length > 0 && (
                        <>
                            <h2 className="section-title mb-3">Resolved ({resolved.length})</h2>
                            <div className="flex flex-col gap-2">
                                {resolved.map(req => (
                                    <div key={req.id} className={`card-p opacity-75 border-l-4 ${req.status === 'approved' ? 'border-green-400' : 'border-red-300'}`}>
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <span className="font-medium text-gray-800 text-sm">{req.company_name}</span>
                                                <span className="text-gray-500 text-sm"> — {req.candidate_name}</span>
                                            </div>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[req.status]}`}>{req.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

import { useEffect, useState } from 'react';
import { hrPremiumAPI } from '../../api/hrPremium';
import toast from 'react-hot-toast';

export default function PremiumRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(null);

    const load = () => {
        setLoading(true);
        hrPremiumAPI.list()
            .then(({ data }) => setRequests(data.data || []))
            .catch(() => toast.error('Failed to load requests.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleApprove = async (req) => {
        if (!window.confirm(`Move ${req.company_name} to the Premium tier?\n\nThis replaces their listing-fee requirement and charges 8.33% of CTC on every hire going forward.`)) return;
        setActing(req.id);
        try {
            const { data } = await hrPremiumAPI.approve(req.id);
            toast.success(data.message || 'Premium tier approved.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to approve.');
        } finally {
            setActing(null);
        }
    };

    const handleDismiss = async (req) => {
        const reason = window.prompt('Optional reason for dismissal (sent to company):') ?? null;
        if (reason === null) return; // cancelled
        setActing(req.id);
        try {
            await hrPremiumAPI.dismiss(req.id, reason || undefined);
            toast.success('Request dismissed.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to dismiss.');
        } finally {
            setActing(null);
        }
    };

    const pending = requests.filter(r => !r.is_read);
    const handled = requests.filter(r => r.is_read);

    if (loading) return <div className="text-gray-400 text-sm p-4">Loading…</div>;

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Company Premium Requests</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Companies assigned to you asking to move to the Premium tier (8.33% placement fee per hire,
                    replaces the ₹3,999 per-job fee).
                </p>
            </div>

            {pending.length === 0 ? (
                <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-12 text-center text-sm text-gray-400">
                    No pending requests.
                </div>
            ) : (
                <div className="flex flex-col gap-3 mb-8">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending — {pending.length}</p>
                    {pending.map(r => (
                        <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                                            ⭐ Premium Tier
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900">{r.company_name || 'Unknown Company'}</p>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.body}</p>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                    <button
                                        onClick={() => handleApprove(r)}
                                        disabled={acting === r.id}
                                        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition font-medium"
                                    >
                                        {acting === r.id ? '…' : 'Approve'}
                                    </button>
                                    <button
                                        onClick={() => handleDismiss(r)}
                                        disabled={acting === r.id}
                                        className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition font-medium"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {handled.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Handled — {handled.length}</p>
                    {handled.map(r => (
                        <div key={r.id} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 opacity-60">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-700 truncate">{r.company_name}</p>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">
                                {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

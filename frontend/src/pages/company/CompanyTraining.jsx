import { useEffect, useState } from 'react';
import { trainingServiceAPI } from '../../api/trainingServices';
import toast from 'react-hot-toast';

const fmtINR = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const CATEGORY_COLORS = {
    'Onboarding':     'bg-green-100 text-green-700',
    'Culture':        'bg-purple-100 text-purple-700',
    'Professionalism':'bg-blue-100 text-blue-700',
    'Communication':  'bg-indigo-100 text-indigo-700',
    'Leadership':     'bg-orange-100 text-orange-700',
    'Sales':          'bg-red-100 text-red-700',
};

const STATUS_CLS = {
    pending:   'bg-yellow-100 text-yellow-700',
    approved:  'bg-green-100 text-green-700',
    rejected:  'bg-red-100 text-red-600',
    completed: 'bg-indigo-100 text-indigo-700',
};

export default function CompanyTraining() {
    const [catalogue,  setCatalogue]  = useState([]);
    const [requests,   setRequests]   = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [activeTab,  setActiveTab]  = useState('catalogue');

    // Request modal state
    const [selected,   setSelected]   = useState(null); // catalogue item
    const [numUsers,   setNumUsers]   = useState(1);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        Promise.all([
            trainingServiceAPI.getCatalogue(),
            trainingServiceAPI.getMyRequests(),
        ])
            .then(([c, r]) => {
                setCatalogue(c.data?.data || []);
                setRequests(r.data?.data || []);
            })
            .catch(() => toast.error('Failed to load training data'))
            .finally(() => setLoading(false));
    }, []);

    const refreshRequests = () => {
        trainingServiceAPI.getMyRequests()
            .then(r => setRequests(r.data?.data || []))
            .catch(() => {});
    };

    const handleRequest = async (e) => {
        e.preventDefault();
        if (!selected) return;
        setSubmitting(true);
        try {
            await trainingServiceAPI.request({ catalogue_id: selected.id, num_users: numUsers });
            toast.success(`Training request for "${selected.title}" submitted successfully.`);
            setSelected(null);
            setNumUsers(1);
            refreshRequests();
            setActiveTab('requests');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="p-8">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Training Services</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Browse LadderStep Human Consulting's training catalogue and request programmes for your team.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 mb-6 border-b border-gray-200">
                {[
                    { id: 'catalogue', label: 'Training Catalogue' },
                    { id: 'requests',  label: `My Requests${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}` },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            activeTab === t.id
                                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── CATALOGUE ─────────────────────────────────────────────────── */}
            {activeTab === 'catalogue' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {catalogue.map(item => (
                            <div
                                key={item.id}
                                className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 transition-shadow hover:shadow-md ${!item.is_active ? 'opacity-50' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-semibold text-gray-800 text-base leading-tight">{item.title}</h3>
                                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-600'}`}>
                                        {item.category}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-500 leading-relaxed flex-1">{item.description}</p>

                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    {item.duration_days && (
                                        <span className="flex items-center gap-1">
                                            <span>⏱</span> {item.duration_days} day{item.duration_days > 1 ? 's' : ''}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1 font-semibold text-indigo-700">
                                        {fmtINR(item.price_per_user)} / user
                                    </span>
                                </div>

                                {item.is_active ? (
                                    <button
                                        onClick={() => { setSelected(item); setNumUsers(1); }}
                                        className="mt-1 w-full py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                    >
                                        Request This Training
                                    </button>
                                ) : (
                                    <span className="mt-1 text-center text-xs text-gray-400">Currently unavailable</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {catalogue.length === 0 && (
                        <p className="text-center text-gray-400 py-16">No training topics available.</p>
                    )}
                </>
            )}

            {/* ── MY REQUESTS ───────────────────────────────────────────────── */}
            {activeTab === 'requests' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                    {requests.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <p className="text-lg mb-1">No training requests yet.</p>
                            <button onClick={() => setActiveTab('catalogue')} className="text-sm text-indigo-600 hover:underline">
                                Browse the catalogue →
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                <tr>
                                    <th className="px-4 py-3 text-left">Topic</th>
                                    <th className="px-4 py-3 text-left">Category</th>
                                    <th className="px-4 py-3 text-center">Users</th>
                                    <th className="px-4 py-3 text-right">Total Fee</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-left">Invoice</th>
                                    <th className="px-4 py-3 text-left">Requested</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {requests.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-800">{r.topic_title}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[r.category] || 'bg-gray-100 text-gray-600'}`}>
                                                {r.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-700">{r.num_users}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                            {fmtINR(parseFloat(r.price_per_user) * r.num_users)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                                                {r.status}
                                            </span>
                                            {r.status === 'rejected' && r.rejection_reason && (
                                                <p className="text-xs text-red-500 mt-0.5">{r.rejection_reason}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {r.invoice_number ? (
                                                <div>
                                                    <p className="font-mono">{r.invoice_number}</p>
                                                    <p className={r.invoice_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}>
                                                        {r.invoice_status} · {fmtINR(r.amount_paid)} paid
                                                    </p>
                                                    {r.due_date && <p className="text-gray-400">Due {fmtDate(r.due_date)}</p>}
                                                </div>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(r.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── Request Modal ─────────────────────────────────────────────── */}
            {selected && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-800">Request Training</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{selected.title}</p>
                        </div>
                        <form onSubmit={handleRequest} className="p-6 space-y-4">
                            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Category</span>
                                    <span className="font-medium">{selected.category}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Duration</span>
                                    <span className="font-medium">{selected.duration_days} day{selected.duration_days > 1 ? 's' : ''}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Price per user</span>
                                    <span className="font-semibold text-indigo-700">{fmtINR(selected.price_per_user)}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Number of users
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={numUsers}
                                    onChange={e => setNumUsers(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    required
                                />
                            </div>

                            <div className="flex justify-between items-center text-sm pt-1 border-t border-gray-100">
                                <span className="text-gray-500">Estimated total</span>
                                <span className="text-lg font-bold text-indigo-700">
                                    {fmtINR(parseFloat(selected.price_per_user) * numUsers)}
                                </span>
                            </div>

                            <p className="text-xs text-gray-400">
                                An admin will review your request and raise an invoice. You can pay via the Payments section once approved.
                            </p>

                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setSelected(null)}
                                    className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting…' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

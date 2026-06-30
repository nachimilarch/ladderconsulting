import { useEffect, useState } from 'react';
import { adminOfferRequestAPI } from '../../api/admin';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    pending:  'bg-yellow-100 text-yellow-700',
    paid:     'bg-green-100 text-green-700',
    waived:   'bg-teal-100 text-teal-700',
    overdue:  'bg-red-100 text-red-600',
    rejected: 'bg-gray-100 text-gray-500',
};

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

const fmtINR = (n) => n != null
    ? `₹${parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : '₹0';

const today = new Date().toISOString().split('T')[0];
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

export default function PlacementFees() {
    const [fees, setFees] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', date_from: monthAgo, date_to: today });

    const load = () => {
        setLoading(true);
        const params = {};
        if (filters.status) params.status = filters.status;
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;

        adminOfferRequestAPI.listFees(params)
            .then(r => {
                setFees(r.data?.data || []);
                setSummary(r.data?.summary || null);
            })
            .catch(() => toast.error('Failed to load placement fees'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Placement Fees</h1>

            {/* Summary cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Pending', val: fmtINR(summary.pending_total), color: 'text-yellow-600', sub: `${summary.pending_count || 0} invoice${summary.pending_count !== 1 ? 's' : ''}` },
                        { label: 'Collected (This Month)', val: fmtINR(summary.collected_this_month), color: 'text-green-600', sub: 'current month' },
                        { label: 'Collected (All Time)', val: fmtINR(summary.collected_total), color: 'text-indigo-600', sub: `${summary.paid_count || 0} paid` },
                        { label: 'Total Invoices', val: summary.total_count || 0, color: 'text-gray-700', sub: 'all time' },
                    ].map(({ label, val, color, sub }) => (
                        <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                            <p className={`text-2xl font-bold ${color}`}>{val}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-3 flex-wrap items-end mb-6">
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">
                        <option value="">All</option>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="waived">Waived</option>
                        <option value="overdue">Overdue</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                    <input type="date" value={filters.date_from}
                        onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                    <input type="date" value={filters.date_to}
                        onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none" />
                </div>
                <button onClick={load} disabled={loading}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                    {loading ? 'Loading...' : 'Apply Filters'}
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
            ) : fees.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <p className="text-gray-400 text-sm">No placement fee records for the selected period.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                {['Company', 'Candidate', 'Job Role', 'Annual CTC', 'Fee Amount', 'Status', 'Executive', 'Date'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {fees.map(fee => (
                                <tr key={fee.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{fee.company_name}</td>
                                    <td className="px-4 py-3 text-gray-700">{fee.candidate_name}</td>
                                    <td className="px-4 py-3 text-gray-500">{fee.job_title}</td>
                                    <td className="px-4 py-3 text-gray-700">{fmtINR(fee.offered_ctc)}</td>
                                    <td className="px-4 py-3 font-semibold text-indigo-700">{fmtINR(fee.placement_fee_amount)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[fee.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {fee.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{fee.executive_name || '—'}</td>
                                    <td className="px-4 py-3 text-gray-400">{fmtDate(fee.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

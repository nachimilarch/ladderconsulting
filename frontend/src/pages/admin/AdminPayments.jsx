import { useEffect, useState } from 'react';
import { adminInvoiceAPI } from '../../api/payments';
import { adminOfferRequestAPI } from '../../api/admin';

const fmtINR = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS_CLS = {
    pending:        'bg-yellow-100 text-yellow-700',
    partially_paid: 'bg-blue-100 text-blue-700',
    paid:           'bg-green-100 text-green-700',
    overdue:        'bg-red-100 text-red-600',
    cancelled:      'bg-gray-100 text-gray-500',
    waived:         'bg-teal-100 text-teal-700',
    rejected:       'bg-gray-100 text-gray-500',
};

const Kpi = ({ label, value, sub, accent = '' }) => (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${accent || 'border-gray-200'}`}>
        <p className="text-xl font-bold text-gray-800">{value ?? '—'}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
);

export default function AdminPayments() {
    const [tab, setTab] = useState('invoices');

    // ── Invoices ──────────────────────────────────────────────────────────────
    const [invoices,   setInvoices]   = useState([]);
    const [invSummary, setInvSummary] = useState(null);
    const [invFilter,  setInvFilter]  = useState('');
    const [invLoading, setInvLoading] = useState(true);

    useEffect(() => {
        let live = true;
        Promise.all([
            adminInvoiceAPI.list(invFilter ? { status: invFilter } : {}),
            adminInvoiceAPI.summary(),
        ])
            .then(([l, s]) => {
                if (!live) return;
                setInvoices(l.data?.invoices || l.data?.data || []);
                setInvSummary(s.data?.summary || s.data?.data || null);
            })
            .catch(console.error)
            .finally(() => { if (live) setInvLoading(false); });
        return () => { live = false; setInvLoading(true); };
    }, [invFilter]);

    // ── Placement Fees ────────────────────────────────────────────────────────
    const [fees,       setFees]       = useState([]);
    const [feeSummary, setFeeSummary] = useState(null);
    const [feeStatus,  setFeeStatus]  = useState('');
    const [feeLoading, setFeeLoading] = useState(true);

    useEffect(() => {
        let live = true;
        adminOfferRequestAPI.listFees(feeStatus ? { status: feeStatus } : {})
            .then(r => {
                if (!live) return;
                setFees(r.data?.fees || r.data?.data || []);
                setFeeSummary(r.data?.summary || null);
            })
            .catch(console.error)
            .finally(() => { if (live) setFeeLoading(false); });
        return () => { live = false; setFeeLoading(true); };
    }, [feeStatus]);

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Payments & Placement Fees</h2>
            <p className="text-sm text-gray-500 mb-6">All financial activity across the platform</p>

            {/* ── Combined top-level KPIs ─────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Kpi
                    label="Total Invoiced"
                    value={fmtINR(invSummary?.total_invoiced)}
                    sub={`${invSummary?.paid_count || 0} paid invoices`}
                    accent="border-blue-500"
                />
                <Kpi
                    label="Total Collected"
                    value={fmtINR(invSummary?.total_collected)}
                    accent="border-green-500"
                />
                <Kpi
                    label="Outstanding"
                    value={fmtINR(invSummary?.total_outstanding)}
                    sub={`${(invSummary?.pending_count || 0) + (invSummary?.partial_count || 0)} open`}
                    accent="border-yellow-500"
                />
                <Kpi
                    label="Placement Fees Collected"
                    value={fmtINR(feeSummary?.collected_total)}
                    sub={`${feeSummary?.paid_count || 0} placements`}
                    accent="border-indigo-500"
                />
            </div>

            {/* ── Tab switcher ─────────────────────────────────────────────── */}
            <div className="flex gap-0 mb-6 border-b border-gray-200">
                {[
                    { id: 'invoices', label: 'Service Invoices' },
                    { id: 'fees',     label: 'Placement Fees'   },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            tab === t.id
                                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── SERVICE INVOICES ─────────────────────────────────────────── */}
            {tab === 'invoices' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <Kpi label="Pending"    value={invSummary?.pending_count || 0}  accent="border-yellow-400" />
                        <Kpi label="Partial"    value={invSummary?.partial_count || 0}  accent="border-blue-400" />
                        <Kpi label="Overdue"    value={invSummary?.overdue_count || 0}  accent="border-red-400" />
                        <Kpi label="Fully Paid" value={invSummary?.paid_count || 0}     accent="border-green-400" />
                    </div>

                    <div className="flex gap-3 mb-4">
                        <select
                            value={invFilter}
                            onChange={e => setInvFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="partially_paid">Partially Paid</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                        </select>
                    </div>

                    {invLoading ? (
                        <div className="text-center text-gray-400 py-16">Loading…</div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Invoice #</th>
                                        <th className="px-4 py-3 text-left">Company</th>
                                        <th className="px-4 py-3 text-left">Candidate</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                        <th className="px-4 py-3 text-right">Collected</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                        <th className="px-4 py-3 text-left">Due</th>
                                        <th className="px-4 py-3 text-left">Executive</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {invoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-gray-400">No invoices found.</td>
                                        </tr>
                                    ) : invoices.map(inv => (
                                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.invoice_number}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800">{inv.company_name}</td>
                                            <td className="px-4 py-3 text-gray-500">{inv.candidate_name || '—'}</td>
                                            <td className="px-4 py-3 text-right font-medium">{fmtINR(inv.amount)}</td>
                                            <td className="px-4 py-3 text-right text-green-700">{fmtINR(inv.amount_paid)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[inv.status] || 'bg-gray-100 text-gray-500'}`}>
                                                    {inv.status?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500">{fmtDate(inv.due_date)}</td>
                                            <td className="px-4 py-3 text-gray-500">{inv.raised_by_name || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ── PLACEMENT FEES ───────────────────────────────────────────── */}
            {tab === 'fees' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <Kpi label="Pending Fees"         value={fmtINR(feeSummary?.pending_total)}        sub={`${feeSummary?.pending_count || 0} invoices`} accent="border-yellow-400" />
                        <Kpi label="Collected This Month" value={fmtINR(feeSummary?.collected_this_month)} accent="border-green-400" />
                        <Kpi label="All-time Collected"   value={fmtINR(feeSummary?.collected_total)}      sub={`${feeSummary?.paid_count || 0} paid`}        accent="border-indigo-400" />
                        <Kpi label="Total Fee Invoices"   value={feeSummary?.total_count || 0} />
                    </div>

                    <div className="flex gap-3 mb-4">
                        <select
                            value={feeStatus}
                            onChange={e => setFeeStatus(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="waived">Waived</option>
                            <option value="overdue">Overdue</option>
                        </select>
                    </div>

                    {feeLoading ? (
                        <div className="text-center text-gray-400 py-16">Loading…</div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Company</th>
                                        <th className="px-4 py-3 text-left">Candidate</th>
                                        <th className="px-4 py-3 text-left">Job Role</th>
                                        <th className="px-4 py-3 text-right">Annual CTC</th>
                                        <th className="px-4 py-3 text-right">Fee Amount</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                        <th className="px-4 py-3 text-left">Executive</th>
                                        <th className="px-4 py-3 text-left">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {fees.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-gray-400">No placement fees found.</td>
                                        </tr>
                                    ) : fees.map(fee => (
                                        <tr key={fee.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-800">{fee.company_name}</td>
                                            <td className="px-4 py-3 text-gray-600">{fee.candidate_name}</td>
                                            <td className="px-4 py-3 text-gray-500">{fee.job_title}</td>
                                            <td className="px-4 py-3 text-right text-gray-700">{fmtINR(fee.offered_ctc)}</td>
                                            <td className="px-4 py-3 text-right font-semibold">{fmtINR(fee.placement_fee_amount)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[fee.status] || 'bg-gray-100 text-gray-500'}`}>
                                                    {fee.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500">{fee.executive_name || '—'}</td>
                                            <td className="px-4 py-3 text-gray-500">{fmtDate(fee.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

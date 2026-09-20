import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminInvoiceAPI } from '../../api/payments';
import { adminOfferRequestAPI, adminAiSubscriptionAPI } from '../../api/admin';

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

// One entry per invoice_type: how it's labelled, and what a manual "Mark Paid"
// activates (the backend runs the same fulfilment as an online payment).
const TYPE_META = {
    job_posting_fee:     { label: 'Job Posting Fee',   cls: 'bg-indigo-100 text-indigo-700', effect: 'publish the job posting' },
    premium_profile_fee: { label: 'Candidate Premium', cls: 'bg-amber-100 text-amber-700',   effect: 'activate Premium for this candidate' },
    ai_subscription:     { label: 'AI Subscription',   cls: 'bg-violet-100 text-violet-700', effect: 'activate or extend the AI Assistant subscription' },
    placement_fee:       { label: 'Placement Fee',     cls: 'bg-emerald-100 text-emerald-700' },
    training_fee:        { label: 'Training',          cls: 'bg-sky-100 text-sky-700' },
    service_fee:         { label: 'Service Fee',       cls: 'bg-gray-100 text-gray-600' },
    listing_fee:         { label: 'Listing Fee (legacy)', cls: 'bg-gray-100 text-gray-500' },
    resume_unlock:       { label: 'Resume Unlock (legacy)', cls: 'bg-gray-100 text-gray-500' },
};
const typeMeta = (t) => TYPE_META[t] || { label: t?.replace(/_/g, ' ') || '—', cls: 'bg-gray-100 text-gray-500' };

const SUB_STATUS = {
    active:    { label: 'Active',           cls: 'bg-green-100 text-green-700' },
    grace:     { label: 'Payment overdue',  cls: 'bg-yellow-100 text-yellow-700' },
    suspended: { label: 'Suspended',        cls: 'bg-red-100 text-red-600' },
    cancelled: { label: 'Cancelled',        cls: 'bg-gray-100 text-gray-500' },
};

const Kpi = ({ label, value, sub, accent = '' }) => (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${accent || 'border-gray-200'}`}>
        <p className="text-xl font-bold text-gray-800">{value ?? '—'}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
);

const PayerBadge = ({ inv }) => (
    <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-medium text-gray-800">{inv.payer_name || '—'}</span>
        {inv.payer_type === 'candidate' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700">Candidate</span>
        )}
        {inv.company_tier === 'premium' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">⭐ Platinum</span>
        )}
    </div>
);

export default function AdminPayments() {
    const [tab, setTab] = useState('invoices');
    const [markingId, setMarkingId] = useState(null);

    // ── Invoices ──────────────────────────────────────────────────────────────
    const [invoices,   setInvoices]   = useState([]);
    const [invSummary, setInvSummary] = useState(null);
    const [invFilter,  setInvFilter]  = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [invLoading, setInvLoading] = useState(true);

    const invParams = () => ({
        ...(invFilter ? { status: invFilter } : {}),
        ...(typeFilter ? { invoice_type: typeFilter } : {}),
    });

    useEffect(() => {
        let live = true;
        Promise.all([
            adminInvoiceAPI.list({
                ...(invFilter ? { status: invFilter } : {}),
                ...(typeFilter ? { invoice_type: typeFilter } : {}),
            }),
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
    }, [invFilter, typeFilter]);

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

    // ── AI Subscriptions ──────────────────────────────────────────────────────
    const [subs,       setSubs]       = useState([]);
    const [subSummary, setSubSummary] = useState(null);
    const [subStatus,  setSubStatus]  = useState('');
    const [subLoading, setSubLoading] = useState(true);

    useEffect(() => {
        let live = true;
        adminAiSubscriptionAPI.list(subStatus ? { status: subStatus } : {})
            .then(r => {
                if (!live) return;
                setSubs(r.data?.data?.subscriptions || []);
                setSubSummary(r.data?.data?.summary || null);
            })
            .catch(console.error)
            .finally(() => { if (live) setSubLoading(false); });
        return () => { live = false; setSubLoading(true); };
    }, [subStatus]);

    const reloadInvoices = () => {
        setInvLoading(true);
        Promise.all([adminInvoiceAPI.list(invParams()), adminInvoiceAPI.summary()])
            .then(([l, s]) => {
                setInvoices(l.data?.invoices || l.data?.data || []);
                setInvSummary(s.data?.summary || s.data?.data || null);
            }).catch(console.error).finally(() => setInvLoading(false));
        // A paid subscription invoice changes the subscriber list too.
        adminAiSubscriptionAPI.list(subStatus ? { status: subStatus } : {})
            .then(r => {
                setSubs(r.data?.data?.subscriptions || []);
                setSubSummary(r.data?.data?.summary || null);
            }).catch(console.error);
    };

    const reloadFees = () => {
        setFeeLoading(true);
        adminOfferRequestAPI.listFees(feeStatus ? { status: feeStatus } : {})
            .then(r => {
                setFees(r.data?.fees || r.data?.data || []);
                setFeeSummary(r.data?.summary || null);
            }).catch(console.error).finally(() => setFeeLoading(false));
    };

    const handleMarkPaid = async (inv) => {
        const effect = typeMeta(inv.invoice_type).effect;
        const msg = effect
            ? `Mark this invoice as fully paid? This will also ${effect}.`
            : 'Mark this invoice as fully paid?';
        if (!window.confirm(msg)) return;
        setMarkingId(inv.id);
        try {
            await adminInvoiceAPI.markPaid(inv.id);
            toast.success('Invoice marked as paid');
            reloadInvoices();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to mark paid');
        } finally {
            setMarkingId(null);
        }
    };

    const handleMarkFeePaid = async (id) => {
        if (!window.confirm('Mark this placement fee as paid?')) return;
        setMarkingId(id);
        try {
            await adminInvoiceAPI.markFeePaid(id);
            toast.success('Placement fee marked as paid');
            reloadFees();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to mark paid');
        } finally {
            setMarkingId(null);
        }
    };

    const streams = (invSummary?.by_type || []).filter(t => Number(t.invoice_count) > 0);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Payments, Subscriptions & Placement Fees</h2>
            <p className="text-sm text-gray-500 mb-6">All financial activity across the platform — companies and candidates</p>

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
                    sub={`${(invSummary?.pending_count || 0) + (invSummary?.partial_count || 0) + (invSummary?.overdue_count || 0)} open`}
                    accent="border-yellow-500"
                />
                <Kpi
                    label="AI Subscription MRR"
                    value={fmtINR(subSummary?.monthly_recurring)}
                    sub={`${subSummary?.active || 0} active · ${subSummary?.grace || 0} overdue`}
                    accent="border-violet-500"
                />
            </div>

            {/* ── Tab switcher ─────────────────────────────────────────────── */}
            <div className="flex gap-0 mb-6 border-b border-gray-200">
                {[
                    { id: 'invoices', label: 'Invoices' },
                    { id: 'fees',     label: 'Placement Fees' },
                    { id: 'ai',       label: 'AI Subscriptions' },
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

            {/* ── INVOICES ─────────────────────────────────────────────────── */}
            {tab === 'invoices' && (
                <>
                    {streams.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Collected by revenue stream</p>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {streams.map(t => (
                                    <button
                                        key={t.invoice_type}
                                        onClick={() => setTypeFilter(f => f === t.invoice_type ? '' : t.invoice_type)}
                                        className={`text-left bg-white rounded-xl p-3 shadow-sm border transition ${
                                            typeFilter === t.invoice_type ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-100 hover:border-gray-300'
                                        }`}
                                    >
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeMeta(t.invoice_type).cls}`}>
                                            {typeMeta(t.invoice_type).label}
                                        </span>
                                        <p className="text-lg font-bold text-gray-800 mt-1.5">{fmtINR(t.collected)}</p>
                                        <p className="text-[11px] text-gray-400">
                                            {t.paid_count || 0} of {t.invoice_count} paid · {fmtINR(t.invoiced)} invoiced
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <Kpi label="Pending"    value={invSummary?.pending_count || 0}  accent="border-yellow-400" />
                        <Kpi label="Partial"    value={invSummary?.partial_count || 0}  accent="border-blue-400" />
                        <Kpi label="Overdue"    value={invSummary?.overdue_count || 0}  accent="border-red-400" />
                        <Kpi label="Fully Paid" value={invSummary?.paid_count || 0}     accent="border-green-400" />
                    </div>

                    <div className="flex gap-3 mb-4 flex-wrap">
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
                            <option value="cancelled">Cancelled</option>
                            <option value="waived">Waived</option>
                        </select>
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            <option value="">All Types</option>
                            {Object.entries(TYPE_META).map(([k, m]) => (
                                <option key={k} value={k}>{m.label}</option>
                            ))}
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
                                        <th className="px-4 py-3 text-left">Type</th>
                                        <th className="px-4 py-3 text-left">Payer</th>
                                        <th className="px-4 py-3 text-left">For</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                        <th className="px-4 py-3 text-right">Collected</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                        <th className="px-4 py-3 text-left">Due</th>
                                        <th className="px-4 py-3 text-left">Raised by</th>
                                        <th className="px-4 py-3 text-left">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {invoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="text-center py-12 text-gray-400">No invoices found.</td>
                                        </tr>
                                    ) : invoices.map(inv => (
                                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.invoice_number}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${typeMeta(inv.invoice_type).cls}`}>
                                                    {typeMeta(inv.invoice_type).label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3"><PayerBadge inv={inv} /></td>
                                            <td className="px-4 py-3 text-gray-500">
                                                {inv.job_title || inv.candidate_name || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">{fmtINR(inv.amount)}</td>
                                            <td className="px-4 py-3 text-right text-green-700">{fmtINR(inv.amount_paid)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[inv.status] || 'bg-gray-100 text-gray-500'}`}>
                                                    {inv.status?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500">{fmtDate(inv.due_date)}</td>
                                            <td className="px-4 py-3 text-gray-500">{inv.raised_by_name || 'System'}</td>
                                            <td className="px-4 py-3">
                                                {['pending','overdue','partially_paid'].includes(inv.status) && (
                                                    <button
                                                        onClick={() => handleMarkPaid(inv)}
                                                        disabled={markingId === inv.id}
                                                        className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 transition whitespace-nowrap"
                                                    >
                                                        {markingId === inv.id ? '…' : 'Mark Paid'}
                                                    </button>
                                                )}
                                            </td>
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
                                        <th className="px-4 py-3 text-left">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {fees.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-12 text-gray-400">No placement fees found.</td>
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
                                            <td className="px-4 py-3">
                                                {['pending','overdue'].includes(fee.status) && (
                                                    <button
                                                        onClick={() => handleMarkFeePaid(fee.id)}
                                                        disabled={markingId === fee.id}
                                                        className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 transition whitespace-nowrap"
                                                    >
                                                        {markingId === fee.id ? '…' : 'Mark Paid'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ── AI SUBSCRIPTIONS ─────────────────────────────────────────── */}
            {tab === 'ai' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                        <Kpi label="Active"          value={subSummary?.active || 0}    accent="border-green-400" />
                        <Kpi label="Payment overdue" value={subSummary?.grace || 0}     sub="grace period" accent="border-yellow-400" />
                        <Kpi label="Suspended"       value={subSummary?.suspended || 0} accent="border-red-400" />
                        <Kpi label="Cancelled"       value={subSummary?.cancelled || 0} accent="border-gray-300" />
                        <Kpi
                            label="Monthly recurring"
                            value={fmtINR(subSummary?.monthly_recurring)}
                            sub={`${fmtINR(subSummary?.monthly_amount)}/subscriber · ${subSummary?.company_subscribers || 0} companies, ${subSummary?.candidate_subscribers || 0} candidates`}
                            accent="border-violet-400"
                        />
                    </div>

                    <div className="flex gap-3 mb-4">
                        <select
                            value={subStatus}
                            onChange={e => setSubStatus(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="grace">Payment overdue</option>
                            <option value="suspended">Suspended</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    {subLoading ? (
                        <div className="text-center text-gray-400 py-16">Loading…</div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Subscriber</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                        <th className="px-4 py-3 text-left">Current period</th>
                                        <th className="px-4 py-3 text-left">Grace until</th>
                                        <th className="px-4 py-3 text-left">Open invoice</th>
                                        <th className="px-4 py-3 text-left">Since</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {subs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-gray-400">No AI subscriptions found.</td>
                                        </tr>
                                    ) : subs.map(s => {
                                        const st = SUB_STATUS[s.status] || { label: s.status, cls: 'bg-gray-100 text-gray-500' };
                                        return (
                                            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <PayerBadge inv={s} />
                                                    <p className="text-xs text-gray-400">{s.payer_email}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500">
                                                    {fmtDate(s.current_period_start)} – {fmtDate(s.current_period_end)}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500">{fmtDate(s.grace_until)}</td>
                                                <td className="px-4 py-3 text-gray-500">
                                                    {s.open_invoice_number ? (
                                                        <>
                                                            <span className="font-mono text-xs">{s.open_invoice_number}</span>
                                                            <p className="text-xs text-red-600">
                                                                {fmtINR(s.open_invoice_due_amount)} due {fmtDate(s.open_invoice_due_date)}
                                                            </p>
                                                        </>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(s.created_at)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="text-xs text-gray-400 mt-3">
                        Subscriptions bill via a monthly invoice the subscriber pays manually. To record an offline payment,
                        mark the subscription invoice paid under Invoices — it renews the subscription automatically.
                    </p>
                </>
            )}
        </div>
    );
}

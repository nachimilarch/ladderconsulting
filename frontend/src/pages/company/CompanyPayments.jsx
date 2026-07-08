import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { companyInvoiceAPI } from '../../api/payments';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const downloadInvoicePDF = async (invoiceId, invoiceNumber) => {
    try {
        const res = await api.get(`/invoices/company/${invoiceId}/pdf`, { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url; a.download = `Invoice-${invoiceNumber}.pdf`; a.click();
        URL.revokeObjectURL(url);
    } catch {
        toast.error('Failed to download PDF.');
    }
};

const STATUS_COLORS = {
    pending:       'bg-yellow-100 text-yellow-700',
    partially_paid:'bg-blue-100 text-blue-700',
    paid:          'bg-green-100 text-green-700',
    overdue:       'bg-red-100 text-red-600',
    cancelled:     'bg-gray-100 text-gray-500',
    waived:        'bg-gray-100 text-gray-500',
};

const TYPE_LABELS = {
    placement_fee:   'Placement Fee',
    partial_payment: 'Partial Payment',
    other_fee:       'Other Fee',
    resume_unlock:   'Resume Unlock',
    training_fee:    'Training Fee',
};

const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', maximumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const CASHFREE_JS_TEST = 'https://sdk.cashfree.com/js/v3/cashfree.js';
const CASHFREE_JS_PROD = 'https://sdk.cashfree.com/js/v3/cashfree.js'; // same URL; mode controlled by session

export default function CompanyPayments() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [payModal, setPayModal] = useState(null); // { invoice }
    const [payAmount, setPayAmount] = useState('');
    const [paying, setPaying] = useState(false);
    const [pfSummary, setPfSummary] = useState(null); // placement-fee summary

    useEffect(() => {
        companyInvoiceAPI.list()
            .then(r => setInvoices(r.data?.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
        // Outstanding placement fees across hired candidates — partial/full payable via Cashfree
        companyInvoiceAPI.placementFeeSummary()
            .then(r => setPfSummary(r.data?.data || null))
            .catch(() => setPfSummary(null));
    }, []);

    const openPayModal = (inv) => {
        const outstanding = parseFloat(inv.amount) - parseFloat(inv.amount_paid);
        setPayAmount(outstanding.toFixed(2));
        setPayModal(inv);
    };

    const handlePay = async (e) => {
        e.preventDefault();
        const amt = parseFloat(payAmount);
        if (isNaN(amt) || amt <= 0) return toast.error('Enter a valid amount.');
        const outstanding = parseFloat(payModal.amount) - parseFloat(payModal.amount_paid);
        if (amt > outstanding + 0.01) return toast.error(`Max payable: ${fmtINR(outstanding)}`);

        setPaying(true);
        try {
            const { data } = await companyInvoiceAPI.pay(payModal.id, { amount: amt });
            const { payment_session_id, order_id, cashfree_env } = data;

            // Redirect to Cashfree checkout
            const returnUrl = `${window.location.origin}/company/payments/${payModal.id}/callback?txnOrderId=${order_id}`;
            window.location.href = `https://payments.cashfree.com/forms/${payment_session_id}`;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to initiate payment.');
            setPaying(false);
        }
    };

    const summary = invoices.reduce((acc, inv) => {
        acc.total += parseFloat(inv.amount);
        acc.paid += parseFloat(inv.amount_paid);
        return acc;
    }, { total: 0, paid: 0 });
    const outstanding = summary.total - summary.paid;

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
                <p className="text-sm text-gray-500 mt-0.5">Invoices raised by LadderStep Human Consulting</p>
            </div>

            {/* Placement Fee summary — what you owe for selected candidates */}
            {pfSummary && pfSummary.summary.candidates_selected > 0 && (
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 shadow-sm p-5 mb-6">
                    <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                        <div>
                            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Placement Fees</p>
                            <p className="text-sm text-gray-600 mt-0.5">
                                Across <strong>{pfSummary.summary.candidates_selected}</strong> selected candidate{pfSummary.summary.candidates_selected !== 1 ? 's' : ''} ·
                                {' '}{pfSummary.summary.paid_count} paid · {pfSummary.summary.partially_paid_count} partial · {pfSummary.summary.pending_count} pending
                            </p>
                        </div>
                        <span className="text-xs text-gray-500 italic">Pay full or partial via Cashfree</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-white rounded-xl p-3 text-center">
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Total Due</p>
                            <p className="text-lg font-bold text-gray-800">{fmtINR(pfSummary.summary.total_due)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center">
                            <p className="text-[11px] text-green-500 uppercase tracking-wide">Paid</p>
                            <p className="text-lg font-bold text-green-700">{fmtINR(pfSummary.summary.total_paid)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center">
                            <p className="text-[11px] text-orange-500 uppercase tracking-wide">Outstanding</p>
                            <p className="text-lg font-bold text-orange-700">{fmtINR(pfSummary.summary.outstanding)}</p>
                        </div>
                    </div>

                    {/* Per-candidate placement fee invoices with Pay buttons */}
                    {pfSummary.invoices?.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Invoices</p>
                            {pfSummary.invoices.map(inv => {
                                const owed = parseFloat(inv.amount) - parseFloat(inv.amount_paid || 0);
                                const canPay = ['pending', 'partially_paid', 'overdue'].includes(inv.status) && owed > 0;
                                return (
                                    <div key={inv.invoice_id} className="bg-white rounded-xl border border-indigo-100 p-3 flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                <span className="font-mono text-[11px] text-gray-400">{inv.invoice_number}</span>
                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-500'}`}>
                                                    {inv.status?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-gray-800">{inv.candidate_name}</p>
                                            <p className="text-xs text-gray-500">{inv.job_title}</p>
                                            <div className="flex gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                                                <span>Invoice: {fmtINR(inv.amount)}</span>
                                                <span className="text-green-600">Paid: {fmtINR(inv.amount_paid || 0)}</span>
                                                {owed > 0 && <span className="text-orange-600 font-medium">Due: {fmtINR(owed)}</span>}
                                                {inv.due_date && <span>By {fmtDate(inv.due_date)}</span>}
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex flex-col gap-1.5 items-end">
                                            <button
                                                onClick={() => downloadInvoicePDF(inv.invoice_id, inv.invoice_number)}
                                                className="text-xs text-gray-400 hover:text-indigo-600 hover:underline"
                                            >
                                                PDF
                                            </button>
                                            {canPay ? (
                                                <button
                                                    onClick={() => openPayModal({
                                                        id: inv.invoice_id,
                                                        invoice_number: inv.invoice_number,
                                                        amount: inv.amount,
                                                        amount_paid: inv.amount_paid || 0,
                                                        status: inv.status,
                                                    })}
                                                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
                                                >
                                                    Pay Now
                                                </button>
                                            ) : inv.status === 'paid' ? (
                                                <span className="text-xs text-green-600 font-medium">Paid</span>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Summary Cards */}
            {!loading && invoices.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Invoiced</p>
                        <p className="text-xl font-bold text-gray-800">{fmtINR(summary.total)}</p>
                    </div>
                    <div className="bg-green-50 rounded-2xl border border-green-100 shadow-sm p-4 text-center">
                        <p className="text-xs text-green-500 uppercase tracking-wide mb-1">Total Paid</p>
                        <p className="text-xl font-bold text-green-700">{fmtINR(summary.paid)}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-2xl border border-yellow-100 shadow-sm p-4 text-center">
                        <p className="text-xs text-yellow-500 uppercase tracking-wide mb-1">Outstanding</p>
                        <p className="text-xl font-bold text-yellow-700">{fmtINR(outstanding)}</p>
                    </div>
                </div>
            )}

            {/* Pay Modal */}
            {payModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="font-semibold text-gray-800 mb-1">Pay Invoice</h2>
                        <p className="text-xs text-gray-500 mb-4">{payModal.invoice_number}</p>
                        <div className="bg-gray-50 rounded-xl p-3 mb-4 grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <p className="text-gray-400">Total Amount</p>
                                <p className="font-semibold text-gray-800">{fmtINR(payModal.amount)}</p>
                            </div>
                            <div>
                                <p className="text-gray-400">Already Paid</p>
                                <p className="font-semibold text-gray-800">{fmtINR(payModal.amount_paid)}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-gray-400">Outstanding</p>
                                <p className="font-semibold text-indigo-700">{fmtINR(parseFloat(payModal.amount) - parseFloat(payModal.amount_paid))}</p>
                            </div>
                        </div>
                        <form onSubmit={handlePay} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Amount (INR) *</label>
                                <input
                                    type="number"
                                    value={payAmount}
                                    onChange={e => setPayAmount(e.target.value)}
                                    min="1"
                                    step="0.01"
                                    max={parseFloat(payModal.amount) - parseFloat(payModal.amount_paid)}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <p className="text-[10px] text-gray-400 mt-0.5">You can pay partial or full amount</p>
                            </div>
                            <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-700 border border-indigo-100">
                                You will be redirected to Cashfree secure payment page. Powered by Cashfree Payments.
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={paying}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                                    {paying ? 'Redirecting…' : 'Pay Now →'}
                                </button>
                                <button type="button" onClick={() => setPayModal(null)}
                                    className="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Invoice List */}
            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : invoices.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="text-3xl mb-3 text-gray-300">🧾</div>
                    <h3 className="font-semibold text-gray-700 mb-1">No invoices yet</h3>
                    <p className="text-sm text-gray-500">Invoices raised by your LadderStep Human Consulting executive will appear here.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {invoices.map(inv => {
                        const outstanding = parseFloat(inv.amount) - parseFloat(inv.amount_paid);
                        const canPay = ['pending', 'partially_paid', 'overdue'].includes(inv.status);
                        return (
                            <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-mono text-xs text-gray-500">{inv.invoice_number}</span>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status] || 'bg-gray-100'}`}>
                                                {inv.status.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs text-gray-400">{TYPE_LABELS[inv.invoice_type]}</span>
                                        </div>
                                        <p className="font-semibold text-gray-900 text-lg">{fmtINR(inv.amount)}</p>
                                        {inv.description && <p className="text-sm text-gray-600 mt-0.5">{inv.description}</p>}
                                        {inv.candidate_name && <p className="text-xs text-gray-500 mt-0.5">Candidate: {inv.candidate_name}</p>}
                                        <div className="flex gap-4 text-xs text-gray-400 mt-1">
                                            {inv.due_date && <span>Due: {fmtDate(inv.due_date)}</span>}
                                            <span>Paid: {fmtINR(inv.amount_paid)}</span>
                                            {outstanding > 0 && <span className="text-yellow-600 font-medium">Outstanding: {fmtINR(outstanding)}</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 shrink-0 items-end">
                                        <button
                                            onClick={() => navigate(`/company/payments/${inv.id}`)}
                                            className="text-xs text-indigo-600 hover:underline"
                                        >
                                            View →
                                        </button>
                                        <button
                                            onClick={() => downloadInvoicePDF(inv.id, inv.invoice_number)}
                                            className="text-xs text-gray-500 hover:text-indigo-600 hover:underline"
                                        >
                                            Download PDF
                                        </button>
                                        {canPay && (
                                            <button
                                                onClick={() => openPayModal(inv)}
                                                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
                                            >
                                                Pay Now
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

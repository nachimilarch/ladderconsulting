import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { offerRequestAPI } from '../../api/interview';
import { hrInvoiceAPI } from '../../api/payments';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    pending:     'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved:    'bg-green-100 text-green-700',
    rejected:    'bg-red-100 text-red-600',
};

const PAY_STATUS = {
    pending:         ['Awaiting payment',  'bg-yellow-100 text-yellow-700'],
    partially_paid:  ['Partially paid',    'bg-blue-100 text-blue-700'],
    paid:            ['Paid in full',      'bg-green-100 text-green-700'],
    overdue:         ['Overdue',           'bg-red-100 text-red-600'],
};

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
const fmtINR = (n) => n != null
    ? `₹${parseFloat(n).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', maximumFractionDigits: 0 })}`
    : '—';

export default function OfferRequestDetail() {
    const { id } = useParams();
    const [req, setReq] = useState(null);
    const [loading, setLoading] = useState(true);

    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [saving, setSaving] = useState(false);

    // Payment recording
    const [payMode, setPayMode] = useState(null); // 'full' | 'partial'
    const [payAmount, setPayAmount] = useState('');
    const [payNote, setPayNote] = useState('');
    const [payMethod, setPayMethod] = useState('bank_transfer');
    const [recording, setRecording] = useState(false);

    const load = () => {
        setLoading(true);
        offerRequestAPI.getExecDetail(id)
            .then(r => setReq(r.data?.data || null))
            .catch(() => toast.error('Failed to load request'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [id]);

    const handleApprove = async () => {
        if (!window.confirm('Approve this offer letter request? The offer letter will be unlocked for the company and a placement fee invoice will be raised.')) return;
        setSaving(true);
        try {
            await offerRequestAPI.approve(id);
            toast.success('Approved. Offer letter unlocked and invoice raised.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to approve.');
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async (e) => {
        e.preventDefault();
        if (!rejectReason.trim()) return;
        setSaving(true);
        try {
            await offerRequestAPI.reject(id, rejectReason);
            toast.success('Request rejected. Company has been notified.');
            setRejecting(false);
            setRejectReason('');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reject.');
        } finally {
            setSaving(false);
        }
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!req?.payable_invoice_id) return;
        setRecording(true);
        try {
            if (payMode === 'full') {
                await hrInvoiceAPI.markPaid(req.payable_invoice_id, {
                    payment_method: payMethod,
                    payment_note: payNote || undefined,
                });
                toast.success('Invoice marked as fully paid.');
            } else {
                const amt = parseFloat(payAmount);
                if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount.'); setRecording(false); return; }
                await hrInvoiceAPI.markPartial(req.payable_invoice_id, {
                    amount: amt,
                    payment_method: payMethod,
                    payment_note: payNote || undefined,
                });
                toast.success('Partial payment recorded.');
            }
            setPayMode(null);
            setPayAmount('');
            setPayNote('');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record payment.');
        } finally {
            setRecording(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>;
    if (!req) return <div className="p-6 text-gray-500">Request not found.</div>;

    const isActive = ['pending', 'in_progress'].includes(req.status);
    const payable = req.payable_invoice_id ? {
        id: req.payable_invoice_id,
        number: req.payable_invoice_number,
        amount: parseFloat(req.payable_amount || 0),
        paid: parseFloat(req.payable_amount_paid || 0),
        status: req.payable_status,
        due_date: req.payable_due_date,
    } : null;
    const outstanding = payable ? Math.max(payable.amount - payable.paid, 0) : 0;
    const pct = payable && payable.amount > 0 ? Math.min(100, Math.round((payable.paid / payable.amount) * 100)) : 0;
    const [payStatusLabel, payStatusCls] = PAY_STATUS[payable?.status] || ['—', 'bg-gray-100 text-gray-500'];

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <Link to="/hr/offer-requests" className="text-sm text-indigo-600 hover:underline">← Offer Requests</Link>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-500'}`}>
                    {req.status?.replace('_', ' ')}
                </span>
            </div>

            {/* Company + candidate info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h1 className="text-xl font-bold text-gray-900">{req.company_name}</h1>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {[
                        { label: 'Contact', val: req.company_contact },
                        { label: 'Industry', val: req.industry || '—' },
                        { label: 'Contact Email', val: req.company_email },
                        { label: 'Candidate', val: req.candidate_name },
                        { label: 'Job Role', val: req.job_title },
                        { label: 'Documents', val: req.candidate_id
                            ? <Link to={`/hr/candidates/${req.candidate_id}/documents`} className="text-blue-600 hover:underline text-sm">View Documents ↗</Link>
                            : '—' },
                        { label: 'Submitted', val: fmtDate(req.created_at) },
                    ].map(({ label, val }) => (
                        <div key={label}>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                            <p className="font-medium text-gray-800 mt-0.5">{val}</p>
                        </div>
                    ))}
                </div>
                {req.request_note && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 italic">
                        "{req.request_note}"
                    </div>
                )}
            </div>

            {/* Fee details */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Placement Fee</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Offered Annual CTC</p>
                        <p className="text-2xl font-bold text-gray-900 mt-0.5">{fmtINR(req.offered_ctc)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Placement Fee (1× monthly)</p>
                        <p className="text-2xl font-bold text-indigo-700 mt-0.5">{fmtINR(req.placement_fee_amount)}</p>
                    </div>
                </div>
            </div>

            {/* Grant + payable invoice status — visible once approved */}
            {req.grant_id && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-700">
                    Offer letter grant created on {fmtDate(req.granted_at)}. The company can now generate and send the offer letter.
                </div>
            )}

            {/* Payable invoice + payment recording */}
            {payable && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 className="font-semibold text-gray-800">Payment Status</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-500">{payable.number}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${payStatusCls}`}>{payStatusLabel}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total Due</p>
                            <p className="text-base font-bold text-gray-800">{fmtINR(payable.amount)}</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-green-500 uppercase tracking-wide">Received</p>
                            <p className="text-base font-bold text-green-700">{fmtINR(payable.paid)}</p>
                        </div>
                        <div className="bg-yellow-50 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-yellow-600 uppercase tracking-wide">Outstanding</p>
                            <p className="text-base font-bold text-yellow-700">{fmtINR(outstanding)}</p>
                        </div>
                    </div>

                    {payable.amount > 0 && (
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                    )}

                    {payable.due_date && (
                        <p className="text-xs text-gray-400">Due: {fmtDate(payable.due_date)}</p>
                    )}

                    {/* Payment history */}
                    {req.transactions?.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment History</p>
                            <div className="flex flex-col gap-1.5">
                                {req.transactions.map((txn, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                                        <span className="text-gray-600">{txn.payment_method?.replace('_', ' ')}{txn.payment_note ? ` · ${txn.payment_note}` : ''}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold text-green-700">{fmtINR(txn.amount)}</span>
                                            <span className="text-gray-400">{fmtDate(txn.completed_at)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Record payment buttons */}
                    {outstanding > 0 && payable.status !== 'paid' && (
                        <div>
                            {!payMode ? (
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => setPayMode('full')}
                                        className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700 transition">
                                        Mark Fully Paid
                                    </button>
                                    <button
                                        onClick={() => { setPayMode('partial'); setPayAmount(outstanding.toFixed(2)); }}
                                        className="border border-indigo-200 text-indigo-700 px-4 py-2 rounded-xl text-sm hover:bg-indigo-50 transition">
                                        Record Partial Payment
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleRecordPayment} className="space-y-3">
                                    <p className="text-sm font-medium text-gray-700">
                                        {payMode === 'full' ? 'Confirm full payment received' : 'Record partial payment'}
                                    </p>
                                    {payMode === 'partial' && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (INR) *</label>
                                            <input
                                                type="number"
                                                value={payAmount}
                                                onChange={e => setPayAmount(e.target.value)}
                                                min="1"
                                                max={outstanding}
                                                step="0.01"
                                                required
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                                        <select
                                            value={payMethod}
                                            onChange={e => setPayMethod(e.target.value)}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="upi">UPI</option>
                                            <option value="cheque">Cheque</option>
                                            <option value="cash">Cash</option>
                                            <option value="online">Online / Cashfree</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
                                        <input
                                            type="text"
                                            value={payNote}
                                            onChange={e => setPayNote(e.target.value)}
                                            placeholder="e.g. NEFT ref # 12345"
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button type="submit" disabled={recording}
                                            className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                                            {recording ? 'Recording…' : 'Confirm Payment'}
                                        </button>
                                        <button type="button" onClick={() => { setPayMode(null); setPayNote(''); }}
                                            className="border border-gray-300 text-gray-600 px-5 py-2 rounded-xl text-sm hover:bg-gray-50">
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Rejection reason */}
            {req.status === 'rejected' && req.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
                    <span className="font-semibold">Rejection Reason: </span>{req.rejection_reason}
                </div>
            )}

            {/* Actions — approve/reject (only when pending and not yet granted) */}
            {isActive && !req.grant_id && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                    <h2 className="font-semibold text-gray-800">Actions</h2>

                    {!rejecting ? (
                        <div className="flex gap-3 flex-wrap">
                            <button
                                onClick={handleApprove}
                                disabled={saving}
                                className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition">
                                {saving ? 'Processing...' : 'Approve Offer Letter'}
                            </button>
                            <button
                                onClick={() => setRejecting(true)}
                                className="border border-red-200 text-red-600 px-5 py-2 rounded-xl text-sm hover:bg-red-50 transition">
                                Reject Request
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleReject} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Rejection Reason *</label>
                                <textarea
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    required
                                    rows={3}
                                    placeholder="Explain why the request cannot be approved..."
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={saving || !rejectReason.trim()}
                                    className="bg-red-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                                    {saving ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                                <button type="button" onClick={() => { setRejecting(false); setRejectReason(''); }}
                                    className="border border-gray-300 text-gray-600 px-5 py-2 rounded-xl text-sm hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}

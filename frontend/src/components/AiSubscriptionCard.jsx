import { useEffect, useState } from 'react';
import { aiSubscriptionAPI } from '../api/aiSubscription';
import toast from 'react-hot-toast';

const CASHFREE_SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';

const loadCashfreeSDK = () => new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const s = document.createElement('script');
    s.src = CASHFREE_SDK_URL;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
});

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS_STYLE = {
    active:    { label: '✓ Active',    cls: 'bg-green-50 border-green-100 text-green-700' },
    grace:     { label: '⏳ Payment overdue', cls: 'bg-yellow-50 border-yellow-100 text-yellow-700' },
    suspended: { label: '⛔ Suspended', cls: 'bg-red-50 border-red-100 text-red-700' },
    cancelled: { label: 'Cancelled',   cls: 'bg-gray-50 border-gray-100 text-gray-500' },
};

// Shared between CompanyProfile.jsx and CandidateProfile.jsx — the AI-usage
// subscription is the same ₹299/month, manual-invoice model on both sides,
// just billed against whichever payer the logged-in account resolves to.
export default function AiSubscriptionCard() {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = () => {
        setLoading(true);
        aiSubscriptionAPI.status()
            .then(({ data }) => setStatus(data))
            .catch(() => toast.error('Failed to load AI subscription status.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const checkout = async (apiCall) => {
        setBusy(true);
        try {
            const { data } = await apiCall();
            const { payment_session_id, cashfree_env } = data;
            await loadCashfreeSDK();
            const mode = cashfree_env === 'PROD' ? 'production' : 'sandbox';
            const cashfree = window.Cashfree({ mode });
            cashfree.checkout({ paymentSessionId: payment_session_id, redirectTarget: '_self' });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to initiate payment.');
            setBusy(false);
        }
    };

    const handleCancel = async () => {
        if (!window.confirm('Cancel your AI Assistant subscription?')) return;
        setBusy(true);
        try {
            await aiSubscriptionAPI.cancel();
            toast.success('Subscription cancelled.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to cancel.');
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-sm text-gray-400">Loading…</p>
            </div>
        );
    }

    const sub = status?.subscription;
    const statusInfo = sub ? STATUS_STYLE[sub.status] : null;
    const isUsable = sub && (sub.status === 'active' || sub.status === 'grace');

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">AI Assistant Subscription</h2>
            <p className="text-xs text-gray-500 mb-4">
                ₹{status?.amount || 299}/month — unlocks the AI chatbot for drafting, matching, and profile help. Opt-in, cancel anytime.
            </p>

            {!sub ? (
                <button
                    onClick={() => checkout(aiSubscriptionAPI.subscribe)}
                    disabled={busy}
                    className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
                >
                    {busy ? '…' : `Subscribe — ₹${status?.amount || 299}/mo`}
                </button>
            ) : (
                <>
                    <div className={`rounded-xl border px-4 py-3 text-sm font-medium mb-3 ${statusInfo.cls}`}>
                        {statusInfo.label}
                        {sub.status !== 'cancelled' && (
                            <span className="block text-xs font-normal mt-0.5 opacity-80">
                                Current period: {fmtDate(sub.current_period_start)} – {fmtDate(sub.current_period_end)}
                            </span>
                        )}
                    </div>

                    {status.outstanding_invoice && (
                        <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3 text-xs text-yellow-800 mb-3">
                            Invoice {status.outstanding_invoice.invoice_number} — ₹{status.outstanding_invoice.amount} due {fmtDate(status.outstanding_invoice.due_date)}.
                        </div>
                    )}

                    <div className="flex gap-2">
                        {status.outstanding_invoice && (
                            <button
                                onClick={() => checkout(aiSubscriptionAPI.payInvoice)}
                                disabled={busy}
                                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
                            >
                                {busy ? '…' : `Pay ₹${status.outstanding_invoice.amount}`}
                            </button>
                        )}
                        {sub.status === 'suspended' && !status.outstanding_invoice && (
                            <button
                                onClick={() => checkout(aiSubscriptionAPI.subscribe)}
                                disabled={busy}
                                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
                            >
                                {busy ? '…' : 'Reactivate'}
                            </button>
                        )}
                        {isUsable && (
                            <button
                                onClick={handleCancel}
                                disabled={busy}
                                className="border border-gray-200 text-gray-500 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

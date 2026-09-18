import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { candidatePremiumAPI } from '../../api/candidate';
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

const MIN_CTC = 600000;

export default function CandidatePremium() {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [ctc, setCtc] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [paying, setPaying] = useState(false);

    const load = () => {
        setLoading(true);
        candidatePremiumAPI.status()
            .then(({ data }) => setStatus(data))
            .catch(() => toast.error('Failed to load Premium status.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const val = parseFloat(ctc);
        if (isNaN(val) || val < MIN_CTC) {
            toast.error(`Declared annual CTC must be at least ₹${MIN_CTC.toLocaleString('en-IN')}.`);
            return;
        }
        setSubmitting(true);
        try {
            const { data } = await candidatePremiumAPI.request(val);
            toast.success(data?.message || 'Request submitted.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePay = async () => {
        setPaying(true);
        try {
            const { data } = await candidatePremiumAPI.pay();
            const { payment_session_id, cashfree_env } = data;
            await loadCashfreeSDK();
            const mode = cashfree_env === 'PROD' ? 'production' : 'sandbox';
            const cashfree = window.Cashfree({ mode });
            cashfree.checkout({ paymentSessionId: payment_session_id, redirectTarget: '_self' });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to initiate payment.');
            setPaying(false);
        }
    };

    if (loading) return <div className="text-gray-400 text-sm p-4">Loading…</div>;

    const request = status?.request;
    const payslipCount = status?.payslip_count || 0;

    return (
        <div className="max-w-xl mx-auto">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Premium Profile</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Verified candidates earning ₹6 LPA or more get boosted visibility to LadderStep's Premium hiring companies.
                </p>
            </div>

            {status?.is_premium ? (
                <div className="bg-green-50 border border-green-100 rounded-2xl px-6 py-5 text-sm text-green-700 font-medium">
                    ⭐ Your profile is Premium — you're boosted to the top of Talent Pool results shown to Premium companies.
                </div>
            ) : request?.status === 'pending' ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <p className="text-sm font-semibold text-gray-900 mb-1">Verification pending</p>
                    <p className="text-xs text-gray-500">
                        Declared CTC: ₹{parseFloat(request.declared_annual_ctc).toLocaleString('en-IN')}/yr.
                        Your executive is reviewing your uploaded payslips.
                    </p>
                </div>
            ) : request?.status === 'approved' ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <p className="text-sm font-semibold text-gray-900 mb-2">✓ Verification approved</p>
                    <p className="text-xs text-gray-500 mb-4">
                        Pay the one-time ₹999 Premium profile fee to activate your Premium status.
                    </p>
                    <button
                        onClick={handlePay}
                        disabled={paying}
                        className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
                    >
                        {paying ? '…' : 'Pay ₹999 — Activate Premium'}
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    {request?.status === 'rejected' && (
                        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-700 mb-4">
                            Your last request was not approved{request.review_note ? `: ${request.review_note}` : '.'} You can submit a new one below.
                        </div>
                    )}

                    <p className="text-sm font-semibold text-gray-900 mb-1">1. Upload your last 3 payslips</p>
                    <p className="text-xs text-gray-500 mb-2">
                        Use the Documents page and choose "Payslip (Last 3 months)" as the type.
                        {' '}
                        <span className={payslipCount > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                            {payslipCount} payslip{payslipCount !== 1 ? 's' : ''} uploaded
                        </span>
                    </p>
                    <Link
                        to="/candidate/documents"
                        className="inline-block text-xs border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition font-medium mb-5"
                    >
                        Go to Documents →
                    </Link>

                    <form onSubmit={handleSubmit}>
                        <p className="text-sm font-semibold text-gray-900 mb-1">2. Declare your current annual CTC</p>
                        <p className="text-xs text-gray-400 mb-2">Minimum ₹{MIN_CTC.toLocaleString('en-IN')}/year to qualify.</p>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min={0}
                                value={ctc}
                                onChange={e => setCtc(e.target.value)}
                                placeholder="e.g. 800000"
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                                type="submit"
                                disabled={submitting || payslipCount < 1}
                                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition whitespace-nowrap"
                            >
                                {submitting ? '…' : 'Submit for Review'}
                            </button>
                        </div>
                        {payslipCount < 1 && (
                            <p className="text-[11px] text-gray-400 mt-1">Upload at least one payslip before submitting.</p>
                        )}
                    </form>
                </div>
            )}
        </div>
    );
}

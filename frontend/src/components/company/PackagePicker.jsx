import { useEffect, useState } from 'react';
import { talentPoolAPI } from '../../api/company';
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

// Self-contained resume-unlock package picker. Shows current status (Platinum
// badge / credits remaining) if already selected; otherwise the 3-tier picker.
// Used both as the mandatory gate on TalentPool.jsx and standalone on
// CompanyProfile.jsx for re-selecting/topping up later.
export default function PackagePicker({ onSelected, title = 'Resume Unlock Package', subtitle }) {
    const [loading, setLoading] = useState(true);
    const [platinum, setPlatinum] = useState(false);
    const [packCredits, setPackCredits] = useState(0);
    const [buying, setBuying] = useState(null); // 'single' | 'pack_4' | null
    const [note, setNote] = useState('');
    const [requesting, setRequesting] = useState(false);
    const [requested, setRequested] = useState(false);

    const load = () => {
        setLoading(true);
        talentPoolAPI.packageStatus()
            .then(({ data }) => {
                setPlatinum(!!data?.platinum);
                onSelected?.(!!data?.has_package);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
        talentPoolAPI.unlockStatus()
            .then(({ data }) => setPackCredits(data?.pack_credits_remaining || 0))
            .catch(() => {});
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleBuyPackage = async (tier) => {
        setBuying(tier);
        try {
            const { data } = await talentPoolAPI.buyPack(tier);
            const { payment_session_id, cashfree_env } = data;
            await loadCashfreeSDK();
            const mode = cashfree_env === 'PROD' ? 'production' : 'sandbox';
            const cashfree = window.Cashfree({ mode });
            cashfree.checkout({ paymentSessionId: payment_session_id, redirectTarget: '_self' });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to initiate payment.');
            setBuying(null);
        }
    };

    const handleRequestPlatinum = async () => {
        setRequesting(true);
        try {
            const { data } = await talentPoolAPI.requestPlatinum(note.trim() || undefined);
            toast.success(data?.message || 'Request sent.');
            setRequested(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send request.');
        } finally {
            setRequesting(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">{title}</h2>
            <p className="text-xs text-gray-500 mb-4">
                {subtitle || 'Get full profile detail and downloadable resumes for candidates in the Talent Pool.'}
            </p>

            {loading ? (
                <p className="text-sm text-gray-400">Loading…</p>
            ) : platinum ? (
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                    ⭐ Platinum — unlimited free resume unlocks under your placement agreement
                </div>
            ) : (
                <>
                    {packCredits > 0 && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm text-indigo-700 font-medium mb-4">
                            🔓 {packCredits} unlock credit{packCredits !== 1 ? 's' : ''} remaining
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Single Resume Unlock <span className="text-gray-400 font-normal">— ₹999 (incl. GST)</span></p>
                                <p className="text-xs text-gray-400">1 credit — pick a candidate anytime, no expiry. No placement fee on hire.</p>
                            </div>
                            <button
                                onClick={() => handleBuyPackage('single')}
                                disabled={!!buying}
                                className="text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-60 transition font-medium whitespace-nowrap"
                            >
                                {buying === 'single' ? '…' : 'Buy Now'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-gray-900">5-Resume Pack <span className="text-gray-400 font-normal">— ₹3,999 (incl. GST)</span></p>
                                <p className="text-xs text-gray-400">5 credits — use anytime, no expiry. No placement fee on any hire.</p>
                            </div>
                            <button
                                onClick={() => handleBuyPackage('pack_4')}
                                disabled={!!buying}
                                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition font-medium whitespace-nowrap"
                            >
                                {buying === 'pack_4' ? '…' : packCredits > 0 ? 'Buy More' : 'Buy Now'}
                            </button>
                        </div>

                        <div className="border border-gray-200 rounded-xl px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900 mb-1">Platinum</p>
                            <p className="text-xs text-gray-400 mb-2">Unlimited free unlocks. You pay a placement fee — at your contracted rate — only when you hire. Reviewed and set up by your account executive.</p>
                            {requested ? (
                                <p className="text-xs text-green-600 font-medium">✓ Request sent — your executive will follow up.</p>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        placeholder="Optional note for your executive…"
                                        className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <button
                                        onClick={handleRequestPlatinum}
                                        disabled={requesting}
                                        className="text-xs border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-60 transition font-medium whitespace-nowrap"
                                    >
                                        {requesting ? '…' : 'Request Platinum'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

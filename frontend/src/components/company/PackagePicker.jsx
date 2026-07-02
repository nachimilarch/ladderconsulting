import { useEffect, useState } from 'react';
import { talentPoolAPI } from '../../api/company';
import toast from 'react-hot-toast';

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
    const [requestedTier, setRequestedTier] = useState(null); // 'single' | 'pack_4' | 'platinum'

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

    const handleRequestPackage = async (tier) => {
        setBuying(tier);
        try {
            const { data } = await talentPoolAPI.requestPackage(tier, note.trim() || undefined);
            toast.success(data?.message || 'Request sent. Our team will activate it shortly.');
            setRequestedTier(tier);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send request.');
        } finally {
            setBuying(null);
        }
    };

    const handleRequestPlatinum = async () => {
        setRequesting(true);
        try {
            const { data } = await talentPoolAPI.requestPlatinum(note.trim() || undefined);
            toast.success(data?.message || 'Request sent.');
            setRequested(true);
            setRequestedTier('platinum');
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
                            {requestedTier === 'single' ? (
                                <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ Requested</span>
                            ) : (
                                <button
                                    onClick={() => handleRequestPackage('single')}
                                    disabled={!!buying}
                                    className="text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-60 transition font-medium whitespace-nowrap"
                                >
                                    {buying === 'single' ? '…' : 'Request'}
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-gray-900">5-Resume Pack <span className="text-gray-400 font-normal">— ₹3,999 (incl. GST)</span></p>
                                <p className="text-xs text-gray-400">5 credits — use anytime, no expiry. No placement fee on any hire.</p>
                            </div>
                            {requestedTier === 'pack_4' ? (
                                <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ Requested</span>
                            ) : (
                                <button
                                    onClick={() => handleRequestPackage('pack_4')}
                                    disabled={!!buying}
                                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition font-medium whitespace-nowrap"
                                >
                                    {buying === 'pack_4' ? '…' : packCredits > 0 ? 'Request more' : 'Request'}
                                </button>
                            )}
                        </div>

                        <div className="border border-gray-200 rounded-xl px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900 mb-1">Platinum</p>
                            <p className="text-xs text-gray-400 mb-2">Unlimited free unlocks. You pay a placement fee — at your contracted rate — only when you hire, same as before. Reviewed and set up by your account executive.</p>
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

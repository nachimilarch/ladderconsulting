import { useEffect, useState } from 'react';
import { talentPoolAPI, premiumAPI } from '../../api/company';
import toast from 'react-hot-toast';

// Shows the company's current tier and, for Standard-tier companies, lets them
// request the Premium tier (8.33% placement fee per hire, replaces the ₹3,999
// per-job fee).
export default function PremiumTierCard() {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [note, setNote] = useState('');
    const [requesting, setRequesting] = useState(false);
    const [requested, setRequested] = useState(false);

    const load = () => {
        setLoading(true);
        talentPoolAPI.activationStatus()
            .then(({ data }) => setStatus(data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleRequest = async () => {
        setRequesting(true);
        try {
            const { data } = await premiumAPI.request(note.trim() || undefined);
            toast.success(data?.message || 'Request sent.');
            setRequested(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send request.');
        } finally {
            setRequesting(false);
        }
    };

    const isPremium = status?.company_tier === 'premium';

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Account Tier</h2>
            <p className="text-xs text-gray-500 mb-4">
                {isPremium
                    ? 'You post jobs with no per-job fee. Every hire carries an 8.33% placement fee.'
                    : 'You’re on the Standard tier — post jobs and hire from the free candidate pool for a flat ₹3,999.'}
            </p>

            {loading ? (
                <p className="text-sm text-gray-400">Loading…</p>
            ) : isPremium ? (
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                    ⭐ Platinum — no per-job fee, 8.33% placement fee per hire
                </div>
            ) : (
                <>
                    <div className={`rounded-xl px-4 py-3 text-sm font-medium mb-4 ${status?.activated ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' : 'bg-gray-50 border border-gray-100 text-gray-500'}`}>
                        {status?.activated
                            ? '✓ Listing fee paid — you can post jobs and browse the free candidate pool.'
                            : 'Pay the ₹3,999 listing fee to post jobs and browse the free candidate pool.'}
                    </div>

                    <div className="border border-gray-200 rounded-xl px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900 mb-1">Premium Tier</p>
                        <p className="text-xs text-gray-400 mb-2">
                            Replaces the per-job fee: you pay nothing to post jobs, but every hire is charged an
                            8.33% placement fee at hire time.
                            Reviewed and approved by your account executive.
                        </p>
                        {requested || status?.premium_requested_at ? (
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
                                    onClick={handleRequest}
                                    disabled={requesting}
                                    className="text-xs border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-60 transition font-medium whitespace-nowrap"
                                >
                                    {requesting ? '…' : 'Request Premium'}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

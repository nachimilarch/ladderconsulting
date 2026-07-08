import { useEffect, useState } from 'react';
import { applicationAPI } from '../../api/candidate';
import { candidateInterviewAPI } from '../../api/interview';

const STATUS_CONFIG = {
    applied:              { label: 'Applied',              cls: 'bg-blue-100 text-blue-700' },
    under_review:         { label: 'Under Review',         cls: 'bg-yellow-100 text-yellow-700' },
    shortlisted:          { label: 'Shortlisted',          cls: 'bg-green-100 text-green-700' },
    interview_scheduled:  { label: 'Interview Scheduled',  cls: 'bg-purple-100 text-purple-700' },
    interviewed:          { label: 'Interviewed',          cls: 'bg-indigo-100 text-indigo-700' },
    offer_sent:           { label: 'Offer Sent',           cls: 'bg-teal-100 text-teal-700' },
    hired:                { label: 'Hired 🎉',             cls: 'bg-green-100 text-green-800' },
    rejected:             { label: 'Rejected',             cls: 'bg-red-100 text-red-600' },
    withdrawn:            { label: 'Withdrawn',            cls: 'bg-gray-100 text-gray-500' },
};

const WITHDRAWABLE = ['applied', 'under_review', 'shortlisted'];

export default function CandidateApplications() {
    const [applications, setApplications] = useState([]);
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [withdrawing, setWithdrawing] = useState(null);
    const [offerAction, setOfferAction] = useState(null);
    const [error, setError] = useState('');

    // Decline modal state
    const [declineOffer, setDeclineOffer] = useState(null);
    const [declineReason, setDeclineReason] = useState('');

    const load = () => {
        return Promise.allSettled([
            applicationAPI.getAll(),
            candidateInterviewAPI.getMyOffers(),
        ]).then(([appResult, offerResult]) => {
            if (appResult.status === 'fulfilled') {
                const d = appResult.value.data;
                // Backend returns { success, data: [...] }
                setApplications(Array.isArray(d.data) ? d.data : d.applications ?? []);
            } else {
                setError('Failed to load applications.');
            }
            if (offerResult.status === 'fulfilled') {
                const d = offerResult.value.data;
                setOffers(Array.isArray(d.data) ? d.data : d.offers ?? []);
            }
            // Offers failing is non-fatal — applications still show
        });
    };

    useEffect(() => { load().finally(() => setLoading(false)); }, []);

    const handleWithdraw = async (app) => {
        if (!window.confirm(`Withdraw your application for "${app.title}" at ${app.company_name}?`)) return;
        setWithdrawing(app.id);
        try {
            await applicationAPI.withdraw(app.id);
            load();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to withdraw application.');
        } finally {
            setWithdrawing(null);
        }
    };

    const handleOfferAccept = async (offer) => {
        if (!window.confirm(`Accept this offer from ${offer.company_name} for ${offer.job_title}?`)) return;
        setOfferAction(offer.offer_id);
        try {
            await candidateInterviewAPI.respondToOffer(offer.offer_id, { response: 'accepted' });
            load();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to accept offer.');
        } finally {
            setOfferAction(null);
        }
    };

    const handleOfferDecline = async (e) => {
        e.preventDefault();
        setOfferAction(declineOffer.offer_id);
        try {
            await candidateInterviewAPI.respondToOffer(declineOffer.offer_id, {
                response: 'declined',
                decline_reason: declineReason,
            });
            setDeclineOffer(null);
            setDeclineReason('');
            load();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to decline offer.');
        } finally {
            setOfferAction(null);
        }
    };

    const formatSalary = (min, max) => {
        if (!min && !max) return null;
        const fmt = (v) => `₹${(v / 100000).toFixed(1)}L`;
        if (min && max) return `${fmt(min)} – ${fmt(max)}`;
        return min ? `From ${fmt(min)}` : `Up to ${fmt(max)}`;
    };

    const formatCTC = (amount, currency = 'INR') => {
        if (!amount) return null;
        if (currency === 'INR') return `₹${(amount / 100000).toFixed(2)}L`;
        return `${currency} ${Number(amount).toLocaleString()}`;
    };

    // Map offer by application_id for quick lookup
    const offerByApp = {};
    for (const o of offers) {
        offerByApp[o.application_id] = o;
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64"><div className="text-gray-400 text-sm">Loading...</div></div>;
    }

    return (
        <div className="max-w-4xl mx-auto animate-slide-up">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
                <p className="text-sm text-gray-500 mt-1">
                    {applications.length} application{applications.length !== 1 ? 's' : ''}
                </p>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

            {/* Decline Modal */}
            {declineOffer && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="font-semibold text-gray-800 mb-1">Decline Offer</h2>
                        <p className="text-xs text-gray-500 mb-4">
                            {declineOffer.job_title} at {declineOffer.company_name}
                        </p>
                        <form onSubmit={handleOfferDecline} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
                                <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)}
                                    rows={3} placeholder="Let the company know why you're declining..."
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={offerAction === declineOffer.offer_id}
                                    className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                                    {offerAction === declineOffer.offer_id ? 'Declining...' : 'Decline Offer'}
                                </button>
                                <button type="button" onClick={() => { setDeclineOffer(null); setDeclineReason(''); }}
                                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {applications.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
                    <div className="text-5xl mb-4">📋</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No applications yet</h3>
                    <p className="text-sm text-gray-500">Browse open positions and apply to jobs that match your skills.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {applications.map((app) => {
                        const statusInfo = STATUS_CONFIG[app.status] || { label: app.status, cls: 'bg-gray-100 text-gray-500' };
                        const canWithdraw = WITHDRAWABLE.includes(app.status);
                        const salary = formatSalary(app.salary_min, app.salary_max);
                        const offer = offerByApp[app.id];
                        const offerPending = offer && offer.offer_status === 'sent';

                        return (
                            <div key={app.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-opacity ${
                                app.status === 'withdrawn' ? 'opacity-60' : ''
                            }`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-semibold text-gray-900 truncate">{app.title}</h3>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.cls}`}>
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">
                                            {app.company_name}
                                            {app.location && <span className="text-gray-400"> • {app.location}</span>}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                            {app.job_type && <span className="capitalize">{app.job_type.replace('_', ' ')}</span>}
                                            {salary && <span>💰 {salary}</span>}
                                            <span>Applied {new Date(app.applied_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata',
                                                day: 'numeric', month: 'short', year: 'numeric',
                                            })}</span>
                                        </div>

                                        {/* Offer details when pending */}
                                        {offerPending && (
                                            <div className="mt-3 pt-3 border-t border-teal-100 bg-teal-50 rounded-xl p-3">
                                                <p className="text-xs font-semibold text-teal-700 mb-1">You have a pending offer!</p>
                                                <div className="flex flex-wrap gap-3 text-xs text-teal-600">
                                                    {offer.ctc_amount && <span>💰 CTC: {formatCTC(offer.ctc_amount, offer.ctc_currency)}</span>}
                                                    {offer.joining_date && <span>📅 Join: {new Date(offer.joining_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata',
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                    })}</span>}
                                                </div>
                                                {offer.offer_notes && (
                                                    <p className="text-xs text-teal-500 mt-1 italic">{offer.offer_notes}</p>
                                                )}
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => handleOfferAccept(offer)}
                                                        disabled={offerAction === offer.offer_id}
                                                        className="text-xs bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-60 font-medium">
                                                        {offerAction === offer.offer_id ? '...' : 'Accept Offer'}
                                                    </button>
                                                    <button
                                                        onClick={() => { setDeclineOffer(offer); setDeclineReason(''); }}
                                                        disabled={offerAction === offer.offer_id}
                                                        className="text-xs bg-red-50 text-red-600 border border-red-200 px-4 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-60">
                                                        Decline
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {offer && offer.offer_status === 'accepted' && (
                                            <div className="mt-3 pt-3 border-t border-green-100">
                                                <p className="text-xs text-green-700 font-medium">Offer accepted — you're hired!</p>
                                            </div>
                                        )}

                                        {offer && offer.offer_status === 'declined' && (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <p className="text-xs text-gray-400 italic">Offer declined.</p>
                                            </div>
                                        )}
                                    </div>

                                    {canWithdraw && !offerPending && (
                                        <button onClick={() => handleWithdraw(app)} disabled={withdrawing === app.id}
                                            className="shrink-0 text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition">
                                            {withdrawing === app.id ? 'Withdrawing...' : 'Withdraw'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

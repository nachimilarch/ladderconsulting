import { useEffect, useState } from 'react';
import { companyInterviewAPI } from '../../api/interview';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const downloadOfferLetter = async (offerId, candidateName, jobTitle) => {
    try {
        const res = await api.get(`/interviews/offers/${offerId}/pdf`, { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        const safe = (s) => (s || '').replace(/\s+/g, '_');
        a.href = url; a.download = `OfferLetter-${safe(candidateName)}-${safe(jobTitle)}.pdf`; a.click();
        URL.revokeObjectURL(url);
    } catch {
        toast.error('Failed to download offer letter.');
    }
};

const sendOfferLetter = async (offerId) => {
    try {
        await api.post(`/interviews/offers/${offerId}/letter/send`);
        toast.success('Offer letter sent to candidate.');
    } catch {
        toast.error('Failed to send offer letter.');
    }
};

const STATUS_COLORS = {
    sent:      'bg-blue-100 text-blue-700',
    accepted:  'bg-green-100 text-green-700',
    declined:  'bg-red-100 text-red-600',
    expired:   'bg-gray-100 text-gray-500',
    withdrawn: 'bg-gray-100 text-gray-500',
};

export default function OfferManagement() {
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        companyInterviewAPI.listSlots()
            .then(({ data }) => setSlots((data.slots || []).filter(s => s.offer_id)))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const formatCTC = (amount, currency = 'INR') => {
        if (!amount) return '—';
        if (currency === 'INR') return `₹${(amount / 100000).toFixed(2)}L`;
        return `${currency} ${Number(amount).toLocaleString()}`;
    };

    const offersWithData = slots.filter(s => s.offer_status);

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Offer Management</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Offers are generated from the Interviews page after recording a "selected" outcome.
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
            ) : offersWithData.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="text-4xl mb-3">📨</div>
                    <h3 className="font-semibold text-gray-700 mb-1">No offers sent yet</h3>
                    <p className="text-sm text-gray-500">
                        Go to <span className="font-medium text-indigo-600">Interviews</span>, record a "Selected" outcome, then click "Generate Offer".
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {offersWithData.map(slot => {
                        const statusCls = STATUS_COLORS[slot.offer_status] || 'bg-gray-100 text-gray-500';
                        const isHired = slot.offer_status === 'accepted';
                        return (
                            <div key={slot.offer_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-semibold text-gray-900">{slot.candidate_name}</h3>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCls}`}>
                                                {slot.offer_status}
                                            </span>
                                            {isHired && (
                                                <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                                                    Hired ✓
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{slot.job_title}</p>

                                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                            {slot.ctc_amount && (
                                                <span>💰 CTC: {formatCTC(slot.ctc_amount, slot.ctc_currency)}</span>
                                            )}
                                            {slot.joining_date && (
                                                <span>📅 Join: {new Date(slot.joining_date).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                })}</span>
                                            )}
                                            {slot.offer_sent_at && (
                                                <span>Sent {new Date(slot.offer_sent_at).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'short',
                                                })}</span>
                                            )}
                                            {slot.candidate_response_at && (
                                                <span>Responded {new Date(slot.candidate_response_at).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'short',
                                                })}</span>
                                            )}
                                        </div>

                                        {slot.decline_reason && (
                                            <p className="mt-2 text-xs text-red-500 italic">
                                                Decline reason: {slot.decline_reason}
                                            </p>
                                        )}

                                        {slot.offer_notes && (
                                            <p className="mt-2 text-xs text-gray-400 italic">{slot.offer_notes}</p>
                                        )}

                                        {isHired && (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <span className="text-xs text-gray-500">
                                                    Onboarding status:{' '}
                                                    <span className={slot.onboarding_started ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                                                        {slot.onboarding_started ? 'Started' : 'Pending'}
                                                    </span>
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="shrink-0 flex flex-col items-end gap-2">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                                            isHired ? 'bg-green-100' :
                                            slot.offer_status === 'declined' ? 'bg-red-100' :
                                            'bg-blue-100'
                                        }`}>
                                            {isHired ? '🎉' : slot.offer_status === 'declined' ? '✗' : '📧'}
                                        </div>
                                        <button
                                            onClick={() => downloadOfferLetter(slot.offer_id, slot.candidate_name, slot.job_title)}
                                            className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
                                        >
                                            Download PDF
                                        </button>
                                        {['sent', 'accepted'].includes(slot.offer_status) && (
                                            <button
                                                onClick={() => sendOfferLetter(slot.offer_id)}
                                                className="text-xs text-gray-500 hover:text-indigo-600 hover:underline whitespace-nowrap"
                                            >
                                                Send to Candidate
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

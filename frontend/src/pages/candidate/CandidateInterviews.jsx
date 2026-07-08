import { useEffect, useState } from 'react';
import { candidateInterviewAPI } from '../../api/interview';

const STATUS_COLORS = {
    proposed:    'bg-yellow-100 text-yellow-700',
    confirmed:   'bg-green-100 text-green-700',
    rescheduled: 'bg-blue-100 text-blue-700',
    completed:   'bg-gray-100 text-gray-600',
    cancelled:   'bg-red-100 text-red-600',
};

const MODE_LABELS = { video: '📹 Video', phone: '📞 Phone', in_person: '🏢 In-Person' };

export default function CandidateInterviews() {
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const [rescheduleSlot, setRescheduleSlot] = useState(null);
    const [rescheduleReason, setRescheduleReason] = useState('');

    const load = () =>
        candidateInterviewAPI.getMyInterviews()
            .then(({ data }) => setInterviews(data.interviews || []))
            .catch(console.error);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, []);

    const handleConfirm = async (slotId) => {
        setActionLoading(slotId);
        try {
            await candidateInterviewAPI.confirmSlot(slotId);
            load();
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        setActionLoading(rescheduleSlot.id);
        try {
            await candidateInterviewAPI.requestReschedule(rescheduleSlot.id, { reason: rescheduleReason });
            setRescheduleSlot(null);
            setRescheduleReason('');
            load();
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-slide-up">
            <div className="page-header mb-6">
                <h1 className="page-title">My Interviews</h1>
            </div>

            {/* Reschedule Modal */}
            {rescheduleSlot && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="font-semibold text-gray-800 mb-1">Request Reschedule</h2>
                        <p className="text-xs text-gray-500 mb-4">
                            Interview with {rescheduleSlot.company_name} for {rescheduleSlot.job_title}
                        </p>
                        <form onSubmit={handleReschedule} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label>
                                <textarea
                                    value={rescheduleReason}
                                    onChange={e => setRescheduleReason(e.target.value)}
                                    required
                                    rows={3}
                                    placeholder="Please explain why you need to reschedule..."
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={actionLoading === rescheduleSlot.id}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                                    {actionLoading === rescheduleSlot.id ? 'Sending...' : 'Send Request'}
                                </button>
                                <button type="button" onClick={() => { setRescheduleSlot(null); setRescheduleReason(''); }}
                                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
            ) : interviews.length === 0 ? (
                <div className="card-p text-center py-16">
                    <div className="text-4xl mb-3">🗓</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">No interviews yet</h3>
                    <p className="text-sm text-gray-500">When a company schedules an interview, it will appear here.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {interviews.map(iv => {
                        const statusCls = STATUS_COLORS[iv.status] || 'bg-gray-100 text-gray-500';
                        const isLoading = actionLoading === iv.id;
                        const isPending = ['proposed', 'rescheduled'].includes(iv.status) && !iv.candidate_confirmed;
                        const canAct = ['proposed', 'confirmed', 'rescheduled'].includes(iv.status);

                        return (
                            <div key={iv.id} className="card-p">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-semibold text-gray-900">{iv.job_title}</h3>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCls}`}>
                                                {iv.status}
                                            </span>
                                            {iv.candidate_confirmed && (
                                                <span className="text-xs text-green-600 font-medium">✓ You confirmed</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-3">{iv.company_name}</p>

                                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                                            <span>📅 {new Date(iv.slot_datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
                                                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit',
                                            })}</span>
                                            <span>{MODE_LABELS[iv.mode] || iv.mode}</span>
                                            <span>⏱ {iv.duration_mins} min</span>
                                        </div>

                                        {iv.mode === 'video' && iv.meeting_link && (
                                            <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer"
                                                className="inline-block text-xs text-indigo-600 hover:underline mb-2">
                                                Join Meeting →
                                            </a>
                                        )}

                                        {iv.mode === 'in_person' && iv.location_detail && (
                                            <p className="text-xs text-gray-500 mb-2">📍 {iv.location_detail}</p>
                                        )}

                                        {iv.notes && (
                                            <p className="text-xs text-gray-400 italic">Note: {iv.notes}</p>
                                        )}

                                        {iv.outcome_result && (
                                            <div className={`mt-3 inline-block text-xs font-medium px-2 py-1 rounded-lg ${
                                                iv.outcome_result === 'selected'
                                                    ? 'bg-green-100 text-green-700'
                                                    : iv.outcome_result === 'rejected'
                                                    ? 'bg-red-100 text-red-600'
                                                    : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                Result: {iv.outcome_result === 'selected' ? '🎉 Selected!' : iv.outcome_result === 'rejected' ? 'Not selected' : 'On hold'}
                                            </div>
                                        )}
                                    </div>

                                    {canAct && (
                                        <div className="shrink-0 flex flex-col gap-2 items-end">
                                            {isPending && (
                                                <button
                                                    onClick={() => handleConfirm(iv.id)}
                                                    disabled={isLoading}
                                                    className="text-xs bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700 disabled:opacity-60 transition font-medium">
                                                    {isLoading ? '...' : 'Confirm'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { setRescheduleSlot(iv); setRescheduleReason(''); }}
                                                disabled={isLoading}
                                                className="text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 disabled:opacity-60 transition">
                                                Request Reschedule
                                            </button>
                                        </div>
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

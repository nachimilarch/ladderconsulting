import { useEffect, useState, useCallback } from 'react';
import { interviewRequestAPI } from '../../api/payments';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    proposed:    'badge-yellow',
    confirmed:   'badge-green',
    rescheduled: 'badge-blue',
    completed:   'badge-gray',
    cancelled:   'badge-red',
};

const MODE_LABELS = { video: 'Video Call', phone: 'Phone', in_person: 'In-Person' };

const SCOPES = [
    { key: 'active',   label: 'Active',   params: {} },
    { key: 'upcoming', label: 'Upcoming', params: { scope: 'upcoming' } },
    { key: 'past',     label: 'Past',     params: { scope: 'past' } },
    { key: 'all',      label: 'All',      params: { scope: 'all' } },
];

const fmtDateTime = (d) => d
    ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
    : '—';

export default function ScheduledInterviews({ embedded = false }) {
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState('active');
    const [confirming, setConfirming] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        const params = SCOPES.find(s => s.key === scope)?.params || {};
        interviewRequestAPI.listScheduled(params)
            .then(r => setInterviews(r.data?.data || []))
            .catch(() => toast.error('Failed to load scheduled interviews.'))
            .finally(() => setLoading(false));
    }, [scope]);

    useEffect(() => { load(); }, [load]);

    const handleConfirm = async (slot) => {
        if (!window.confirm(`Confirm this interview on behalf of ${slot.candidate_name}? Use this once the candidate has agreed to the time (e.g. by phone/email).`)) return;
        setConfirming(slot.id);
        try {
            await interviewRequestAPI.confirmSlot(slot.id);
            toast.success('Interview confirmed on behalf of the candidate.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to confirm interview.');
        } finally {
            setConfirming(null);
        }
    };

    return (
        <div className={embedded ? '' : 'max-w-5xl mx-auto'}>
            <div className="mb-6">
                {!embedded && <h1 className="text-2xl font-bold text-gray-900">Scheduled Interviews</h1>}
                <p className="text-sm text-gray-500 mt-0.5">
                    Interviews approved across your companies. Notify the candidate, confirm the slot,
                    and keep things moving — especially for candidates who haven't logged in yet.
                </p>
            </div>

            {/* Scope tabs */}
            <div className="flex gap-2 mb-5">
                {SCOPES.map(s => (
                    <button
                        key={s.key}
                        onClick={() => setScope(s.key)}
                        className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                            scope === s.key
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : interviews.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="text-3xl mb-3 text-gray-300">🗓</div>
                    <h3 className="font-semibold text-gray-700 mb-1">No interviews here</h3>
                    <p className="text-sm text-gray-500">
                        Interviews appear once you approve a company's interview request.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {interviews.map(iv => {
                        const canConfirm = ['proposed', 'rescheduled'].includes(iv.status) && !iv.candidate_confirmed;
                        return (
                            <div key={iv.id} className="card-p">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-semibold text-gray-900">{iv.candidate_name}</h3>
                                            <span className={STATUS_COLORS[iv.status] || 'badge-gray'}>{iv.status}</span>
                                            {iv.candidate_confirmed
                                                ? <span className="badge-green">Confirmed</span>
                                                : <span className="badge-yellow">Awaiting confirmation</span>}
                                            {iv.application_source === 'executive' && (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                    Sourced by Ladder
                                                </span>
                                            )}
                                            {iv.candidate_never_logged_in && (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                                    Hasn't logged in — coordinate manually
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm text-gray-600">
                                            {iv.job_title} · {iv.company_name}
                                        </p>

                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1.5">
                                            <span>🗓 {fmtDateTime(iv.slot_datetime)}</span>
                                            <span>{MODE_LABELS[iv.mode] || iv.mode}</span>
                                            <span>{iv.duration_mins} min</span>
                                            {iv.meeting_link && (
                                                <a href={iv.meeting_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                                    Meeting link
                                                </a>
                                            )}
                                            {iv.location_detail && iv.mode === 'in_person' && <span>📍 {iv.location_detail}</span>}
                                        </div>

                                        {/* Real candidate contact — executives are the intermediary */}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2">
                                            {iv.candidate_email && (
                                                <a href={`mailto:${iv.candidate_email}`} className="text-blue-600 hover:underline">
                                                    ✉ {iv.candidate_email}
                                                </a>
                                            )}
                                            {iv.candidate_phone && (
                                                <a href={`tel:${iv.candidate_phone}`} className="text-blue-600 hover:underline">
                                                    ☎ {iv.candidate_phone}
                                                </a>
                                            )}
                                            {!iv.candidate_phone && (
                                                <span className="text-gray-400 italic">No phone on file</span>
                                            )}
                                        </div>

                                        {iv.outcome_result && (
                                            <div className="mt-2">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                    iv.outcome_result === 'selected' ? 'bg-green-100 text-green-700'
                                                    : iv.outcome_result === 'rejected' ? 'bg-red-100 text-red-600'
                                                    : 'bg-yellow-100 text-yellow-700'
                                                }`}>Outcome: {iv.outcome_result}</span>
                                                {iv.offer_id && <span className="text-xs text-teal-600 font-medium ml-2">Offer {iv.offer_status}</span>}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 shrink-0 items-end">
                                        {canConfirm && (
                                            <button
                                                onClick={() => handleConfirm(iv)}
                                                disabled={confirming === iv.id}
                                                className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 disabled:opacity-50 transition"
                                            >
                                                {confirming === iv.id ? 'Confirming…' : '✓ Confirm for candidate'}
                                            </button>
                                        )}
                                        <span className="text-[10px] text-gray-400 text-right max-w-[140px]">
                                            Executive {iv.executive_name ? `· ${iv.executive_name}` : ''}
                                        </span>
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

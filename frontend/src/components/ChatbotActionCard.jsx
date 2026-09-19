import { useState } from 'react';
import { chatbotAPI } from '../api/chatbot';
import toast from 'react-hot-toast';
import { JOB_TYPE, WORK_MODE, salaryRange } from './chat/chatFormat';

const CASHFREE_SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';

const loadCashfreeSDK = () => new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const s = document.createElement('script');
    s.src = CASHFREE_SDK_URL;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
});

const inr = (v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const TITLES = {
    update_profile: { icon: '✏️', label: 'Profile update' },
    apply_to_job:   { icon: '📨', label: 'Application' },
    create_job:     { icon: '💼', label: 'New job post' },
    update_job:     { icon: '💼', label: 'Job update' },
};

const PROFILE_FIELDS = [
    ['headline', 'Headline'], ['summary', 'Summary'], ['total_experience', 'Experience', (v) => `${v} years`],
    ['current_location', 'Location'], ['expected_salary', 'Expected salary', inr], ['current_salary', 'Current salary', inr],
    ['notice_period_days', 'Notice period', (v) => `${v} days`], ['linkedin_url', 'LinkedIn'], ['portfolio_url', 'Portfolio'],
];

const present = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);

function Row({ label, children }) {
    return (
        <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
            <div className="text-[13px] text-gray-800 leading-snug mt-0.5 break-words">{children}</div>
        </div>
    );
}

function LongText({ text }) {
    const [open, setOpen] = useState(false);
    const long = text.length > 220;
    return (
        <span className="whitespace-pre-line">
            {open || !long ? text : `${text.slice(0, 220).trimEnd()}…`}
            {long && (
                <button onClick={() => setOpen(o => !o)} className="ml-1 text-indigo-600 font-medium hover:underline">
                    {open ? 'Show less' : 'Show more'}
                </button>
            )}
        </span>
    );
}

// What will actually change, as labelled rows instead of raw "key: value" text.
function Details({ actionType, payload, preview }) {
    if (!payload) return <p className="whitespace-pre-line text-[13px] text-gray-700">{preview}</p>;

    if (actionType === 'update_profile') {
        const rows = PROFILE_FIELDS.filter(([k]) => present(payload[k]));
        return (
            <div className="space-y-2.5">
                {rows.map(([k, label, fmt]) => (
                    <Row key={k} label={label}>{k === 'summary' ? <LongText text={String(payload[k])} /> : (fmt ? fmt(payload[k]) : String(payload[k]))}</Row>
                ))}
                {present(payload.skills) && (
                    <Row label="Skills">
                        <div className="flex flex-wrap gap-1 mt-0.5">
                            {payload.skills.map((s) => (
                                <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{s}</span>
                            ))}
                        </div>
                    </Row>
                )}
            </div>
        );
    }

    if (actionType === 'apply_to_job') {
        return (
            <div className="space-y-2.5">
                <Row label="Role">
                    <span className="font-semibold">{payload.job_title || `Job #${payload.job_id}`}</span>
                    {payload.company_name && <span className="text-gray-500"> at {payload.company_name}</span>}
                </Row>
                <Row label="Sent with">Your profile and primary resume</Row>
                {present(payload.cover_letter) && <Row label="Cover letter"><LongText text={payload.cover_letter} /></Row>}
            </div>
        );
    }

    if (actionType === 'create_job' || actionType === 'update_job') {
        const salary = salaryRange(payload.salary_min, payload.salary_max);
        const exp = present(payload.experience_min) || present(payload.experience_max)
            ? `${payload.experience_min ?? 0}${payload.experience_max ? `–${payload.experience_max}` : '+'} years` : null;
        const chips = [JOB_TYPE[payload.job_type] || payload.job_type, WORK_MODE[payload.work_mode] || payload.work_mode, payload.location, salary, exp,
            present(payload.openings) ? `${payload.openings} opening${Number(payload.openings) === 1 ? '' : 's'}` : null].filter(Boolean);
        return (
            <div className="space-y-2.5">
                <Row label="Title"><span className="font-semibold text-sm">{payload.title}</span></Row>
                {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {chips.map((c) => <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c}</span>)}
                    </div>
                )}
                {present(payload.description) && <Row label="Description"><LongText text={payload.description} /></Row>}
                {present(payload.requirements) && <Row label="Requirements"><LongText text={payload.requirements} /></Row>}
            </div>
        );
    }

    return <p className="whitespace-pre-line text-[13px] text-gray-700">{preview}</p>;
}

// Renders a chatbot_pending_actions draft with Confirm / Not now — the
// human-in-the-loop gate the write tools require before anything is created or
// saved (see chatbotTools.js / chatbotController.js).
export default function ChatbotActionCard({ id, preview, actionType, payload, onResolved }) {
    const [busy, setBusy] = useState(false);
    const [resolved, setResolved] = useState(null); // 'confirmed' | 'discarded' | null
    const [awaitingPayment, setAwaitingPayment] = useState(false);
    const meta = TITLES[actionType] || { icon: '✨', label: 'Draft' };

    const handleConfirm = async () => {
        setBusy(true);
        try {
            const { data } = await chatbotAPI.confirmAction(id);
            setResolved('confirmed');
            setAwaitingPayment(!!data?.payment_session_id);
            onResolved?.('confirmed', { actionType, data });
            if (data?.payment_session_id) {
                // Standard-tier job post: created as pending, needs payment
                // to actually go live — same Cashfree flow as everywhere else.
                await loadCashfreeSDK();
                const mode = data.cashfree_env === 'PROD' ? 'production' : 'sandbox';
                const cf = new window.Cashfree({ mode });
                cf.checkout({ paymentSessionId: data.payment_session_id });
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Hmm, that didn't go through. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    const handleDiscard = async () => {
        setBusy(true);
        try {
            const { data } = await chatbotAPI.discardAction(id);
            setResolved('discarded');
            onResolved?.('discarded', { actionType, data });
        } catch (err) {
            toast.error(err.response?.data?.message || "Couldn't cancel that. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`w-full rounded-xl border shadow-sm overflow-hidden bg-white ${resolved === 'confirmed' ? 'border-green-200' : 'border-indigo-200'}`}>
            <div className={`px-3 py-2 flex items-center gap-2 text-xs font-semibold ${resolved === 'confirmed' ? 'bg-green-50 text-green-800' : 'bg-indigo-50 text-indigo-800'}`}>
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className="ml-auto font-medium opacity-70">
                    {resolved === 'confirmed' ? '✓ Done' : resolved === 'discarded' ? 'Cancelled' : 'Waiting for you'}
                </span>
            </div>

            <div className={`p-3 ${resolved === 'discarded' ? 'opacity-50' : ''}`}>
                <Details actionType={actionType} payload={payload} preview={preview} />
            </div>

            <div className="px-3 pb-3">
                {resolved ? (
                    <p className={`text-xs font-medium ${resolved === 'confirmed' ? 'text-green-700' : 'text-gray-500'}`}>
                        {resolved === 'confirmed'
                            ? (awaitingPayment ? 'Taking you to payment…' : 'All set.')
                            : 'Nothing was changed.'}
                    </p>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={handleConfirm}
                            disabled={busy}
                            className="flex-1 bg-indigo-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition font-semibold"
                        >
                            {busy ? 'One moment…' : 'Looks good, confirm'}
                        </button>
                        <button
                            onClick={handleDiscard}
                            disabled={busy}
                            className="border border-gray-300 text-gray-600 text-xs px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition font-medium"
                        >
                            Not now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { employmentStatusAPI } from '../../api/candidate';

const OPTIONS = [
    { value: 'looking', title: 'Looking for a job', hint: 'I am actively searching. Please suggest me for roles.', icon: '🔎' },
    { value: 'open', title: 'Working, open to offers', hint: 'I have a job, but I would consider the right opportunity.', icon: '🤝' },
    { value: 'working', title: 'Working, not looking', hint: 'I am happy where I am. Please do not suggest me for roles.', icon: '🏢' },
];

// Asks the candidate for their current job status. `onSaved` runs after a successful save,
// `onClose` when they dismiss it ("Remind me later" / close).
export default function EmploymentStatusModal({ current, onSaved, onClose }) {
    const [choice, setChoice] = useState(current || '');
    const [saving, setSaving] = useState(false);
    const firstRef = useRef(null);

    useEffect(() => {
        firstRef.current?.focus();
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const save = async () => {
        if (!choice || saving) return;
        setSaving(true);
        try {
            await employmentStatusAPI.set(choice);
            toast.success('Thanks, your job status is updated.');
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save your job status. Please try again.');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="emp-status-title">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="emp-status-title" className="text-lg font-bold text-gray-900">Where are you in your career right now?</h2>
                        <p className="mt-1 text-sm text-gray-500">It takes ten seconds and helps us suggest you for the right roles.</p>
                    </div>
                    <button type="button" onClick={onClose} className="-mr-1 -mt-1 h-9 w-9 shrink-0 rounded-full text-2xl leading-none text-gray-400 hover:bg-gray-100" aria-label="Close">×</button>
                </div>

                <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="Job status">
                    {OPTIONS.map((o, i) => {
                        const on = choice === o.value;
                        return (
                            <button
                                key={o.value}
                                ref={i === 0 ? firstRef : undefined}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setChoice(o.value)}
                                className={`w-full text-left flex items-start gap-3 rounded-xl border p-3.5 transition ${on ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                            >
                                <span className="text-xl leading-none mt-0.5" aria-hidden="true">{o.icon}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-gray-900">{o.title}</span>
                                    <span className="block text-xs text-gray-500 mt-0.5">{o.hint}</span>
                                </span>
                                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${on ? 'border-indigo-600 bg-indigo-600 shadow-[inset_0_0_0_2px_white]' : 'border-gray-300'}`} aria-hidden="true" />
                            </button>
                        );
                    })}
                </div>

                <p className="mt-3 text-xs text-gray-400">Only the LadderStep team can see this. Companies never do.</p>

                <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
                    <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-800 py-2">Remind me later</button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={!choice || saving}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

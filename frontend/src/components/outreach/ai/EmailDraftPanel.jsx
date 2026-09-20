import { useEffect, useState } from 'react';
import { outreachAiAPI } from '../../../api/outreachAi';
import useAiTask from './useAiTask';
import { AiRunning, AiError, CopyButton, HtmlPreview, Field, PrimaryButton, GhostButton, CopyReport, RecentResults } from './common';
import { inputClass } from './ui';

const TONES = [['professional', 'Professional'], ['friendly', 'Friendly'], ['direct', 'Direct'], ['warm', 'Warm'], ['formal', 'Formal']];

// Write a cold email from a short brief. Used on the AI Studio page and inside the new-campaign
// form (`onUse` puts the chosen subject and body straight into the form).
export default function EmailDraftPanel({ onUse, defaultGoal = '' }) {
    const task = useAiTask();
    const [form, setForm] = useState({ goal: defaultGoal, audience: '', offer: '', cta: '', tone: 'professional', length: 'short' });
    const [subjectIdx, setSubjectIdx] = useState(0);
    const [report, setReport] = useState(null);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const r = task.result;

    useEffect(() => {
        if (task.phase !== 'done' || !r) return undefined;
        let cancelled = false;
        outreachAiAPI.checkCopy({ channel: 'email', subject: r.subject_options[subjectIdx], body: r.body_html })
            .then(({ data }) => { if (!cancelled) setReport(data.data); }).catch(() => {});
        return () => { cancelled = true; };
    }, [task.phase, r, subjectIdx]);

    const start = () => { setSubjectIdx(0); setReport(null); task.run('email_campaign', form); };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                    <Field label="What is this campaign for? *" hint="One or two sentences. The more specific, the better the email.">
                        <textarea rows={3} value={form.goal} onChange={set('goal')} className={inputClass}
                            placeholder="e.g. Introduce our hiring support to HR heads of manufacturing companies in Pune and get a 15 minute call" />
                    </Field>
                </div>
                <Field label="Who is it going to?">
                    <input value={form.audience} onChange={set('audience')} className={inputClass} placeholder="HR heads at mid-sized companies" />
                </Field>
                <Field label="What are we offering? (optional)">
                    <input value={form.offer} onChange={set('offer')} className={inputClass} placeholder="Screened candidates in 2 weeks" />
                </Field>
                <Field label="What should they do?">
                    <input value={form.cta} onChange={set('cta')} className={inputClass} placeholder="Reply to book a 15 minute call" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Tone">
                        <select value={form.tone} onChange={set('tone')} className={inputClass}>{TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    </Field>
                    <Field label="Length">
                        <select value={form.length} onChange={set('length')} className={inputClass}>
                            <option value="short">Short (~100 words)</option>
                            <option value="medium">Medium (~160)</option>
                        </select>
                    </Field>
                </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                <PrimaryButton onClick={start} disabled={task.running || form.goal.trim().length < 8}>✨ {r ? 'Write another version' : 'Write the email'}</PrimaryButton>
                {form.goal.trim().length < 8 && <span className="text-xs text-gray-400">Describe the campaign first.</span>}
            </div>

            {task.running && <AiRunning startedAt={task.startedAt} what="writing your email" />}
            {task.phase === 'failed' && <AiError message={task.error} onRetry={start} />}

            {task.phase === 'done' && r && (
                <div className="rounded-2xl border border-brand-200 bg-white p-4 space-y-4">
                    <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Subject line (pick one)</p>
                        <div className="space-y-1.5">
                            {r.subject_options.map((s, i) => (
                                <label key={s} className={`flex items-start gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition ${subjectIdx === i ? 'border-brand-400 bg-brand-50' : 'border-gray-100 hover:border-gray-200'}`}>
                                    <input type="radio" name="subject" checked={subjectIdx === i} onChange={() => setSubjectIdx(i)} className="mt-1 accent-brand-600" />
                                    <span className="text-sm text-gray-800 flex-1">{s}</span>
                                    <span className="text-[11px] text-gray-400 shrink-0">{s.length} chars</span>
                                </label>
                            ))}
                        </div>
                        {r.preheader && <p className="text-[11px] text-gray-400 mt-2">Preview text: {r.preheader}</p>}
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-gray-600">Email body ({r.word_count} words)</p>
                            <CopyButton text={r.body_html} label="Copy HTML" />
                        </div>
                        <HtmlPreview html={r.body_html} />
                        <p className="text-[11px] text-gray-400 mt-1.5">Merge tags like {'{{first_name}}'} fill in for each person when the campaign sends.</p>
                    </div>

                    <CopyReport report={report} />

                    {r.notes?.length > 0 && (
                        <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                    )}

                    <div className="flex gap-2 flex-wrap">
                        {onUse && <PrimaryButton onClick={() => onUse({ subject: r.subject_options[subjectIdx], body: r.body_html })}>Use this in my campaign</PrimaryButton>}
                        <GhostButton onClick={start}>Try another version</GhostButton>
                    </div>
                </div>
            )}

            <RecentResults kind="email_campaign" refreshKey={r}
                describe={(it) => it.input?.goal?.slice(0, 70) || 'Email draft'}
                onPick={(it) => { setForm((f) => ({ ...f, goal: it.input?.goal || f.goal, audience: it.input?.audience || '', offer: it.input?.offer || '', cta: it.input?.cta || '' })); setSubjectIdx(0); setReport(null); task.load(it.result); }} />
        </div>
    );
}

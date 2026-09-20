import { useState } from 'react';
import useAiTask from './useAiTask';
import { AiRunning, AiError, CopyButton, HtmlPreview, Field, PrimaryButton, GhostButton, CopyReport, Pill, RecentResults } from './common';
import { inputClass } from './ui';

const ANGLE_LABEL = { benefit: 'Benefit', curiosity: 'Curiosity', question: 'Question', personal: 'Personal', direct: 'Direct' };

// ── Subject lines ────────────────────────────────────────────────────────────
export function SubjectLinesPanel({ onPick }) {
    const task = useAiTask();
    const [form, setForm] = useState({ subject: '', goal: '' });
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const ok = form.subject.trim() || form.goal.trim();
    const r = task.result;
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Your current subject (optional)"><input value={form.subject} onChange={set('subject')} className={inputClass} placeholder="Quick intro from LadderStep" /></Field>
                <Field label="What is the email about? (optional)"><input value={form.goal} onChange={set('goal')} className={inputClass} placeholder="Hiring support for HR heads" /></Field>
            </div>
            <PrimaryButton onClick={() => task.run('subject_lines', form)} disabled={task.running || !ok}>✨ Suggest subject lines</PrimaryButton>
            {task.running && <AiRunning startedAt={task.startedAt} what="writing subject lines" />}
            {task.phase === 'failed' && <AiError message={task.error} onRetry={() => task.run('subject_lines', form)} />}
            {task.phase === 'done' && r && (
                <ul className="space-y-2">
                    {r.options.map((o) => (
                        <li key={o.text} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3.5 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-800">{o.text}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">{ANGLE_LABEL[o.angle]} · {o.text.length} characters{o.check?.length ? ` · ${o.check[0]}` : ''}</p>
                            </div>
                            <CopyButton text={o.text} />
                            {onPick && <button type="button" onClick={() => onPick(o.text)} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700">Use</button>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ── Improve copy ─────────────────────────────────────────────────────────────
const HOW = [['clearer', 'Make it clearer'], ['shorter', 'Make it shorter'], ['friendlier', 'Make it friendlier'], ['more_formal', 'More formal'], ['stronger_cta', 'Stronger call to action'], ['fix_grammar', 'Fix grammar only']];

export function ImproveCopyPanel() {
    const task = useAiTask();
    const [text, setText] = useState('');
    const [how, setHow] = useState('clearer');
    const [channel, setChannel] = useState('email');
    const r = task.result;
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                    <Field label="Paste your email or WhatsApp message" hint="HTML is fine. Merge tags like {{first_name}} are kept exactly.">
                        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} font-mono text-[13px]`} />
                    </Field>
                </div>
                <Field label="What should change?">
                    <select value={how} onChange={(e) => setHow(e.target.value)} className={inputClass}>{HOW.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </Field>
                <Field label="Channel">
                    <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select>
                </Field>
            </div>
            <PrimaryButton onClick={() => task.run('improve_copy', { text, instruction: how, channel })} disabled={task.running || text.trim().length < 15}>✨ Improve it</PrimaryButton>
            {task.running && <AiRunning startedAt={task.startedAt} what="editing your text" />}
            {task.phase === 'failed' && <AiError message={task.error} onRetry={() => task.run('improve_copy', { text, instruction: how, channel })} />}
            {task.phase === 'done' && r && (
                <div className="rounded-2xl border border-brand-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between"><p className="text-xs font-semibold text-gray-600">Improved version</p><CopyButton text={r.text} /></div>
                    {channel === 'email' ? <HtmlPreview html={r.text} /> : <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 rounded-xl p-3">{r.text}</pre>}
                    {r.changes?.length > 0 && <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">{r.changes.map((c) => <li key={c}>{c}</li>)}</ul>}
                </div>
            )}
        </div>
    );
}

// ── Follow-up sequence ───────────────────────────────────────────────────────
export function FollowUpPanel() {
    const task = useAiTask();
    const [form, setForm] = useState({ subject: '', body: '', steps: 3 });
    const r = task.result;
    return (
        <div className="space-y-4">
            <Field label="Your first email: subject"><input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className={inputClass} /></Field>
            <Field label="Your first email: body" hint="The follow-ups build on this and never repeat it.">
                <textarea rows={5} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} className={`${inputClass} font-mono text-[13px]`} />
            </Field>
            <Field label="How many follow-ups?">
                <select value={form.steps} onChange={(e) => setForm((f) => ({ ...f, steps: Number(e.target.value) }))} className={`${inputClass} sm:w-40`}>{[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </Field>
            <PrimaryButton onClick={() => task.run('follow_up_sequence', form)} disabled={task.running || (form.body.trim().length < 20 && !form.subject.trim())}>✨ Write the follow-ups</PrimaryButton>
            {task.running && <AiRunning startedAt={task.startedAt} what="writing the follow-ups" />}
            {task.phase === 'failed' && <AiError message={task.error} onRetry={() => task.run('follow_up_sequence', form)} />}
            {task.phase === 'done' && r && (
                <ol className="space-y-3">
                    {r.steps.map((s, i) => (
                        <li key={s.subject} className="rounded-2xl border border-gray-100 bg-white p-4">
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                                <div className="flex items-center gap-2"><Pill tone="brand">Follow-up {i + 1}</Pill><span className="text-xs text-gray-500">send {s.after_days} days after the previous email</span></div>
                                <CopyButton text={`Subject: ${s.subject}\n\n${s.body_html}`} />
                            </div>
                            <p className="text-sm font-semibold text-gray-800">{s.subject}</p>
                            {s.purpose && <p className="text-[11px] text-gray-400 mb-2">{s.purpose}</p>}
                            <HtmlPreview html={s.body_html} height="h-40" />
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

// ── WhatsApp template ────────────────────────────────────────────────────────
export function WhatsAppTemplatePanel() {
    const task = useAiTask();
    const [form, setForm] = useState({ goal: '', tone: 'friendly', category: 'MARKETING' });
    const r = task.result;
    return (
        <div className="space-y-4">
            <Field label="What is the message for? *" hint="Templates must be approved by Meta before they can be sent. This drafts one that is likely to pass.">
                <textarea rows={3} value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} className={inputClass} placeholder="Introduce our recruitment service to HR managers and offer a short call" />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:w-2/3">
                <Field label="Tone"><select value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))} className={inputClass}>{['friendly', 'professional', 'direct', 'warm'].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></Field>
                <Field label="Category"><select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputClass}><option value="MARKETING">Marketing</option><option value="UTILITY">Utility</option></select></Field>
            </div>
            <PrimaryButton onClick={() => task.run('wa_template', form)} disabled={task.running || form.goal.trim().length < 8}>✨ Draft the template</PrimaryButton>
            {task.running && <AiRunning startedAt={task.startedAt} what="drafting your template" />}
            {task.phase === 'failed' && <AiError message={task.error} onRetry={() => task.run('wa_template', form)} />}
            {task.phase === 'done' && r && (
                <div className="rounded-2xl border border-brand-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2"><Pill tone="brand">{r.category}</Pill><code className="text-xs text-gray-600">{r.template_name}</code></div>
                        <CopyButton text={`Name: ${r.template_name}\nCategory: ${r.category}\nLanguage: en\n\n${r.body_text}\n\nFooter: ${r.footer_text}`} label="Copy for Meta submission" />
                    </div>
                    <div className="rounded-2xl bg-[#e7f5e6] px-4 py-3 max-w-md">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.body_text}</p>
                        <p className="text-[11px] text-gray-500 mt-2">{r.footer_text}</p>
                    </div>
                    {r.variable_hints.length > 0 && (
                        <div className="text-xs text-gray-600">
                            <p className="font-semibold mb-1">Variables to map when you create a campaign:</p>
                            <ul className="space-y-0.5">{r.variable_hints.map((h) => <li key={h.n}><code>{`{{${h.n}}}`}</code> = {h.field.replace('_', ' ')}{h.example ? ` (for example ${h.example})` : ''}</li>)}</ul>
                        </div>
                    )}
                    <CopyReport report={r.check} />
                    {r.notes?.length > 0 && <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
                    <p className="text-[11px] text-gray-400">Next: submit this text in your Vaartabot / Meta template manager. Once it is approved, press Sync on the WA Templates page and it appears in campaigns.</p>
                </div>
            )}
        </div>
    );
}

// ── Call script ──────────────────────────────────────────────────────────────
export function CallScriptPanel() {
    const task = useAiTask();
    const [form, setForm] = useState({ company: '', person: '', designation: '', purpose: 'Introduce our hiring support and book a 15 minute meeting', notes: '' });
    const [tick, setTick] = useState(0);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const r = task.result;
    const start = () => { task.run('call_script', form); setTick((n) => n + 1); };
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Company"><input value={form.company} onChange={set('company')} className={inputClass} /></Field>
                <Field label="Person"><input value={form.person} onChange={set('person')} className={inputClass} /></Field>
                <Field label="Designation"><input value={form.designation} onChange={set('designation')} className={inputClass} /></Field>
                <div className="sm:col-span-3"><Field label="Purpose of the call"><input value={form.purpose} onChange={set('purpose')} className={inputClass} /></Field></div>
                <div className="sm:col-span-3"><Field label="Anything you already know? (optional)"><textarea rows={2} value={form.notes} onChange={set('notes')} className={inputClass} placeholder="They opened our email twice; they hire mostly engineers." /></Field></div>
            </div>
            <PrimaryButton onClick={start} disabled={task.running || (!form.company.trim() && !form.person.trim())}>✨ Write the call script</PrimaryButton>
            {task.running && <AiRunning startedAt={task.startedAt} what="writing the script" />}
            {task.phase === 'failed' && <AiError message={task.error} onRetry={start} />}
            {task.phase === 'done' && r && (
                <div className="rounded-2xl border border-brand-200 bg-white p-4 space-y-4 text-sm text-gray-800">
                    <Block title="Opening">{r.opening}</Block>
                    <ListBlock title="Ask these" items={r.questions} />
                    <ListBlock title="Talking points" items={r.talking_points} />
                    <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1.5">If they say…</p>
                        <ul className="space-y-2">{r.objections.map((o) => <li key={o.objection} className="rounded-xl bg-gray-50 px-3 py-2"><p className="font-medium">“{o.objection}”</p><p className="text-gray-600 mt-0.5">{o.response}</p></li>)}</ul>
                    </div>
                    <Block title="Closing">{r.closing}</Block>
                    {r.voicemail && <Block title="Voicemail (15 seconds)">{r.voicemail}</Block>}
                    <GhostButton onClick={() => navigator.clipboard?.writeText(scriptText(r))}>Copy the whole script</GhostButton>
                </div>
            )}
            <RecentResults kind="call_script" refreshKey={tick + (r ? 1 : 0)} describe={(it) => [it.input?.person, it.input?.company].filter(Boolean).join(' at ') || 'Call script'}
                onPick={(it) => { setForm((f) => ({ ...f, ...it.input })); task.load(it.result); }} />
        </div>
    );
}

const Block = ({ title, children }) => (<div><p className="text-xs font-semibold text-gray-600 mb-1">{title}</p><p className="leading-relaxed">{children}</p></div>);
const ListBlock = ({ title, items }) => (<div><p className="text-xs font-semibold text-gray-600 mb-1">{title}</p><ul className="list-disc pl-5 space-y-1">{items.map((i) => <li key={i}>{i}</li>)}</ul></div>);
const scriptText = (r) => [`OPENING\n${r.opening}`, `ASK\n- ${r.questions.join('\n- ')}`, `TALKING POINTS\n- ${r.talking_points.join('\n- ')}`,
    `OBJECTIONS\n${r.objections.map((o) => `"${o.objection}"\n  ${o.response}`).join('\n')}`, `CLOSING\n${r.closing}`, r.voicemail ? `VOICEMAIL\n${r.voicemail}` : ''].filter(Boolean).join('\n\n');

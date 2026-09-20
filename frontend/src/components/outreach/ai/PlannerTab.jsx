import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { contactListAPI, waTemplateAPI } from '../../../api/outreach';
import { outreachAiAPI } from '../../../api/outreachAi';
import EmailDraftPanel from './EmailDraftPanel';
import { Pill, Field, PrimaryButton, GhostButton, CopyReport } from './common';
import { inputClass } from './ui';

const WA_FIELDS = ['first_name', 'full_name', 'company_name', 'designation', 'city'];
const fmtDate = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

export default function PlannerTab({ initial }) {
    const [lists, setLists] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [segments, setSegments] = useState([]);
    const [channel, setChannel] = useState(initial.channel || 'email');
    const [listId, setListId] = useState(initial.list || '');
    const [segment, setSegment] = useState(initial.segment || '');
    const [startDate, setStartDate] = useState('');
    const [cap, setCap] = useState('');
    const [plan, setPlan] = useState(null);
    const [busy, setBusy] = useState(false);
    const [content, setContent] = useState({ campaign_name: '', subject: '', message_body: '', from_name: '', whatsapp_template_id: '' });
    const [mapping, setMapping] = useState({});
    const [showWriter, setShowWriter] = useState(false);
    const [report, setReport] = useState(null);
    const [created, setCreated] = useState(null);

    useEffect(() => {
        contactListAPI.getAll().then((r) => setLists((r.data.data || []).filter((l) => l.import_status === 'done'))).catch(() => {});
        waTemplateAPI.getAll().then((r) => setTemplates((r.data.data || []).filter((t) => Number(t.is_active) === 1))).catch(() => {});
    }, []);

    // The groups available for the chosen list, so the segment picker only offers real ones.
    useEffect(() => {
        if (!listId) return undefined;
        let cancelled = false;
        outreachAiAPI.analyseList(listId)
            .then(({ data }) => { if (!cancelled) setSegments(data.data.segments.filter((s) => s.key !== 'needs_cleanup')); })
            .catch(() => { if (!cancelled) setSegments([]); });
        return () => { cancelled = true; };
    }, [listId]);

    // Live copy check on the email while it is being typed.
    useEffect(() => {
        if (channel !== 'email' || (!content.subject && !content.message_body)) return undefined;
        const t = setTimeout(() => {
            outreachAiAPI.checkCopy({ channel: 'email', subject: content.subject, body: content.message_body }).then(({ data }) => setReport(data.data)).catch(() => {});
        }, 700);
        return () => clearTimeout(t);
    }, [channel, content.subject, content.message_body]);

    const body = () => ({ channel, list_id: listId, segment_key: segment || undefined, start_date: startDate || undefined, daily_cap: cap ? Number(cap) : undefined });

    const build = async () => {
        setBusy(true); setCreated(null);
        try { const { data } = await outreachAiAPI.plan(body()); setPlan(data.data); }
        catch (err) { setPlan(null); toast.error(err.response?.data?.message || 'Could not build a plan'); }
        finally { setBusy(false); }
    };

    const selectedTemplate = templates.find((t) => String(t.id) === String(content.whatsapp_template_id));
    const create = async () => {
        if (!window.confirm(`Create ${plan.plan.batches.length} scheduled campaign${plan.plan.batches.length === 1 ? '' : 's'}? They will send by themselves at the times shown.`)) return;
        setBusy(true);
        try {
            const payload = { ...body(), confirm: true, content: channel === 'email'
                ? { campaign_name: content.campaign_name, subject: content.subject, message_body: content.message_body, from_name: content.from_name || undefined }
                : { campaign_name: content.campaign_name, whatsapp_template_id: Number(content.whatsapp_template_id), variable_mapping: mapping } };
            const { data } = await outreachAiAPI.applyPlan(payload);
            setCreated(data.data.campaigns);
            toast.success('Scheduled. You can change or cancel each one before it sends.');
        } catch (err) { toast.error(err.response?.data?.message || 'Could not create the campaigns'); }
        finally { setBusy(false); }
    };

    const contentReady = channel === 'email'
        ? content.campaign_name.trim() && content.subject.trim() && content.message_body.trim()
        : content.campaign_name.trim() && content.whatsapp_template_id && (selectedTemplate?.variable_count || 0) === Object.values(mapping).filter(Boolean).length;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Channel">
                    <select value={channel} onChange={(e) => { setChannel(e.target.value); setPlan(null); setSegment(''); }} className={inputClass}>
                        <option value="email">Email</option><option value="whatsapp">WhatsApp</option>
                    </select>
                </Field>
                <Field label="Contact list">
                    <select value={listId} onChange={(e) => { setListId(e.target.value); setSegment(''); setPlan(null); }} className={inputClass}>
                        <option value="">Choose a list…</option>
                        {lists.map((l) => <option key={l.id} value={l.id}>{l.list_name} ({l.imported_contacts})</option>)}
                    </select>
                </Field>
                <Field label="Who to send to">
                    <select value={segment} onChange={(e) => { setSegment(e.target.value); setPlan(null); }} className={inputClass} disabled={!listId}>
                        <option value="">{channel === 'email' ? 'Fresh prospects (never emailed)' : 'WhatsApp-ready contacts'}</option>
                        {segments.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.count})</option>)}
                    </select>
                </Field>
                <Field label="Earliest start (optional)"><input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPlan(null); }} className={inputClass} /></Field>
                <Field label="Max per day (optional)" hint="Leave empty to let the AI ramp up safely."><input type="number" min="10" value={cap} onChange={(e) => { setCap(e.target.value); setPlan(null); }} className={inputClass} placeholder="e.g. 100" /></Field>
                <div className="flex items-end"><PrimaryButton onClick={build} disabled={busy || !listId}>📅 Plan the sends</PrimaryButton></div>
            </div>

            {!plan && <p className="text-sm text-gray-500">The AI spreads your list over the best days and times (Indian business hours, Tuesday to Thursday mornings first), starts small and ramps up so your mailbox is not flagged as spam, and sends your best prospects first.</p>}

            {plan && (
                <>
                    <div className="card-p">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-800">{plan.plan.summary.total} contacts over {plan.plan.summary.days} sending day{plan.plan.summary.days === 1 ? '' : 's'}</h3>
                            <Pill tone="brand">{plan.segment.label}</Pill>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">From "{plan.list.name}". Times are India time. Best-scoring contacts are in the earliest batches.</p>
                        {plan.plan.warnings.map((w) => <p key={w} className="text-xs text-warning-800 bg-warning-50 border border-warning-200 rounded-lg px-3 py-2 mb-2">{w}</p>)}
                        {plan.plan.batches.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[460px]">
                                    <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-400"><th className="pb-2">Batch</th><th className="pb-2">Day</th><th className="pb-2">Time</th><th className="pb-2 text-right">Messages</th><th className="pb-2 pl-4">Why</th></tr></thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {plan.plan.batches.map((b) => (
                                            <tr key={b.n}><td className="py-1.5 font-medium">{b.n}</td><td className="py-1.5">{fmtDate(b.date)}</td><td className="py-1.5">{b.time_ist}</td><td className="py-1.5 text-right font-semibold">{b.size}</td><td className="py-1.5 pl-4 text-xs text-gray-500">{b.reason}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {plan.plan.follow_ups.length > 0 && (
                            <div className="mt-4 rounded-xl bg-gray-50 px-3.5 py-3">
                                <p className="text-xs font-semibold text-gray-600 mb-1">Then follow up</p>
                                <ul className="text-xs text-gray-600 space-y-0.5">{plan.plan.follow_ups.map((f) => <li key={f.after_days}><span className="font-medium">After {f.after_days} days:</span> {f.note}</li>)}</ul>
                                {channel === 'email' && <p className="text-[11px] text-gray-400 mt-1.5">Write them in the Write tab under "Follow-ups".</p>}
                            </div>
                        )}
                    </div>

                    {plan.plan.batches.length > 0 && !created && (
                        <div className="card-p space-y-4">
                            <h3 className="font-semibold text-gray-800">What should go out?</h3>
                            <Field label="Campaign name *" hint="Each batch is named like this with (1/3), (2/3) and so on.">
                                <input value={content.campaign_name} onChange={(e) => setContent((c) => ({ ...c, campaign_name: e.target.value }))} className={inputClass} placeholder="e.g. Pune manufacturing HR outreach" />
                            </Field>

                            {channel === 'email' ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Subject *"><input value={content.subject} onChange={(e) => setContent((c) => ({ ...c, subject: e.target.value }))} className={inputClass} /></Field>
                                        <Field label="From name (optional)"><input value={content.from_name} onChange={(e) => setContent((c) => ({ ...c, from_name: e.target.value }))} className={inputClass} /></Field>
                                    </div>
                                    <Field label="Email body *" hint="HTML and merge tags such as {{first_name}} are supported.">
                                        <textarea rows={7} value={content.message_body} onChange={(e) => setContent((c) => ({ ...c, message_body: e.target.value }))} className={`${inputClass} font-mono text-[13px]`} />
                                    </Field>
                                    <CopyReport report={report} />
                                    <div>
                                        <GhostButton onClick={() => setShowWriter((v) => !v)}>✨ {showWriter ? 'Hide the AI writer' : 'Write it with AI'}</GhostButton>
                                        {showWriter && (
                                            <div className="mt-3 rounded-2xl border border-gray-100 p-4">
                                                <EmailDraftPanel onUse={({ subject, body: b }) => { setContent((c) => ({ ...c, subject, message_body: b })); setShowWriter(false); toast.success('Added to the campaign'); }} />
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Field label="Approved WhatsApp template *">
                                        <select value={content.whatsapp_template_id} onChange={(e) => { setContent((c) => ({ ...c, whatsapp_template_id: e.target.value })); setMapping({}); }} className={inputClass}>
                                            <option value="">Choose a template…</option>
                                            {templates.map((t) => <option key={t.id} value={t.id}>{t.template_name}</option>)}
                                        </select>
                                    </Field>
                                    {selectedTemplate && (
                                        <>
                                            <p className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 whitespace-pre-wrap">{selectedTemplate.body_text}</p>
                                            {Array.from({ length: selectedTemplate.variable_count || 0 }, (_, i) => `{{${i + 1}}}`).map((ph) => (
                                                <Field key={ph} label={`Fill ${ph} with`}>
                                                    <select value={mapping[ph] || ''} onChange={(e) => setMapping((m) => ({ ...m, [ph]: e.target.value }))} className={inputClass}>
                                                        <option value="">Choose…</option>{WA_FIELDS.map((f) => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
                                                    </select>
                                                </Field>
                                            ))}
                                        </>
                                    )}
                                </>
                            )}

                            <div className="flex items-center gap-3 flex-wrap pt-1">
                                <PrimaryButton onClick={create} disabled={busy || !contentReady}>Create {plan.plan.batches.length} scheduled campaign{plan.plan.batches.length === 1 ? '' : 's'}</PrimaryButton>
                                <span className="text-xs text-gray-400">Nothing is sent now. Each campaign sends at its time; you can edit or cancel it first.</span>
                            </div>
                        </div>
                    )}

                    {created && (
                        <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-4">
                            <p className="text-sm font-semibold text-success-700 mb-2">{created.length} campaign{created.length === 1 ? '' : 's'} scheduled</p>
                            <ul className="text-sm text-gray-700 space-y-1">
                                {created.map((c) => (
                                    <li key={c.campaign_id}>Batch {c.batch}: {c.size} contacts, {fmtDate(c.date)} at {c.time_ist} · <Link className="text-brand-700 font-medium hover:underline" to={`/outreach/${channel === 'email' ? 'email' : 'whatsapp'}/${c.campaign_id}`}>open</Link></li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

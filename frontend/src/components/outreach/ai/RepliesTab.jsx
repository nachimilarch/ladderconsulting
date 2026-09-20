import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { replyAPI } from '../../../api/outreach';
import { outreachAiAPI } from '../../../api/outreachAi';
import useAiTask from './useAiTask';
import { Spinner, Pill, AiRunning, AiError, CopyButton, HtmlPreview, PrimaryButton } from './common';
import { htmlToPlain } from './ui';

const URGENCY_ORDER = { high: 0, normal: 1, low: 2 };

// A small badge showing what the reply is about. Used in the Replies list and here.
export function IntentBadge({ triage }) {
    if (!triage || triage.intent === 'other') return null;
    return <Pill tone={triage.tone}>{triage.label}</Pill>;
}

// Drafts a reply with the AI model. `onUse` (optional) drops the draft into a reply box.
export function ReplyDraft({ replyId, onUse }) {
    const task = useAiTask();
    const [tip, setTip] = useState('');
    const r = task.result;
    const start = () => task.run('reply_draft', { reply_id: replyId, tip });
    return (
        <div className="space-y-3">
            {task.phase === 'idle' && (
                <div className="flex flex-col sm:flex-row gap-2">
                    <input value={tip} onChange={(e) => setTip(e.target.value)} placeholder="Anything to include? (optional) e.g. offer Thursday 3pm"
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500" />
                    <PrimaryButton onClick={start}>✨ Draft a reply</PrimaryButton>
                </div>
            )}
            {task.running && <AiRunning startedAt={task.startedAt} what="drafting a reply" />}
            {task.phase === 'failed' && <AiError message={task.error} onRetry={start} />}
            {task.phase === 'done' && r && (
                <div className="rounded-2xl border border-brand-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{r.subject}</p>
                        <CopyButton text={htmlToPlain(r.body_html)} label="Copy text" />
                    </div>
                    <HtmlPreview html={r.body_html} height="h-40" />
                    {r.next_step && <p className="text-xs text-gray-500"><span className="font-semibold">After sending:</span> {r.next_step}</p>}
                    <div className="flex gap-2 flex-wrap">
                        {onUse && <PrimaryButton onClick={() => onUse(r)}>Use this reply</PrimaryButton>}
                        <button type="button" onClick={() => { task.reset(); }} className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2">Write a different one</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RepliesTab() {
    const [rows, setRows] = useState([]);
    const [triage, setTriage] = useState({});
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(null);

    useEffect(() => {
        let cancelled = false;
        replyAPI.getAll({ page: 1, limit: 60 })
            .then(async ({ data }) => {
                const list = (data.data || []).filter((r) => r.channel === 'email');
                if (cancelled) return;
                setRows(list);
                if (list.length) {
                    const t = await outreachAiAPI.triage(list.map((r) => r.id));
                    if (!cancelled) setTriage(t.data.data || {});
                }
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const sorted = [...rows].sort((a, b) => {
        const ta = triage[a.id], tb = triage[b.id];
        const ua = URGENCY_ORDER[ta?.urgency || 'low'], ub = URGENCY_ORDER[tb?.urgency || 'low'];
        return ua - ub || new Date(b.received_at) - new Date(a.received_at);
    });
    const counts = {};
    for (const r of rows) { const t = triage[r.id]; if (t) counts[t.label] = (counts[t.label] || 0) + 1; }

    if (loading) return <p className="text-sm text-gray-500 flex items-center gap-2"><Spinner /> Reading your replies…</p>;
    if (!rows.length) return <p className="text-sm text-gray-500">No email replies yet. When prospects answer your campaigns, the AI sorts them here so the ones that matter come first.</p>;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">{Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([label, n]) => <span key={label} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-700"><b>{n}</b> {label.toLowerCase()}</span>)}</div>
            <ul className="space-y-2">
                {sorted.map((r) => {
                    const t = triage[r.id];
                    const canDraft = t && !['auto_generated', 'out_of_office', 'unsubscribe'].includes(t.intent);
                    return (
                        <li key={r.id} className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{r.from_name || r.from_email}</p>
                                        <IntentBadge triage={t} />
                                        {t?.urgency === 'high' && <Pill tone="amber">Reply today</Pill>}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{r.subject || '(no subject)'}</p>
                                    {t && <p className="text-xs text-gray-600 mt-1">{t.suggested_action}</p>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {canDraft && <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100">✨ Draft</button>}
                                    <Link to={`/outreach/replies/${r.id}`} className="text-xs font-semibold text-gray-500 hover:text-gray-800">Open</Link>
                                </div>
                            </div>
                            {open === r.id && <div className="mt-3 pt-3 border-t border-gray-100"><ReplyDraft replyId={r.id} /></div>}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

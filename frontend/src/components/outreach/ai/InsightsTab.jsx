import { useEffect, useState } from 'react';
import { outreachAiAPI } from '../../../api/outreachAi';
import useAiTask from './useAiTask';
import { Spinner, Pill, AiRunning, AiError, PrimaryButton, Field } from './common';
import { inputClass } from './ui';

const Stat = ({ label, value, sub }) => (
    <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-3">
        <p className="text-[11px] font-medium text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
);

const OUTCOME_LABEL = {
    interested: 'Interested', meeting_request: 'Want a call', pricing_question: 'Asked about price', question: 'Had a question', referral: 'Pointed to someone else',
    not_interested: 'Not interested', unsubscribe: 'Asked to stop', out_of_office: 'Out of office', auto_generated: 'Automatic messages', other: 'Other',
};

export default function InsightsTab() {
    const [days, setDays] = useState(90);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const task = useAiTask();
    const r = task.result;

    useEffect(() => {
        let cancelled = false;
        outreachAiAPI.insightStats(days)
            .then(({ data }) => { if (!cancelled) setStats(data.data); })
            .catch(() => { if (!cancelled) setStats(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [days]);

    const maxDay = stats ? Math.max(1, ...Object.values(stats.replies_by_weekday_ist)) : 1;
    const noData = stats && stats.totals.campaigns === 0;

    return (
        <div className="space-y-5">
            <div className="flex items-end gap-3 flex-wrap">
                <Field label="Look back"><select value={days} onChange={(e) => { setLoading(true); task.reset(); setDays(Number(e.target.value)); }} className={`${inputClass} w-44`}><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>6 months</option><option value={365}>1 year</option></select></Field>
                <PrimaryButton onClick={() => task.run('campaign_insights', { days })} disabled={task.running || loading || noData}>✨ Explain these numbers</PrimaryButton>
            </div>

            {loading && <p className="text-sm text-gray-500 flex items-center gap-2"><Spinner /> Adding it up…</p>}
            {noData && <p className="text-sm text-gray-500">No sent campaigns in this period yet.</p>}

            {task.running && <AiRunning startedAt={task.startedAt} what="reading your numbers" />}
            {task.phase === 'failed' && <AiError message={task.error} onRetry={() => task.run('campaign_insights', { days })} />}
            {task.phase === 'done' && r && (
                <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-900">✨ {r.headline}</p>
                    {r.findings.length > 0 && <div><p className="text-xs font-semibold text-gray-600 mb-1">What the numbers say</p><ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">{r.findings.map((f) => <li key={f}>{f}</li>)}</ul></div>}
                    {r.recommendations.length > 0 && <div><p className="text-xs font-semibold text-gray-600 mb-1">Try next</p><ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">{r.recommendations.map((f) => <li key={f}>{f}</li>)}</ul></div>}
                    <p className="text-[11px] text-gray-400">Written by AI from the figures below. Check them before acting.</p>
                </div>
            )}

            {stats && !noData && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Stat label="Campaigns" value={stats.totals.campaigns} sub={`last ${stats.period_days} days`} />
                        <Stat label="Messages sent" value={stats.totals.sent} sub={`${stats.totals.replies} replies`} />
                        <Stat label="Email reply rate" value={`${stats.email.reply_rate_pct}%`} sub={`${stats.email.replies} of ${stats.email.sent} sent`} />
                        <Stat label="Email failures" value={`${stats.email.failure_rate_pct}%`} sub={`${stats.email.failed} failed to send`} />
                        {stats.whatsapp.campaigns > 0 && <Stat label="WhatsApp reply rate" value={`${stats.whatsapp.reply_rate_pct}%`} sub={`${stats.whatsapp.replies} of ${stats.whatsapp.sent} sent`} />}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {stats.best_campaigns.length > 0 && (
                            <div className="card-p">
                                <h3 className="font-semibold text-gray-800 mb-3">Best campaigns <span className="text-xs font-normal text-gray-400">(20+ sent)</span></h3>
                                <ul className="space-y-2">{stats.best_campaigns.map((c) => <li key={c.name} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-gray-700">{c.name}</span><Pill tone={c.reply_rate_pct >= 8 ? 'green' : 'gray'}>{c.reply_rate_pct}% · {c.replies}/{c.sent}</Pill></li>)}</ul>
                            </div>
                        )}
                        <div className="card-p">
                            <h3 className="font-semibold text-gray-800 mb-3">When people reply <span className="text-xs font-normal text-gray-400">(India time)</span></h3>
                            <div className="flex items-end gap-2 h-24">
                                {Object.entries(stats.replies_by_weekday_ist).map(([d, n]) => (
                                    <div key={d} className="flex-1 flex flex-col items-center gap-1">
                                        <div className="w-full bg-brand-200 rounded-t" style={{ height: `${Math.max(4, (n / maxDay) * 80)}px` }} title={`${n} replies`} />
                                        <span className="text-[10px] text-gray-500">{d}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {Object.keys(stats.reply_outcomes).length > 0 && (
                        <div className="card-p">
                            <h3 className="font-semibold text-gray-800 mb-3">What the replies were about</h3>
                            <div className="flex flex-wrap gap-2">{Object.entries(stats.reply_outcomes).sort((a, b) => b[1] - a[1]).map(([k, n]) => <span key={k} className="text-xs bg-gray-50 border border-gray-100 rounded-full px-3 py-1 text-gray-700"><b>{n}</b> {(OUTCOME_LABEL[k] || k).toLowerCase()}</span>)}</div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

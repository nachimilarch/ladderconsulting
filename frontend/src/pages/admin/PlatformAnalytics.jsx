import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAnalyticsAPI } from '../../api/admin';
import { adminInvoiceAPI } from '../../api/payments';
import { analyticsAPI } from '../../api/outreach';
import toast from 'react-hot-toast';

const fmtINR = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';
const fmt    = (v) => v != null ? Number(v).toLocaleString('en-IN') : '0';
const pct    = (n, d) => d > 0 ? `${Math.round((n / d) * 100)}%` : '—';

const PERIODS = [
    { key: 'daily',   label: 'Today',      desc: 'Last 24 hours' },
    { key: 'weekly',  label: 'This Week',   desc: 'Last 7 days' },
    { key: 'monthly', label: 'This Month',  desc: 'Last 30 days' },
];

// ── Primitives ────────────────────────────────────────────────────────────────

const Sparkline = ({ data = [], field, color = '#6a47d4' }) => {
    if (!data.length) return null;
    const vals = data.map(d => Number(d[field]) || 0);
    const max = Math.max(...vals, 1);
    const W = 64, H = 24;
    const step = W / (vals.length - 1 || 1);
    const pts = vals.map((v, i) => `${i * step},${H - (v / max) * H}`).join(' ');
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-16 h-6 opacity-70">
            <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" points={pts} />
            <circle cx={(vals.length - 1) * step} cy={H - (vals[vals.length - 1] / max) * H} r="2" fill={color} />
        </svg>
    );
};

const BarRow = ({ label, value, max, color = 'bg-indigo-500', note }) => {
    const p = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-3 text-sm">
            <div className="w-32 shrink-0">
                <p className="text-gray-600 text-xs truncate">{label}</p>
                {note && <p className="text-[10px] text-gray-400">{note}</p>}
            </div>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${p}%` }} />
            </div>
            <span className="w-12 text-right text-gray-700 font-semibold text-sm tabular-nums">{fmt(value ?? 0)}</span>
        </div>
    );
};

// Period-filtered KPI card with sparkline + description
const KpiTile = ({ label, desc, value, trend, trendField, color, textColor, suffix = '' }) => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-1">
            <p className={`text-2xl font-bold tabular-nums ${textColor}`}>{fmt(value)}{suffix}</p>
            <Sparkline data={trend} field={trendField} color={color} />
        </div>
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        {desc && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{desc}</p>}
    </div>
);

// All-time summary tile
const SumTile = ({ label, desc, value, accent = 'border-gray-200' }) => (
    <div className={`bg-gray-50 rounded-lg p-3 border-l-4 ${accent}`}>
        <p className="text-xl font-bold text-gray-800 tabular-nums">{value ?? '—'}</p>
        <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
        {desc && <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>}
    </div>
);

// Section wrapper with title + optional subtitle
const Panel = ({ title, subtitle, children, className = '' }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
        <div className="px-5 py-4 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="p-5">{children}</div>
    </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlatformAnalytics() {
    const [monthly,  setMonthly]  = useState([]);
    const [funnel,   setFunnel]   = useState(null);
    const [summary,  setSummary]  = useState(null);
    const [outreach, setOutreach] = useState(null);
    const [invSum,   setInvSum]   = useState(null);
    const [loading,  setLoading]  = useState(true);
    const [period,   setPeriod]   = useState('weekly');
    const [mis,      setMis]      = useState(null);
    const [misLoad,  setMisLoad]  = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([
            adminAnalyticsAPI.getMonthly(),
            adminAnalyticsAPI.getConversion(),
            adminAnalyticsAPI.getSummary(),
            adminInvoiceAPI.summary(),
        ])
            .then(([m, f, s, inv]) => {
                setMonthly(m.data?.data ?? []);
                setFunnel(f.data?.data?.funnel ?? null);
                setSummary(s.data?.data?.summary ?? null);
                setInvSum(inv.data?.summary || inv.data?.data || null);
            })
            .catch(() => toast.error('Failed to load analytics'))
            .finally(() => setLoading(false));

        analyticsAPI.campaigns()
            .then(r => setOutreach(r.data?.summary ?? null))
            .catch(() => {});
    }, []);

    const loadMIS = useCallback((p) => {
        setMisLoad(true);
        adminAnalyticsAPI.getMIS(p)
            .then(r => setMis(r.data?.data ?? null))
            .catch(() => toast.error('Failed to load MIS data'))
            .finally(() => setMisLoad(false));
    }, []);

    useEffect(() => { loadMIS(period); }, [period, loadMIS]);

    if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading analytics…</div>;

    const safeMonthly = Array.isArray(monthly) ? monthly : [];
    const maxMonthly  = Math.max(...safeMonthly.map(m => Math.max(m.new_companies || 0, m.new_candidates || 0)), 1);
    const funnelSteps = funnel ? [
        { label: 'Applications Received',  note: 'candidates who applied',   value: funnel.applications, color: 'bg-blue-500' },
        { label: 'Shortlisted',            note: 'moved to shortlist',        value: funnel.shortlisted,  color: 'bg-indigo-500' },
        { label: 'Interviewed',            note: 'interview slot confirmed',  value: funnel.interviewed,  color: 'bg-purple-500' },
        { label: 'Offers Sent',            note: 'offer letter generated',    value: funnel.offers_sent,  color: 'bg-amber-500' },
        { label: 'Hires Confirmed',        note: 'candidate accepted offer',  value: funnel.hired,        color: 'bg-green-500' },
    ] : [];
    const funnelMax = funnelSteps[0]?.value || 1;
    const p = mis?.platform ?? {};
    const trend = mis?.trend ?? [];
    const periodLabel = PERIODS.find(pp => pp.key === period)?.label ?? '';
    const periodDesc  = PERIODS.find(pp => pp.key === period)?.desc  ?? '';

    return (
        <div className="p-6 lg:p-8 space-y-10 max-w-[1600px]">

            {/* ── Page header ──────────────────────────────────────────────── */}
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Platform Analytics & MIS</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Full operational visibility across recruitment, outreach, and revenue — per executive and platform-wide.
                    </p>
                </div>
                {/* Period selector — controls ALL period-filtered sections */}
                <div>
                    <p className="text-[10px] text-gray-400 mb-1 text-right uppercase tracking-wide">Filter period</p>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        {PERIODS.map(pp => (
                            <button key={pp.key} onClick={() => setPeriod(pp.key)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    period === pp.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}>
                                {pp.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {misLoad ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading {periodLabel} data…</div>
            ) : mis ? (<>

                {/* ══════════════════════════════════════════════════════════
                    SECTION 1 — PLATFORM-WIDE KPIs (period-filtered)
                ══════════════════════════════════════════════════════════ */}
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-base font-bold text-gray-800">Platform Overview</h3>
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{periodLabel} · {periodDesc}</span>
                    </div>

                    {/* Growth & registrations */}
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Growth & Registrations</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                        <KpiTile label="New Registrations" desc="Total new user sign-ups (companies + candidates)" value={p.new_registrations} trend={trend} trendField="applications" color="#6a47d4" textColor="text-indigo-700" />
                        <KpiTile label="New Companies" desc="Hiring companies that joined the platform" value={p.new_companies} trend={trend} trendField="applications" color="#0ea5e9" textColor="text-blue-700" />
                        <KpiTile label="New Candidates" desc="Job seekers who registered on the portal" value={p.new_candidates} trend={trend} trendField="applications" color="#8b5cf6" textColor="text-purple-700" />
                        <KpiTile label="Jobs Posted" desc="New job openings listed by hiring companies" value={p.jobs_posted} trend={trend} trendField="applications" color="#f59e0b" textColor="text-amber-700" />
                        <KpiTile label="Applications Received" desc="Candidates who applied to open positions" value={p.applications_received} trend={trend} trendField="applications" color="#ec4899" textColor="text-pink-700" />
                        <KpiTile label="Interviews Scheduled" desc="Interview slots confirmed with candidates" value={p.interviews_scheduled} trend={trend} trendField="interviews" color="#14b8a6" textColor="text-teal-700" />
                    </div>

                    {/* Hiring outcomes */}
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Hiring Outcomes</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                        <KpiTile label="Offers Sent" desc="Formal offer letters generated and sent to candidates" value={p.offers_sent} trend={trend} trendField="offers" color="#10b981" textColor="text-emerald-700" />
                        <KpiTile label="Hires Confirmed" desc="Candidates who accepted offers — positions filled" value={p.hires_made} trend={trend} trendField="hires" color="#059669" textColor="text-green-700" />
                        <KpiTile label="Leads Created" desc="New business leads generated from outreach campaigns" value={p.leads_created} trend={trend} trendField="leads" color="#6a47d4" textColor="text-indigo-700" />
                        <KpiTile label="Leads Converted" desc="Leads that became active hiring clients" value={p.leads_converted} trend={trend} trendField="leads" color="#0ea5e9" textColor="text-blue-700" />
                        <KpiTile label="Lead Conversion Rate" desc="% of generated leads that converted to clients" value={p.leads_created > 0 ? Math.round((p.leads_converted / p.leads_created) * 100) : 0} trend={trend} trendField="leads" color="#f59e0b" textColor="text-amber-700" suffix="%" />
                        <KpiTile label="Tasks Completed" desc="HR staff tasks marked done in the task tracker" value={p.tasks_completed} trend={trend} trendField="applications" color="#8b5cf6" textColor="text-purple-700" />
                    </div>

                    {/* Outreach & revenue */}
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Outreach & Revenue</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <KpiTile label="Campaigns Launched" desc="Email or WhatsApp campaigns sent to contact lists" value={p.campaigns_launched} trend={trend} trendField="applications" color="#6a47d4" textColor="text-indigo-700" />
                        <KpiTile label="Messages Sent" desc="Total individual messages delivered across all campaigns" value={p.outreach_messages_sent} trend={trend} trendField="applications" color="#0ea5e9" textColor="text-blue-700" />
                        <KpiTile label="Reply Rate" desc="% of sent messages that received a reply" value={p.outreach_messages_sent > 0 ? Math.round(((p.replies_received ?? 0) / p.outreach_messages_sent) * 100) : 0} trend={trend} trendField="applications" color="#14b8a6" textColor="text-teal-700" suffix="%" />
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 lg:col-span-3">
                            <p className="text-2xl font-bold text-green-700 tabular-nums">{fmtINR(p.revenue_collected)}</p>
                            <p className="text-xs font-semibold text-gray-700 mt-1">Revenue Collected</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Placement fees and invoice payments received from hiring companies during this period</p>
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════
                    SECTION 2 — EXECUTIVE SCORECARD (period-filtered)
                ══════════════════════════════════════════════════════════ */}
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-bold text-gray-800">Executive Performance Scorecard</h3>
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{periodLabel}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">
                        Activity breakdown per HR executive — outreach operations, lead pipeline, and hiring results for the selected period.
                        Columns are colour-coded by function: <span className="text-indigo-600 font-medium">purple = outreach</span>, <span className="text-amber-600 font-medium">amber = leads</span>, <span className="text-green-600 font-medium">green = hiring</span>.
                    </p>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {!mis.executives?.length ? (
                            <p className="text-sm text-gray-400 p-6">No executive data available.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="text-xs w-full" style={{ minWidth: '1100px' }}>
                                    <thead>
                                        {/* Group row */}
                                        <tr className="border-b border-gray-200">
                                            <th className="px-4 py-3 text-left align-bottom" rowSpan={2}>
                                                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Executive</p>
                                            </th>
                                            <th className="px-3 py-3 text-center align-bottom" rowSpan={2}>
                                                <p className="text-[11px] font-semibold text-gray-500 uppercase leading-tight">Companies<br/>Assigned</p>
                                                <p className="text-[9px] text-gray-400 font-normal mt-0.5">all-time total</p>
                                            </th>
                                            <th colSpan={4} className="px-3 py-2 text-center bg-indigo-50 border-l-2 border-indigo-200">
                                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">📣 Outreach Activity</p>
                                                <p className="text-[9px] text-indigo-400 font-normal">campaigns, messages & calls during this period</p>
                                            </th>
                                            <th colSpan={2} className="px-3 py-2 text-center bg-amber-50 border-l-2 border-amber-200">
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">🎯 Lead Pipeline</p>
                                                <p className="text-[9px] text-amber-400 font-normal">outreach-generated leads &amp; conversions</p>
                                            </th>
                                            <th colSpan={4} className="px-3 py-2 text-center bg-green-50 border-l-2 border-green-200">
                                                <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">👥 Hiring Pipeline</p>
                                                <p className="text-[9px] text-green-400 font-normal">candidates sourced through to placements</p>
                                            </th>
                                            <th className="px-3 py-3 text-center align-bottom" rowSpan={2}>
                                                <p className="text-[11px] font-semibold text-gray-500 uppercase leading-tight">Tasks<br/>Completed</p>
                                                <p className="text-[9px] text-gray-400 font-normal mt-0.5">closed in tracker</p>
                                            </th>
                                            <th className="px-4 py-3 text-right align-bottom" rowSpan={2}>
                                                <p className="text-[11px] font-semibold text-gray-500 uppercase leading-tight">Placement Fees<br/>Collected</p>
                                                <p className="text-[9px] text-gray-400 font-normal mt-0.5">invoices paid</p>
                                            </th>
                                        </tr>
                                        {/* Sub-column row */}
                                        <tr className="border-b-2 border-gray-200 bg-gray-50">
                                            {/* Outreach */}
                                            <th className="px-3 py-2 text-center bg-indigo-50 border-l-2 border-indigo-200">
                                                <p className="font-semibold text-indigo-700">Campaigns</p>
                                                <p className="text-[9px] text-gray-400 font-normal">email/WA launched</p>
                                            </th>
                                            <th className="px-3 py-2 text-center bg-indigo-50">
                                                <p className="font-semibold text-indigo-700">Messages Sent</p>
                                                <p className="text-[9px] text-gray-400 font-normal">total delivered</p>
                                            </th>
                                            <th className="px-3 py-2 text-center bg-indigo-50">
                                                <p className="font-semibold text-indigo-700">Replies Received</p>
                                                <p className="text-[9px] text-gray-400 font-normal">inbound responses</p>
                                            </th>
                                            <th className="px-3 py-2 text-center bg-indigo-50">
                                                <p className="font-semibold text-indigo-700">Cold Calls</p>
                                                <p className="text-[9px] text-gray-400 font-normal">calls logged</p>
                                            </th>
                                            {/* Leads */}
                                            <th className="px-3 py-2 text-center bg-amber-50 border-l-2 border-amber-200">
                                                <p className="font-semibold text-amber-700">Leads Generated</p>
                                                <p className="text-[9px] text-gray-400 font-normal">via campaigns</p>
                                            </th>
                                            <th className="px-3 py-2 text-center bg-amber-50">
                                                <p className="font-semibold text-amber-700">Leads Converted</p>
                                                <p className="text-[9px] text-gray-400 font-normal">became clients</p>
                                            </th>
                                            {/* Hiring */}
                                            <th className="px-3 py-2 text-center bg-green-50 border-l-2 border-green-200">
                                                <p className="font-semibold text-green-700">Candidates Sourced</p>
                                                <p className="text-[9px] text-gray-400 font-normal">added to pipeline</p>
                                            </th>
                                            <th className="px-3 py-2 text-center bg-green-50">
                                                <p className="font-semibold text-green-700">Interviews Scheduled</p>
                                                <p className="text-[9px] text-gray-400 font-normal">for assigned companies</p>
                                            </th>
                                            <th className="px-3 py-2 text-center bg-green-50">
                                                <p className="font-semibold text-green-700">Offers Facilitated</p>
                                                <p className="text-[9px] text-gray-400 font-normal">offer letters sent</p>
                                            </th>
                                            <th className="px-3 py-2 text-center bg-green-50">
                                                <p className="font-semibold text-green-800">Hires Closed</p>
                                                <p className="text-[9px] text-gray-400 font-normal">placements confirmed</p>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(mis.executives ?? []).map(e => {
                                            const replyRate = e.messages_sent > 0 ? Math.round((e.replies_received / e.messages_sent) * 100) : null;
                                            const convRate  = e.leads_created > 0  ? Math.round((e.leads_converted / e.leads_created) * 100)  : null;
                                            return (
                                                <tr key={e.user_id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{e.executive_name}</td>
                                                    <td className="px-3 py-3 text-center font-bold text-gray-700">{e.companies_assigned}</td>
                                                    {/* Outreach */}
                                                    <td className="px-3 py-3 text-center bg-indigo-50/40 border-l-2 border-indigo-100">
                                                        <span className="font-bold text-indigo-700">{e.campaigns_run}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center bg-indigo-50/40">
                                                        <span className="text-gray-700 tabular-nums">{fmt(e.messages_sent)}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center bg-indigo-50/40">
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-semibold text-blue-600">{e.replies_received}</span>
                                                            {replyRate !== null && <span className="text-[9px] text-gray-400">{replyRate}% rate</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-center bg-indigo-50/40">
                                                        <span className="text-gray-700">{e.outreach_calls}</span>
                                                    </td>
                                                    {/* Leads */}
                                                    <td className="px-3 py-3 text-center bg-amber-50/40 border-l-2 border-amber-100">
                                                        <span className="font-semibold text-amber-700">{e.leads_created}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center bg-amber-50/40">
                                                        <div className="flex flex-col items-center">
                                                            <span className={`font-bold ${Number(e.leads_converted) > 0 ? 'text-green-600' : 'text-gray-400'}`}>{e.leads_converted}</span>
                                                            {convRate !== null && <span className="text-[9px] text-gray-400">{convRate}% conv.</span>}
                                                        </div>
                                                    </td>
                                                    {/* Hiring */}
                                                    <td className="px-3 py-3 text-center bg-green-50/40 border-l-2 border-green-100">
                                                        <span className="font-semibold text-gray-700">{e.candidates_sourced}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center bg-green-50/40">
                                                        <span className="text-gray-700">{e.interviews_scheduled}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center bg-green-50/40">
                                                        <span className="text-gray-700">{e.offers_facilitated}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center bg-green-50/40">
                                                        <span className={`font-bold px-2 py-0.5 rounded-full ${Number(e.hires_closed) > 0 ? 'bg-green-100 text-green-700' : 'text-gray-400'}`}>
                                                            {e.hires_closed}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center text-gray-700">{e.tasks_completed}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-green-700">{fmtINR(e.fees_collected)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════
                    SECTION 3 — TOP PERFORMERS (period-filtered)
                ══════════════════════════════════════════════════════════ */}
                {mis.topPerformers?.length > 0 && (
                    <div>
                        <h3 className="text-base font-bold text-gray-800 mb-1">Top Performers — {periodLabel}</h3>
                        <p className="text-xs text-gray-400 mb-4">Executives ranked by candidates sourced, campaigns run, and calls made during the selected period.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            {mis.topPerformers.map((tp, i) => (
                                <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center text-white shrink-0 ${
                                            i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-200 text-gray-600'
                                        }`}>{i + 1}</span>
                                        <p className="font-semibold text-gray-800 text-sm leading-tight">{tp.name}</p>
                                    </div>
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400">Candidates Sourced</span>
                                            <span className="font-bold text-indigo-700">{tp.sourced}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400">Campaigns Run</span>
                                            <span className="font-bold text-purple-700">{tp.campaigns}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400">Messages Sent</span>
                                            <span className="font-bold text-blue-600">{fmt(tp.messages)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400">Cold Calls Logged</span>
                                            <span className="font-bold text-gray-700">{tp.calls}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </>) : null}

            {/* ══════════════════════════════════════════════════════════════
                SECTION 4 — ALL-TIME CUMULATIVE PLATFORM STATS
            ══════════════════════════════════════════════════════════════ */}
            <div className="border-t-2 border-dashed border-gray-200 pt-8">
                <div className="mb-6">
                    <h3 className="text-base font-bold text-gray-800">All-Time Cumulative Statistics</h3>
                    <p className="text-xs text-gray-400 mt-1">
                        Total platform counts since inception — not affected by the period filter above.
                    </p>
                </div>

                {/* Users & platform health */}
                <Panel title="Platform Users & Health" subtitle="Total registered users, approval status, and staff count across the platform" className="mb-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <SumTile label="Total Companies" desc="All registered hiring companies" value={summary?.total_companies} accent="border-blue-400" />
                        <SumTile label="Approved Companies" desc="Companies cleared for posting jobs" value={summary?.approved_companies} accent="border-green-400" />
                        <SumTile label="Pending Approval" desc="Companies awaiting admin review" value={summary?.pending_companies} accent="border-amber-400" />
                        <SumTile label="HR Staff / Executives" desc="Internal team members on the platform" value={summary?.total_hr_staff} accent="border-indigo-400" />
                        <SumTile label="Total Candidates" desc="All registered job seekers" value={summary?.total_candidates} accent="border-purple-400" />
                        <SumTile label="Active Candidates" desc="Candidates with a complete profile" value={summary?.active_candidates} accent="border-pink-400" />
                        <SumTile label="Avg AI Match Score" desc="Average job-fit score across all applications" value={summary?.avg_match_score != null ? `${summary.avg_match_score}%` : '—'} accent="border-violet-400" />
                        <SumTile label="Offer Accept Rate" desc="% of sent offers accepted by candidates" value={funnel?.offer_acceptance_rate != null ? `${funnel.offer_acceptance_rate}%` : '—'} accent="border-green-500" />
                    </div>
                </Panel>

                {/* Recruitment funnel + monthly growth — side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                    <Panel title="All-Time Recruitment Funnel" subtitle="How candidates progress from application to confirmed hire">
                        <div className="space-y-3">
                            {funnelSteps.map((step, i) => (
                                <BarRow key={step.label} label={step.label} note={step.note} value={step.value || 0} max={funnelMax} color={step.color} />
                            ))}
                            {funnelSteps.length > 0 && (
                                <div className="pt-3 border-t grid grid-cols-3 gap-2 text-center text-xs">
                                    <div>
                                        <p className="font-bold text-gray-800">{pct(funnel?.shortlisted, funnel?.applications)}</p>
                                        <p className="text-gray-400">Shortlist rate</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">{pct(funnel?.interviewed, funnel?.shortlisted)}</p>
                                        <p className="text-gray-400">Interview rate</p>
                                    </div>
                                    <div>
                                        <p className="font-bold text-green-700">{pct(funnel?.hired, funnel?.offers_sent)}</p>
                                        <p className="text-gray-400">Offer accept rate</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Panel>

                    <Panel title="Monthly Registrations — Last 12 Months" subtitle="New companies and candidates joining each month">
                        {safeMonthly.length === 0 ? <p className="text-sm text-gray-400">No data.</p> : (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1">Companies</p>
                                    {safeMonthly.map(m => <BarRow key={`c-${m.month}`} label={m.month} value={m.new_companies || 0} max={maxMonthly} color="bg-blue-500" />)}
                                </div>
                                <div className="space-y-2 pt-4 border-t">
                                    <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider mb-1">Candidates</p>
                                    {safeMonthly.map(m => <BarRow key={`cd-${m.month}`} label={m.month} value={m.new_candidates || 0} max={maxMonthly} color="bg-green-500" />)}
                                </div>
                            </div>
                        )}
                    </Panel>
                </div>

                {/* Recruitment pipeline + HR activity + Finance */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                    <Panel title="Recruitment Pipeline" subtitle="Lifetime totals across all job postings">
                        <div className="grid grid-cols-2 gap-3">
                            <SumTile label="Active Job Postings"   desc="Open positions currently live" value={summary?.active_jobs}       accent="border-blue-400" />
                            <SumTile label="Total Applications"     desc="All-time candidate applications" value={summary?.total_applications} accent="border-indigo-400" />
                            <SumTile label="Interviews Held"        desc="Completed interview sessions" value={summary?.interviews_held}    accent="border-purple-400" />
                            <SumTile label="Placements Made"        desc="Candidates hired across all companies" value={summary?.total_placements} accent="border-green-400" />
                        </div>
                    </Panel>

                    <Panel title="HR & Outreach Activity" subtitle="All-time outreach and lead activity by HR team">
                        <div className="grid grid-cols-2 gap-3">
                            <SumTile label="Total Calls Logged"  desc="HR cold calls recorded" value={summary?.total_calls}     accent="border-blue-400" />
                            <SumTile label="Total Leads Created" desc="Business leads in pipeline" value={summary?.total_leads}     accent="border-amber-400" />
                            <SumTile label="Leads Converted"     desc="Leads that became clients" value={summary?.converted_leads} accent="border-green-400" />
                            <SumTile label="Tasks Completed"     desc="HR tasks closed in tracker" value={summary?.tasks_completed} accent="border-indigo-400" />
                        </div>
                    </Panel>

                    <Panel title="Finance Summary" subtitle="All-time billing and collection status">
                        <div className="grid grid-cols-2 gap-3">
                            <SumTile label="Total Invoiced"    desc="Sum of all invoices raised" value={fmtINR(invSum?.total_invoiced)}   accent="border-gray-400" />
                            <SumTile label="Total Collected"   desc="Payments received to date"  value={fmtINR(invSum?.total_collected)}  accent="border-green-500" />
                            <SumTile label="Outstanding"       desc={`${(invSum?.pending_count || 0) + (invSum?.partial_count || 0)} open invoices`} value={fmtINR(invSum?.total_outstanding)} accent="border-amber-400" />
                            <SumTile label="Overdue Invoices"  desc="Past due date, unpaid"       value={invSum?.overdue_count || 0}      accent="border-red-400" />
                        </div>
                    </Panel>
                </div>

                {/* Outreach all-time */}
                {outreach && (
                    <Panel title="All-Time Outreach Summary" subtitle="Cumulative totals for all email and WhatsApp campaigns run by the team">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <SumTile label="Total Contacts"          desc="People in all contact lists"         value={outreach.total_contacts}         accent="border-gray-400" />
                            <SumTile label="Campaigns Sent"          desc="Email + WhatsApp campaigns launched" value={outreach.total_campaigns}         accent="border-indigo-400" />
                            <SumTile label="Messages Delivered"      desc="Total outreach messages sent"        value={fmt(outreach.total_sent)}         accent="border-blue-400" />
                            <SumTile label="Replies Received"        desc="Inbound responses from contacts"     value={outreach.total_replies}           accent="border-teal-400" />
                            <SumTile label="Leads from Outreach"     desc="Contacts converted to leads"         value={outreach.total_leads_generated}   accent="border-green-500" />
                        </div>
                        <button onClick={() => navigate('/outreach/analytics')} className="mt-4 text-xs text-indigo-600 hover:underline">
                            View detailed outreach analytics →
                        </button>
                    </Panel>
                )}
            </div>
        </div>
    );
}

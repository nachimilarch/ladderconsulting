import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAnalyticsAPI } from '../../api/admin';
import { adminInvoiceAPI } from '../../api/payments';
import { analyticsAPI } from '../../api/outreach';
import toast from 'react-hot-toast';

const fmtINR = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';
const fmt    = (v) => v != null ? Number(v).toLocaleString('en-IN') : '0';

// ── Shared components ──────────────────────────────────────────────────────────

const BarRow = ({ label, value, max, color = 'bg-indigo-500' }) => {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-3 text-sm">
            <span className="w-28 text-gray-500 truncate shrink-0">{label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right text-gray-700 font-medium">{value ?? 0}</span>
        </div>
    );
};

const Section = ({ title, children, className = '' }) => (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 ${className}`}>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
        {children}
    </div>
);

const StatBox = ({ label, value, sub, accent }) => (
    <div className={`bg-gray-50 rounded-lg p-3 text-center border-t-2 ${accent || 'border-transparent'}`}>
        <p className="text-xl font-bold text-gray-800">{value ?? 0}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
);

const KpiCard = ({ label, value, sub, color = 'text-gray-800', accent = '' }) => (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center ${accent}`}>
        <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
);

// Mini sparkline (SVG path from data points)
const Sparkline = ({ data = [], field, color = '#6a47d4' }) => {
    if (!data.length) return null;
    const vals = data.map(d => Number(d[field]) || 0);
    const max = Math.max(...vals, 1);
    const W = 80, H = 28;
    const step = W / (vals.length - 1 || 1);
    const pts = vals.map((v, i) => `${i * step},${H - (v / max) * H}`).join(' ');
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-20 h-7 ml-auto">
            <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" points={pts} />
        </svg>
    );
};

// ── MIS KPI tile with sparkline ────────────────────────────────────────────────
const MisTile = ({ label, value, trend, trendField, color = '#6a47d4', textColor = 'text-indigo-700' }) => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1">
        <div className="flex items-start justify-between">
            <div>
                <p className={`text-2xl font-bold ${textColor}`}>{fmt(value)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
            <Sparkline data={trend} field={trendField} color={color} />
        </div>
    </div>
);

const PERIODS = [
    { key: 'daily',   label: 'Today' },
    { key: 'weekly',  label: 'This Week' },
    { key: 'monthly', label: 'This Month' },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PlatformAnalytics() {
    const [monthly,  setMonthly]  = useState([]);
    const [funnel,   setFunnel]   = useState(null);
    const [summary,  setSummary]  = useState(null);
    const [outreach, setOutreach] = useState(null);
    const [execPerf, setExecPerf] = useState([]);
    const [invSum,   setInvSum]   = useState(null);
    const [loading,  setLoading]  = useState(true);

    // MIS state
    const [period,   setPeriod]   = useState('weekly');
    const [mis,      setMis]      = useState(null);
    const [misLoad,  setMisLoad]  = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([
            adminAnalyticsAPI.getMonthly(),
            adminAnalyticsAPI.getConversion(),
            adminAnalyticsAPI.getSummary(),
            adminAnalyticsAPI.getExecutivePerformance(),
            adminInvoiceAPI.summary(),
        ])
            .then(([m, f, s, ep, inv]) => {
                setMonthly(m.data?.data ?? []);
                setFunnel(f.data?.data?.funnel ?? null);
                setSummary(s.data?.data?.summary ?? null);
                setExecPerf(ep.data?.data ?? []);
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

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Loading…</div>;

    const safeMonthly = Array.isArray(monthly) ? monthly : [];
    const maxMonthly  = Math.max(...safeMonthly.map(m => Math.max(m.new_companies || 0, m.new_candidates || 0)), 1);

    const funnelSteps = funnel ? [
        { label: 'Applications', value: funnel.applications, color: 'bg-blue-500'   },
        { label: 'Shortlisted',  value: funnel.shortlisted,  color: 'bg-indigo-500' },
        { label: 'Interviewed',  value: funnel.interviewed,  color: 'bg-purple-500' },
        { label: 'Offers Sent',  value: funnel.offers_sent,  color: 'bg-yellow-500' },
        { label: 'Hired',        value: funnel.hired,        color: 'bg-green-500'  },
    ] : [];
    const funnelMax = funnelSteps[0]?.value || 1;

    const maxExecOffers = Math.max(...execPerf.map(e => Number(e.offers_sent) || 0), 1);
    const p = mis?.platform ?? {};
    const trend = mis?.trend ?? [];

    return (
        <div className="p-8 space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Platform Analytics & MIS</h2>
                <p className="text-sm text-gray-500">Live overview of all operations across LadderStep Human Consulting</p>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                MIS / OPERATIONAL REPORT — period-filtered
            ════════════════════════════════════════════════════════════════ */}
            <div>
                {/* Period selector */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-800">Operational MIS Report</h3>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        {PERIODS.map(pp => (
                            <button
                                key={pp.key}
                                onClick={() => setPeriod(pp.key)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    period === pp.key
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {pp.label}
                            </button>
                        ))}
                    </div>
                </div>

                {misLoad ? (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading MIS data…</div>
                ) : mis ? (
                    <>
                        {/* Platform operational KPIs */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                            <MisTile label="New Registrations" value={p.new_registrations} trend={trend} trendField="applications" color="#6a47d4" textColor="text-indigo-700" />
                            <MisTile label="Jobs Posted"        value={p.jobs_posted}        trend={trend} trendField="applications" color="#0ea5e9" textColor="text-blue-700" />
                            <MisTile label="Applications"       value={p.applications_received} trend={trend} trendField="applications" color="#8b5cf6" textColor="text-purple-700" />
                            <MisTile label="Interviews Scheduled" value={p.interviews_scheduled} trend={trend} trendField="interviews" color="#f59e0b" textColor="text-amber-700" />
                            <MisTile label="Offers Sent"        value={p.offers_sent}        trend={trend} trendField="offers" color="#10b981" textColor="text-emerald-700" />
                            <MisTile label="Hires Made"         value={p.hires_made}         trend={trend} trendField="hires" color="#059669" textColor="text-green-700" />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                            <MisTile label="Leads Created"      value={p.leads_created}      trend={trend} trendField="leads" color="#6a47d4" textColor="text-indigo-700" />
                            <MisTile label="Leads Converted"    value={p.leads_converted}    trend={trend} trendField="leads" color="#0ea5e9" textColor="text-blue-700" />
                            <MisTile label="Campaigns Launched" value={p.campaigns_launched} trend={trend} trendField="applications" color="#8b5cf6" textColor="text-purple-700" />
                            <MisTile label="Messages Sent"      value={p.outreach_messages_sent} trend={trend} trendField="applications" color="#f59e0b" textColor="text-amber-700" />
                            <MisTile label="Tasks Completed"    value={p.tasks_completed}    trend={trend} trendField="applications" color="#10b981" textColor="text-emerald-700" />
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <p className="text-2xl font-bold text-green-700">{fmtINR(p.revenue_collected)}</p>
                                <p className="text-xs text-gray-500 mt-0.5">Revenue Collected</p>
                            </div>
                        </div>

                        {/* Executive operations table (period-filtered) */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100">
                                <h4 className="text-sm font-semibold text-gray-700">
                                    Executive Operations — {PERIODS.find(pp => pp.key === period)?.label}
                                </h4>
                            </div>
                            {mis.executives?.length === 0 ? (
                                <p className="text-sm text-gray-400 p-5">No executive data.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs text-gray-500 uppercase border-b border-gray-100 bg-gray-50">
                                                <th className="px-4 py-3 text-left font-medium">Executive</th>
                                                <th className="px-3 py-3 text-center font-medium">Cos Mgd</th>
                                                <th className="px-3 py-3 text-center font-medium">Leads</th>
                                                <th className="px-3 py-3 text-center font-medium">Converted</th>
                                                <th className="px-3 py-3 text-center font-medium">Calls</th>
                                                <th className="px-3 py-3 text-center font-medium">Sourced</th>
                                                <th className="px-3 py-3 text-center font-medium">Interviews Appvd</th>
                                                <th className="px-3 py-3 text-center font-medium">Offers Fclt'd</th>
                                                <th className="px-3 py-3 text-center font-medium">Hires Closed</th>
                                                <th className="px-3 py-3 text-center font-medium">Tasks Done</th>
                                                <th className="px-3 py-3 text-center font-medium">Campaigns</th>
                                                <th className="px-4 py-3 text-right font-medium">Fees Collected</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {(mis.executives ?? []).map(e => {
                                                const conversion = e.leads_created > 0
                                                    ? Math.round((e.leads_converted / e.leads_created) * 100)
                                                    : 0;
                                                return (
                                                    <tr key={e.employee_id} className="hover:bg-indigo-50/30 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium text-gray-800">{e.executive_name}</p>
                                                            <p className="text-[10px] text-gray-400">{e.designation || e.department || '—'}</p>
                                                        </td>
                                                        <td className="px-3 py-3 text-center text-gray-700">{e.companies_assigned}</td>
                                                        <td className="px-3 py-3 text-center text-gray-700">{e.leads_created}</td>
                                                        <td className="px-3 py-3 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className={`text-xs font-semibold ${Number(e.leads_converted) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                                    {e.leads_converted}
                                                                </span>
                                                                {e.leads_created > 0 && (
                                                                    <span className="text-[10px] text-gray-400">{conversion}%</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-center text-gray-700">{e.calls_made}</td>
                                                        <td className="px-3 py-3 text-center text-gray-700">{e.candidates_sourced}</td>
                                                        <td className="px-3 py-3 text-center text-gray-700">{e.interviews_approved}</td>
                                                        <td className="px-3 py-3 text-center text-gray-700">{e.offers_facilitated}</td>
                                                        <td className="px-3 py-3 text-center">
                                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                                Number(e.hires_closed) > 0
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-gray-100 text-gray-400'
                                                            }`}>
                                                                {e.hires_closed}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-3 text-center text-gray-700">{e.tasks_completed}</td>
                                                        <td className="px-3 py-3 text-center text-gray-700">{e.campaigns_run}</td>
                                                        <td className="px-4 py-3 text-right font-medium text-green-700">{fmtINR(e.fees_collected)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Top performers */}
                        {mis.topPerformers?.length > 0 && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
                                {mis.topPerformers.map((tp, i) => (
                                    <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center text-white ${
                                                i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-400' : 'bg-amber-700/60'
                                            }`}>{i + 1}</span>
                                            <span className="text-xs text-gray-500">Top Performer</span>
                                        </div>
                                        <p className="font-semibold text-gray-800 text-sm">{tp.name}</p>
                                        <p className="text-[10px] text-gray-400 mb-2">{tp.designation || '—'}</p>
                                        <div className="flex gap-3 text-xs text-gray-600">
                                            <span><span className="font-bold text-indigo-700">{tp.leads}</span> leads</span>
                                            <span><span className="font-bold text-green-700">{tp.converted}</span> conv</span>
                                            <span><span className="font-bold text-blue-700">{tp.calls}</span> calls</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            {/* ════════════════════════════════════════════════════════════════
                ALL-TIME PLATFORM ANALYTICS (existing sections below)
            ════════════════════════════════════════════════════════════════ */}
            <div>
                <h3 className="text-base font-semibold text-gray-800 mb-4">All-Time Platform Overview</h3>

                {/* Top KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KpiCard label="Total Candidates" value={summary?.total_candidates} sub={`${summary?.active_candidates || 0} active`} color="text-indigo-700" />
                    <KpiCard label="Total Offers Sent" value={summary?.total_placements} sub={`${summary?.placements_this_month || 0} this month`} color="text-green-700" />
                    <KpiCard label="Offer Accept Rate" value={funnel?.offer_acceptance_rate != null ? `${funnel.offer_acceptance_rate}%` : '—'} color="text-blue-700" />
                    <KpiCard label="Avg AI Match Score" value={summary?.avg_match_score != null ? `${summary.avg_match_score}%` : '—'} color="text-purple-700" />
                </div>

                {/* Financial KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KpiCard label="Total Invoiced"   value={fmtINR(invSum?.total_invoiced)}   color="text-gray-800" />
                    <KpiCard label="Total Collected"  value={fmtINR(invSum?.total_collected)}  color="text-green-700" />
                    <KpiCard label="Outstanding"      value={fmtINR(invSum?.total_outstanding)} color="text-yellow-700"
                        sub={`${(invSum?.pending_count || 0) + (invSum?.partial_count || 0)} open`} />
                    <KpiCard label="Overdue Invoices" value={invSum?.overdue_count || 0}       color="text-red-600" />
                </div>

                {/* All-time Executive Performance */}
                <div className="mb-6">
                    <Section title="All-Time Executive Performance">
                        {execPerf.length === 0 ? (
                            <p className="text-sm text-gray-400">No executives found.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                                            <th className="pb-2 text-left font-medium">Executive</th>
                                            <th className="pb-2 text-left font-medium">Dept</th>
                                            <th className="pb-2 text-center font-medium">Companies</th>
                                            <th className="pb-2 text-center font-medium">Leads</th>
                                            <th className="pb-2 text-center font-medium">Converted</th>
                                            <th className="pb-2 text-center font-medium">Calls</th>
                                            <th className="pb-2 text-center font-medium">Sourced</th>
                                            <th className="pb-2 text-center font-medium">Offers Sent</th>
                                            <th className="pb-2 text-right font-medium">Fees Collected</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {execPerf.map(e => (
                                            <tr key={e.employee_id} className="hover:bg-gray-50">
                                                <td className="py-2.5 pr-4">
                                                    <p className="font-medium text-gray-800">{e.executive_name}</p>
                                                    <p className="text-[10px] text-gray-400">{e.designation || e.department}</p>
                                                </td>
                                                <td className="py-2.5 pr-4 text-gray-500 text-xs">{e.department || '—'}</td>
                                                <td className="py-2.5 text-center text-gray-700">{e.companies_assigned}</td>
                                                <td className="py-2.5 text-center text-gray-700">{e.leads_managed}</td>
                                                <td className="py-2.5 text-center">
                                                    <span className={`text-xs font-medium ${Number(e.leads_converted) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                        {e.leads_converted}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 text-center text-gray-700">{e.calls_made}</td>
                                                <td className="py-2.5 text-center text-gray-700">{e.candidates_sourced}</td>
                                                <td className="py-2.5 text-center">
                                                    <div className="flex items-center gap-1 justify-center">
                                                        <div className="flex-1 max-w-[60px] bg-gray-100 rounded-full h-1.5">
                                                            <div className="bg-indigo-500 h-1.5 rounded-full"
                                                                style={{ width: `${Math.round((e.offers_sent / maxExecOffers) * 100)}%` }} />
                                                        </div>
                                                        <span className="text-xs font-semibold text-indigo-700">{e.offers_sent}</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-right font-medium text-green-700">{fmtINR(e.fees_collected)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Section>
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <Section title="Monthly Registrations (last 12 months)">
                        {safeMonthly.length === 0 ? (
                            <p className="text-sm text-gray-400">No data.</p>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-400 font-medium uppercase mb-1">Companies</p>
                                    {safeMonthly.map(m => (
                                        <BarRow key={`c-${m.month}`} label={m.month} value={m.new_companies || 0} max={maxMonthly} color="bg-blue-500" />
                                    ))}
                                </div>
                                <div className="space-y-2 pt-4 border-t">
                                    <p className="text-xs text-gray-400 font-medium uppercase mb-1">Candidates</p>
                                    {safeMonthly.map(m => (
                                        <BarRow key={`cd-${m.month}`} label={m.month} value={m.new_candidates || 0} max={maxMonthly} color="bg-green-500" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </Section>

                    <Section title="Recruitment Conversion Funnel">
                        {funnelSteps.length === 0 ? (
                            <p className="text-sm text-gray-400">No data.</p>
                        ) : (
                            <div className="space-y-3">
                                {funnelSteps.map(step => (
                                    <BarRow key={step.label} label={step.label} value={step.value || 0} max={funnelMax} color={step.color} />
                                ))}
                                {funnel?.offer_acceptance_rate != null && (
                                    <p className="text-xs text-gray-400 pt-3 border-t">
                                        Offer acceptance rate: <span className="font-semibold text-gray-700">{funnel.offer_acceptance_rate}%</span>
                                    </p>
                                )}
                            </div>
                        )}
                    </Section>
                </div>

                {/* Platform stat grids */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <Section title="Platform Users">
                        <div className="grid grid-cols-2 gap-3">
                            <StatBox label="Companies"   value={summary?.total_companies}  sub={`${summary?.approved_companies || 0} approved`} accent="border-blue-400" />
                            <StatBox label="Candidates"  value={summary?.total_candidates} sub={`${summary?.active_candidates || 0} active`} accent="border-green-400" />
                            <StatBox label="HR Staff"    value={summary?.total_hr_staff}   accent="border-indigo-400" />
                            <StatBox label="Pending Cos" value={summary?.pending_companies} accent="border-yellow-400" />
                        </div>
                    </Section>

                    <Section title="Recruitment Pipeline">
                        <div className="grid grid-cols-2 gap-3">
                            <StatBox label="Active Jobs"    value={summary?.active_jobs}        accent="border-blue-400" />
                            <StatBox label="Applications"   value={summary?.total_applications}  accent="border-indigo-400" />
                            <StatBox label="Interviews"     value={summary?.interviews_held}     accent="border-purple-400" />
                            <StatBox label="Offers Sent"    value={summary?.total_placements}    sub={`${summary?.placements_this_month || 0} this month`} accent="border-green-400" />
                        </div>
                    </Section>

                    <Section title="HR & Outreach Activity">
                        <div className="grid grid-cols-2 gap-3">
                            <StatBox label="Total Calls"     value={summary?.total_calls}     accent="border-blue-400" />
                            <StatBox label="Total Leads"     value={summary?.total_leads}     accent="border-yellow-400" />
                            <StatBox label="Converted"       value={summary?.converted_leads} accent="border-green-400" />
                            <StatBox label="Tasks Done"      value={summary?.tasks_completed} accent="border-indigo-400" />
                        </div>
                    </Section>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Section title="Training & Onboarding">
                        <div className="grid grid-cols-2 gap-3">
                            <StatBox label="Courses"           value={summary?.total_courses}         />
                            <StatBox label="Active Enrolments" value={summary?.active_assignments}    />
                            <StatBox label="Completed"         value={summary?.completed_assignments} accent="border-green-400" />
                            <StatBox label="Certificates"      value={summary?.certificates_issued}   accent="border-indigo-400" />
                        </div>
                    </Section>

                    {outreach && (
                        <Section title="Outreach Campaigns">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <StatBox label="Total Contacts"   value={outreach.total_contacts}  />
                                <StatBox label="Campaigns Sent"   value={outreach.total_campaigns} />
                                <StatBox label="Emails Sent"      value={outreach.total_sent}      />
                                <StatBox label="Replies"          value={outreach.total_replies}   accent="border-indigo-400" />
                            </div>
                            <StatBox label="Leads Generated from Outreach" value={outreach.total_leads_generated} accent="border-green-400" />
                            <button
                                onClick={() => navigate('/outreach/analytics')}
                                className="mt-3 text-xs text-indigo-600 hover:underline"
                            >
                                View full outreach analytics →
                            </button>
                        </Section>
                    )}
                </div>
            </div>
        </div>
    );
}

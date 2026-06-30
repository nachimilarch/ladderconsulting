import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAnalyticsAPI } from '../../api/admin';
import { adminInvoiceAPI } from '../../api/payments';
import { analyticsAPI } from '../../api/outreach';
import toast from 'react-hot-toast';

const fmtINR = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';

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

const KpiCard = ({ label, value, sub, color = 'text-gray-800' }) => (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
        <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
);

export default function PlatformAnalytics() {
    const [monthly,  setMonthly]  = useState([]);
    const [funnel,   setFunnel]   = useState(null);
    const [summary,  setSummary]  = useState(null);
    const [outreach, setOutreach] = useState(null);
    const [execPerf, setExecPerf] = useState([]);
    const [invSum,   setInvSum]   = useState(null);
    const [loading,  setLoading]  = useState(true);
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

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Loading…</div>;

    const safeMonthly = Array.isArray(monthly) ? monthly : [];
    const maxMonthly = Math.max(...safeMonthly.map(m => Math.max(m.new_companies || 0, m.new_candidates || 0)), 1);

    const funnelSteps = funnel ? [
        { label: 'Applications', value: funnel.applications, color: 'bg-blue-500'   },
        { label: 'Shortlisted',  value: funnel.shortlisted,  color: 'bg-indigo-500' },
        { label: 'Interviewed',  value: funnel.interviewed,  color: 'bg-purple-500' },
        { label: 'Offers Sent',  value: funnel.offers_sent,  color: 'bg-yellow-500' },
        { label: 'Hired',        value: funnel.hired,        color: 'bg-green-500'  },
    ] : [];
    const funnelMax = funnelSteps[0]?.value || 1;

    const maxExecOffers = Math.max(...execPerf.map(e => Number(e.offers_sent) || 0), 1);

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Platform Analytics</h2>
            <p className="text-sm text-gray-500 mb-6">Real-time overview of all activity across LadderStep Human Consulting</p>

            {/* ── Top KPIs ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard
                    label="Total Candidates"
                    value={summary?.total_candidates}
                    sub={`${summary?.active_candidates || 0} active`}
                    color="text-indigo-700"
                />
                <KpiCard
                    label="Total Offers Sent"
                    value={summary?.total_placements}
                    sub={`${summary?.placements_this_month || 0} this month`}
                    color="text-green-700"
                />
                <KpiCard
                    label="Offer Accept Rate"
                    value={funnel?.offer_acceptance_rate != null ? `${funnel.offer_acceptance_rate}%` : '—'}
                    color="text-blue-700"
                />
                <KpiCard
                    label="Avg AI Match Score"
                    value={summary?.avg_match_score != null ? `${summary.avg_match_score}%` : '—'}
                    color="text-purple-700"
                />
            </div>

            {/* ── Financial KPIs ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard label="Total Invoiced"    value={fmtINR(invSum?.total_invoiced)}   color="text-gray-800" />
                <KpiCard label="Total Collected"   value={fmtINR(invSum?.total_collected)}  color="text-green-700" />
                <KpiCard label="Outstanding"       value={fmtINR(invSum?.total_outstanding)} color="text-yellow-700"
                    sub={`${(invSum?.pending_count || 0) + (invSum?.partial_count || 0)} open`} />
                <KpiCard label="Overdue Invoices"  value={invSum?.overdue_count || 0}       color="text-red-600" />
            </div>

            {/* ── Executive Performance ────────────────────────────────────── */}
            <div className="mb-6">
                <Section title="Executive Performance" className="">
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

            {/* ── Charts row ───────────────────────────────────────────────── */}
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

            {/* ── Platform stat grids ──────────────────────────────────────── */}
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
                        <StatBox label="Courses"          value={summary?.total_courses}         />
                        <StatBox label="Active Enrolments" value={summary?.active_assignments}   />
                        <StatBox label="Completed"        value={summary?.completed_assignments} accent="border-green-400" />
                        <StatBox label="Certificates"     value={summary?.certificates_issued}   accent="border-indigo-400" />
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
    );
}

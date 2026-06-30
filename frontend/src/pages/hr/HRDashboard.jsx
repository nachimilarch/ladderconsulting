import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { employeeAPI, reportAPI } from '../../api/hr';

const REFRESH_INTERVAL = 30000; // 30 seconds

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtTime = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

function KpiCard({ label, value, icon, sub, tone, to }) {
    const tones = {
        blue:   'bg-blue-50 border-blue-100 text-blue-700',
        green:  'bg-green-50 border-green-100 text-green-700',
        yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
        red:    'bg-red-50 border-red-100 text-red-700',
        indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
        amber:  'bg-amber-50 border-amber-100 text-amber-700',
        violet: 'bg-violet-50 border-violet-100 text-violet-700',
    };
    const inner = (
        <>
            <div className="flex items-center justify-between mb-1">
                <span className="text-xl">{icon}</span>
                {to && <span className="text-[10px] opacity-60">→</span>}
            </div>
            <div className="text-2xl font-bold">{value ?? '—'}</div>
            <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
            {sub && <div className="text-[11px] opacity-60 mt-0.5">{sub}</div>}
        </>
    );
    const cls = `rounded-2xl border p-4 ${tones[tone] || tones.blue}`;
    return to
        ? <Link to={to} className={`${cls} hover:shadow-sm transition`}>{inner}</Link>
        : <div className={cls}>{inner}</div>;
}

export default function HRDashboard() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [stats, setStats] = useState(null);
    const [hiring, setHiring] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState(null);

    const fetchAll = useCallback(async () => {
        try {
            const [statsRes, hiringRes] = await Promise.allSettled([
                employeeAPI.getStats(),
                reportAPI.hiring(),
            ]);
            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data?.data || null);
            if (hiringRes.status === 'fulfilled') setHiring(hiringRes.value.data?.data || null);
            setLastRefreshed(new Date());
        } catch (_) {}
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchAll();
        // Auto-refresh every 30 seconds
        const timer = setInterval(fetchAll, REFRESH_INTERVAL);
        // Refresh when tab becomes visible
        const onVisible = () => { if (document.visibilityState === 'visible') fetchAll(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [fetchAll]);

    const k = hiring?.kpis;

    const quickLinks = [
        { label: 'Tasks',              to: '/hr/tasks',          icon: '✅' },
        { label: 'Reports',            to: '/hr/reports',        icon: '📊' },
        { label: 'Offer Requests',     to: '/hr/offer-requests', icon: '📋' },
        { label: 'Interviews',         to: '/hr/interviews',     icon: '🗓' },
        { label: 'Resume Sourcing',    to: '/hr/sourcing',       icon: '📄' },
        { label: 'Invoices',           to: '/hr/invoices',       icon: '🧾' },
    ];

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Hiring Dashboard</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {isAdmin ? 'All-company view' : 'Your assigned companies'}
                        {lastRefreshed && (
                            <span className="ml-2 text-gray-400">· Updated {fmtTime(lastRefreshed)}</span>
                        )}
                    </p>
                </div>
                <button onClick={fetchAll} className="text-xs text-indigo-600 hover:underline">
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : (
                <>
                    {/* Real-time hiring KPIs */}
                    {k && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                            <KpiCard label="Total Hires"         value={k.hires_total}              icon="🎯" tone="green"  sub={`${k.hires_this_month} this month`} />
                            <KpiCard label="Active Jobs"         value={k.active_jobs}              icon="💼" tone="blue" />
                            <KpiCard label="Applications"        value={k.total_applications}       icon="📥" tone="violet" sub={`${k.candidates_sourced} sourced`} />
                            <KpiCard label="Fees Collected"      value={fmtINR(k.placement_fees_collected)} icon="💰" tone="green" />
                            <KpiCard label="Interview Requests"  value={k.pending_interview_requests} icon="🗓" tone="amber"
                                sub="Pending approval" to="/hr/interviews" />
                            <KpiCard label="Offer Requests"      value={k.pending_offer_requests}   icon="📋" tone="indigo"
                                sub="Pending approval" to="/hr/offer-requests" />
                            <KpiCard label="Upcoming Interviews" value={k.upcoming_interviews}      icon="📅" tone="blue"
                                sub={k.awaiting_candidate_confirmation > 0 ? `${k.awaiting_candidate_confirmation} unconfirmed` : undefined} />
                            <KpiCard label="Outstanding Invoices" value={fmtINR(k.outstanding_amount)} icon="🧾" tone="red"
                                sub={`${k.pending_invoices} invoice${k.pending_invoices !== 1 ? 's' : ''}`} to="/hr/invoices" />
                        </div>
                    )}

                    {/* HR task KPIs (from employeeAPI.getStats) */}
                    {stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                            {isAdmin && (
                                <KpiCard label="Total Employees" value={stats.total_employees} icon="👥" tone="blue" />
                            )}
                            <KpiCard label="Tasks Pending"       value={stats.tasks_pending}        icon="⏳" tone="red" />
                            <KpiCard label="Completed This Week" value={stats.tasks_completed_week} icon="✅" tone="green" />
                        </div>
                    )}

                    {/* Pipeline snapshot */}
                    {hiring?.pipeline?.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-gray-800 text-sm">Live Pipeline</h3>
                                <Link to="/hr/reports" className="text-xs text-indigo-600 hover:underline">Full report →</Link>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {hiring.pipeline.map(p => (
                                    <div key={p.status} className="bg-gray-50 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                        <span className="text-base font-bold text-gray-900">{p.count}</span>
                                        <span className="text-xs text-gray-500 capitalize">{p.status.replace('_', ' ')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pending offer requests */}
                    {hiring?.pending_actions?.offer_requests?.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 mb-5">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-indigo-800 text-sm">
                                    📋 Offer Requests Pending ({hiring.pending_actions.offer_requests.length})
                                </h3>
                                <Link to="/hr/offer-requests" className="text-xs text-indigo-600 hover:underline">View all</Link>
                            </div>
                            <div className="space-y-2">
                                {hiring.pending_actions.offer_requests.slice(0, 3).map(r => (
                                    <Link key={r.id} to={`/hr/offer-requests/${r.id}`}
                                        className="flex items-start justify-between bg-white rounded-xl px-4 py-3 border border-indigo-100 hover:border-indigo-300 transition">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{r.company_name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{r.candidate_name} — {r.job_title}</p>
                                        </div>
                                        {r.placement_fee_amount != null && (
                                            <span className="text-xs text-indigo-700 font-medium shrink-0 ml-4">
                                                ₹{parseFloat(r.placement_fee_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pending interview requests */}
                    {hiring?.pending_actions?.interview_requests?.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-5">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-blue-800 text-sm">
                                    🗓 Interview Requests Pending ({hiring.pending_actions.interview_requests.length})
                                </h3>
                                <Link to="/hr/interviews" className="text-xs text-blue-600 hover:underline">View all</Link>
                            </div>
                            <div className="space-y-2">
                                {hiring.pending_actions.interview_requests.slice(0, 3).map(r => (
                                    <Link key={r.id} to={`/hr/interview-requests/${r.id}`}
                                        className="flex items-start justify-between bg-white rounded-xl px-4 py-3 border border-blue-100 hover:border-blue-300 transition">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{r.company_name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{r.candidate_name} — {r.job_title}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Quick navigation */}
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Quick Access</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {quickLinks.map(({ label, to, icon }) => (
                    <Link key={to} to={to}
                        className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition flex flex-col items-center gap-2 text-center">
                        <span className="text-2xl">{icon}</span>
                        <span className="text-xs font-medium text-gray-700">{label}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}

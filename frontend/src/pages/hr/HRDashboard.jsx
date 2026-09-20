import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { employeeAPI } from '../../api/hr';
import NextStepCard from '../../components/common/NextStepCard';
import StepTracker from '../../components/common/StepTracker';
import { buildHrWorkflow } from '../../components/hr/hrWorkflow';
import { inr } from '../../utils/money';

const fmtTime = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// Numbers about the business: neutral cards, no colour. Amber is kept for things waiting on you.
const Glance = ({ label, value, sub, icon }) => (
    <div className="card-p">
        <div className="flex items-center gap-2 mb-1.5">
            <span className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-base shrink-0">{icon}</span>
            <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
        </div>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
);

export default function HRDashboard() {
    const { user } = useAuth();
    const { hiring, premium, loaded, updatedAt, refresh } = useOutletContext();
    const isAdmin = user?.role === 'admin';
    const [tasksPending, setTasksPending] = useState(0);

    useEffect(() => {
        employeeAPI.getStats()
            .then((r) => setTasksPending(Number(r.data?.data?.tasks_pending || 0)))
            .catch(() => {});
    }, []);

    if (!loaded) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading your dashboard…</div>;
    }

    const k = hiring?.kpis || {};
    const { steps, next, waiting } = buildHrWorkflow({ hiring, premium, tasksPending, isAdmin });
    const firstName = (user?.name || '').trim().split(' ')[0];

    const tools = [
        { label: 'Tasks',             to: '/hr/tasks',                      icon: '✅', badge: tasksPending },
        { label: 'Reports',           to: '/hr/reports',                    icon: '📈' },
        { label: 'Outreach',          to: '/outreach',                      icon: '📡' },
        { label: 'Company Premium',   to: '/hr/premium-requests',           icon: '⭐', badge: premium.company },
        { label: 'Candidate Premium', to: '/hr/premium-candidate-requests', icon: '🌟', badge: premium.candidate },
    ];

    return (
        <div className="max-w-4xl mx-auto animate-slide-up space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Hi{firstName ? `, ${firstName}` : ''} 👋</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {isAdmin ? 'All companies' : 'Your assigned companies'}. Here's what needs you today.
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <button onClick={refresh} className="text-xs text-indigo-600 hover:underline">Refresh</button>
                    {updatedAt && <p className="text-[11px] text-gray-400 mt-0.5">Updated {fmtTime(updatedAt)}</p>}
                </div>
            </div>

            <NextStepCard next={next} />

            <StepTracker title="Your hiring workflow" steps={steps} />

            {/* Waiting on you */}
            {waiting.length > 0 && (
                <div>
                    <h2 className="section-title">Waiting on you ({waiting.length})</h2>
                    <div className="card divide-y divide-gray-100 overflow-hidden">
                        {waiting.slice(0, 6).map((w) => (
                            <Link key={w.key} to={w.to} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                                <span className="w-9 h-9 rounded-xl bg-warning-50 flex items-center justify-center text-lg shrink-0">{w.icon}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{w.title}</p>
                                    <p className="text-xs text-gray-500 truncate">{w.sub}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="badge-yellow">{w.kind}</span>
                                    {w.right && <p className="text-xs font-semibold text-gray-700 mt-1">{w.right}</p>}
                                </div>
                            </Link>
                        ))}
                        {waiting.length > 6 && (
                            <p className="px-4 py-2.5 text-xs text-gray-500 bg-gray-50">
                                and {waiting.length - 6} more in <Link to="/hr/interviews" className="text-indigo-600 hover:underline">Interviews</Link> and <Link to="/hr/offer-requests" className="text-indigo-600 hover:underline">Offer Requests</Link>
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* At a glance */}
            <div>
                <h2 className="section-title">At a glance</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Glance icon="🎯" label="Total hires"    value={k.hires_total}       sub={`${k.hires_this_month || 0} this month`} />
                    <Glance icon="💼" label="Active jobs"    value={k.active_jobs} />
                    <Glance icon="📥" label="Applications"   value={k.total_applications} sub={`${k.candidates_sourced || 0} sourced by us`} />
                    <Glance icon="💰" label="Fees collected" value={inr(k.placement_fees_collected)} />
                </div>
            </div>

            {/* Pipeline */}
            {hiring?.pipeline?.length > 0 && (
                <div className="card-p">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-800">Candidate pipeline</h3>
                        <Link to="/hr/reports" className="text-xs text-indigo-600 hover:underline">Full report →</Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {hiring.pipeline.map((p) => (
                            <div key={p.status} className="bg-gray-50 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                <span className="text-base font-bold text-gray-900">{p.count}</span>
                                <span className="text-xs text-gray-500 capitalize">{p.status.replace(/_/g, ' ')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Other tools */}
            <div className="pb-2">
                <h2 className="section-title">More tools</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {tools.map(({ label, to, icon, badge }) => (
                        <Link key={to} to={to}
                            className="relative card p-4 hover:border-brand-200 hover:shadow-card-hover transition flex flex-col items-center gap-2 text-center">
                            {badge > 0 && (
                                <span className="absolute top-2 right-2 bg-warning-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                    {badge}
                                </span>
                            )}
                            <span className="text-2xl">{icon}</span>
                            <span className="text-xs font-medium text-gray-700">{label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

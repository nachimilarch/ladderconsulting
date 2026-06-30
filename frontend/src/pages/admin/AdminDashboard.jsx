import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAnalyticsAPI, adminAuditAPI } from '../../api/admin';
import { adminInvoiceAPI, interviewRequestAPI } from '../../api/payments';
import { offerRequestAPI } from '../../api/interview';
import { adminCompanyAPI } from '../../api/admin';
import toast from 'react-hot-toast';

const Kpi = ({ label, value, sub, color }) => (
    <div className={`bg-white rounded-lg p-5 border-l-4 ${color} shadow-sm`}>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-bold text-gray-800 mt-1">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
);

export default function AdminDashboard() {
    const [summary, setSummary] = useState(null);
    const [auditFeed, setAuditFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingActions, setPendingActions] = useState(null);
    const [invoiceSummary, setInvoiceSummary] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([
            adminAnalyticsAPI.getSummary(),
            adminAuditAPI.getLogs({ limit: 8 }),
        ])
            .then(([s, a]) => {
                setSummary(s.data?.data?.summary ?? null);
                setAuditFeed(a.data?.data || []);
            })
            .catch(() => toast.error('Failed to load dashboard'))
            .finally(() => setLoading(false));

        // Load pending action counts
        Promise.all([
            interviewRequestAPI.listExec({ status: 'pending' }),
            offerRequestAPI.listExec({ status: 'pending' }),
            adminInvoiceAPI.summary(),
            adminCompanyAPI.listUnassigned(),
        ]).then(([intReq, offReq, invSum, unassigned]) => {
            setPendingActions({
                interview_requests: intReq.data?.data?.length || 0,
                offer_requests: offReq.data?.data?.length || 0,
                unassigned_companies: unassigned.data?.data?.length || 0,
            });
            setInvoiceSummary(invSum.data?.data || null);
        }).catch(() => {});

    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Loading dashboard…
            </div>
        );
    }

    const kpis = [
        { label: 'Total Companies',   value: summary?.total_companies,   color: 'border-blue-500',   sub: `${summary?.pending_companies ?? 0} pending approval` },
        { label: 'Total Candidates',  value: summary?.total_candidates,  color: 'border-green-500',  sub: `${summary?.active_candidates ?? 0} active` },
        { label: 'HR Staff',          value: summary?.total_hr_staff,    color: 'border-purple-500', sub: null },
        { label: 'Active Jobs',       value: summary?.active_jobs,       color: 'border-yellow-500', sub: null },
        { label: 'Applications',      value: summary?.total_applications, color: 'border-orange-500', sub: `${summary?.placements_this_month ?? 0} placed this month` },
        { label: 'Interviews Held',   value: summary?.interviews_held,   color: 'border-teal-500',   sub: null },
        { label: 'Certificates Issued', value: summary?.certificates_issued, color: 'border-pink-500', sub: null },
        { label: 'Pending Approvals', value: summary?.pending_companies, color: 'border-red-500',    sub: 'companies awaiting review' },
    ];

    return (
        <div className="p-8">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
                <p className="text-sm text-gray-500 mt-1">Platform-wide overview</p>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {kpis.map((k) => <Kpi key={k.label} {...k} />)}
            </div>

            {/* Platform Pending Actions */}
            {pendingActions && (
                <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Platform Pending Actions</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <button onClick={() => navigate('/hr/interview-requests')}
                            className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left hover:border-blue-400 transition">
                            <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">Interview Requests</p>
                            <p className="text-3xl font-bold text-blue-700">{pendingActions.interview_requests}</p>
                            <p className="text-xs text-blue-400 mt-1">pending</p>
                        </button>
                        <button onClick={() => navigate('/admin/requests')}
                            className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-left hover:border-indigo-400 transition">
                            <p className="text-xs text-indigo-500 uppercase tracking-wide mb-1">Offer Letter Requests</p>
                            <p className="text-3xl font-bold text-indigo-700">{pendingActions.offer_requests}</p>
                            <p className="text-xs text-indigo-400 mt-1">pending</p>
                        </button>
                        <button onClick={() => navigate('/admin/payments')}
                            className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left hover:border-yellow-400 transition">
                            <p className="text-xs text-yellow-600 uppercase tracking-wide mb-1">Outstanding Invoices</p>
                            <p className="text-3xl font-bold text-yellow-700">
                                {(parseInt(invoiceSummary?.pending_count || 0) + parseInt(invoiceSummary?.partial_count || 0))}
                            </p>
                            {invoiceSummary?.total_outstanding && (
                                <p className="text-xs text-yellow-500 mt-1">₹{parseFloat(invoiceSummary.total_outstanding).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                            )}
                        </button>
                        <button onClick={() => navigate('/admin/companies?filter=unassigned')}
                            className="bg-red-50 border border-red-200 rounded-xl p-4 text-left hover:border-red-400 transition">
                            <p className="text-xs text-red-500 uppercase tracking-wide mb-1">Unassigned Companies</p>
                            <p className="text-3xl font-bold text-red-700">{pendingActions.unassigned_companies}</p>
                            <p className="text-xs text-red-400 mt-1">no executive</p>
                        </button>
                    </div>
                </div>
            )}

            {/* Quick actions + audit feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick actions */}
                <div className="bg-white rounded-lg p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                        {[
                            { label: 'Review Pending Companies', to: '/admin/companies', badge: summary?.pending_companies },
                            { label: 'Manage HR Staff',          to: '/admin/staff' },
                            { label: 'View Recruitment Pipeline', to: '/admin/recruitment' },
                            { label: 'Platform Settings',        to: '/admin/settings' },
                        ].map(({ label, to, badge }) => (
                            <button
                                key={to}
                                onClick={() => navigate(to)}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-colors"
                            >
                                <span>{label}</span>
                                {badge > 0 && (
                                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                                        {badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recent audit feed */}
                <div className="lg:col-span-2 bg-white rounded-lg p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700">Recent Activity</h3>
                        <button
                            onClick={() => navigate('/admin/audit-log')}
                            className="text-xs text-indigo-600 hover:underline"
                        >
                            View all →
                        </button>
                    </div>
                    {auditFeed.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No recent activity</p>
                    ) : (
                        <div className="space-y-3">
                            {auditFeed.map((log) => (
                                <div key={log.id} className="flex items-start gap-3 text-sm">
                                    <span className="mt-0.5 text-base">
                                        {log.entity_type === 'company' ? '🏢' :
                                         log.entity_type === 'candidate' ? '👤' :
                                         log.entity_type === 'staff' ? '👥' : '⚙️'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-gray-700 truncate">
                                            <span className="font-medium">{log.admin_email}</span>{' '}
                                            <span className="text-gray-500">{log.action.replace(/_/g, ' ')}</span>
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(log.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

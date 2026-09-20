import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAnalyticsAPI, adminAuditAPI } from '../../api/admin';
import { adminInvoiceAPI, interviewRequestAPI } from '../../api/payments';
import { offerRequestAPI } from '../../api/interview';
import { adminCompanyAPI } from '../../api/admin';
import toast from 'react-hot-toast';

// Numbers about the platform: neutral cards, no colour. Colour is reserved for
// things that need somebody to act (see Attention below).
const Kpi = ({ icon, label, value, sub }) => (
    <div className="card-p flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-lg shrink-0">{icon}</span>
        <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 leading-tight">{value ?? '—'}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// Amber only when there is something waiting; otherwise a quiet "all clear".
const Attention = ({ label, hint, value, onClick }) => {
    const n = value == null ? null : Number(value || 0);
    const hot = n > 0;
    return (
        <button
            onClick={onClick}
            className={`rounded-2xl border p-4 text-left transition ${
                hot
                    ? 'bg-warning-50 border-warning-200 hover:border-warning-400'
                    : 'bg-white border-gray-100 hover:border-gray-200'
            }`}
        >
            <p className={`text-xs font-medium ${hot ? 'text-warning-800' : 'text-gray-500'}`}>{label}</p>
            <p className={`text-3xl font-bold mt-1 leading-none ${hot ? 'text-warning-800' : 'text-gray-900'}`}>{n ?? '—'}</p>
            <p className={`text-xs mt-1.5 ${hot ? 'text-warning-700' : 'text-success-600'}`}>
                {n == null ? 'Loading…' : hot ? hint : '✓ All clear'}
            </p>
        </button>
    );
};

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
        { icon: '🏢', label: 'Companies',           value: summary?.total_companies,    sub: `${summary?.pending_companies ?? 0} pending approval` },
        { icon: '👤', label: 'Candidates',          value: summary?.total_candidates,   sub: `${summary?.active_candidates ?? 0} active` },
        { icon: '💼', label: 'Active Jobs',         value: summary?.active_jobs },
        { icon: '📨', label: 'Applications',        value: summary?.total_applications, sub: `${summary?.placements_this_month ?? 0} placed this month` },
        { icon: '🗓', label: 'Interviews Held',     value: summary?.interviews_held },
        { icon: '👥', label: 'HR Staff',            value: summary?.total_hr_staff },
        { icon: '⭐', label: 'Platinum Companies',  value: summary?.premium_companies,  sub: '8.33% placement fee tier' },
        { icon: '🌟', label: 'Premium Candidates',  value: summary?.premium_candidates, sub: '₹6L+ verified, listed first' },
        { icon: '🤖', label: 'AI Subscriptions',    value: summary?.active_ai_subscriptions, sub: 'active, ₹299/mo' },
        { icon: '🎓', label: 'Certificates Issued', value: summary?.certificates_issued },
    ];

    const outstandingInvoices = invoiceSummary
        ? parseInt(invoiceSummary.pending_count || 0) + parseInt(invoiceSummary.partial_count || 0)
        : null;
    const outstandingAmount = invoiceSummary?.total_outstanding
        ? `₹${parseFloat(invoiceSummary.total_outstanding).toLocaleString('en-IN', { maximumFractionDigits: 0 })} to collect`
        : 'awaiting payment';

    // Built mostly from the summary, so the first four still show if the
    // pending-actions calls fail.
    const attention = [
        { label: 'Companies to Approve',  hint: 'awaiting review',                value: summary?.pending_companies,                    to: '/admin/companies' },
        { label: 'Platinum Requests',     hint: 'companies asking for Platinum',  value: summary?.pending_company_premium_requests,     to: '/admin/premium?tab=companies' },
        { label: 'Premium Verifications', hint: 'payslips to review',             value: summary?.pending_candidate_premium_requests,   to: '/admin/premium?tab=candidates' },
        { label: 'Jobs Awaiting Fee',     hint: 'posted but not paid for',        value: summary?.pending_payment_jobs,                 to: '/admin/jobs' },
        { label: 'Interview Requests',    hint: 'waiting for approval',           value: pendingActions?.interview_requests,            to: '/hr/interview-requests' },
        { label: 'Offer Requests',        hint: 'waiting for approval',           value: pendingActions?.offer_requests,                to: '/admin/requests' },
        { label: 'Outstanding Invoices',  hint: outstandingAmount,                value: outstandingInvoices,                           to: '/admin/payments' },
        { label: 'Unassigned Companies',  hint: 'no executive yet',               value: pendingActions?.unassigned_companies,          to: '/admin/companies?filter=unassigned' },
    ];
    const needCount = attention.filter((a) => Number(a.value || 0) > 0).length;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h2>
                <p className="text-sm text-gray-500 mt-1">
                    {needCount > 0 ? `${needCount} ${needCount === 1 ? 'thing needs' : 'things need'} your attention.` : 'Nothing is waiting on you right now.'}
                </p>
            </div>

            <div className="mb-8">
                <h3 className="section-title">Needs Your Attention</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {attention.map(({ to, ...a }) => <Attention key={a.label} {...a} onClick={() => navigate(to)} />)}
                </div>
            </div>

            <div className="mb-8">
                <h3 className="section-title">Platform Overview</h3>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                    {kpis.map((k) => <Kpi key={k.label} {...k} />)}
                </div>
            </div>

            {/* Quick actions + audit feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick actions */}
                <div className="card-p">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h3>
                    <div className="space-y-1">
                        {[
                            { label: 'Review Pending Companies', to: '/admin/companies', badge: summary?.pending_companies },
                            { label: 'Premium Requests',         to: '/admin/premium',
                              badge: Number(summary?.pending_company_premium_requests || 0) + Number(summary?.pending_candidate_premium_requests || 0) },
                            { label: 'Manage HR Staff',          to: '/admin/staff' },
                            { label: 'View Recruitment Pipeline', to: '/admin/recruitment' },
                            { label: 'Job Postings',             to: '/admin/jobs' },
                            { label: 'Analytics',                to: '/admin/analytics' },
                            { label: 'Outreach',                 to: '/outreach' },
                            { label: 'Training Manager',         to: '/admin/training' },
                            { label: 'Platform Settings',        to: '/admin/settings' },
                        ].map(({ label, to, badge }) => (
                            <button
                                key={to}
                                onClick={() => navigate(to)}
                                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 rounded-lg transition-colors"
                            >
                                <span>{label}</span>
                                {badge > 0 && (
                                    <span className="bg-warning-100 text-warning-800 text-xs font-semibold rounded-full px-2 py-0.5">
                                        {badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recent audit feed */}
                <div className="lg:col-span-2 card-p">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-800">Recent Activity</h3>
                        <button
                            onClick={() => navigate('/admin/audit-log')}
                            className="text-xs text-brand-600 hover:underline"
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { companyAPI } from '../../api/company';

const STATUS_CONFIG = {
    applied:             { label: 'Applied',             cls: 'bg-blue-100 text-blue-700' },
    under_review:        { label: 'Under Review',        cls: 'bg-yellow-100 text-yellow-700' },
    shortlisted:         { label: 'Shortlisted',         cls: 'bg-green-100 text-green-700' },
    interview_scheduled: { label: 'Interview Scheduled', cls: 'bg-purple-100 text-purple-700' },
    interviewed:         { label: 'Interviewed',         cls: 'bg-indigo-100 text-indigo-700' },
    offer_sent:          { label: 'Offer Sent',          cls: 'bg-teal-100 text-teal-700' },
    hired:               { label: 'Hired',               cls: 'bg-green-100 text-green-800' },
    rejected:            { label: 'Rejected',            cls: 'bg-red-100 text-red-600' },
};

const KPI = ({ title, value, icon, color }) => {
    const colors = {
        blue:   'bg-blue-50 border-blue-100 text-blue-700',
        green:  'bg-green-50 border-green-100 text-green-700',
        purple: 'bg-purple-50 border-purple-100 text-purple-700',
        amber:  'bg-amber-50 border-amber-100 text-amber-700',
    };
    return (
        <div className={`rounded-2xl border p-5 ${colors[color]}`}>
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-2xl font-bold">{value ?? '—'}</div>
            <div className="text-xs font-medium mt-0.5 opacity-80">{title}</div>
        </div>
    );
};

export default function CompanyDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchDashboard = () => {
        companyAPI.getDashboard()
            .then(({ data }) => setData(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchDashboard();

        const onVisible = () => { if (document.visibilityState === 'visible') fetchDashboard(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                Loading dashboard...
            </div>
        );
    }

    const { jobs = {}, applications = {}, recent_applications = [], company = {} } = data || {};

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {company.company_name || 'Company Dashboard'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {company.industry && <span>{company.industry} · </span>}
                        Hiring Dashboard
                    </p>
                </div>
                <button
                    onClick={fetchDashboard}
                    className="text-xs text-indigo-600 hover:underline mt-1 shrink-0"
                >
                    Refresh
                </button>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <KPI title="Active Jobs"    value={jobs.active_jobs}             icon="💼" color="blue" />
                <KPI title="Total Applied"  value={applications.total_applications} icon="📋" color="purple" />
                <KPI title="Shortlisted"    value={applications.shortlisted}     icon="⭐" color="green" />
                <KPI title="Offers Sent"    value={applications.offers_sent}     icon="📨" color="amber" />
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Post a Job',      to: '/company/jobs',       icon: '➕' },
                    { label: 'Review Shortlist', to: '/company/shortlist',  icon: '⭐' },
                    { label: 'Interviews',       to: '/company/interviews', icon: '🗓' },
                    { label: 'Edit Profile',     to: '/company/profile',    icon: '🏢' },
                ].map(({ label, to, icon }) => (
                    <Link key={to} to={to}
                        className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-indigo-200 hover:shadow-md transition-all flex flex-col items-center gap-2 text-center shadow-sm">
                        <span className="text-2xl">{icon}</span>
                        <span className="text-xs font-medium text-gray-700">{label}</span>
                    </Link>
                ))}
            </div>

            {/* Recent applications */}
            {recent_applications.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-800 text-sm">Recent Applications</h2>
                        <Link to="/company/shortlist" className="text-xs text-indigo-600 hover:underline">
                            View all →
                        </Link>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                {['Candidate', 'Job', 'Status', 'Applied'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {recent_applications.map(app => {
                                const s = STATUS_CONFIG[app.status] || { label: app.status, cls: 'bg-gray-100 text-gray-500' };
                                return (
                                    <tr key={app.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-800">{app.candidate_name}</td>
                                        <td className="px-4 py-3 text-gray-600">{app.job_title}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
                                                {s.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

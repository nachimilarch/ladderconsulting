import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { companyAPI } from '../../api/company';

// Phone-gate: on every dashboard load, if the company has no phone, show a
// one-field modal before anything else.  Same component as in CompanyProfile.
function PhoneModal({ onSave }) {
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr]     = useState('');

    const submit = async (e) => {
        e.preventDefault();
        const cleaned = phone.replace(/\s/g, '');
        if (!/^\+?[0-9]{7,15}$/.test(cleaned)) { setErr('Enter a valid phone number.'); return; }
        setSaving(true);
        try { await companyAPI.updateProfile({ contact_phone: cleaned }); onSave(); }
        catch { setErr('Could not save. Please try again.'); setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Phone number required</h2>
                <p className="text-sm text-gray-500 mb-5">
                    A contact phone number is required to use your account. Please add one to continue.
                </p>
                <form onSubmit={submit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number *</label>
                        <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setErr(''); }}
                            placeholder="+91 98765 43210" required
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
                    </div>
                    <button type="submit" disabled={saving || !phone.trim()}
                        className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition">
                        {saving ? 'Saving…' : 'Save & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}

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
    const [needsPhone, setNeedsPhone] = useState(false);

    const fetchDashboard = () => {
        companyAPI.getDashboard()
            .then(({ data }) => setData(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchDashboard();
        // Check if phone is missing and show modal
        companyAPI.getProfile()
            .then(({ data }) => { if (!data.company?.contact_phone) setNeedsPhone(true); })
            .catch(() => {});

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
            {needsPhone && <PhoneModal onSave={() => setNeedsPhone(false)} />}
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

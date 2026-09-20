import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { companyAPI, talentPoolAPI } from '../../api/company';
import { aiSubscriptionAPI } from '../../api/aiSubscription';
import NextStepCard from '../../components/common/NextStepCard';
import StepTracker from '../../components/common/StepTracker';
import AssistantPanel from '../../components/common/AssistantPanel';

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

const ASSISTANT_PROMPTS = [
    { icon: '📝', label: 'Draft a job post', text: 'Draft a job post' },
    { icon: '✨', label: 'Improve a job', text: 'Improve one of my job descriptions' },
    { icon: '🎯', label: 'Find matching candidates', text: 'Find candidates for my job' },
];

// Numbers about the business: neutral cards. Amber is kept for things waiting on you.
const Glance = ({ label, value, sub, icon, to }) => (
    <Link to={to} className="card-p hover:shadow-card-hover hover:border-brand-200 transition">
        <div className="flex items-center gap-2 mb-1.5">
            <span className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-base shrink-0">{icon}</span>
            <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
        </div>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </Link>
);

export default function CompanyDashboard() {
    const { user } = useAuth();
    // The layout owns the numbers (also used for the sidebar badges) and the welcome form.
    const { dash, loaded, refresh, workflow, onboardingOpen = false } = useOutletContext();
    const [needsPhone, setNeedsPhone] = useState(false);
    const [tierStatus, setTierStatus] = useState(null);
    const [aiStatus, setAiStatus] = useState(null);

    useEffect(() => {
        talentPoolAPI.activationStatus().then(({ data }) => setTierStatus(data)).catch(() => {});
        aiSubscriptionAPI.status().then(({ data }) => setAiStatus(data)).catch(() => {});
    }, []);

    // The welcome form collects the phone too; ask again only once it is closed.
    useEffect(() => {
        if (onboardingOpen) return;
        companyAPI.getProfile()
            .then(({ data }) => setNeedsPhone(!data.company?.contact_phone))
            .catch(() => {});
    }, [onboardingOpen]);

    if (!loaded) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading your dashboard…</div>;
    }

    const { jobs = {}, applications = {}, recent_applications = [], company = {} } = dash || {};
    const firstName = (user?.name || '').trim().split(' ')[0];
    const aiOn = ['active', 'grace'].includes(aiStatus?.subscription?.status);
    const isPlatinum = tierStatus?.company_tier === 'premium';

    return (
        <div className="max-w-4xl mx-auto animate-slide-up space-y-5">
            {needsPhone && <PhoneModal onSave={() => setNeedsPhone(false)} />}

            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Hi{firstName ? `, ${firstName}` : ''} 👋</h1>
                    <p className="text-sm text-gray-500 mt-1 truncate">
                        {company.company_name}{company.industry ? ` · ${company.industry}` : ''}
                    </p>
                </div>
                <button onClick={refresh} className="text-xs text-indigo-600 hover:underline mt-1 shrink-0">Refresh</button>
            </div>

            <NextStepCard next={workflow.next} />

            <StepTracker title="Your hiring journey" steps={workflow.steps} />

            <AssistantPanel
                subscribed={aiOn}
                price={aiStatus?.amount}
                blurb="Your assistant can draft job posts, sharpen a job description, and rank candidates by fit for you."
                prompts={ASSISTANT_PROMPTS}
            />

            {/* At a glance */}
            <div>
                <h2 className="section-title">At a glance</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Glance to="/company/jobs" icon="💼" label="Active jobs" value={jobs.active_jobs} />
                    <Glance to="/company/shortlist" icon="📋" label="Applications" value={applications.total_applications}
                        sub={Number(applications.to_review) ? `${applications.to_review} to review` : 'all reviewed'} />
                    <Glance to="/company/shortlist" icon="⭐" label="Shortlisted" value={applications.shortlisted} />
                    <Glance to="/company/offers" icon="📨" label="Offers out" value={dash?.offers?.waiting ?? applications.offers_sent} />
                </div>
            </div>

            {/* Account strip */}
            <div className="flex flex-wrap gap-3">
                <Link to="/company/profile" className={`flex-1 min-w-[220px] rounded-2xl border px-4 py-3 text-sm hover:shadow-sm transition ${
                    isPlatinum ? 'bg-success-50 border-success-100' : 'bg-white border-gray-100'
                }`}>
                    {isPlatinum ? (
                        <span className="text-success-700 font-medium">⭐ Platinum: no per-job fee, 8.33% per hire</span>
                    ) : tierStatus?.activated ? (
                        <span className="text-gray-700">Standard tier: <span className="text-indigo-600 font-medium">go Platinum →</span></span>
                    ) : (
                        <span className="text-gray-500">No live job yet: <span className="text-indigo-600 font-medium">post a job to see full profiles →</span></span>
                    )}
                </Link>
                <Link to="/company/profile" className={`flex-1 min-w-[220px] rounded-2xl border px-4 py-3 text-sm hover:shadow-sm transition ${
                    aiOn ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-gray-100'
                }`}>
                    {aiOn ? (
                        <span className="text-indigo-700 font-medium">✨ AI Assistant is on</span>
                    ) : (
                        <span className="text-gray-500">✨ AI Assistant: <span className="text-indigo-600 font-medium">subscribe for ₹{aiStatus?.amount || 299}/mo →</span></span>
                    )}
                </Link>
            </div>

            {/* Recent applications */}
            {recent_applications.length > 0 && (
                <div className="pb-2">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="section-title mb-0">Recent applications</h2>
                        <Link to="/company/shortlist" className="text-xs text-indigo-600 hover:underline">View all →</Link>
                    </div>

                    {/* Phones: one row per application */}
                    <div className="md:hidden card divide-y divide-gray-100 overflow-hidden">
                        {recent_applications.map(app => {
                            const st = STATUS_CONFIG[app.status] || { label: app.status, cls: 'bg-gray-100 text-gray-500' };
                            return (
                                <div key={app.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{app.candidate_name}</p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {app.job_title}, {new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </p>
                                    </div>
                                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="hidden md:block card overflow-hidden">
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
                                    const st = STATUS_CONFIG[app.status] || { label: app.status, cls: 'bg-gray-100 text-gray-500' };
                                    return (
                                        <tr key={app.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-gray-800">{app.candidate_name}</td>
                                            <td className="px-4 py-3 text-gray-600">{app.job_title}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
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
                </div>
            )}
        </div>
    );
}

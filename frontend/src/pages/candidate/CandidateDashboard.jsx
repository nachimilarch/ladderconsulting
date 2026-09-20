import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileAPI, jobAPI, aiAPI, applicationAPI, candidatePremiumAPI } from '../../api/candidate';
import { candidateInterviewAPI } from '../../api/interview';
import { aiSubscriptionAPI } from '../../api/aiSubscription';
import JobDetailModal from '../../components/candidate/JobDetailModal';
import NextStepCard from '../../components/candidate/NextStepCard';
import JourneyStepper from '../../components/candidate/JourneyStepper';
import AssistantPanel from '../../components/candidate/AssistantPanel';
import { buildJourney, profileChecklist } from '../../components/candidate/journey';
import { matchBadgeCls } from '../../utils/matchScore';

const list = (res, ...keys) => {
    if (res?.status !== 'fulfilled') return [];
    const d = res.value.data;
    if (Array.isArray(d?.data)) return d.data;
    for (const k of keys) if (Array.isArray(d?.[k])) return d[k];
    return [];
};


const Glance = ({ to, label, value, sub, tone }) => (
    <Link to={to} className={`rounded-2xl border p-4 hover:shadow-sm transition ${tone}`}>
        <p className="text-[11px] uppercase tracking-wide font-semibold opacity-70">{label}</p>
        <p className="text-3xl font-bold mt-1 leading-none">{value}</p>
        <p className="text-xs mt-1.5 opacity-80 leading-snug">{sub}</p>
    </Link>
);

export default function CandidateDashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ skills: 0, education: 0, experience: 0, hasResume: false, completeness: 0 });
    const [applications, setApplications] = useState([]);
    const [interviews, setInterviews] = useState([]);
    const [offers, setOffers] = useState([]);
    const [topJobs, setTopJobs] = useState([]);
    const [premium, setPremium] = useState(null);
    const [ai, setAi] = useState(null);
    const [detailJobId, setDetailJobId] = useState(null);
    const [rematching, setRematching] = useState(false);

    const load = () =>
        Promise.allSettled([
            profileAPI.get(),
            applicationAPI.getAll(),
            candidateInterviewAPI.getMyInterviews(),
            candidateInterviewAPI.getMyOffers(),
            jobAPI.getMatched({ page: 1, limit: 3 }),
            candidatePremiumAPI.status(),
            aiSubscriptionAPI.status(),
        ]).then(([prof, apps, ivs, offs, matched, prem, sub]) => {
            if (prof.status === 'fulfilled') {
                const d = prof.value.data;
                setStats({
                    skills: d.skills?.length || 0,
                    education: d.education?.length || 0,
                    experience: d.experience_years || 0,
                    hasResume: !!d.resume,
                    completeness: d.profile_complete_pct || 0,
                });
            }
            setApplications(list(apps, 'applications'));
            setInterviews(list(ivs, 'interviews'));
            setOffers(list(offs, 'offers'));
            setTopJobs(list(matched, 'jobs').filter((j) => j.match_computed && j.match_score > 0).slice(0, 3));
            setPremium(prem.status === 'fulfilled' ? prem.value.data : null);
            setAi(sub.status === 'fulfilled' ? sub.value.data : null);
        }).finally(() => setLoading(false));

    useEffect(() => {
        load();
        // Coming back from another tab (e.g. after confirming something) refreshes the picture.
        const onVisible = () => { if (document.visibilityState === 'visible') load(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    const refreshMatches = async () => {
        setRematching(true);
        try {
            await aiAPI.triggerResumeMatch();
            const res = await jobAPI.getMatched({ page: 1, limit: 3 });
            setTopJobs((res.data?.jobs || []).filter((j) => j.match_computed && j.match_score > 0).slice(0, 3));
        } catch { /* the AI may be unavailable; the list just stays as it was */ }
        finally { setRematching(false); }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading your dashboard…</div>;
    }

    const journey = buildJourney({ hasResume: stats.hasResume, completeness: stats.completeness, applications, interviews, offers });
    const checklist = profileChecklist(stats);
    const inProgress = applications.filter((a) => !['withdrawn', 'rejected', 'hired'].includes(a.status)).length;
    const shortlisted = applications.filter((a) => ['shortlisted', 'interview_scheduled', 'interviewed'].includes(a.status)).length;
    const aiOn = ['active', 'grace'].includes(ai?.subscription?.status);
    const firstName = (user?.name || '').trim().split(' ')[0];
    const done = checklist.every((c) => c.done);

    return (
        <div className="max-w-4xl mx-auto animate-slide-up space-y-5">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Hi{firstName ? `, ${firstName}` : ''} 👋</h1>
                <p className="text-sm text-gray-500 mt-1">Here's where you stand and what to do next.</p>
            </div>

            <NextStepCard next={journey.next} />

            <JourneyStepper steps={journey.steps} />

            <AssistantPanel subscribed={aiOn} price={ai?.amount} />

            {/* At a glance */}
            <div>
                <h2 className="section-title">At a glance</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Glance
                        to="/candidate/applications"
                        label="Applications"
                        value={applications.length}
                        sub={applications.length ? `${inProgress} in progress · ${shortlisted} shortlisted` : 'None yet. Find a job to apply to.'}
                        tone="bg-white border-gray-100 text-gray-800 shadow-card"
                    />
                    <Glance
                        to="/candidate/interviews"
                        label="Interviews"
                        value={journey.counts.upcoming}
                        sub={journey.nextInterview
                            ? `Next: ${new Date(journey.nextInterview.slot_datetime).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })}`
                            : 'Nothing scheduled'}
                        tone="bg-white border-gray-100 text-gray-800 shadow-card"
                    />
                    <Glance
                        to="/candidate/applications"
                        label="Offers"
                        value={journey.counts.pendingOffers}
                        sub={journey.counts.pendingOffers ? 'Waiting for your reply' : 'No offers waiting'}
                        tone={journey.counts.pendingOffers ? 'bg-warning-50 border-warning-200 text-warning-800' : 'bg-white border-gray-100 text-gray-800 shadow-card'}
                    />
                </div>
            </div>

            {/* Profile checklist */}
            <div className="card-p">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h3 className="font-semibold text-gray-800">Profile strength</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {done ? 'Great job! Your profile is looking strong.' : 'A complete profile gets better matches.'}
                        </p>
                    </div>
                    <span className={`text-2xl font-bold ${stats.completeness >= 80 ? 'text-green-600' : stats.completeness >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {stats.completeness}%
                    </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${stats.completeness >= 80 ? 'bg-green-500' : stats.completeness >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${stats.completeness}%` }}
                    />
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    {checklist.map((c) => (
                        <li key={c.label}>
                            <Link to="/candidate/profile" className="flex items-center gap-2.5 py-1.5 text-sm group">
                                <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${c.done ? 'bg-green-500 text-white' : 'border-2 border-gray-300 text-transparent'}`}>✓</span>
                                <span className={c.done ? 'text-gray-500' : 'text-gray-800 font-medium group-hover:text-indigo-700'}>{c.label}</span>
                                {c.hint && <span className="ml-auto text-xs text-gray-400">{c.hint}</span>}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Top matches */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="section-title mb-0">Top job matches</h2>
                    {stats.hasResume && (
                        <button onClick={refreshMatches} disabled={rematching} className="text-xs text-indigo-600 hover:underline disabled:opacity-50">
                            {rematching ? 'Refreshing…' : 'Refresh matches'}
                        </button>
                    )}
                </div>
                {topJobs.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {topJobs.map((job) => (
                            <button
                                key={job.id}
                                onClick={() => setDetailJobId(job.id)}
                                className="card-p flex items-center justify-between gap-3 text-left hover:shadow-md hover:border-indigo-200 transition-all"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-gray-900 truncate">{job.title}</p>
                                    <p className="text-xs text-gray-500 truncate">{job.company_name}{job.location ? ` • ${job.location}` : ''}</p>
                                    <span className="text-[11px] text-indigo-600 font-medium">
                                        {job.already_applied ? 'You applied' : 'View details →'}
                                    </span>
                                </div>
                                <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${matchBadgeCls(job.match_score)}`}>{job.match_score}% match</span>
                            </button>
                        ))}
                        <Link to="/candidate/jobs" className="text-xs text-indigo-600 hover:underline self-start">Browse all jobs →</Link>
                    </div>
                ) : (
                    <div className="card-p text-center py-8 text-sm text-gray-500">
                        {stats.hasResume
                            ? <>No strong matches yet. Add more skills to your profile, or <Link to="/candidate/jobs" className="text-indigo-600 font-medium hover:underline">browse all jobs</Link>.</>
                            : <><Link to="/candidate/profile" className="text-indigo-600 font-medium hover:underline">Upload your resume</Link> to see jobs matched to your skills.</>}
                    </div>
                )}
            </div>

            {/* Boosters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                <Link to="/candidate/premium" className={`rounded-2xl border px-5 py-3.5 text-sm hover:shadow-sm transition ${premium?.is_premium ? 'bg-green-50 border-green-100' : 'bg-gradient-to-r from-yellow-50 to-indigo-50 border-yellow-100'}`}>
                    {premium?.is_premium ? (
                        <span className="font-semibold text-green-700">⭐ Premium active: you're listed first to every company</span>
                    ) : premium?.request?.status === 'pending' ? (
                        <span className="text-gray-600"><span className="font-semibold text-yellow-700">⭐ Premium verification pending</span>. Your executive is reviewing it.</span>
                    ) : premium?.request?.status === 'approved' ? (
                        <span className="text-gray-600"><span className="font-semibold text-yellow-700">⭐ Premium approved</span>. Pay ₹999 to activate →</span>
                    ) : (
                        <span className="text-gray-600"><span className="font-semibold text-yellow-700">⭐ Go Premium</span>: earning ₹6 LPA+? Get verified and be listed first.</span>
                    )}
                </Link>
                <Link to="/candidate/documents" className="rounded-2xl border border-gray-100 bg-white px-5 py-3.5 text-sm hover:shadow-sm transition text-gray-600">
                    📁 <span className="font-semibold text-gray-800">Documents</span>: upload IDs, payslips and certificates →
                </Link>
            </div>

            {detailJobId && <JobDetailModal jobId={detailJobId} onClose={() => setDetailJobId(null)} />}
        </div>
    );
}

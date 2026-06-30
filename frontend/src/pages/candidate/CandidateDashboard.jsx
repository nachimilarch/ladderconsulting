import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileAPI, jobAPI, aiAPI } from '../../api/candidate';

export default function CandidateDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({ skills: 0, education: 0, experience: 0, hasResume: false, completeness: 0 });
    const [loading, setLoading] = useState(true);
    const [topJobs, setTopJobs] = useState([]);
    const [rematching, setRematching] = useState(false);

    const fetchProfile = () => {
        profileAPI.get()
            .then(({ data }) => {
                setProfile(data.profile);
                setStats({
                    skills: data.skills?.length || 0,
                    education: data.education?.length || 0,
                    experience: data.experience_years || 0,
                    hasResume: !!data.resume,
                    completeness: data.profile_complete_pct || 0,
                });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchProfile();

        const onVisible = () => { if (document.visibilityState === 'visible') fetchProfile(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    useEffect(() => {
        jobAPI.getMatched({ page: 1, limit: 10 })
            .then(({ data }) => {
                // Only show jobs with a computed match score
                const scored = (data.jobs || []).filter(j => j.match_computed && j.match_score > 0);
                setTopJobs(scored.slice(0, 3));
            })
            .catch(() => {});
    }, []);

    const handleRetriggerMatch = async () => {
        setRematching(true);
        try {
            await aiAPI.triggerResumeMatch();
            const { data } = await jobAPI.getMatched({ page: 1, limit: 10 });
            const scored = (data.jobs || []).filter(j => j.match_computed && j.match_score > 0);
            setTopJobs(scored.slice(0, 3));
        } catch {
            // silently ignore — AI may be unavailable
        } finally {
            setRematching(false);
        }
    };

    const completeness = stats.completeness;

    const quickActions = [
        { label: 'Complete Profile', to: '/candidate/profile', icon: '👤', desc: 'Add your details and experience', color: 'blue' },
        { label: 'Browse Jobs', to: '/candidate/jobs', icon: '💼', desc: 'Find jobs matched to your skills', color: 'green' },
        { label: 'My Applications', to: '/candidate/applications', icon: '📋', desc: 'Track your application status', color: 'purple' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400 text-sm">Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto animate-slide-up">
            {/* Welcome header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">
                    Welcome back, {user?.name || 'Candidate'} 👋
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Here's an overview of your profile and job search progress.
                </p>
            </div>

            {/* Profile Completeness Card */}
            <div className="card-p mb-6">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="font-semibold text-gray-800">Profile Completeness</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {completeness >= 80
                                ? 'Great job! Your profile is looking strong.'
                                : 'Complete your profile to get better job matches.'}
                        </p>
                    </div>
                    <span className={`text-2xl font-bold ${
                        completeness >= 80 ? 'text-green-600' :
                        completeness >= 50 ? 'text-yellow-600' : 'text-red-500'
                    }`}>
                        {completeness}%
                    </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                            completeness >= 80 ? 'bg-green-500' :
                            completeness >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${completeness}%` }}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="kpi-card bg-blue-50 border-blue-100">
                    <div className="kpi-title text-blue-600">Skills</div>
                    <div className="kpi-value text-blue-700">{stats.skills}</div>
                </div>
                <div className="kpi-card bg-green-50 border-green-100">
                    <div className="kpi-title text-green-600">Education</div>
                    <div className="kpi-value text-green-700">{stats.education}</div>
                </div>
                <div className="kpi-card bg-purple-50 border-purple-100">
                    <div className="kpi-title text-purple-600">Experience</div>
                    <div className="kpi-value text-purple-700">
                        {stats.experience > 0 ? `${stats.experience}y` : '—'}
                    </div>
                </div>
                <div className="kpi-card bg-amber-50 border-amber-100">
                    <div className="kpi-title text-amber-600">Resume</div>
                    <div className="kpi-value text-amber-700">
                        {stats.hasResume ? '✓' : '✗'}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <h2 className="section-title">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quickActions.map(({ label, to, icon, desc }) => (
                    <Link key={to} to={to} className="nav-tile">
                        <div className="nav-tile-icon">{icon}</div>
                        <div>
                            <div className="nav-tile-label">{label}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Top Matched Jobs */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="section-title mb-0">Top Job Matches</h2>
                    {stats.hasResume && (
                        <button
                            onClick={handleRetriggerMatch}
                            disabled={rematching}
                            className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                        >
                            {rematching ? 'Refreshing...' : 'Refresh matches'}
                        </button>
                    )}
                </div>

                {topJobs.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {topJobs.map(job => (
                            <div key={job.id} className="card-p flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">{job.title}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {job.company_name}{job.location ? ` • ${job.location}` : ''}
                                    </p>
                                </div>
                                <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                                    job.match_score >= 80 ? 'bg-green-100 text-green-700' :
                                    job.match_score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-600'
                                }`}>
                                    {job.match_score}% match
                                </span>
                            </div>
                        ))}
                        <Link to="/candidate/jobs" className="text-xs text-indigo-600 hover:underline mt-1 inline-block">
                            Browse all jobs →
                        </Link>
                    </div>
                ) : stats.hasResume ? (
                    <div className="card-p text-center py-8 text-sm text-gray-500">
                        <p className="mb-2">Match scores are being computed.</p>
                        <p className="text-xs text-gray-400">Apply to jobs and scores will appear here once processed.</p>
                    </div>
                ) : (
                    <div className="card-p text-center py-8 text-sm text-gray-500">
                        <Link to="/candidate/profile" className="text-indigo-600 hover:underline font-medium">
                            Upload your resume
                        </Link>
                        <span> to see jobs matched to your skills.</span>
                    </div>
                )}
            </div>
        </div>
    );
}

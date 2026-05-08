import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileAPI } from '../../api/candidate';

export default function CandidateDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({ skills: 0, education: 0, experience: 0, hasResume: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        profileAPI.get()
            .then(({ data }) => {
                setProfile(data.profile);
                setStats({
                    skills: data.skills?.length || 0,
                    education: data.education?.length || 0,
                    experience: data.experience?.length || 0,
                    hasResume: !!data.resume,
                });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const completeness = profile?.profile_complete_pct || 0;

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
                    <div className="kpi-value text-purple-700">{stats.experience}</div>
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
        </div>
    );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { myTrainingAPI } from '../../api/training';

const STATUS_COLORS = {
    assigned:    'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed:   'bg-green-100 text-green-700',
    overdue:     'bg-red-100 text-red-600',
};

const LEVEL_BADGE = {
    beginner:     'bg-emerald-100 text-emerald-700',
    intermediate: 'bg-blue-100 text-blue-700',
    advanced:     'bg-purple-100 text-purple-700',
};

export default function TrainingDashboard() {
    const [assignments, setAssignments] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [hired, setHired] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            myTrainingAPI.getAssignments(),
            myTrainingAPI.getCertificates(),
        ])
            .then(([aRes, cRes]) => {
                setAssignments(aRes.data.assignments || []);
                setHired(aRes.data.hired !== false);
                setCertificates(cRes.data.certificates || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));

        // AI recs — non-blocking
        myTrainingAPI.getAIRecommendations()
            .then(({ data }) => setRecommendations(data.recommendations || []))
            .catch(() => {});
    }, []);

    const total = assignments.length;
    const done = assignments.filter(a => a.status === 'completed').length;
    const overallPct = total > 0 ? Math.round((done / total) * 100) : 0;

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>;
    }

    if (!hired) {
        return (
            <div className="max-w-3xl mx-auto text-center py-20">
                <div className="text-5xl mb-4">🎓</div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">No Training Yet</h2>
                <p className="text-sm text-gray-500">Your training plan will appear here once you accept an offer and are onboarded.</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto animate-slide-up">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Training</h1>
                <p className="text-sm text-gray-500 mt-1">
                    {done} of {total} course{total !== 1 ? 's' : ''} completed
                </p>
            </div>

            {/* Overall progress */}
            {total > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm font-bold text-indigo-600">{overallPct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                            className="bg-indigo-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${overallPct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Course cards */}
            {assignments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm mb-6">
                    <div className="text-4xl mb-3">📚</div>
                    <h3 className="font-semibold text-gray-700 mb-1">No courses assigned yet</h3>
                    <p className="text-sm text-gray-500">Your onboarding training will appear here shortly.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {assignments.map(a => {
                        const statusCls = STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-500';
                        const levelCls = LEVEL_BADGE[a.level] || 'bg-gray-100 text-gray-500';
                        const isComplete = a.status === 'completed';

                        return (
                            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="font-semibold text-gray-900 leading-tight">{a.course_title}</h3>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusCls}`}>
                                        {a.status.replace('_', ' ')}
                                    </span>
                                </div>

                                {a.skill_tag && (
                                    <span className="text-xs text-indigo-500 mb-1">{a.skill_tag}</span>
                                )}

                                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{a.description}</p>

                                <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-3">
                                    {a.duration_hrs && <span>⏱ {a.duration_hrs}h</span>}
                                    {a.level && (
                                        <span className={`px-1.5 py-0.5 rounded ${levelCls}`}>{a.level}</span>
                                    )}
                                    <span>{a.total_modules} module{a.total_modules !== 1 ? 's' : ''}</span>
                                </div>

                                {/* Progress bar */}
                                <div className="mb-3">
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>{a.completed_modules}/{a.total_modules} completed</span>
                                        <span>{a.progress_pct}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${a.progress_pct}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="mt-auto flex items-center justify-between">
                                    {isComplete && a.has_certificate ? (
                                        <Link
                                            to="/training/certificates"
                                            className="text-xs text-green-600 font-medium hover:underline"
                                        >
                                            View Certificate →
                                        </Link>
                                    ) : <span />}

                                    <Link
                                        to={`/training/course/${a.id}`}
                                        className={`text-xs font-medium px-4 py-1.5 rounded-lg transition ${
                                            isComplete
                                                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }`}
                                    >
                                        {a.status === 'assigned' ? 'Start' :
                                         isComplete ? 'Review' : 'Continue'}
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* AI Recommendations */}
            {recommendations.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">Recommended for You</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {recommendations.map(rec => (
                            <div key={rec.id} className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                                <h3 className="font-medium text-gray-900 text-sm mb-1">{rec.title}</h3>
                                {rec.description && (
                                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{rec.description}</p>
                                )}
                                {rec.reason && (
                                    <p className="text-xs text-indigo-500 italic">{rec.reason}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Certificates */}
            {certificates.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-gray-800">Certificates Earned</h2>
                        <Link to="/training/certificates" className="text-xs text-indigo-600 hover:underline">
                            View all →
                        </Link>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {certificates.slice(0, 3).map(cert => (
                            <div key={cert.id}
                                className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                                <span className="text-2xl">🏆</span>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{cert.course_title}</p>
                                    <p className="text-xs text-gray-400">
                                        {new Date(cert.issued_at).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                        })}
                                    </p>
                                </div>
                                <a href={cert.download_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-indigo-600 hover:underline ml-2">
                                    Download
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { myTrainingAPI } from '../../api/training';

const STATUS_ICON = {
    completed: '✓',
    failed:    '✗',
    in_progress: '▶',
    not_started: '○',
};

export default function CoursePlayer() {
    const { assignmentId } = useParams();
    const navigate = useNavigate();

    const [assignment, setAssignment] = useState(null);
    const [modules, setModules] = useState([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Quiz state
    const [quizAnswers, setQuizAnswers] = useState({});
    const [quizResult, setQuizResult] = useState(null);

    const loadDetail = () =>
        myTrainingAPI.getAssignmentDetail(assignmentId)
            .then(({ data }) => {
                setAssignment(data.assignment);
                setModules(data.modules || []);
            });

    useEffect(() => {
        loadDetail().catch(console.error).finally(() => setLoading(false));
    }, [assignmentId]);

    const activeModule = modules[activeIdx];

    const handleCompleteModule = async () => {
        if (!activeModule) return;
        setActionLoading(true);
        try {
            await myTrainingAPI.completeModule(assignmentId, activeModule.id);
            await loadDetail();
            setQuizResult(null);
            // Move to next module if available
            if (activeIdx < modules.length - 1) setActiveIdx(i => i + 1);
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmitQuiz = async () => {
        if (!activeModule?.quiz_questions) return;
        const questions = activeModule.quiz_questions;
        const answers = questions.map((_, i) => quizAnswers[i] ?? -1);

        setActionLoading(true);
        try {
            const { data } = await myTrainingAPI.submitQuiz(assignmentId, activeModule.id, answers);
            setQuizResult(data);
            await loadDetail();
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRetryQuiz = () => {
        setQuizAnswers({});
        setQuizResult(null);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading course...</div>;
    }

    if (!assignment) {
        return (
            <div className="max-w-3xl mx-auto text-center py-20">
                <p className="text-gray-500">Assignment not found.</p>
                <button onClick={() => navigate('/training')} className="mt-4 text-indigo-600 hover:underline text-sm">
                    Back to Training
                </button>
            </div>
        );
    }

    const isCompleted = assignment.status === 'completed';

    return (
        <div className="max-w-6xl mx-auto animate-slide-up">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/training')}
                    className="text-gray-400 hover:text-gray-700 text-sm">
                    ← Back
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">{assignment.course_title}</h1>
                    <p className="text-xs text-gray-400 capitalize">{assignment.assignment_type?.replace('_', ' ')} · {assignment.status}</p>
                </div>
                {isCompleted && (
                    <span className="ml-auto text-xs font-medium px-3 py-1 rounded-full bg-green-100 text-green-700">
                        Completed ✓
                    </span>
                )}
            </div>

            <div className="flex gap-6">
                {/* Module sidebar */}
                <aside className="w-60 shrink-0">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Modules
                        </div>
                        <div className="divide-y divide-gray-50">
                            {modules.map((m, i) => {
                                const status = m.progress_status || 'not_started';
                                const icon = STATUS_ICON[status] || '○';
                                const isActive = i === activeIdx;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => { setActiveIdx(i); setQuizResult(null); setQuizAnswers({}); }}
                                        className={`w-full text-left px-4 py-3 text-sm flex items-start gap-2 transition ${
                                            isActive
                                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                                : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span className={`mt-0.5 text-xs shrink-0 w-4 ${
                                            status === 'completed' ? 'text-green-500' :
                                            status === 'failed' ? 'text-red-400' :
                                            isActive ? 'text-indigo-500' : 'text-gray-300'
                                        }`}>{icon}</span>
                                        <span className="leading-snug">{m.title}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 min-w-0">
                    {!activeModule ? (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                            <p className="text-gray-400">Select a module to begin.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">{activeModule.title}</h2>
                                    <p className="text-xs text-gray-400 capitalize mt-0.5">
                                        {activeModule.content_type}
                                        {activeModule.duration_mins > 0 && ` · ${activeModule.duration_mins} min`}
                                    </p>
                                </div>
                                {activeModule.progress_status === 'completed' && (
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                        Completed ✓
                                    </span>
                                )}
                            </div>

                            {/* VIDEO */}
                            {activeModule.content_type === 'video' && activeModule.content_url && (
                                <div className="mb-6">
                                    <video
                                        src={activeModule.content_url}
                                        controls
                                        className="w-full rounded-xl bg-black max-h-96"
                                    />
                                </div>
                            )}

                            {/* PDF / ARTICLE / DOCUMENT */}
                            {['pdf', 'article'].includes(activeModule.content_type) && activeModule.content_url && (
                                <div className="mb-6">
                                    <a
                                        href={activeModule.content_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl px-4 py-3 text-sm hover:bg-indigo-100 transition"
                                    >
                                        📄 Open {activeModule.content_type === 'pdf' ? 'PDF' : 'Article'}
                                    </a>
                                </div>
                            )}

                            {/* QUIZ */}
                            {activeModule.content_type === 'quiz' && (
                                <QuizPanel
                                    questions={activeModule.quiz_questions || []}
                                    passScore={activeModule.pass_score}
                                    attempts={activeModule.attempts}
                                    answers={quizAnswers}
                                    setAnswers={setQuizAnswers}
                                    result={quizResult}
                                    onSubmit={handleSubmitQuiz}
                                    onRetry={handleRetryQuiz}
                                    loading={actionLoading}
                                    alreadyPassed={activeModule.progress_status === 'completed'}
                                />
                            )}

                            {/* Complete button for non-quiz */}
                            {activeModule.content_type !== 'quiz' && activeModule.progress_status !== 'completed' && (
                                <button
                                    onClick={handleCompleteModule}
                                    disabled={actionLoading}
                                    className="mt-2 bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition"
                                >
                                    {actionLoading ? 'Saving...' : 'Mark as Complete'}
                                </button>
                            )}

                            {/* Navigation */}
                            <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => { setActiveIdx(i => Math.max(0, i - 1)); setQuizResult(null); setQuizAnswers({}); }}
                                    disabled={activeIdx === 0}
                                    className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30"
                                >
                                    ← Previous
                                </button>
                                {activeIdx < modules.length - 1 && (
                                    <button
                                        onClick={() => { setActiveIdx(i => i + 1); setQuizResult(null); setQuizAnswers({}); }}
                                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                        Next Module →
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

function QuizPanel({ questions, passScore, attempts, answers, setAnswers, result, onSubmit, onRetry, loading, alreadyPassed }) {
    if (alreadyPassed) {
        return (
            <div className="text-center py-8">
                <div className="text-4xl mb-2">🏆</div>
                <p className="font-semibold text-green-700">Quiz Passed!</p>
                <p className="text-sm text-gray-500 mt-1">This quiz has been successfully completed.</p>
            </div>
        );
    }

    if (!questions.length) {
        return <p className="text-gray-400 text-sm">No questions in this quiz.</p>;
    }

    if (result) {
        return (
            <div className={`rounded-xl p-6 mb-4 ${result.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="text-3xl mb-3 text-center">{result.passed ? '🎉' : '😔'}</div>
                <h3 className={`text-lg font-bold text-center mb-1 ${result.passed ? 'text-green-700' : 'text-red-700'}`}>
                    {result.passed ? 'Quiz Passed!' : 'Not Quite'}
                </h3>
                <p className="text-center text-sm text-gray-600 mb-3">
                    You scored <strong>{result.score}%</strong> ({result.correct}/{result.total} correct).
                    Pass mark: {result.pass_score}%.
                </p>
                <p className="text-center text-xs text-gray-400 mb-4">Attempt #{result.attempts}</p>
                {result.passed ? (
                    <p className="text-center text-sm text-green-600 font-medium">Module marked as complete!</p>
                ) : (
                    <div className="text-center">
                        <button
                            onClick={onRetry}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
                        >
                            Retry Quiz
                        </button>
                    </div>
                )}
            </div>
        );
    }

    const allAnswered = questions.every((_, i) => answers[i] !== undefined);

    return (
        <div>
            {attempts > 0 && (
                <p className="text-xs text-gray-400 mb-3">Previous attempts: {attempts}</p>
            )}
            <div className="flex flex-col gap-5 mb-6">
                {questions.map((q, qi) => (
                    <div key={qi} className="border border-gray-100 rounded-xl p-4">
                        <p className="font-medium text-gray-800 mb-3 text-sm">
                            {qi + 1}. {q.q}
                        </p>
                        <div className="flex flex-col gap-2">
                            {(q.choices || []).map((choice, ci) => (
                                <label key={ci} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition ${
                                    answers[qi] === ci
                                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                                        : 'hover:bg-gray-50 border border-transparent text-gray-700'
                                }`}>
                                    <input
                                        type="radio"
                                        name={`q${qi}`}
                                        value={ci}
                                        checked={answers[qi] === ci}
                                        onChange={() => setAnswers(a => ({ ...a, [qi]: ci }))}
                                        className="accent-indigo-600"
                                    />
                                    {choice}
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={onSubmit}
                disabled={!allAnswered || loading}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
            >
                {loading ? 'Submitting...' : `Submit Quiz (${Object.keys(answers).length}/${questions.length} answered)`}
            </button>

            {!allAnswered && (
                <p className="text-xs text-gray-400 mt-2">Answer all questions before submitting.</p>
            )}
        </div>
    );
}

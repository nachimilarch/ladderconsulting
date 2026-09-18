import { useEffect, useState, useCallback, useRef } from 'react';
import { talentPoolAPI, companyJobAPI } from '../../api/company';
import toast from 'react-hot-toast';
import AiAssistantPromo from '../../components/AiAssistantPromo';

const EXP_RANGES = [
    { label: 'Any experience', min: '', max: '' },
    { label: '0 – 1 year',     min: 0,   max: 1  },
    { label: '1 – 3 years',    min: 1,   max: 3  },
    { label: '3 – 5 years',    min: 3,   max: 5  },
    { label: '5 – 8 years',    min: 5,   max: 8  },
    { label: '8+ years',       min: 8,   max: ''  },
];

const fmtINR = (n) =>
    n ? `₹${parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : null;

function SkillChip({ label }) {
    return (
        <span className="inline-block bg-indigo-50 text-indigo-700 text-[11px] font-medium px-2 py-0.5 rounded-full border border-indigo-100">
            {label}
        </span>
    );
}

const SCORE_COLOR_CLS = (s) => s >= 70 ? 'text-green-700 bg-green-50 border-green-200' : s >= 40 ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-red-600 bg-red-50 border-red-200';

function CandidateCard({ cand, activated, onInterest }) {
    const skills = Array.isArray(cand.skills) ? cand.skills.filter(Boolean) : [];
    const shown = skills.slice(0, 5);
    const extra = skills.length - shown.length;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                            {(cand.candidate_name || 'C')[0].toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-gray-900 truncate">{cand.candidate_name}</p>
                                {cand.is_premium ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 shrink-0">
                                        ⭐ Premium
                                    </span>
                                ) : null}
                            </div>
                            {cand.current_location && (
                                <p className="text-[11px] text-gray-400">{cand.current_location}</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                    {cand.match_score != null && cand.match_score > 0 && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SCORE_COLOR_CLS(cand.match_score)}`}>
                            {cand.match_score}% match
                        </span>
                    )}
                    {cand.total_experience != null && (
                        <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {parseFloat(cand.total_experience).toFixed(1)} yrs
                        </span>
                    )}
                </div>
            </div>

            {cand.headline && (
                <p className="text-xs font-medium text-gray-700 leading-snug">{cand.headline}</p>
            )}

            {cand.summary && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{cand.summary}</p>
            )}

            {shown.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {shown.map(s => <SkillChip key={s} label={s} />)}
                    {extra > 0 && (
                        <span className="text-[11px] text-gray-400 px-1 py-0.5">+{extra} more</span>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50 gap-2">
                <div className="flex gap-3 text-[11px] text-gray-400">
                    {cand.notice_period_days != null && cand.notice_period_days > 0 && (
                        <span>{cand.notice_period_days}d notice</span>
                    )}
                    {cand.expected_salary && (
                        <span>{fmtINR(cand.expected_salary)}/yr</span>
                    )}
                </div>
                <div className="flex gap-2 shrink-0">
                    {activated ? (
                        <>
                            {activated && cand.candidate_email && (
                                <a
                                    href={`mailto:${cand.candidate_email}`}
                                    className="text-xs border border-indigo-200 text-indigo-700 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition font-medium"
                                >
                                    Contact
                                </a>
                            )}
                            <button
                                onClick={() => onInterest(cand)}
                                className="text-xs bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-indigo-700 transition font-medium whitespace-nowrap"
                            >
                                → Add to Pipeline
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => onInterest(cand)}
                            className="text-xs border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition font-medium"
                        >
                            Express Interest
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function TalentPool() {
    const [candidates, setCandidates] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [activated, setActivated] = useState(false);
    const [companyTier, setCompanyTier] = useState('standard');
    const [activationChecked, setActivationChecked] = useState(false);

    const [search, setSearch] = useState('');
    const [skill, setSkill] = useState('');
    const [expRange, setExpRange] = useState(0);
    const searchTimer = useRef(null);

    const [jobs, setJobs] = useState([]);
    const [modal, setModal] = useState(null);
    const [selectedJob, setSelectedJob] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [matchJob, setMatchJob] = useState('');
    const matchJobRef = useRef('');

    useEffect(() => {
        talentPoolAPI.activationStatus()
            .then(r => {
                setActivated(!!r.data?.activated);
                if (r.data?.company_tier) setCompanyTier(r.data.company_tier);
            })
            .catch(() => {})
            .finally(() => setActivationChecked(true));
    }, []);

    const fetchCandidates = useCallback(async (p = 1, s = search, sk = skill, exp = expRange) => {
        setLoading(true);
        const range = EXP_RANGES[exp];
        try {
            const { data } = await talentPoolAPI.list({
                page: p,
                ...(s.trim() ? { search: s.trim() } : {}),
                ...(sk.trim() ? { skill: sk.trim() } : {}),
                ...(range.min !== '' ? { experience_min: range.min } : {}),
                ...(range.max !== '' ? { experience_max: range.max } : {}),
                ...(matchJobRef.current ? { jobId: matchJobRef.current } : {}),
            });
            setCandidates(data?.data || []);
            setTotal(data?.total || 0);
            if (data?.activated !== undefined) setActivated(!!data.activated);
            if (data?.company_tier) setCompanyTier(data.company_tier);
        } catch {
            toast.error('Failed to load talent pool.');
        } finally {
            setLoading(false);
        }
    }, []); // eslint-disable-line

    useEffect(() => { fetchCandidates(1); }, []); // eslint-disable-line

    useEffect(() => {
        companyJobAPI.list()
            .then(r => {
                const all = r.data?.jobs || r.data?.data || r.data || [];
                setJobs(Array.isArray(all) ? all.filter(j => j.status === 'active') : []);
            })
            .catch(() => {});
    }, []);

    const handleSearchChange = (val) => {
        setSearch(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { setPage(1); fetchCandidates(1, val, skill, expRange); }, 400);
    };

    const handleSkillChange = (val) => {
        setSkill(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { setPage(1); fetchCandidates(1, search, val, expRange); }, 400);
    };

    const handleMatchJobChange = (id) => {
        setMatchJob(id);
        matchJobRef.current = id;
        setPage(1);
        fetchCandidates(1);
    };

    const handleExpChange = (idx) => {
        setExpRange(idx);
        setPage(1);
        fetchCandidates(1, search, skill, idx);
    };

    const handlePageChange = (p) => {
        setPage(p);
        fetchCandidates(p);
    };

    const openModal = (cand) => {
        setModal(cand);
        setSelectedJob('');
        setNotes('');
    };

    const handleSubmitInterest = async (e) => {
        e.preventDefault();
        if (!modal) return;
        setSubmitting(true);
        try {
            await talentPoolAPI.expressInterest(modal.candidate_id, {
                job_id: selectedJob || undefined,
                notes: notes.trim() || undefined,
            });
            toast.success('Interest submitted! Your executive will facilitate the introduction.');
            setModal(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit interest.');
        } finally {
            setSubmitting(false);
        }
    };

    const totalPages = Math.ceil(total / 24);

    if (!activationChecked) {
        return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>;
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Talent Pool</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Browse {total > 0 ? `${total} available` : 'available'} candidates sourced by LadderStep Human Consulting.
                    {activated
                        ? ' Full profiles and contact details are visible.'
                        : ' Activate your account to view full profiles.'}
                </p>
                {activated && companyTier === 'premium' && (
                    <span className="inline-block mt-2 text-xs font-medium text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
                        ⭐ Premium — full pool including Premium candidates
                    </span>
                )}
                {activated && companyTier !== 'premium' && (
                    <span className="inline-block mt-2 text-xs font-medium text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
                        ✓ Account Activated
                    </span>
                )}
                {companyTier !== 'premium' && (
                    <a
                        href="/company/profile"
                        className="inline-block mt-2 ml-2 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-100 px-2.5 py-1 rounded-full hover:bg-yellow-100 transition"
                    >
                        ⭐ Upgrade to Premium — see Premium candidates too
                    </a>
                )}
            </div>

            <AiAssistantPromo text="ask it to find candidates matching one of your job postings, ranked by AI match score." />

            {/* Filters — always shown so companies can browse masked cards */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Search</label>
                    <input
                        type="text"
                        placeholder="Title, skills, or keywords…"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                </div>
                <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Skill</label>
                    <input
                        type="text"
                        placeholder="e.g. React, SQL…"
                        value={skill}
                        onChange={e => handleSkillChange(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                </div>
                <div className="min-w-[160px]">
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Experience</label>
                    <select
                        value={expRange}
                        onChange={e => handleExpChange(parseInt(e.target.value))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    >
                        {EXP_RANGES.map((r, i) => (
                            <option key={i} value={i}>{r.label}</option>
                        ))}
                    </select>
                </div>
                {activated && (
                    <div className="min-w-[190px]">
                        <label className="block text-xs text-gray-500 mb-1 font-medium">🎯 Match against job</label>
                        <select
                            value={matchJob}
                            onChange={e => handleMatchJobChange(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        >
                            <option value="">— No match scoring —</option>
                            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                        </select>
                    </div>
                )}
                <button
                    onClick={() => { setSearch(''); setSkill(''); setExpRange(0); setMatchJob(''); matchJobRef.current = ''; setPage(1); fetchCandidates(1, '', '', 0); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
                >
                    Clear
                </button>
            </div>

            {matchJob && activated && (
                <p className="text-xs text-indigo-500 -mt-4 mb-4">
                    Showing each candidate's live <b>% match</b> against <b>{jobs.find(j => String(j.id) === String(matchJob))?.title}</b>.
                </p>
            )}

            {/* Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
            ) : candidates.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                    <div className="text-4xl mb-3 text-gray-200">👥</div>
                    <h3 className="font-semibold text-gray-700 mb-1">No candidates found</h3>
                    <p className="text-sm text-gray-400">Try adjusting your filters or check back later.</p>
                </div>
            ) : (
                <>
                    <div className="text-xs text-gray-400 mb-3">{total} candidate{total !== 1 ? 's' : ''} available</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {candidates.map(c => (
                            <CandidateCard
                                key={c.candidate_id}
                                cand={c}
                                activated={activated}
                                onInterest={openModal}
                            />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => handlePageChange(p)}
                                    className={`w-8 h-8 text-xs rounded-lg font-medium transition ${
                                        p === page
                                            ? 'bg-indigo-600 text-white'
                                            : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Interest / pipeline modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h2 className="font-semibold text-gray-900 mb-1">
                            {activated ? 'Add to Pipeline' : 'Express Interest'}
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            {activated
                                ? `Link ${modal.candidate_name} to one of your open positions.`
                                : `Your executive will contact ${modal.candidate_name} and facilitate the introduction.`}
                        </p>

                        <form onSubmit={handleSubmitInterest} className="flex flex-col gap-4">
                            {jobs.length > 0 && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Link to Job Opening {activated ? '(required)' : '(optional)'}
                                    </label>
                                    <select
                                        value={selectedJob}
                                        onChange={e => setSelectedJob(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                        required={activated}
                                    >
                                        <option value="">— {activated ? 'Select a job' : 'Not linked to a specific job'} —</option>
                                        {jobs.map(j => (
                                            <option key={j.id} value={j.id}>{j.title}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Notes (optional)
                                </label>
                                <textarea
                                    rows={3}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Any specific requirements or context…"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {!activated && (
                                <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700 border border-indigo-100">
                                    Candidate contact details are not shared directly. Your assigned LadderStep Human Consulting executive will co-ordinate the next steps.
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
                                >
                                    {submitting ? 'Submitting…' : activated ? 'Add to Pipeline' : 'Submit Interest'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModal(null)}
                                    className="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

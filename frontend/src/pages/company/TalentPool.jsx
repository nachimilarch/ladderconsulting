import { useEffect, useState, useCallback, useRef } from 'react';
import { talentPoolAPI, companyJobAPI } from '../../api/company';
import PackagePicker from '../../components/company/PackagePicker';
import toast from 'react-hot-toast';

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

function CandidateCard({ cand, onInterest, unlockInfo, onUnlock, onViewProfile, onDownload, downloading, onMoveToPipeline }) {
    const skills = Array.isArray(cand.skills) ? cand.skills.filter(Boolean) : [];
    const shown = skills.slice(0, 5);
    const extra = skills.length - shown.length;
    const unlocked = !!unlockInfo?.unlocked;
    const isPaidUnlock = unlocked && unlockInfo.via !== 'platinum';

    return (
        <div className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow ${unlocked ? 'border-green-200' : 'border-gray-100'}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                            {(cand.candidate_name || 'C')[0].toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900 truncate">{cand.candidate_name}</p>
                            {cand.current_location && (
                                <p className="text-[11px] text-gray-400">{cand.current_location}</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                    {cand.total_experience != null && (
                        <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {parseFloat(cand.total_experience).toFixed(1)} yrs
                        </span>
                    )}
                    {unlocked && (
                        <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            🔓 Unlocked
                        </span>
                    )}
                </div>
            </div>

            {/* Headline */}
            {cand.headline && (
                <p className="text-xs font-medium text-gray-700 leading-snug">{cand.headline}</p>
            )}

            {/* Summary excerpt */}
            {cand.summary && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{cand.summary}</p>
            )}

            {/* Skills */}
            {shown.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {shown.map(s => <SkillChip key={s} label={s} />)}
                    {extra > 0 && (
                        <span className="text-[11px] text-gray-400 px-1 py-0.5">+{extra} more</span>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50 gap-2">
                <div className="flex gap-3 text-[11px] text-gray-400">
                    {cand.notice_period_days != null && cand.notice_period_days > 0 && (
                        <span>{cand.notice_period_days}d notice</span>
                    )}
                    {cand.expected_salary && (
                        <span>{fmtINR(cand.expected_salary)}/yr</span>
                    )}
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    {unlocked ? (
                        <>
                            <button
                                onClick={() => onViewProfile(cand)}
                                className="text-xs border border-indigo-200 text-indigo-700 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition font-medium"
                            >
                                Full Profile
                            </button>
                            <button
                                onClick={() => onDownload(cand)}
                                disabled={downloading === cand.candidate_id}
                                title={isPaidUnlock ? 'Original resume file' : 'AI-parsed resume (contact info redacted)'}
                                className="text-xs bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition font-medium"
                            >
                                {downloading === cand.candidate_id ? '…' : 'Resume'}
                            </button>
                            {isPaidUnlock && (
                                <button
                                    onClick={() => onMoveToPipeline(cand)}
                                    className="text-xs border border-green-200 text-green-700 px-2.5 py-1.5 rounded-lg hover:bg-green-50 transition font-medium whitespace-nowrap"
                                >
                                    → Pipeline
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => onInterest(cand)}
                                className="text-xs border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition font-medium"
                            >
                                Express Interest
                            </button>
                            <button
                                onClick={() => onUnlock(cand)}
                                className="text-xs bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-indigo-700 transition font-medium whitespace-nowrap"
                            >
                                🔓 Unlock
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Package request modal (shown when company has no credits/platinum) ────────
function PackageRequestModal({ onClose }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-900">Request a Resume Unlock Package</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>
                <p className="text-sm text-gray-500 mb-5">
                    To see full candidate details and download resumes, select a package below.
                    Your LadderStep executive will activate it for you — no payment gateway needed right now.
                </p>
                <PackagePicker
                    title="Choose a Package"
                    subtitle="Unlock credits let you access full profiles and resumes for any candidate in the pool."
                    onSelected={(hasPackage) => { if (hasPackage) onClose(); }}
                />
            </div>
        </div>
    );
}

// ── Full unlocked profile detail ──────────────────────────────────────────────
function FullProfileModal({ candidateId, candidateName, onClose }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        talentPoolAPI.fullProfile(candidateId)
            .then(r => setProfile(r.data?.data || null))
            .catch(() => toast.error('Failed to load full profile.'))
            .finally(() => setLoading(false));
    }, [candidateId]);

    const education = (() => {
        try { return Array.isArray(profile?.education) ? profile.education : JSON.parse(profile?.education || '[]'); }
        catch { return []; }
    })();

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">{candidateName}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>

                {loading ? (
                    <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
                ) : !profile ? (
                    <p className="text-sm text-gray-400 py-8 text-center">Could not load profile.</p>
                ) : (
                    <div className="flex flex-col gap-4">
                        {profile.headline && <p className="text-sm font-medium text-gray-700">{profile.headline}</p>}
                        {profile.summary && <p className="text-sm text-gray-600 leading-relaxed">{profile.summary}</p>}

                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                            {profile.total_experience != null && <span>💼 {parseFloat(profile.total_experience).toFixed(1)} yrs experience</span>}
                            {profile.current_location && <span>📍 {profile.current_location}</span>}
                            {profile.notice_period_days != null && <span>🕐 {profile.notice_period_days}d notice period</span>}
                            {profile.expected_salary && <span>💰 {fmtINR(profile.expected_salary)}/yr expected</span>}
                            {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">LinkedIn ↗</a>}
                            {profile.portfolio_url && <a href={profile.portfolio_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Portfolio ↗</a>}
                        </div>

                        {profile.skills?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Skills</h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {profile.skills.map(s => (
                                        <span key={s.name} className="bg-indigo-50 text-indigo-700 text-[11px] px-2 py-1 rounded-full border border-indigo-100">
                                            {s.name}{s.years_exp ? ` · ${s.years_exp}y` : ''}{s.proficiency ? ` · ${s.proficiency}` : ''}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {education.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Education</h3>
                                <div className="flex flex-col gap-2">
                                    {education.map((e, i) => (
                                        <div key={i} className="text-sm text-gray-700">
                                            <p className="font-medium">{e.degree}{e.field ? ` in ${e.field}` : ''}</p>
                                            <p className="text-xs text-gray-400">{e.institution}{e.end_year ? ` · ${e.end_year}` : ''}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TalentPool() {
    const [candidates, setCandidates] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [skill, setSkill] = useState('');
    const [expRange, setExpRange] = useState(0); // index into EXP_RANGES
    const searchTimer = useRef(null);

    const [jobs, setJobs] = useState([]);
    const [modal, setModal] = useState(null); // candidate object
    const [selectedJob, setSelectedJob] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Unlock state
    const [unlockMap, setUnlockMap] = useState({}); // candidateId -> { unlocked, via }
    const [platinum, setPlatinum] = useState(false);
    const [packCredits, setPackCredits] = useState(0);
    const [pkgRequestModal, setPkgRequestModal] = useState(false); // request-a-package modal
    const [profileModal, setProfileModal] = useState(null); // candidate object (full profile view)
    const [downloading, setDownloading] = useState(null); // candidateId while downloading
    const [hasPackage, setHasPackage] = useState(false); // banner only — browsing is always allowed

    // Move-to-pipeline (paid-unlock candidates only)
    const [pipelineModal, setPipelineModal] = useState(null); // candidate object
    const [pipelineJob, setPipelineJob] = useState('');
    const [applyingToPipeline, setApplyingToPipeline] = useState(false);

    const fetchUnlockStatus = useCallback((rows) => {
        const ids = rows.map(c => c.candidate_id).filter(Boolean);
        if (!ids.length) return;
        talentPoolAPI.unlockStatus(ids)
            .then(r => {
                setPlatinum(!!r.data?.platinum);
                setPackCredits(r.data?.pack_credits_remaining || 0);
                setUnlockMap(prev => ({ ...prev, ...(r.data?.statuses || {}) }));
            })
            .catch(() => {});
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
            });
            const rows = data?.data || [];
            setCandidates(rows);
            setTotal(data?.total || 0);
            setHasPackage(!!data?.has_package);
            fetchUnlockStatus(rows);
        } catch (err) {
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

    // ── Unlock handlers ───────────────────────────────────────────────────────
    const applyUnlock = (candidateId, via) => {
        setUnlockMap(prev => ({ ...prev, [candidateId]: { unlocked: true, via } }));
        if (via === 'pack') setPackCredits(c => Math.max(0, c - 1));
    };

    const handleUnlockClick = async (cand) => {
        // Platinum or a spare pack credit → instant free grant, no modal needed.
        if (platinum || packCredits > 0) {
            try {
                const { data } = await talentPoolAPI.unlock(cand.candidate_id);
                if (data?.unlocked) {
                    applyUnlock(cand.candidate_id, data.via);
                    toast.success(data.via === 'platinum' ? 'Unlocked under your Platinum agreement.' : 'Unlocked using a pack credit.');
                }
            } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to unlock.');
            }
            return;
        }
        // No package yet — show request modal (request flow, no payment gateway needed).
        setPkgRequestModal(true);
    };

    const handleViewProfile = (cand) => setProfileModal(cand);

    const handleDownloadResume = async (cand) => {
        setDownloading(cand.candidate_id);
        try {
            const res = await talentPoolAPI.downloadResume(cand.candidate_id);
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${cand.candidate_name.replace(/\s+/g, '_')}_resume.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to download resume.');
        } finally {
            setDownloading(null);
        }
    };

    const openPipelineModal = (cand) => { setPipelineModal(cand); setPipelineJob(''); };

    const handleApplyToPipeline = async (e) => {
        e.preventDefault();
        if (!pipelineModal || !pipelineJob) return;
        setApplyingToPipeline(true);
        try {
            const { data } = await talentPoolAPI.applyToPipeline(pipelineModal.candidate_id, pipelineJob);
            toast.success(data?.message || 'Candidate added to your pipeline.');
            setPipelineModal(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add candidate to pipeline.');
        } finally {
            setApplyingToPipeline(false);
        }
    };

    const totalPages = Math.ceil(total / 24);

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Talent Pool</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                    Browse {total > 0 ? `${total} available` : 'available'} candidates sourced by LadderStep Human Consulting.
                    Unlock a candidate to view full contact details and download their resume.
                </p>
                {platinum ? (
                    <span className="inline-block mt-2 text-xs font-medium text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
                        ⭐ Platinum — unlimited free resume unlocks
                    </span>
                ) : packCredits > 0 ? (
                    <span className="inline-block mt-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                        🔓 {packCredits} unlock credit{packCredits !== 1 ? 's' : ''} remaining
                    </span>
                ) : !hasPackage ? (
                    <span className="inline-block mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full cursor-pointer hover:bg-amber-100 transition" onClick={() => setPkgRequestModal(true)}>
                        🔒 Request a package to unlock candidates →
                    </span>
                ) : null}
            </div>

            <>
            {/* Filters */}
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
                <button
                    onClick={() => { setSearch(''); setSkill(''); setExpRange(0); setPage(1); fetchCandidates(1, '', '', 0); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
                >
                    Clear
                </button>
            </div>

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
                                onInterest={openModal}
                                unlockInfo={unlockMap[c.candidate_id]}
                                onUnlock={handleUnlockClick}
                                onViewProfile={handleViewProfile}
                                onDownload={handleDownloadResume}
                                downloading={downloading}
                                onMoveToPipeline={openPipelineModal}
                            />
                        ))}
                    </div>

                    {/* Pagination */}
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
            </>

            {/* Interest modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h2 className="font-semibold text-gray-900 mb-1">Express Interest</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Your executive will contact <strong>{modal.candidate_name}</strong> and facilitate the introduction.
                        </p>

                        <form onSubmit={handleSubmitInterest} className="flex flex-col gap-4">
                            {jobs.length > 0 && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Link to Job Opening (optional)
                                    </label>
                                    <select
                                        value={selectedJob}
                                        onChange={e => setSelectedJob(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="">— Not linked to a specific job —</option>
                                        {jobs.map(j => (
                                            <option key={j.id} value={j.id}>{j.title}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Notes for your executive (optional)
                                </label>
                                <textarea
                                    rows={3}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Any specific requirements, urgency, or context…"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700 border border-indigo-100">
                                Candidate contact details are not shared directly. Your assigned LadderStep Human Consulting executive will co-ordinate the next steps.
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
                                >
                                    {submitting ? 'Submitting…' : 'Submit Interest'}
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

            {/* Package request modal */}
            {pkgRequestModal && (
                <PackageRequestModal onClose={() => setPkgRequestModal(false)} />
            )}

            {/* Full unlocked profile */}
            {profileModal && (
                <FullProfileModal
                    candidateId={profileModal.candidate_id}
                    candidateName={profileModal.candidate_name}
                    onClose={() => setProfileModal(null)}
                />
            )}

            {/* Move to hiring pipeline */}
            {pipelineModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h2 className="font-semibold text-gray-900 mb-1">Move to Hiring Pipeline</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Add <strong>{pipelineModal.candidate_name}</strong> as an applicant to one of your job openings.
                            Interview scheduling and offer release still go through your LadderStep Human Consulting executive, same as any applicant.
                        </p>
                        <form onSubmit={handleApplyToPipeline} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Job Opening *</label>
                                <select
                                    value={pipelineJob}
                                    onChange={e => setPipelineJob(e.target.value)}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="">— Select a job —</option>
                                    {jobs.map(j => (
                                        <option key={j.id} value={j.id}>{j.title}</option>
                                    ))}
                                </select>
                                {jobs.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">You have no active job postings yet — create one first.</p>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={applyingToPipeline || !pipelineJob}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
                                >
                                    {applyingToPipeline ? 'Adding…' : 'Add to Pipeline'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPipelineModal(null)}
                                    disabled={applyingToPipeline}
                                    className="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 transition disabled:opacity-60"
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

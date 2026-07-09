import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { companyJobAPI, candidateResumeAPI, talentPoolAPI, companyAPI } from '../../api/company';

// ── Candidate profile drawer (masked unless contact_unlocked) ─────────────────
function CandidateProfileDrawer({ candidateId, contactUnlocked, onClose }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Use previewProfile — it handles masking server-side based on unlock status
        talentPoolAPI.previewProfile(candidateId)
            .then(r => setProfile(r.data?.data || null))
            .catch(() => toast.error('Failed to load profile.'))
            .finally(() => setLoading(false));
    }, [candidateId]);

    const education = (() => {
        try { return Array.isArray(profile?.education) ? profile.education : JSON.parse(profile?.education || '[]'); }
        catch { return []; }
    })();

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40" onClick={onClose} />
            <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="font-semibold text-gray-900 text-base">
                            {loading ? 'Loading…' : profile?.candidate_name || 'Candidate Profile'}
                        </h2>
                        {!contactUnlocked && <p className="text-xs text-gray-400 mt-0.5">🔒 Contact details protected</p>}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center flex-1 text-gray-400 text-sm">Loading…</div>
                ) : !profile ? (
                    <div className="flex items-center justify-center flex-1 text-gray-400 text-sm">Could not load profile.</div>
                ) : (
                    <div className="px-5 py-4 flex flex-col gap-5">
                        {/* Identity */}
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-base font-bold shrink-0">
                                    {(profile.candidate_name || 'C')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{profile.candidate_name}</p>
                                    {profile.headline && <p className="text-xs text-gray-500">{profile.headline}</p>}
                                </div>
                            </div>
                            {contactUnlocked && (
                                <div className="flex flex-col gap-0.5 text-xs text-gray-500">
                                    {profile.candidate_email && <span>✉ {profile.candidate_email}</span>}
                                    {profile.candidate_phone && <span>📞 {profile.candidate_phone}</span>}
                                    {profile.linkedin_url   && <a href={profile.linkedin_url}  target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">LinkedIn ↗</a>}
                                    {profile.portfolio_url  && <a href={profile.portfolio_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Portfolio ↗</a>}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-500">
                            {profile.total_experience != null && <span>💼 {parseFloat(profile.total_experience).toFixed(1)} yrs exp</span>}
                            {profile.current_location && <span>📍 {profile.current_location}</span>}
                            {profile.notice_period_days != null && <span>🕐 {profile.notice_period_days}d notice</span>}
                            {profile.expected_salary   && <span>💰 ₹{(parseFloat(profile.expected_salary)/100000).toFixed(1)}L/yr</span>}
                        </div>

                        {profile.summary && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Summary</h3>
                                <p className="text-sm text-gray-700 leading-relaxed">{profile.summary}</p>
                            </div>
                        )}

                        {profile.skills?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Skills</h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {profile.skills.map(s => (
                                        <span key={s.name} className="bg-indigo-50 text-indigo-700 text-[11px] px-2 py-1 rounded-full border border-indigo-100 capitalize">
                                            {s.name}{s.years_exp ? ` · ${s.years_exp}y` : ''}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {education.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Education</h3>
                                <div className="flex flex-col gap-2">
                                    {education.map((e, i) => (
                                        <div key={i} className="text-sm">
                                            <p className="font-medium text-gray-800">{e.degree}{e.field ? ` in ${e.field}` : ''}</p>
                                            {e.institution && <p className="text-xs text-gray-500">{e.institution}{e.end_year ? ` · ${e.end_year}` : ''}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!contactUnlocked && (
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                                Contact details are protected. To reach this candidate, go through your assigned LadderStep executive.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const STATUS_COLORS = {
    applied:             'bg-blue-100 text-blue-700',
    under_review:        'bg-yellow-100 text-yellow-700',
    shortlisted:         'bg-green-100 text-green-700',
    interview_scheduled: 'bg-purple-100 text-purple-700',
    interviewed:         'bg-indigo-100 text-indigo-700',
    offer_sent:          'bg-teal-100 text-teal-700',
    hired:               'bg-green-100 text-green-800',
    rejected:            'bg-red-100 text-red-600',
};

const SCORE_COLOR = (score) => {
    if (!score) return 'text-gray-400';
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-500';
};

export default function ShortlistView() {
    const [jobs, setJobs] = useState([]);
    const [selectedJob, setSelectedJob] = useState('');
    const [applications, setApplications] = useState([]);
    const [statusFilter, setStatusFilter] = useState('');
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [loadingApps, setLoadingApps] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [downloadingResume, setDownloadingResume] = useState(null);
    const [profileDrawer, setProfileDrawer] = useState(null); // { candidateId, contactUnlocked }
    const [isPlatinum, setIsPlatinum] = useState(false);
    const [unlockRequested, setUnlockRequested] = useState({}); // candidateId -> true (pending/submitted)
    const [requestingUnlock, setRequestingUnlock] = useState(null); // candidateId

    useEffect(() => {
        companyJobAPI.list()
            .then(({ data }) => {
                setJobs(data.jobs || []);
                if (data.jobs?.length) setSelectedJob(String(data.jobs[0].id));
            })
            .catch(console.error)
            .finally(() => setLoadingJobs(false));
        // Detect Platinum status for profile-unlock button
        talentPoolAPI.packageStatus()
            .then(r => setIsPlatinum(!!r.data?.platinum))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedJob) return;
        setLoadingApps(true);
        companyJobAPI.getApplications(selectedJob)
            .then(({ data }) => setApplications(data.applications || []))
            .catch(console.error)
            .finally(() => setLoadingApps(false));
    }, [selectedJob]);

    const loadApps = () => {
        if (!selectedJob) return;
        companyJobAPI.getApplications(selectedJob)
            .then(({ data }) => setApplications(data.applications || []))
            .catch(console.error);
    };

    const handleShortlist = async (appId) => {
        setActionLoading(appId);
        try {
            await companyJobAPI.shortlist(selectedJob, appId, {});
            loadApps();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to shortlist candidate.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveShortlist = async (appId) => {
        if (!window.confirm('Remove this candidate from shortlist?')) return;
        setActionLoading(appId);
        try {
            await companyJobAPI.removeShortlist(selectedJob, appId);
            loadApps();
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleResumeDownload = async (candidateId, contactUnlocked = false) => {
        setDownloadingResume(candidateId);
        try {
            // Unlocked candidates (single/pack/platinum_approved) get the original unmasked file.
            // Standard applicants (not unlocked) get the masked resume.
            const res = contactUnlocked
                ? await talentPoolAPI.downloadResume(candidateId)
                : await candidateResumeAPI.download(candidateId);
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'candidate_resume.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Resume download failed:', err);
            toast.error('Failed to download resume. Please try again.');
        } finally {
            setDownloadingResume(null);
        }
    };

    const handleStatusChange = async (appId, status) => {
        try {
            await companyJobAPI.updateAppStatus(selectedJob, appId, status);
            loadApps();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status.');
        }
    };

    const handleRequestProfileUnlock = async (app) => {
        setRequestingUnlock(app.candidate_id);
        try {
            await talentPoolAPI.requestProfileUnlock(app.candidate_id, { application_id: app.id });
            toast.success('Full profile access request sent to your LadderStep executive.');
            setUnlockRequested(prev => ({ ...prev, [app.candidate_id]: true }));
        } catch (err) {
            const msg = err.response?.data?.message || '';
            if (msg.toLowerCase().includes('already')) {
                toast('Request already submitted — awaiting executive review.', { icon: 'ℹ️' });
                setUnlockRequested(prev => ({ ...prev, [app.candidate_id]: true }));
            } else {
                toast.error(msg || 'Failed to send request.');
            }
        } finally {
            setRequestingUnlock(null);
        }
    };

    const filtered = statusFilter
        ? applications.filter(a => a.status === statusFilter)
        : applications;

    const formatExp = (exp) => exp != null ? `${exp} yr${exp !== 1 ? 's' : ''}` : '—';
    const formatSalary = (amt) => amt ? `₹${(amt / 100000).toFixed(1)}L` : null;

    return (
        <div className="max-w-6xl mx-auto">
            {profileDrawer && (
                <CandidateProfileDrawer
                    candidateId={profileDrawer.candidateId}
                    contactUnlocked={profileDrawer.contactUnlocked}
                    onClose={() => setProfileDrawer(null)}
                />
            )}
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Applications & Shortlist</h1>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 flex items-start gap-2">
                <span className="text-blue-500 text-lg mt-0.5">&#128274;</span>
                <div>
                    <p className="text-sm font-semibold text-blue-700">Contact details are protected</p>
                    <p className="text-xs text-blue-600">
                        To connect with a candidate, please contact LadderStep Human Consulting. Direct hiring bypasses our agreement terms.
                    </p>
                </div>
            </div>

            {/* Job selector + filter */}
            <div className="flex gap-3 mb-6 flex-wrap">
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Job Posting</label>
                    <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {loadingJobs
                            ? <option>Loading...</option>
                            : jobs.length === 0
                                ? <option>No jobs posted</option>
                                : jobs.map(j => (
                                    <option key={j.id} value={j.id}>{j.title} ({j.applicant_count} applicants)</option>
                                ))
                        }
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Status</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">All statuses</option>
                        <option value="applied">Applied</option>
                        <option value="under_review">Under Review</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="interview_scheduled">Interview Scheduled</option>
                        <option value="interviewed">Interviewed</option>
                        <option value="offer_sent">Offer Sent</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {loadingApps ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading applications...</div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="text-4xl mb-3">📭</div>
                    <h3 className="font-semibold text-gray-700 mb-1">
                        {applications.length === 0 ? 'No applications yet' : 'No applications match this filter'}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {applications.length === 0
                            ? 'Applications will appear here once candidates apply.'
                            : 'Try a different status filter.'}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {filtered.map(app => {
                        const statusCls = STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-500';
                        const isShortlisted = app.status === 'shortlisted' || app.shortlist_status === 'shortlisted';
                        const isLoading = actionLoading === app.id;
                        const hiredElsewhere = Number(app.hired_elsewhere) > 0;
                        const hiredHere = app.status === 'hired';
                        const isLocked = hiredElsewhere || hiredHere;

                        return (
                            <div key={app.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${hiredHere ? 'border-green-300' : 'border-gray-100'}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-semibold text-gray-900">{app.candidate_name}</h3>
                                            <button
                                                onClick={() => setProfileDrawer({ candidateId: app.candidate_id, contactUnlocked: !!app.contact_unlocked })}
                                                className="text-[11px] text-indigo-600 hover:underline"
                                            >
                                                View Profile
                                            </button>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCls}`}>
                                                {app.status.replace('_', ' ')}
                                            </span>
                                            {app.match_score > 0 && (
                                                <span className={`text-xs font-bold ${SCORE_COLOR(app.match_score)}`}>
                                                    {app.match_score}% match
                                                </span>
                                            )}
                                            {app.package_required && (
                                                <a href="/company/profile" className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100" title="Select a resume unlock package to see AI match %">
                                                    🔒 Select package to see match %
                                                </a>
                                            )}
                                            {app.source === 'executive' && (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                    Sourced by Ladder
                                                </span>
                                            )}
                                            {app.contact_unlocked && (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                                                    🔓 Contact Unlocked
                                                </span>
                                            )}
                                            {hiredHere && (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                                    Hired ✓ — Placement complete
                                                </span>
                                            )}
                                            {hiredElsewhere && !hiredHere && (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 border border-gray-300">
                                                    Hired elsewhere — unavailable
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mb-2 italic">
                                            {app.candidate_email}
                                            {app.contact_unlocked && app.candidate_phone && ` · ${app.candidate_phone}`}
                                        </p>
                                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                                            {app.location && <span>📍 {app.location}</span>}
                                            {app.total_experience != null && <span>💼 {formatExp(app.total_experience)}</span>}
                                            {app.expected_salary && <span>💰 {formatSalary(app.expected_salary)} expected</span>}
                                            {app.notice_period && <span>⏱ {app.notice_period}d notice</span>}
                                            <span>Applied {new Date(app.applied_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}</span>
                                        </div>

                                        {/* Extracted skills from resume */}
                                        {app.extracted_skills && (() => {
                                            try {
                                                const skills = typeof app.extracted_skills === 'string'
                                                    ? JSON.parse(app.extracted_skills)
                                                    : app.extracted_skills;
                                                if (skills?.length > 0) return (
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {skills.slice(0, 8).map((s, i) => (
                                                            <span key={i} className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full border border-indigo-100">{s}</span>
                                                        ))}
                                                    </div>
                                                );
                                            } catch (_) {}
                                            return null;
                                        })()}

                                        {/* AI match score + skills */}
                                        {app.match_computed ? (
                                            <>
                                                {app.matched_skills && (
                                                    <div className="flex flex-wrap gap-1 mb-1">
                                                        {(typeof app.matched_skills === 'string'
                                                            ? JSON.parse(app.matched_skills)
                                                            : app.matched_skills
                                                        ).slice(0, 6).map((s, i) => (
                                                            <span key={i} className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{s}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {app.missing_skills && (
                                                    <div className="flex flex-wrap gap-1 mb-1">
                                                        {(typeof app.missing_skills === 'string'
                                                            ? JSON.parse(app.missing_skills)
                                                            : app.missing_skills
                                                        ).slice(0, 4).map((s, i) => (
                                                            <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded line-through">{s}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        ) : app.package_required ? (
                                            <p className="text-[10px] text-amber-600 italic mb-1">Select a resume unlock package to see matched/missing skills.</p>
                                        ) : (
                                            <p className="text-[10px] text-gray-400 italic mb-1">AI matching in progress...</p>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 shrink-0 items-end">
                                        {/* Status update */}
                                        <select
                                            value={app.status}
                                            onChange={e => handleStatusChange(app.id, e.target.value)}
                                            disabled={isLocked}
                                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value="under_review">Under Review</option>
                                            <option value="shortlisted">Shortlisted</option>
                                            <option value="interview_scheduled">Interview Scheduled</option>
                                            <option value="interviewed">Interviewed</option>
                                            <option value="offer_sent">Offer Sent</option>
                                            <option value="rejected">Rejected</option>
                                        </select>

                                        {/* Shortlist toggle */}
                                        {isLocked ? (
                                            <span className="text-[10px] text-gray-400 italic text-right max-w-[140px]">
                                                {hiredHere ? 'Placement complete — no further action needed' : 'Hired through LadderStep — no longer available'}
                                            </span>
                                        ) : !isShortlisted ? (
                                            <button
                                                onClick={() => handleShortlist(app.id)}
                                                disabled={isLoading}
                                                className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 disabled:opacity-50 transition"
                                            >
                                                {isLoading ? '...' : '⭐ Shortlist'}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleRemoveShortlist(app.id)}
                                                disabled={isLoading}
                                                className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 disabled:opacity-50 transition"
                                            >
                                                {isLoading ? '...' : '✕ Remove'}
                                            </button>
                                        )}

                                        {/* Platinum: Request Full Profile for shortlisted candidates */}
                                        {isPlatinum && isShortlisted && !app.contact_unlocked && !isLocked && (
                                            unlockRequested[app.candidate_id] ? (
                                                <span className="text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-lg">
                                                    ⏳ Unlock Requested
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleRequestProfileUnlock(app)}
                                                    disabled={requestingUnlock === app.candidate_id}
                                                    className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100 disabled:opacity-50 transition whitespace-nowrap"
                                                >
                                                    {requestingUnlock === app.candidate_id ? '…' : '🔓 Request Full Profile'}
                                                </button>
                                            )
                                        )}

                                        {/* Resume download */}
                                        <div className="flex flex-col items-end gap-0.5">
                                            <button
                                                onClick={() => handleResumeDownload(app.candidate_id, !!app.contact_unlocked)}
                                                disabled={downloadingResume === app.candidate_id}
                                                className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-100 disabled:opacity-50 transition"
                                            >
                                                {downloadingResume === app.candidate_id ? 'Generating...' : 'Download Resume'}
                                            </button>
                                            {!app.contact_unlocked && (
                                                <span className="text-[10px] text-gray-400 italic">
                                                    Contact info redacted
                                                </span>
                                            )}
                                        </div>

                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

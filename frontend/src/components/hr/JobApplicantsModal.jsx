import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { recruitmentAPI } from '../../api/recruitment';
import { matchTextCls } from '../../utils/matchScore';
import CandidateEditor from './CandidateEditor';
import MessageCandidatesBar from './MessageCandidatesBar';

// Everyone on a JD: self-applied, sourced by staff, or added by the company.
export default function JobApplicantsModal({ jobId, onClose }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [tick, setTick]       = useState(0);
    const [picked, setPicked]   = useState(new Set());
    const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

    useEffect(() => {
        let alive = true;
        recruitmentAPI.jobApplicants(jobId)
            .then((r) => { if (alive) setData(r.data.data); })
            .catch((e) => { toast.error(e.response?.data?.message || 'Could not load applicants.'); onClose(); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId, tick]);

    const openResume = async (id) => {
        try {
            const res = await recruitmentAPI.downloadResume(id);
            window.open(URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] || 'application/pdf' })), '_blank');
        } catch { toast.error('Could not open the resume.'); }
    };

    const sourceLabel = (a) => a.source === 'executive' ? `Sourced${a.sourced_by_name ? ` by ${a.sourced_by_name}` : ''}` : a.source === 'company' ? 'Added by company' : 'Applied themselves';

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="font-semibold text-gray-800">Applicants{data ? ` · ${data.job.title}` : ''}</h3>
                        {data && <p className="text-xs text-gray-500">{data.job.company_name} · {data.applicants.length} applicant{data.applicants.length === 1 ? '' : 's'}</p>}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
                </div>
                <MessageCandidatesBar ids={[...picked]} onClear={() => setPicked(new Set())} />
                {loading ? <p className="text-sm text-gray-400 py-10 text-center">Loading…</p> : !data ? null : data.applicants.length === 0 ? (
                    <p className="text-sm text-gray-400 py-10 text-center">No one has applied to this JD yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead><tr><th className="w-8"><input type="checkbox" checked={!!data && data.applicants.length > 0 && data.applicants.every((a) => picked.has(a.candidate_id))} onChange={() => setPicked(data.applicants.every((a) => picked.has(a.candidate_id)) ? new Set() : new Set(data.applicants.map((a) => a.candidate_id)))} aria-label="Select all" /></th><th>Candidate</th><th>Contact</th><th>Experience</th><th>Fit</th><th>Status</th><th>Source</th><th></th></tr></thead>
                            <tbody>
                                {data.applicants.map((a) => (
                                    <tr key={a.application_id}>
                                        <td><input type="checkbox" checked={picked.has(a.candidate_id)} onChange={() => toggle(a.candidate_id)} aria-label="Select applicant" /></td>
                                        <td className="max-w-[220px]">
                                            <p className="font-medium text-gray-800 truncate">{a.candidate_name}</p>
                                            <p className="text-xs text-gray-400 truncate">{a.headline || ''}{a.current_location ? ` · ${a.current_location}` : ''}</p>
                                        </td>
                                        <td className="text-xs text-gray-600">{a.email}<br />{a.phone || ''}</td>
                                        <td className="text-xs">{a.total_experience != null ? `${parseFloat(a.total_experience)} yrs` : '—'}</td>
                                        <td>{a.fit_score != null ? <span className={`font-semibold ${matchTextCls(a.fit_score)}`}>{a.fit_score}%</span> : '—'}</td>
                                        <td><span className="badge-gray capitalize">{String(a.status).replace('_', ' ')}</span></td>
                                        <td className="text-xs text-gray-500">{sourceLabel(a)}</td>
                                        <td className="whitespace-nowrap space-x-3 text-right">
                                            {a.resume_id && <button onClick={() => openResume(a.resume_id)} className="text-xs text-indigo-600 hover:underline">Resume</button>}
                                            {a.can_manage && <button onClick={() => setEditing(a.candidate_id)} className="text-xs text-indigo-600 hover:underline">Manage</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {editing && <CandidateEditor candidateId={editing} onClose={() => setEditing(null)} onChanged={() => setTick((t) => t + 1)} />}
        </div>
    );
}

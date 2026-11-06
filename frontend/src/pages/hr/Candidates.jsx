import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { recruitmentAPI } from '../../api/recruitment';
import CandidateEditor from '../../components/hr/CandidateEditor';
import MessageCandidatesBar from '../../components/hr/MessageCandidatesBar';

const PAGE = 25;

// Candidates the signed-in executive sourced (admin sees everyone). Add, edit, replace resume, assign, delete.
export default function Candidates() {
    const [rows, setRows]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [page, setPage]       = useState(1);
    const [search, setSearch]   = useState('');
    const [query, setQuery]     = useState('');
    const [loading, setLoading] = useState(true);
    const [editor, setEditor]   = useState(undefined);  // undefined = closed, null = new, number = edit
    const [tick, setTick]       = useState(0);
    const [scope, setScope]     = useState('sourced');   // 'sourced' = mine, editable; 'registered' = signed up themselves, view only
    const [picked, setPicked]   = useState(new Set());
    const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const allOnPage = rows.length > 0 && rows.every((r) => picked.has(r.candidate_id));

    useEffect(() => {
        const t = setTimeout(() => { setQuery(search); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let alive = true;
        recruitmentAPI.myCandidates({ page, limit: PAGE, search: query || undefined, scope: scope === 'registered' ? 'registered' : undefined })
            .then((r) => { if (!alive) return; setRows(r.data.data || []); setTotal(r.data.total || 0); })
            .catch(() => toast.error('Could not load candidates.'))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [page, query, tick, scope]);

    const openResume = async (id) => {
        try {
            const res = await recruitmentAPI.downloadResume(id);
            window.open(URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] || 'application/pdf' })), '_blank');
        } catch { toast.error('The resume file could not be opened.'); }
    };

    const pages = Math.max(1, Math.ceil(total / PAGE));

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Candidates you sourced. Add them one by one, fix their details, change their resume, put them on a JD, or delete them.</p>
                </div>
                <button onClick={() => setEditor(null)} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700">+ Add candidate</button>
            </div>

            <div className="flex gap-1 border-b border-gray-200 mb-4">
                {[['sourced', 'Sourced by me'], ['registered', 'Registered themselves']].map(([k, label]) => (
                    <button key={k} onClick={() => { setScope(k); setPage(1); setLoading(true); setPicked(new Set()); }}
                        className={`px-4 py-2 text-sm font-medium border-b-2 ${scope === k ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
                ))}
            </div>
            {scope === 'registered' && <p className="text-xs text-gray-500 mb-3">People who signed up and manage their own profile. You can see their details and open their resume; only they can change them.</p>}

            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone or headline…"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-full max-w-sm mb-4 focus:outline-none focus:border-indigo-500" />

            <MessageCandidatesBar ids={[...picked]} onClear={() => setPicked(new Set())} />

            {loading ? <p className="text-sm text-gray-400 py-10 text-center">Loading…</p> : rows.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-sm text-gray-400">
                    {query ? 'No candidates match your search.' : scope === 'registered' ? 'No candidates have registered yet.' : 'You have not sourced any candidates yet. Add one, or upload resumes under Resume Sourcing.'}
                </div>
            ) : (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
                    <table className="table">
                        <thead><tr><th className="w-8"><input type="checkbox" checked={allOnPage} onChange={() => setPicked(allOnPage ? new Set() : new Set(rows.map((r) => r.candidate_id)))} aria-label="Select all on this page" /></th><th>Candidate</th><th>Contact</th><th>Experience</th><th>Resume</th><th>JDs</th><th></th></tr></thead>
                        <tbody>
                            {rows.map((c) => (
                                <tr key={c.candidate_id} className="cursor-pointer hover:bg-gray-50" onClick={() => scope === 'sourced' && setEditor(c.candidate_id)}>
                                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={picked.has(c.candidate_id)} onChange={() => toggle(c.candidate_id)} aria-label="Select candidate" /></td>
                                    <td className="max-w-[240px]">
                                        <p className="font-medium text-gray-800 truncate">{c.name}</p>
                                        <p className="text-xs text-gray-400 truncate">{c.headline || ''}{c.current_location ? ` · ${c.current_location}` : ''}</p>
                                    </td>
                                    <td className="text-xs text-gray-600">{c.email}<br />{c.phone || ''}</td>
                                    <td className="text-xs">{c.total_experience != null ? `${parseFloat(c.total_experience)} yrs` : '—'}</td>
                                    <td>{c.resume_count > 0 ? <span className="badge-green">on file</span> : <span className="badge-yellow">missing</span>}</td>
                                    <td className="text-xs">{c.application_count}</td>
                                    <td className="text-right whitespace-nowrap space-x-3" onClick={(e) => e.stopPropagation()}>
                                        {c.resume_id && <button onClick={() => openResume(c.resume_id)} className="text-xs text-indigo-600 hover:underline">Resume</button>}
                                        {scope === 'sourced' && <button onClick={() => setEditor(c.candidate_id)} className="text-xs text-indigo-600 hover:underline">Manage</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {pages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                    <span>{total} candidates</span>
                    <div className="flex gap-2">
                        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded-lg disabled:opacity-40">Previous</button>
                        <span className="px-2 py-1">Page {page} of {pages}</span>
                        <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded-lg disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {editor !== undefined && (
                <CandidateEditor candidateId={editor} onClose={() => setEditor(undefined)} onChanged={() => setTick((t) => t + 1)} />
            )}
        </div>
    );
}

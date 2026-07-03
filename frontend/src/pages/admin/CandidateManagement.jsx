import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminCandidateAPI } from '../../api/admin';
import toast from 'react-hot-toast';

const statusBadge = (s) => {
    const map = { active: 'bg-green-100 text-green-700', suspended: 'bg-red-100 text-red-700' };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${map[s] || 'bg-gray-100 text-gray-600'}`}>
            {s}
        </span>
    );
};

export default function CandidateManagement() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selected, setSelected] = useState(null);
    const [actionModal, setActionModal] = useState(null);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        const params = {};
        if (search) params.search = search;
        if (statusFilter) params.status = statusFilter;
        adminCandidateAPI.list(params)
            .then((r) => {
                const list = Array.isArray(r.data) ? r.data : r.data?.candidates ?? r.data?.data ?? [];
                setCandidates(list);
            })
            .catch(() => { toast.error('Failed to load candidates'); setCandidates([]); })
            .finally(() => setLoading(false));
    }, [search, statusFilter]);

    useEffect(() => {
        const t = setTimeout(load, 350);
        return () => clearTimeout(t);
    }, [load]);

    const openDetail = async (id) => {
        try {
            const r = await adminCandidateAPI.getDetail(id);
            setSelected(r.data?.data ?? r.data);
        } catch {
            toast.error('Failed to load candidate details');
        }
    };

    const handleAction = async () => {
        if (!actionModal) return;
        setSaving(true);
        try {
            if (actionModal.type === 'suspend')
                await adminCandidateAPI.suspend(actionModal.id, { reason });
            else
                await adminCandidateAPI.reactivate(actionModal.id);
            toast.success(`Candidate ${actionModal.type}d`);
            setActionModal(null);
            setReason('');
            setSelected(null);
            load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Action failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Candidate Management</h2>

            {/* Filters */}
            <div className="flex gap-3 mb-6">
                <input
                    type="text"
                    placeholder="Search name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>

            <div className="flex gap-6">
                {/* Table */}
                <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden">
                    {loading ? (
                        <p className="p-6 text-gray-400 text-sm">Loading…</p>
                    ) : candidates.length === 0 ? (
                        <p className="p-6 text-gray-400 text-sm">No candidates found.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    {['Name', 'Email', 'Location', 'Applications', 'Status', ''].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(Array.isArray(candidates) ? candidates : []).map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(c.id)}>
                                        <td className="px-4 py-3 font-medium text-gray-800">{c.full_name || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500">{c.email}</td>
                                        <td className="px-4 py-3 text-gray-500">{c.location || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500">{c.application_count ?? 0}</td>
                                        <td className="px-4 py-3">{statusBadge(c.status)}</td>
                                        <td className="px-4 py-3 text-indigo-600 text-xs">View →</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Slide-out detail */}
                {selected && (
                    <div className="w-80 bg-white rounded-lg shadow-sm p-5 shrink-0 overflow-y-auto max-h-[calc(100vh-120px)]">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-gray-800">{selected.full_name || 'No name'}</h3>
                                <p className="text-xs text-gray-500">{selected.email}</p>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <dl className="space-y-2 text-sm mb-4">
                            {[
                                ['Status', statusBadge(selected.status)],
                                ['Location', selected.location],
                                ['Experience', selected.experience_years != null ? `${selected.experience_years} yrs` : null],
                                ['Applications', selected.application_count],
                                ['Training Courses', selected.training_count],
                                ['Certificates', selected.certificate_count],
                            ].filter(([, v]) => v != null).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                    <dt className="text-gray-500">{k}</dt>
                                    <dd className="font-medium text-gray-700">{v}</dd>
                                </div>
                            ))}
                        </dl>

                        {selected.skills?.length > 0 && (
                            <div className="mb-4">
                                <p className="text-xs font-medium text-gray-500 mb-2">Skills</p>
                                <div className="flex flex-wrap gap-1">
                                    {selected.skills.map((s) => (
                                        <span key={s} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded">{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                            {selected.candidate_id && (
                                <Link
                                    to={`/hr/candidates/${selected.candidate_id}/documents`}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded hover:bg-blue-100 border border-blue-200"
                                >
                                    View Documents
                                </Link>
                            )}
                            {selected.status === 'active' ? (
                                <button
                                    onClick={() => setActionModal({ type: 'suspend', id: selected.id })}
                                    className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                >
                                    Suspend
                                </button>
                            ) : (
                                <button
                                    onClick={() => setActionModal({ type: 'reactivate', id: selected.id })}
                                    className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                >
                                    Reactivate
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Action modal */}
            {actionModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                        <h3 className="font-semibold text-gray-800 mb-3 capitalize">
                            {actionModal.type} Candidate
                        </h3>
                        {actionModal.type === 'suspend' && (
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Enter reason…"
                                />
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <button onClick={() => { setActionModal(null); setReason(''); }} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                            <button onClick={handleAction} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                                {saving ? 'Saving…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

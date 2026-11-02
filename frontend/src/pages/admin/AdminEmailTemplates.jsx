import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import PendingFiles from '../../components/outreach/PendingFiles';
import { formatSize } from '../../utils/attachmentRules';

const EMPTY = { name: '', description: '', subject: '', body_html: '', variables: '', is_active: true };

export default function AdminEmailTemplates() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [current, setCurrent] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [files, setFiles] = useState([]);
    const [existing, setExisting] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/email-templates');
            setTemplates(data.data || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const openAdd = () => { setCurrent(EMPTY); setFiles([]); setExisting([]); setError(''); setModal('add'); };
    const openEdit = async (tpl) => {
        try {
            const { data } = await api.get(`/admin/email-templates/${tpl.id}`);
            const t = data.data;
            setCurrent({
                ...t,
                variables: Array.isArray(t.variables) ? t.variables.join(', ') : (t.variables || ''),
                is_active: !!t.is_active,
            });
            setError('');
            setFiles([]);
            const a = await api.get(`/admin/email-templates/${tpl.id}/attachments`).catch(() => null);
            setExisting(a?.data?.data || []);
            setModal('edit');
        } catch { setError('Failed to load template.'); }
    };
    const openPreview = async (tpl) => {
        try {
            const { data } = await api.get(`/admin/email-templates/${tpl.id}`);
            setCurrent(data.data);
            setModal('preview');
        } catch { /* ignore */ }
    };
    const openDelete = (tpl) => { setCurrent(tpl); setModal('delete'); };
    const closeModal = () => { setModal(null); setError(''); };

    const handleSave = async () => {
        setError('');
        if (!current.name?.trim() || !current.subject?.trim() || !current.body_html?.trim()) {
            setError('Name, subject, and body are required.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...current,
                variables: current.variables
                    ? current.variables.split(',').map(v => v.trim()).filter(Boolean)
                    : [],
            };
            let tplId = current.id;
            if (modal === 'add') {
                const r = await api.post('/admin/email-templates', payload);
                tplId = r.data.data.id;
            } else {
                await api.put(`/admin/email-templates/${current.id}`, payload);
            }
            const failed = [];
            for (const f of files) {
                const fd = new FormData();
                fd.append('file', f);
                try { await api.post(`/admin/email-templates/${tplId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
                catch (err) { failed.push(`${f.name}: ${err.response?.data?.message || 'upload failed'}`); }
            }
            await load();
            if (failed.length) {
                // Template is saved; keep the modal open (in edit mode) so the person can see what failed.
                setCurrent(c => ({ ...c, id: tplId }));
                setModal('edit');
                setFiles([]);
                const a = await api.get(`/admin/email-templates/${tplId}/attachments`).catch(() => null);
                setExisting(a?.data?.data || []);
                setError(`Template saved, but some files were not attached. ${failed.join('; ')}`);
            } else {
                closeModal();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Save failed.');
        }
        setSaving(false);
    };

    const removeExisting = async (att) => {
        if (!window.confirm(`Remove "${att.file_name}"?`)) return;
        try {
            await api.delete(`/admin/email-templates/${current.id}/attachments/${att.id}`);
            setExisting(list => list.filter(a => a.id !== att.id));
        } catch { setError('Could not remove the attachment.'); }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            await api.delete(`/admin/email-templates/${current.id}`);
            await load();
            closeModal();
        } catch {
            setError('Delete failed.');
        }
        setSaving(false);
    };

    const filtered = templates.filter(t =>
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.subject?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage transactional email templates sent by the platform.</p>
                </div>
                <button onClick={openAdd}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                    + New Template
                </button>
            </div>

            <div className="mb-4">
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search templates…"
                    className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            {loading ? (
                <div className="text-center py-16 text-gray-400">Loading…</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No templates found.</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Name', 'Subject', 'Variables', 'Status', 'Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map(tpl => (
                                <tr key={tpl.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900">{tpl.name}</div>
                                        {tpl.description && <div className="text-xs text-gray-400 mt-0.5">{tpl.description}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{tpl.subject}</td>
                                    <td className="px-4 py-3 text-gray-500">
                                        {Array.isArray(tpl.variables) && tpl.variables.length > 0
                                            ? tpl.variables.map(v => (
                                                <span key={v} className="inline-block bg-indigo-50 text-indigo-700 text-xs rounded px-1.5 py-0.5 mr-1 mb-0.5">{`{{${v}}}`}</span>
                                            ))
                                            : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tpl.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {tpl.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button onClick={() => openPreview(tpl)}
                                                className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded px-2 py-1">Preview</button>
                                            <button onClick={() => openEdit(tpl)}
                                                className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded px-2 py-1">Edit</button>
                                            <button onClick={() => openDelete(tpl)}
                                                className="text-xs text-red-500 hover:text-red-700 border border-red-100 rounded px-2 py-1">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add / Edit Modal */}
            {(modal === 'add' || modal === 'edit') && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="text-lg font-bold text-gray-900">
                                {modal === 'add' ? 'New Email Template' : 'Edit Email Template'}
                            </h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>
                        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
                            {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Template Name *</label>
                                    <input value={current.name} onChange={e => setCurrent(p => ({ ...p, name: e.target.value }))}
                                        placeholder="e.g. company_approved"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <p className="text-xs text-gray-400 mt-1">Lowercase, underscores only. Used as the template identifier.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                                    <input value={current.description || ''} onChange={e => setCurrent(p => ({ ...p, description: e.target.value }))}
                                        placeholder="What this template is for"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Subject *</label>
                                <input value={current.subject} onChange={e => setCurrent(p => ({ ...p, subject: e.target.value }))}
                                    placeholder="e.g. Your account is approved — {{company_name}}"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Variables (comma-separated)</label>
                                <input value={current.variables} onChange={e => setCurrent(p => ({ ...p, variables: e.target.value }))}
                                    placeholder="e.g. company_name, candidate_name, job_title"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                <p className="text-xs text-gray-400 mt-1">Use <code className="bg-gray-100 px-1 rounded">{`{{variable_name}}`}</code> in subject and body.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">HTML Body *</label>
                                <textarea value={current.body_html} onChange={e => setCurrent(p => ({ ...p, body_html: e.target.value }))}
                                    rows={14}
                                    placeholder="<p>Hi {{candidate_name}},</p>…"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Attachments</label>
                                {existing.length > 0 && (
                                    <ul className="mb-2 space-y-1">
                                        {existing.map(a => (
                                            <li key={a.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                                                <span className="truncate">{a.file_name} <span className="text-xs text-gray-400">{formatSize(a.file_size)}</span></span>
                                                <button type="button" onClick={() => removeExisting(a)} className="text-xs text-red-500 hover:text-red-700 ml-3">Remove</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <PendingFiles files={files} onChange={setFiles} disabled={saving}
                                    includedBytes={existing.reduce((n, a) => n + a.file_size, 0)} />
                                <p className="text-xs text-gray-400 mt-1">Sent with every campaign created from this template.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="is_active" checked={current.is_active}
                                    onChange={e => setCurrent(p => ({ ...p, is_active: e.target.checked }))}
                                    className="rounded text-indigo-600" />
                                <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
                            <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {modal === 'preview' && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{current.name}</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Subject: {current.subject}</p>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>
                        <div className="overflow-y-auto px-6 py-4 flex-1">
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm prose max-w-none"
                                dangerouslySetInnerHTML={{ __html: current.body_html }} />
                        </div>
                        <div className="flex justify-end px-6 py-4 border-t">
                            <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {modal === 'delete' && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Template?</h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Are you sure you want to delete <strong>{current.name}</strong>? This cannot be undone.
                        </p>
                        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}
                        <div className="flex justify-end gap-3">
                            <button onClick={closeModal} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
                            <button onClick={handleDelete} disabled={saving}
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                                {saving ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

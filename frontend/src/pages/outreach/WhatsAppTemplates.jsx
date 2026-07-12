import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { waTemplateAPI, vaartabotAPI } from '../../api/outreach';


const EMPTY = { template_name:'', language_code:'en', category:'MARKETING', header_type:'none', header_content:'', body_text:'', footer_text:'', variable_count:0 };

export default function WhatsAppTemplates() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [showForm, setShowForm]   = useState(false);
    const [editing, setEditing]     = useState(null);
    const [form, setForm]           = useState(EMPTY);
    const [saving, setSaving]       = useState(false);
    const [syncing, setSyncing]     = useState(false);
    const [credits, setCredits]     = useState(null);

    const fetch = () => {
        setLoading(true);
        waTemplateAPI.getAll()
            .then(r => setTemplates(r.data.data || []))
            .catch(() => toast.error('Failed to load templates'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetch();
        vaartabotAPI.getCredits()
            .then(r => setCredits(r.data?.data?.creditsBalance ?? null))
            .catch(() => {});
    }, []);


    const handleSync = async () => {
        setSyncing(true);
        try {
            const r = await waTemplateAPI.sync();
            toast.success(r.data.message || `Synced ${r.data.synced} template(s)`);
            fetch();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Sync failed');
        } finally { setSyncing(false); }
    };

    const openEdit = (t) => {
        setEditing(t.id);
        setForm({ template_name: t.template_name, language_code: t.language_code, category: t.category,
            header_type: t.header_type, header_content: t.header_content || '',
            body_text: t.body_text, footer_text: t.footer_text || '', variable_count: t.variable_count });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.template_name || !form.body_text) return toast.error('template_name and body_text required');
        setSaving(true);
        try {
            if (editing) {
                await waTemplateAPI.update(editing, form);
                toast.success('Template updated');
            } else {
                await waTemplateAPI.create(form);
                toast.success('Template created');
            }
            setShowForm(false); setEditing(null); setForm(EMPTY); fetch();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete template "${name}"?`)) return;
        try {
            await waTemplateAPI.remove(id);
            toast.success('Deleted'); fetch();
        } catch { toast.error('Delete failed'); }
    };

    const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-gray-800">WhatsApp Templates</h2>
                        {credits !== null && (
                            <span className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                                {credits} credit{credits !== 1 ? 's' : ''} remaining
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">Manage Vaartabot-approved message templates</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSync} disabled={syncing}
                        className="border border-gray-200 text-sm px-3 py-2 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
                        {syncing ? 'Syncing…' : '↻ Sync from Vaartabot'}
                    </button>
                    <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm(EMPTY); }}
                        className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-700 transition">
                        + Add Template
                    </button>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700">
                <strong>Note:</strong> Templates must be pre-approved by Vaartabot before use. The <code>template_name</code> must exactly match the approved name in your Vaartabot dashboard.
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-gray-800">{editing ? 'Edit Template' : 'New Template'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Template Name (Vaartabot name) *</label>
                            <input type="text" value={form.template_name} onChange={set('template_name')}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                                placeholder="e.g. ladder_intro_v1" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Category</label>
                            <select value={form.category} onChange={set('category')}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                                <option>MARKETING</option><option>UTILITY</option><option>AUTHENTICATION</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Language Code</label>
                            <input type="text" value={form.language_code} onChange={set('language_code')}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                                placeholder="en" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Variable Count</label>
                            <input type="number" min="0" value={form.variable_count} onChange={set('variable_count')}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Body Text * (use {`{{1}}, {{2}}`} for variables)</label>
                        <textarea value={form.body_text} onChange={set('body_text')} rows={4}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-y"
                            placeholder="Hi {{1}}, I'm reaching out from LadderStep Human Consulting…" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Footer (optional)</label>
                        <input type="text" value={form.footer_text} onChange={set('footer_text')}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                            placeholder="LadderStep Human Consulting" />
                    </div>
                    <div className="flex gap-3">
                        <button type="submit" disabled={saving}
                            className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                            {saving ? 'Saving…' : (editing ? 'Update' : 'Create')}
                        </button>
                        <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY); }}
                            className="text-sm text-gray-500 hover:underline px-4">Cancel</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
            ) : templates.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <p className="text-gray-400 text-sm">No templates yet.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="divide-y divide-gray-50">
                        {templates.map(t => (
                            <div key={t.id} className="px-5 py-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-gray-800">{t.template_name}</p>
                                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{t.category}</span>
                                            {t.is_active
                                                ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Approved</span>
                                                : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏳ Pending / Rejected</span>
                                            }
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 max-w-lg">{t.body_text}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{t.variable_count} variable(s) · {t.language_code}</p>
                                    </div>
                                    <div className="flex gap-3 ml-4 shrink-0">
                                        <button onClick={() => openEdit(t)} className="text-xs text-blue-600 hover:underline">Edit</button>
                                        <button onClick={() => handleDelete(t.id, t.template_name)} className="text-xs text-red-500 hover:underline">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

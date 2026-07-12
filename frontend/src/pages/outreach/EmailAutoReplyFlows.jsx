import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { emailAutoReplyAPI } from '../../api/outreach';

const EMPTY = {
    flow_name: '', trigger_type: 'keyword', trigger_keywords: '', match_type: 'contains',
    response_subject: '', response_body: '',
};

const TRIGGER_LABELS = { keyword: 'Keyword match', any: 'Any message', first_contact: 'First contact' };
const MATCH_LABELS   = { exact: 'Exact', contains: 'Contains', starts_with: 'Starts with' };

export default function EmailAutoReplyFlows() {
    const [flows, setFlows]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing]   = useState(null);
    const [form, setForm]         = useState(EMPTY);
    const [saving, setSaving]     = useState(false);

    const load = () => {
        setLoading(true);
        emailAutoReplyAPI.getAll()
            .then(r => setFlows(r.data.data || []))
            .catch(() => toast.error('Failed to load flows'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const openEdit = (f) => {
        setEditing(f.id);
        setForm({
            flow_name:        f.flow_name,
            trigger_type:     f.trigger_type,
            trigger_keywords: Array.isArray(f.trigger_keywords)
                ? f.trigger_keywords.join(', ')
                : (typeof f.trigger_keywords === 'string'
                    ? JSON.parse(f.trigger_keywords || '[]').join(', ') : ''),
            match_type:       f.match_type,
            response_subject: f.response_subject || '',
            response_body:    f.response_body || '',
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.flow_name.trim())    return toast.error('Flow name is required');
        if (!form.response_body.trim()) return toast.error('Response body is required');

        const keywords = form.trigger_keywords
            ? form.trigger_keywords.split(',').map(k => k.trim()).filter(Boolean)
            : [];

        const payload = {
            flow_name:        form.flow_name.trim(),
            trigger_type:     form.trigger_type,
            trigger_keywords: keywords,
            match_type:       form.match_type,
            response_subject: form.response_subject.trim() || null,
            response_body:    form.response_body.trim(),
        };

        setSaving(true);
        try {
            if (editing) {
                await emailAutoReplyAPI.update(editing, payload);
                toast.success('Flow updated');
            } else {
                await emailAutoReplyAPI.create(payload);
                toast.success('Flow created');
            }
            setShowForm(false); setEditing(null); setForm(EMPTY); load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (flow) => {
        try {
            await emailAutoReplyAPI.update(flow.id, { is_active: !flow.is_active });
            toast.success(flow.is_active ? 'Flow paused' : 'Flow activated');
            load();
        } catch { toast.error('Failed to toggle flow'); }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete flow "${name}"?`)) return;
        try {
            await emailAutoReplyAPI.remove(id);
            toast.success('Deleted'); load();
        } catch { toast.error('Delete failed'); }
    };

    const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Email Auto-Reply Flows</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Automatically reply to incoming emails based on keywords or triggers.
                        Unlike WhatsApp, email auto-replies send free-text without template restrictions.
                    </p>
                </div>
                <button
                    onClick={() => { setShowForm(!showForm); setEditing(null); setForm(EMPTY); }}
                    className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition">
                    + New Flow
                </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700">
                <strong>How it works:</strong> When an inbound email is received, flows are checked in order (top to bottom).
                The first match fires an auto-reply from your outreach email address. Each email receives at most one auto-reply.
                Keyword matching checks both the email <strong>subject</strong> and <strong>body</strong>.
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-gray-800">{editing ? 'Edit Flow' : 'New Email Auto-Reply Flow'}</h3>

                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Flow Name *</label>
                        <input type="text" value={form.flow_name} onChange={set('flow_name')}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                            placeholder="e.g. Hiring enquiry reply, Candidate interest" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Trigger Type</label>
                            <select value={form.trigger_type} onChange={set('trigger_type')}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                                <option value="keyword">Keyword match</option>
                                <option value="any">Any message (reply to all)</option>
                                <option value="first_contact">First contact (never emailed before)</option>
                            </select>
                        </div>
                        {form.trigger_type === 'keyword' && (
                            <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">Match Type</label>
                                <select value={form.match_type} onChange={set('match_type')}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                                    <option value="contains">Contains keyword</option>
                                    <option value="exact">Exact match</option>
                                    <option value="starts_with">Starts with keyword</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {form.trigger_type === 'keyword' && (
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Keywords (comma-separated) *</label>
                            <input type="text" value={form.trigger_keywords} onChange={set('trigger_keywords')}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                placeholder="hire, hiring, recruitment, talent" />
                            <p className="text-xs text-gray-400 mt-1">Case-insensitive. Matched against email subject + body.</p>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Reply Subject (optional)</label>
                        <input type="text" value={form.response_subject} onChange={set('response_subject')}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                            placeholder="Re: Your enquiry — LadderStep Human Consulting (defaults to Re: {original subject})" />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Reply Body *</label>
                        <textarea value={form.response_body} onChange={set('response_body')} rows={8}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-y font-mono"
                            placeholder="Thank you for reaching out to LadderStep..." />
                        <p className="text-xs text-gray-400 mt-1">Plain text. Line breaks are preserved.</p>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button type="submit" disabled={saving}
                            className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition">
                            {saving ? 'Saving…' : (editing ? 'Update' : 'Create Flow')}
                        </button>
                        <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY); }}
                            className="text-sm text-gray-500 hover:underline px-4">Cancel</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
            ) : flows.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <p className="text-gray-400 text-sm">No email auto-reply flows yet. Create one to start automating responses.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="divide-y divide-gray-50">
                        {flows.map(f => (
                            <div key={f.id} className="px-5 py-4">
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-gray-800">{f.flow_name}</p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {f.is_active ? 'Active' : 'Paused'}
                                            </span>
                                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                                {TRIGGER_LABELS[f.trigger_type] || f.trigger_type}
                                            </span>
                                            {f.trigger_type === 'keyword' && (
                                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                    {MATCH_LABELS[f.match_type]}
                                                </span>
                                            )}
                                        </div>

                                        {f.trigger_type === 'keyword' && f.trigger_keywords && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Keywords: {(Array.isArray(f.trigger_keywords)
                                                    ? f.trigger_keywords
                                                    : JSON.parse(f.trigger_keywords || '[]')
                                                ).join(', ')}
                                            </p>
                                        )}

                                        {f.response_subject && (
                                            <p className="text-xs text-gray-500 mt-0.5">Subject: {f.response_subject}</p>
                                        )}

                                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                                            {(f.response_body || '').slice(0, 120)}{(f.response_body || '').length > 120 ? '…' : ''}
                                        </p>
                                    </div>

                                    <div className="flex gap-3 ml-4 shrink-0 items-center">
                                        <button onClick={() => handleToggle(f)}
                                            className={`text-xs hover:underline ${f.is_active ? 'text-yellow-600' : 'text-green-600'}`}>
                                            {f.is_active ? 'Pause' : 'Activate'}
                                        </button>
                                        <button onClick={() => openEdit(f)} className="text-xs text-blue-600 hover:underline">Edit</button>
                                        <button onClick={() => handleDelete(f.id, f.flow_name)} className="text-xs text-red-500 hover:underline">Delete</button>
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

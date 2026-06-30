import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { emailCampaignAPI, contactListAPI } from '../../api/outreach';

const MERGE_TAGS = ['{{first_name}}','{{full_name}}','{{company_name}}','{{designation}}','{{city}}','{{executive_name}}'];

export default function EmailCampaignNew() {
    const navigate       = useNavigate();
    const [sp]           = useSearchParams();
    const editId         = sp.get('edit');

    const [lists, setLists]       = useState([]);
    const [saving, setSaving]     = useState(false);
    const [sending, setSending]   = useState(false);
    const [form, setForm]         = useState({
        campaign_name: '',
        list_id:       '',
        subject:       '',
        message_body:  '',
        from_name:     '',
        scheduled_at:  '',
    });

    useEffect(() => {
        contactListAPI.getAll().then(r => setLists(r.data.data || [])).catch(() => {});
        if (editId) {
            emailCampaignAPI.getOne(editId)
                .then(r => {
                    const c = r.data.data;
                    setForm({
                        campaign_name: c.campaign_name || '',
                        list_id:       String(c.list_id || ''),
                        subject:       c.subject || '',
                        message_body:  c.message_body || '',
                        from_name:     c.from_name || '',
                        scheduled_at:  c.scheduled_at ? c.scheduled_at.slice(0,16) : '',
                    });
                })
                .catch(() => toast.error('Failed to load campaign'));
        }
    }, [editId]);

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const insertTag = (tag) => {
        const el = document.getElementById('msg-body');
        if (!el) return;
        const start = el.selectionStart;
        const end   = el.selectionEnd;
        const val   = form.message_body;
        setForm(f => ({ ...f, message_body: val.slice(0, start) + tag + val.slice(end) }));
    };

    const handleSaveDraft = async (e) => {
        e.preventDefault();
        if (!form.campaign_name || !form.list_id || !form.subject || !form.message_body) {
            return toast.error('Fill in all required fields');
        }
        setSaving(true);
        try {
            if (editId) {
                await emailCampaignAPI.update(editId, form);
                toast.success('Campaign updated');
            } else {
                const r = await emailCampaignAPI.create(form);
                toast.success('Campaign saved as draft');
                navigate(`/outreach/email/${r.data.id}`);
                return;
            }
            navigate(`/outreach/email/${editId}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleSendNow = async (e) => {
        e.preventDefault();
        if (!form.campaign_name || !form.list_id || !form.subject || !form.message_body) {
            return toast.error('Fill in all required fields');
        }
        if (!confirm('Send this campaign to all contacts in the selected list?')) return;
        setSending(true);
        try {
            let id = editId;
            if (!id) {
                const r = await emailCampaignAPI.create(form);
                id = r.data.id;
            } else {
                await emailCampaignAPI.update(id, form);
            }
            await emailCampaignAPI.send(id);
            toast.success('Campaign send started!');
            navigate(`/outreach/email/${id}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Send failed');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/outreach/email')} className="text-sm text-gray-400 hover:text-gray-600">← Campaigns</button>
                <span className="text-gray-300">/</span>
                <h2 className="text-xl font-bold text-gray-800">{editId ? 'Edit Campaign' : 'New Email Campaign'}</h2>
            </div>

            <form className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Campaign Name *</label>
                        <input type="text" value={form.campaign_name} onChange={set('campaign_name')}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                            placeholder="e.g. IT Decision Makers Outreach" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Contact List *</label>
                        <select value={form.list_id} onChange={set('list_id')}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                            <option value="">— Select list —</option>
                            {lists.filter(l => l.import_status === 'done').map(l => (
                                <option key={l.id} value={l.id}>{l.list_name} ({l.imported_contacts} contacts)</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">From Name</label>
                        <input type="text" value={form.from_name} onChange={set('from_name')}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                            placeholder="Your Name or LadderStep Human Consulting" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Schedule (optional)</label>
                        <input type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Subject *</label>
                    <input type="text" value={form.subject} onChange={set('subject')}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                        placeholder="e.g. Quick intro from LadderStep Human Consulting, {{first_name}}" />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-600">Email Body * (HTML supported)</label>
                        <div className="flex gap-1 flex-wrap justify-end">
                            {MERGE_TAGS.map(tag => (
                                <button key={tag} type="button" onClick={() => insertTag(tag)}
                                    className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded hover:bg-green-100 transition">
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                    <textarea id="msg-body" value={form.message_body} onChange={set('message_body')} rows={10}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-green-500 resize-y"
                        placeholder="Write your email body here. You can use merge tags like {{first_name}} to personalise." />
                    <p className="text-xs text-gray-400 mt-1">HTML is supported. Use merge tags to personalise per contact.</p>
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveDraft} disabled={saving}
                        className="border border-gray-300 text-gray-700 text-sm px-5 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition">
                        {saving ? 'Saving…' : 'Save as Draft'}
                    </button>
                    <button onClick={handleSendNow} disabled={sending || saving}
                        className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                        {sending ? 'Starting Send…' : 'Send Now'}
                    </button>
                </div>
            </form>
        </div>
    );
}

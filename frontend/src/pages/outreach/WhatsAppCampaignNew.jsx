import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { waCampaignAPI, waTemplateAPI, contactListAPI, vaartabotAPI } from '../../api/outreach';

const CONTACT_FIELDS = ['first_name','full_name','company_name','designation','city','phone'];

export default function WhatsAppCampaignNew() {
    const navigate   = useNavigate();
    const [contactSource, setContactSource] = useState('local'); // 'local' | 'vaartabot'
    const [lists, setLists]                 = useState([]);
    const [vbGroups, setVbGroups]           = useState([]);
    const [vbLoading, setVbLoading]         = useState(false);
    const [syncing, setSyncing]             = useState(false);
    const [syncedListId, setSyncedListId]   = useState(null);
    const [templates, setTemplates]         = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [form, setForm]   = useState({ campaign_name:'', list_id:'', whatsapp_template_id:'', vb_group_id:'', vb_group_name:'' });
    const [varMapping, setVarMapping] = useState({});
    const [saving, setSaving]         = useState(false);

    useEffect(() => {
        contactListAPI.getAll().then(r => setLists(r.data.data || [])).catch(() => {});
        waTemplateAPI.getAll().then(r => setTemplates(r.data.data || [])).catch(() => {});
    }, []);

    const loadVbGroups = () => {
        if (vbGroups.length) return;
        setVbLoading(true);
        vaartabotAPI.getGroups()
            .then(r => setVbGroups(r.data.data || []))
            .catch(() => toast.error('Failed to load Vaartabot groups'))
            .finally(() => setVbLoading(false));
    };

    const handleSourceSwitch = (src) => {
        setContactSource(src);
        setForm(f => ({ ...f, list_id: '', vb_group_id: '', vb_group_name: '' }));
        setSyncedListId(null);
        if (src === 'vaartabot') loadVbGroups();
    };

    const handleSyncGroup = async () => {
        if (!form.vb_group_id) return toast.error('Select a Vaartabot group first');
        setSyncing(true);
        try {
            const r = await vaartabotAPI.syncGroup({ group_id: form.vb_group_id, group_name: form.vb_group_name });
            toast.success(r.data.message || 'Sync started');
            setSyncedListId(r.data.list_id);
            setForm(f => ({ ...f, list_id: String(r.data.list_id) }));
            // Refresh local lists so the new one appears
            contactListAPI.getAll().then(r2 => setLists(r2.data.data || [])).catch(() => {});
        } catch (err) {
            toast.error(err.response?.data?.message || 'Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    const handleTemplateChange = (e) => {
        const id = e.target.value;
        const tmpl = templates.find(t => String(t.id) === id);
        setForm(f => ({ ...f, whatsapp_template_id: id }));
        setSelectedTemplate(tmpl || null);
        if (tmpl) {
            const mapping = {};
            for (let i = 1; i <= tmpl.variable_count; i++) mapping[`{{${i}}}`] = '';
            setVarMapping(mapping);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.campaign_name || !form.list_id || !form.whatsapp_template_id) {
            return toast.error('Fill in all required fields');
        }
        setSaving(true);
        try {
            const r = await waCampaignAPI.create({
                campaign_name: form.campaign_name,
                list_id: form.list_id,
                whatsapp_template_id: form.whatsapp_template_id,
                variable_mapping: varMapping,
            });
            toast.success('Campaign created!');
            navigate(`/outreach/whatsapp/${r.data.id}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create campaign');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/outreach/whatsapp')} className="text-sm text-gray-400 hover:text-gray-600">← WhatsApp</button>
                <span className="text-gray-300">/</span>
                <h2 className="text-xl font-bold text-gray-800">New WhatsApp Campaign</h2>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
                {/* Campaign name */}
                <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Campaign Name *</label>
                    <input type="text" value={form.campaign_name}
                        onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                        placeholder="e.g. Q3 Hiring Manager Outreach" />
                </div>

                {/* Contact source tabs */}
                <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">Contact Source *</label>
                    <div className="flex gap-2 mb-3">
                        {[
                            { key: 'local',     label: '📋 Uploaded Lists' },
                            { key: 'vaartabot', label: '💬 Vaartabot Groups' },
                        ].map(s => (
                            <button key={s.key} type="button"
                                onClick={() => handleSourceSwitch(s.key)}
                                className={`px-4 py-1.5 text-sm rounded-xl border transition ${
                                    contactSource === s.key
                                        ? 'bg-green-600 text-white border-green-600'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}>
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {contactSource === 'local' && (
                        <select value={form.list_id} onChange={e => setForm(f => ({ ...f, list_id: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                            <option value="">— Select list —</option>
                            {lists.filter(l => l.import_status === 'done').map(l => (
                                <option key={l.id} value={l.id}>{l.list_name} ({l.imported_contacts} contacts)</option>
                            ))}
                        </select>
                    )}

                    {contactSource === 'vaartabot' && (
                        <div className="space-y-3">
                            {vbLoading ? (
                                <div className="text-sm text-gray-400">Loading Vaartabot groups…</div>
                            ) : (
                                <select value={form.vb_group_id}
                                    onChange={e => {
                                        const opt = vbGroups.find(g => String(g.id || g.group_id) === e.target.value);
                                        setForm(f => ({
                                            ...f,
                                            vb_group_id: e.target.value,
                                            vb_group_name: opt?.name || opt?.group_name || '',
                                            list_id: '',
                                        }));
                                        setSyncedListId(null);
                                    }}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                                    <option value="">— Select Vaartabot group —</option>
                                    {vbGroups.map(g => {
                                        const id   = g.id || g.group_id;
                                        const name = g.name || g.group_name || id;
                                        const count = g.contact_count || g.count || '';
                                        return <option key={id} value={String(id)}>{name}{count ? ` (${count} contacts)` : ''}</option>;
                                    })}
                                </select>
                            )}

                            {form.vb_group_id && !syncedListId && (
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={handleSyncGroup} disabled={syncing}
                                        className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                                        {syncing ? 'Importing…' : '↓ Import to Contact List'}
                                    </button>
                                    <span className="text-xs text-gray-400">Imports the group into a local list, then creates the campaign</span>
                                </div>
                            )}

                            {syncedListId && (
                                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                                    <span>✓</span>
                                    <span>Contacts imported — ready to create campaign</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Template */}
                <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">WhatsApp Template *</label>
                    <select value={form.whatsapp_template_id} onChange={handleTemplateChange}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                        <option value="">— Select template —</option>
                        {templates.filter(t => t.is_active).map(t => (
                            <option key={t.id} value={t.id}>{t.template_name} ({t.variable_count} vars)</option>
                        ))}
                    </select>
                </div>

                {selectedTemplate && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-xs font-medium text-green-700 mb-1">Template Preview:</p>
                        <p className="text-sm text-gray-700">{selectedTemplate.body_text}</p>
                    </div>
                )}

                {selectedTemplate && selectedTemplate.variable_count > 0 && (
                    <div>
                        <p className="text-xs font-medium text-gray-600 mb-2">Map Template Variables to Contact Fields:</p>
                        <div className="space-y-2">
                            {Object.keys(varMapping).map(placeholder => (
                                <div key={placeholder} className="flex items-center gap-3">
                                    <span className="text-sm font-mono text-purple-700 w-12 shrink-0">{placeholder}</span>
                                    <span className="text-gray-400 text-sm">→</span>
                                    <select value={varMapping[placeholder]}
                                        onChange={e => setVarMapping(m => ({ ...m, [placeholder]: e.target.value }))}
                                        className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-green-500">
                                        <option value="">— Select field —</option>
                                        {CONTACT_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={saving || !form.list_id}
                        className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                        {saving ? 'Creating…' : 'Create Campaign'}
                    </button>
                </div>
            </form>
        </div>
    );
}

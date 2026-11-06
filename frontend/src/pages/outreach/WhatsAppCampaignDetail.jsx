import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { waCampaignAPI } from '../../api/outreach';
import { fmtIst } from '../../utils/schedule';

const STATUS_COLORS = {
    draft:'bg-gray-100 text-gray-600', sending:'bg-blue-100 text-blue-700',
    sent:'bg-green-100 text-green-700', paused:'bg-yellow-100 text-yellow-700',
    failed:'bg-red-100 text-red-700', scheduled:'bg-purple-100 text-purple-700',
};

export default function WhatsAppCampaignDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [campaign, setCampaign]   = useState(null);
    const [failedLogs, setFailedLogs] = useState([]);
    const [tab, setTab]             = useState('overview');
    const [loading, setLoading]     = useState(true);

    const fetch = () => {
        waCampaignAPI.getOne(id)
            .then(r => setCampaign(r.data.data))
            .catch(() => toast.error('Failed to load campaign'))
            .finally(() => setLoading(false));
        waCampaignAPI.failedLogs(id)
            .then(r => setFailedLogs(r.data.data || []))
            .catch(() => {});
    };

    useEffect(() => { fetch(); }, [id]);

    useEffect(() => {
        if (campaign?.status !== 'sending') return;
        const t = setTimeout(fetch, 10000);
        return () => clearTimeout(t);
    }, [campaign]);

    const handleUnschedule = async () => {
        if (!confirm('Cancel the schedule? The campaign goes back to a draft and will not send by itself.')) return;
        try {
            await waCampaignAPI.schedule(id, '');
            toast.success('Schedule cancelled'); fetch();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not cancel the schedule');
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete campaign "${campaign.campaign_name}"? It will be removed from your list. Replies and leads already received are kept.`)) return;
        try {
            await waCampaignAPI.remove(id);
            toast.success('Campaign deleted');
            navigate('/outreach/whatsapp');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed');
        }
    };

    const handleMedia = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            await waCampaignAPI.uploadMedia(id, file);
            toast.success('Media saved'); fetch();
        } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    };

    const handleRemoveMedia = async () => {
        try { await waCampaignAPI.removeMedia(id); toast.success('Media removed'); fetch(); }
        catch (err) { toast.error(err.response?.data?.message || 'Could not remove'); }
    };

    const handleSend = async () => {
        if (!confirm('Send this WhatsApp campaign?')) return;
        try {
            await waCampaignAPI.send(id);
            toast.success('Sending started!'); fetch();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Send failed');
        }
    };

    if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>;
    if (!campaign) return <div className="text-center py-12 text-gray-400">Campaign not found.</div>;

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
                <Link to="/outreach/whatsapp" className="text-sm text-gray-400 hover:text-gray-600">← WhatsApp</Link>
                <span className="text-gray-300">/</span>
                <h2 className="text-xl font-bold text-gray-800 flex-1">{campaign.campaign_name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[campaign.status]}`}>{campaign.status}</span>
            </div>

            {campaign.status === 'scheduled' && campaign.scheduled_at && (
                <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm text-purple-800">🗓 Scheduled: sends by itself on <b>{fmtIst(campaign.scheduled_at)}</b></p>
                    <button onClick={handleUnschedule} className="text-xs font-semibold text-purple-700 underline">Cancel schedule</button>
                </div>
            )}

            {campaign.media_header_enabled && ['image', 'video', 'document'].includes(campaign.template_header_type) && (
                <div className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                        Template {campaign.template_header_type}
                        <span className="ml-2 text-[10px] font-medium text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">not verified with Vaartabot</span>
                    </p>
                    <p className="text-xs text-gray-500 mb-2">
                        This template has a {campaign.template_header_type} header. {campaign.template_header_type === 'image' ? 'JPG or PNG, up to 5 MB.' : campaign.template_header_type === 'video' ? 'MP4, up to 16 MB.' : 'PDF, up to 16 MB.'}
                        {' '}Send a test to your own number first.
                    </p>
                    {campaign.has_header_media ? (
                        <p className="text-sm text-green-700">✓ File added
                            {['draft', 'scheduled'].includes(campaign.status) && <button onClick={handleRemoveMedia} className="ml-3 text-xs text-red-500 hover:underline">Remove</button>}
                        </p>
                    ) : ['draft', 'scheduled'].includes(campaign.status) ? (
                        <input type="file" accept={campaign.template_header_type === 'image' ? '.jpg,.jpeg,.png' : campaign.template_header_type === 'video' ? '.mp4' : '.pdf'} onChange={handleMedia} className="text-sm" />
                    ) : <p className="text-sm text-gray-400">No file was added.</p>}
                </div>
            )}

            <div className="flex gap-2 mb-4 flex-wrap">
                {['draft', 'scheduled'].includes(campaign.status) && (
                    <button onClick={handleSend} className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-green-700 transition">
                        Send Now
                    </button>
                )}
                {campaign.status !== 'sending' && (
                    <button onClick={handleDelete} className="border border-red-200 text-red-600 text-sm px-4 py-2 rounded-xl hover:bg-red-50 transition">
                        Delete
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Recipients', value: campaign.total_recipients },
                    { label: 'Sent',       value: campaign.sent_count },
                    { label: 'Failed',     value: campaign.failed_count },
                    { label: 'Replies',    value: campaign.reply_count },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                        <p className="text-xl font-bold text-gray-800">{s.value ?? '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-100 mb-4">
                {['overview', 'failed'].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`text-sm font-medium pb-2 capitalize ${tab === t ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-400'}`}>
                        {t === 'failed' && failedLogs.length > 0 ? `Failed (${failedLogs.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3 text-sm">
                    <div><span className="text-xs text-gray-400 mr-2">List:</span>{campaign.list_name}</div>
                    <div><span className="text-xs text-gray-400 mr-2">Template:</span>{campaign.template_name}</div>
                    {campaign.template_body && (
                        <div className="bg-gray-50 rounded-xl p-3 text-gray-700">{campaign.template_body}</div>
                    )}
                    {campaign.sent_at && (
                        <div><span className="text-xs text-gray-400 mr-2">Sent:</span>{new Date(campaign.sent_at).toLocaleString('en-IN')}</div>
                    )}
                </div>
            )}

            {tab === 'failed' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                    {failedLogs.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">No failed sends.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">Name</th>
                                    <th className="px-4 py-3 text-left">Phone</th>
                                    <th className="px-4 py-3 text-left">Company</th>
                                    <th className="px-4 py-3 text-left">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {failedLogs.map(f => (
                                    <tr key={f.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-700">{f.full_name || '—'}</td>
                                        <td className="px-4 py-3 text-gray-600">{f.whatsapp_number || f.phone || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500">{f.company_name || '—'}</td>
                                        <td className="px-4 py-3 text-red-500 text-xs">{f.error_message || 'Unknown error'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

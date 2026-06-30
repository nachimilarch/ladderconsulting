import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { waCampaignAPI } from '../../api/outreach';

const STATUS_COLORS = {
    draft:'bg-gray-100 text-gray-600', sending:'bg-blue-100 text-blue-700',
    sent:'bg-green-100 text-green-700', paused:'bg-yellow-100 text-yellow-700',
    failed:'bg-red-100 text-red-700',
};

export default function WhatsAppCampaignDetail() {
    const { id } = useParams();
    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading]   = useState(true);

    const fetch = () => {
        waCampaignAPI.getOne(id)
            .then(r => setCampaign(r.data.data))
            .catch(() => toast.error('Failed to load campaign'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetch(); }, [id]);

    useEffect(() => {
        if (campaign?.status !== 'sending') return;
        const t = setTimeout(fetch, 10000);
        return () => clearTimeout(t);
    }, [campaign]);

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

            {campaign.status === 'draft' && (
                <button onClick={handleSend} className="mb-4 bg-green-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-green-700 transition">
                    Send Now
                </button>
            )}

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

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3 text-sm">
                <div><span className="text-xs text-gray-400">List:</span> {campaign.list_name}</div>
                <div><span className="text-xs text-gray-400">Template:</span> {campaign.template_name}</div>
                {campaign.template_body && (
                    <div className="bg-gray-50 rounded-xl p-3 text-gray-700">{campaign.template_body}</div>
                )}
                {campaign.sent_at && <div><span className="text-xs text-gray-400">Sent:</span> {new Date(campaign.sent_at).toLocaleString('en-IN')}</div>}
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { waCampaignAPI } from '../../api/outreach';

const STATUS_COLORS = {
    draft:'bg-gray-100 text-gray-600', sending:'bg-blue-100 text-blue-700',
    sent:'bg-green-100 text-green-700', paused:'bg-yellow-100 text-yellow-700',
    failed:'bg-red-100 text-red-700',
};

export default function WhatsAppCampaigns() {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading]     = useState(true);

    const fetch = () => {
        setLoading(true);
        waCampaignAPI.getAll()
            .then(r => setCampaigns(r.data.data || []))
            .catch(() => toast.error('Failed to load campaigns'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetch(); }, []);

    useEffect(() => {
        const hasSending = campaigns.some(c => c.status === 'sending');
        if (!hasSending) return;
        const t = setTimeout(fetch, 10000);
        return () => clearTimeout(t);
    }, [campaigns]);

    const handleSend = async (id) => {
        if (!confirm('Send this WhatsApp campaign?')) return;
        try {
            await waCampaignAPI.send(id);
            toast.success('Send started!'); fetch();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Send failed');
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">WhatsApp Campaigns</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Bulk WhatsApp outreach using Meta templates</p>
                </div>
                <div className="flex gap-2">
                    <Link to="/outreach/whatsapp/templates" className="border border-gray-200 text-sm px-3 py-2 rounded-xl hover:bg-gray-50 transition">
                        Manage Templates
                    </Link>
                    <Link to="/outreach/whatsapp/new" className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-700 transition">
                        + New Campaign
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
            ) : campaigns.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <p className="text-gray-400 text-sm">No WhatsApp campaigns yet.</p>
                    <Link to="/outreach/whatsapp/new" className="mt-3 inline-block text-sm font-medium text-green-600 hover:underline">
                        Create first campaign →
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="divide-y divide-gray-50">
                        {campaigns.map(c => (
                            <div key={c.id} className="px-6 py-4 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-800">{c.campaign_name}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">Template: {c.template_name} · List: {c.list_name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{c.sent_count}/{c.total_recipients} sent · {c.reply_count} replies</p>
                                </div>
                                <div className="flex items-center gap-3 ml-4 shrink-0">
                                    <Link to={`/outreach/whatsapp/${c.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                                    {c.status === 'draft' && (
                                        <button onClick={() => handleSend(c.id)} className="text-xs text-green-600 hover:underline">Send</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

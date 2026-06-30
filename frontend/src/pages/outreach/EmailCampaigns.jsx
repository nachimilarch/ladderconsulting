import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { emailCampaignAPI } from '../../api/outreach';

const STATUS_COLORS = {
    draft:     'bg-gray-100 text-gray-600',
    sending:   'bg-blue-100 text-blue-700',
    sent:      'bg-green-100 text-green-700',
    paused:    'bg-yellow-100 text-yellow-700',
    failed:    'bg-red-100 text-red-700',
    scheduled: 'bg-purple-100 text-purple-700',
};

export default function EmailCampaigns() {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading]     = useState(true);

    const fetch = () => {
        setLoading(true);
        emailCampaignAPI.getAll()
            .then(r => setCampaigns(r.data.data || []))
            .catch(() => toast.error('Failed to load campaigns'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetch(); }, []);

    // Re-poll active sends every 10s
    useEffect(() => {
        const hasSending = campaigns.some(c => c.status === 'sending');
        if (!hasSending) return;
        const t = setTimeout(fetch, 10000);
        return () => clearTimeout(t);
    }, [campaigns]);

    const handlePause = async (id) => {
        try {
            await emailCampaignAPI.pause(id);
            toast.success('Campaign paused');
            fetch();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to pause');
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete draft campaign "${name}"?`)) return;
        try {
            await emailCampaignAPI.remove(id);
            toast.success('Campaign deleted');
            fetch();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete');
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Email Campaigns</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Bulk cold email outreach campaigns</p>
                </div>
                <Link to="/outreach/email/new"
                    className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-700 transition">
                    + New Campaign
                </Link>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
            ) : campaigns.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <p className="text-gray-400 text-sm">No email campaigns yet.</p>
                    <Link to="/outreach/email/new" className="mt-3 inline-block text-sm font-medium text-green-600 hover:underline">
                        Create your first campaign →
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="divide-y divide-gray-50">
                        {campaigns.map(c => (
                            <div key={c.id} className="px-6 py-4 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-semibold text-gray-800">{c.campaign_name}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                                        {c.status === 'sending' && (
                                            <span className="text-xs text-blue-500 animate-pulse">● Sending…</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5 truncate">{c.subject}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        List: {c.list_name} · {c.sent_count}/{c.total_recipients} sent · {c.reply_count} replies
                                        {c.sent_at && ` · ${new Date(c.sent_at).toLocaleDateString('en-IN')}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 ml-4 shrink-0">
                                    <Link to={`/outreach/email/${c.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                                    {c.status === 'sending' && (
                                        <button onClick={() => handlePause(c.id)} className="text-xs text-yellow-600 hover:underline">Pause</button>
                                    )}
                                    {['draft','scheduled'].includes(c.status) && (
                                        <>
                                            <Link to={`/outreach/email/new?edit=${c.id}`} className="text-xs text-gray-500 hover:underline">Edit</Link>
                                            <button onClick={() => handleDelete(c.id, c.campaign_name)} className="text-xs text-red-500 hover:underline">Delete</button>
                                        </>
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

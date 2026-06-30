import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { emailCampaignAPI, replyAPI } from '../../api/outreach';

const STATUS_COLORS = {
    draft:'bg-gray-100 text-gray-600', sending:'bg-blue-100 text-blue-700',
    sent:'bg-green-100 text-green-700', paused:'bg-yellow-100 text-yellow-700',
    failed:'bg-red-100 text-red-700', scheduled:'bg-purple-100 text-purple-700',
};
const REPLY_STATUS_COLORS = {
    unread:'bg-yellow-100 text-yellow-700', read:'bg-gray-100 text-gray-600',
    replied:'bg-blue-100 text-blue-700', converted:'bg-green-100 text-green-700',
    ignored:'bg-red-50 text-red-400',
};

export default function EmailCampaignDetail() {
    const { id }     = useParams();
    const navigate   = useNavigate();
    const [campaign, setCampaign]   = useState(null);
    const [replies, setReplies]     = useState([]);
    const [tab, setTab]             = useState('overview');
    const [loading, setLoading]     = useState(true);

    const fetch = () => {
        emailCampaignAPI.getOne(id)
            .then(r => setCampaign(r.data.data))
            .catch(() => toast.error('Failed to load campaign'))
            .finally(() => setLoading(false));
        replyAPI.getAll({ campaign_id: id })
            .then(r => setReplies(r.data.data || []))
            .catch(() => {});
    };

    useEffect(() => { fetch(); }, [id]);

    // Poll while sending
    useEffect(() => {
        if (campaign?.status !== 'sending') return;
        const t = setTimeout(fetch, 8000);
        return () => clearTimeout(t);
    }, [campaign]);

    const handleSend = async () => {
        if (!confirm('Send this campaign?')) return;
        try {
            await emailCampaignAPI.send(id);
            toast.success('Sending started!');
            fetch();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Send failed');
        }
    };

    const handlePause = async () => {
        try {
            await emailCampaignAPI.pause(id);
            toast.success('Campaign paused');
            fetch();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Pause failed');
        }
    };

    if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>;
    if (!campaign) return <div className="text-center py-12 text-gray-400">Campaign not found.</div>;

    const stats = campaign.stats || {};
    const convRate = stats.total > 0 ? Math.round((stats.replied / stats.total) * 100) : 0;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
                <Link to="/outreach/email" className="text-sm text-gray-400 hover:text-gray-600">← Campaigns</Link>
                <span className="text-gray-300">/</span>
                <h2 className="text-xl font-bold text-gray-800 flex-1 truncate">{campaign.campaign_name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[campaign.status]}`}>{campaign.status}</span>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
                {['draft','scheduled'].includes(campaign.status) && (
                    <>
                        <button onClick={handleSend}
                            className="bg-green-600 text-white text-sm px-4 py-1.5 rounded-xl hover:bg-green-700 transition">Send Now</button>
                        <Link to={`/outreach/email/new?edit=${id}`}
                            className="border border-gray-300 text-sm px-4 py-1.5 rounded-xl hover:bg-gray-50 transition">Edit</Link>
                    </>
                )}
                {campaign.status === 'sending' && (
                    <button onClick={handlePause}
                        className="bg-yellow-500 text-white text-sm px-4 py-1.5 rounded-xl hover:bg-yellow-600 transition">Pause</button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total Sent',   value: stats.sent    || 0 },
                    { label: 'Failed',       value: stats.failed  || 0 },
                    { label: 'Replies',      value: stats.replied || 0 },
                    { label: 'Reply Rate',   value: `${convRate}%` },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                        <p className="text-xl font-bold text-gray-800">{s.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-100 mb-4">
                {['overview','replies'].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`text-sm font-medium pb-2 capitalize ${tab === t ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-400'}`}>
                        {t} {t === 'replies' && replies.length > 0 && `(${replies.length})`}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3 text-sm">
                    <div><span className="text-xs text-gray-400 mr-2">Subject:</span>{campaign.subject}</div>
                    <div><span className="text-xs text-gray-400 mr-2">List:</span>{campaign.list_name}</div>
                    <div><span className="text-xs text-gray-400 mr-2">From:</span>{campaign.from_name} &lt;{campaign.from_email}&gt;</div>
                    {campaign.sent_at && <div><span className="text-xs text-gray-400 mr-2">Sent:</span>{new Date(campaign.sent_at).toLocaleString('en-IN')}</div>}
                    <div className="pt-3 border-t border-gray-50">
                        <p className="text-xs text-gray-400 mb-2">Email Body Preview:</p>
                        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                            {campaign.message_body}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'replies' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    {replies.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">No replies yet.</p>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {replies.map(r => (
                                <Link key={r.id} to={`/outreach/replies/${r.id}`}
                                    className="block px-5 py-3 hover:bg-gray-50 transition">
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-800">{r.from_name || r.from_email}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">{r.subject}</p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4 shrink-0">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${REPLY_STATUS_COLORS[r.reply_status]}`}>{r.reply_status}</span>
                                            <span className="text-xs text-gray-400">{new Date(r.received_at).toLocaleDateString('en-IN')}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

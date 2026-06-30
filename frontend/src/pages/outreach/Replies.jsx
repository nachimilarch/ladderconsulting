import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { replyAPI } from '../../api/outreach';

const STATUS_COLORS = {
    unread: 'bg-yellow-100 text-yellow-700',
    read:   'bg-gray-100 text-gray-600',
    replied:'bg-blue-100 text-blue-700',
    converted:'bg-green-100 text-green-700',
    ignored:'bg-red-50 text-red-400',
};

export default function Replies() {
    const [replies, setReplies]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [total, setTotal]       = useState(0);
    const [page, setPage]         = useState(1);
    const [status, setStatus]     = useState('');
    const [channel, setChannel]   = useState('');
    const LIMIT = 20;

    const fetch = (p = 1) => {
        setLoading(true);
        replyAPI.getAll({ page: p, limit: LIMIT, status: status || undefined, channel: channel || undefined })
            .then(r => { setReplies(r.data.data || []); setTotal(r.data.total || 0); })
            .catch(() => toast.error('Failed to load replies'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { setPage(1); fetch(1); }, [status, channel]);

    const unreadCount = replies.filter(r => r.reply_status === 'unread').length;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">
                        Replies Inbox
                        {unreadCount > 0 && <span className="ml-2 text-sm bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{unreadCount} unread</span>}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">Email and WhatsApp replies from your campaigns</p>
                </div>
            </div>

            <div className="flex gap-3 mb-4 flex-wrap">
                <select value={status} onChange={e => setStatus(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                    <option value="">All Statuses</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                    <option value="replied">Replied</option>
                    <option value="converted">Converted</option>
                    <option value="ignored">Ignored</option>
                </select>
                <select value={channel} onChange={e => setChannel(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                    <option value="">All Channels</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                </select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
            ) : replies.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <p className="text-gray-400 text-sm">No replies found.</p>
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="divide-y divide-gray-50">
                            {replies.map(r => (
                                <Link key={r.id} to={`/outreach/replies/${r.id}`}
                                    className={`block px-5 py-3 hover:bg-gray-50 transition ${r.reply_status === 'unread' ? 'bg-yellow-50/30' : ''}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                {r.reply_status === 'unread' && <span className="w-2 h-2 bg-yellow-400 rounded-full shrink-0"></span>}
                                                <p className={`text-sm font-medium text-gray-800 ${r.reply_status === 'unread' ? 'font-semibold' : ''}`}>
                                                    {r.from_name || r.from_email || r.from_phone || 'Unknown'}
                                                </p>
                                                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded capitalize">{r.channel}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">{r.subject || r.body_text?.slice(0, 80) || '(no subject)'}</p>
                                            {r.campaign_name && <p className="text-xs text-gray-400 mt-0.5">Campaign: {r.campaign_name}</p>}
                                        </div>
                                        <div className="flex items-center gap-2 ml-4 shrink-0">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.reply_status]}`}>{r.reply_status}</span>
                                            <span className="text-xs text-gray-400">{new Date(r.received_at).toLocaleDateString('en-IN')}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {total > LIMIT && (
                        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                            <span>{(page-1)*LIMIT+1}–{Math.min(page*LIMIT,total)} of {total}</span>
                            <div className="flex gap-2">
                                <button disabled={page===1} onClick={() => { setPage(p => p-1); fetch(page-1); }}
                                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40">Prev</button>
                                <button disabled={page*LIMIT>=total} onClick={() => { setPage(p => p+1); fetch(page+1); }}
                                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40">Next</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

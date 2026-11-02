import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { replyAPI } from '../../api/outreach';
import { outreachAiAPI } from '../../api/outreachAi';
import { IntentBadge } from '../../components/outreach/ai/RepliesTab';

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
    // Filters and page live in the URL, so coming back from a message keeps them.
    const [sp, setSp]             = useSearchParams();
    const status  = sp.get('status')  || '';
    const channel = sp.get('channel') || '';
    const page    = Math.max(1, parseInt(sp.get('page'), 10) || 1);
    const update = (changes) => setSp(prev => {
        const n = new URLSearchParams(prev);
        Object.entries(changes).forEach(([k, v]) => { if (v && v !== 1) n.set(k, v); else n.delete(k); });
        return n;
    }, { replace: true });
    const scrollKey = 'outreach-replies-scroll';
    const restored = useRef(false);
    const [triage, setTriage]     = useState({});
    const LIMIT = 20;

    const load = () => {
        setLoading(true);
        replyAPI.getAll({ page, limit: LIMIT, status: status || undefined, channel: channel || undefined })
            .then(r => {
                const rows = r.data.data || [];
                setReplies(rows); setTotal(r.data.total || 0);
                const emailIds = rows.filter(x => x.channel === 'email').map(x => x.id);
                if (emailIds.length) outreachAiAPI.triage(emailIds).then(t => setTriage(t.data.data || {})).catch(() => {});
            })
            .catch(() => toast.error('Failed to load replies'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [status, channel, page]); // eslint-disable-line react-hooks/exhaustive-deps

    // Put the list back where it was after returning from a message.
    useEffect(() => {
        if (loading || restored.current) return;
        restored.current = true;
        const y = Number(sessionStorage.getItem(scrollKey));
        const main = document.querySelector('main');
        if (y && main) main.scrollTop = y;
    }, [loading]);
    const rememberScroll = () => {
        const main = document.querySelector('main');
        if (main) sessionStorage.setItem(scrollKey, String(main.scrollTop));
    };

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
                <Link to="/outreach/ai?tab=replies" className="text-sm font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-xl px-3.5 py-1.5 hover:bg-brand-100 transition">✨ Sort by what matters</Link>
            </div>

            <div className="flex gap-3 mb-4 flex-wrap">
                <select value={status} onChange={e => { sessionStorage.removeItem(scrollKey); update({ status: e.target.value, page: 1 }); }}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                    <option value="">All Statuses</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                    <option value="replied">Replied</option>
                    <option value="converted">Converted</option>
                    <option value="ignored">Ignored</option>
                </select>
                <select value={channel} onChange={e => { sessionStorage.removeItem(scrollKey); update({ channel: e.target.value, page: 1 }); }}
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
                                <Link key={r.id} to={`/outreach/replies/${r.id}`} onClick={rememberScroll}
                                    className={`block px-5 py-3 hover:bg-gray-50 transition ${r.reply_status === 'unread' ? 'bg-yellow-50/30' : ''}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                {r.reply_status === 'unread' && <span className="w-2 h-2 bg-yellow-400 rounded-full shrink-0"></span>}
                                                <p className={`text-sm font-medium text-gray-800 ${r.reply_status === 'unread' ? 'font-semibold' : ''}`}>
                                                    {r.from_name || r.contact_name || r.from_email || r.from_phone || 'Unknown'}
                                                </p>
                                                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded capitalize">{r.channel}</span>
                                                {r.channel === 'whatsapp' && (r.from_name || r.contact_name) && <span className="text-xs text-gray-400">{r.from_phone}</span>}
                                                <IntentBadge triage={triage[r.id]} />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                                                {r.channel === 'whatsapp' && (r.has_media || (r.msg_type && r.msg_type !== 'text') || r.body_text === '[unsupported]') && <span aria-hidden="true">📎 </span>}
                                                {r.subject || (r.body_text === '[unsupported]' ? 'Attachment' : r.body_text?.slice(0, 80)) || '(no subject)'}
                                            </p>
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
                                <button disabled={page===1} onClick={() => { sessionStorage.removeItem(scrollKey); update({ page: page-1 }); }}
                                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40">Prev</button>
                                <button disabled={page*LIMIT>=total} onClick={() => { sessionStorage.removeItem(scrollKey); update({ page: page+1 }); }}
                                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40">Next</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

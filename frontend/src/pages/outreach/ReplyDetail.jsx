import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { replyAPI } from '../../api/outreach';
import { useAuth } from '../../context/AuthContext';

export default function ReplyDetail() {
    const { id }    = useParams();
    const navigate  = useNavigate();
    const { user }  = useAuth();
    const isAdmin   = user?.role === 'admin';

    const [reply, setReply]     = useState(null);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [converting, setConverting] = useState(false);

    useEffect(() => {
        replyAPI.getOne(id)
            .then(r => setReply(r.data.data))
            .catch(() => toast.error('Failed to load reply'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return toast.error('Reply cannot be empty');
        setSending(true);
        try {
            await replyAPI.reply(id, { body_text: replyText, body_html: `<p>${replyText.replace(/\n/g,'<br>')}</p>` });
            toast.success('Reply sent');
            setReplyText('');
            setReply(r => ({ ...r, reply_status: 'replied' }));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send reply');
        } finally {
            setSending(false);
        }
    };

    const handleConvert = async () => {
        if (!confirm('Convert this contact to a lead in the pipeline?')) return;
        setConverting(true);
        try {
            const r = await replyAPI.convert(id);
            toast.success('Lead created!');
            navigate(`/hr/leads/${r.data.lead_id}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Conversion failed');
        } finally {
            setConverting(false);
        }
    };

    const handleIgnore = async () => {
        try {
            await replyAPI.ignore(id);
            toast.success('Marked as ignored');
            setReply(r => ({ ...r, reply_status: 'ignored' }));
        } catch {
            toast.error('Failed');
        }
    };

    if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>;
    if (!reply)  return <div className="text-center py-12 text-gray-400">Reply not found.</div>;

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <Link to="/outreach/replies" className="text-sm text-gray-400 hover:text-gray-600">← Replies</Link>
                <span className="text-gray-300">/</span>
                <h2 className="text-xl font-bold text-gray-800 flex-1 truncate">
                    {reply.from_name || reply.from_email || reply.from_phone}
                </h2>
            </div>

            {/* Reply header */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div><span className="text-xs text-gray-400">From:</span> <span className="font-medium">{reply.from_name} &lt;{reply.from_email || reply.from_phone}&gt;</span></div>
                    <div><span className="text-xs text-gray-400">Channel:</span> <span className="capitalize">{reply.channel}</span></div>
                    <div><span className="text-xs text-gray-400">Received:</span> {new Date(reply.received_at).toLocaleString('en-IN')}</div>
                    <div><span className="text-xs text-gray-400">Status:</span> <span className="capitalize">{reply.reply_status}</span></div>
                    {reply.campaign_name && <div className="col-span-2"><span className="text-xs text-gray-400">Campaign:</span> {reply.campaign_name}</div>}
                    {reply.subject && <div className="col-span-2"><span className="text-xs text-gray-400">Subject:</span> {reply.subject}</div>}
                </div>

                <div className="border-t border-gray-50 pt-4">
                    <p className="text-xs text-gray-400 mb-2">Message:</p>
                    {reply.body_html ? (
                        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 max-h-64 overflow-y-auto"
                            dangerouslySetInnerHTML={{ __html: reply.body_html }} />
                    ) : (
                        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {reply.body_text || '(no body)'}
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            {!['converted','ignored'].includes(reply.reply_status) && (
                <div className="flex gap-2 mb-4 flex-wrap">
                    {reply.contact_id && (
                        <button onClick={handleConvert} disabled={converting}
                            className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                            {converting ? 'Converting…' : 'Convert to Lead'}
                        </button>
                    )}
                    <button onClick={handleIgnore}
                        className="border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-xl hover:bg-gray-50 transition">
                        Ignore
                    </button>
                    {reply.lead_id && (
                        <Link to={`/hr/leads/${reply.lead_id}`}
                            className="border border-blue-200 text-blue-600 text-sm px-4 py-2 rounded-xl hover:bg-blue-50 transition">
                            View Lead →
                        </Link>
                    )}
                </div>
            )}

            {/* Reply composer — only for email channel */}
            {reply.channel === 'email' && !['ignored'].includes(reply.reply_status) && (
                <form onSubmit={handleSendReply} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-3 text-sm">Send Reply</h3>
                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={5}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-y"
                        placeholder="Type your reply here…" />
                    <div className="flex justify-end mt-3">
                        <button type="submit" disabled={sending}
                            className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                            {sending ? 'Sending…' : 'Send Reply'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

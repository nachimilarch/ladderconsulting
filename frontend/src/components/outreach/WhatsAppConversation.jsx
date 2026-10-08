import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { replyAPI, whatsappMediaUrl } from '../../api/outreach';

const MAX_MB = 10;
const ACCEPT = 'image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

const TYPE_LABEL = { image: 'Image', document: 'Document', audio: 'Voice or audio message', video: 'Video', sticker: 'Sticker',
    location: 'Location', contacts: 'Shared contact', contact: 'Shared contact', reaction: 'Reaction', unsupported: 'Attachment' };

const fmtSize = (n) => (!n ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// The file (or note about a file) inside one message bubble.
function Attachment({ m }) {
    const kind = m.msg_type || '';
    const dir = m.direction;
    if (m.has_media) {
        const src = whatsappMediaUrl(dir, m.id);
        const name = m.media_filename || 'file';
        if ((m.media_mime || '').startsWith('image/')) {
            return (
                <a href={src} target="_blank" rel="noreferrer" className="block mb-1.5">
                    <img src={src} alt={name} loading="lazy" className="max-h-64 max-w-full rounded-lg object-cover" />
                </a>
            );
        }
        if ((m.media_mime || '').startsWith('audio/')) return <audio controls preload="none" src={src} className="mb-1.5 max-w-full" />;
        if ((m.media_mime || '').startsWith('video/')) return <video controls preload="none" src={src} className="mb-1.5 max-h-64 max-w-full rounded-lg" />;
        return (
            <a href={whatsappMediaUrl(dir, m.id, { download: true })} className="mb-1.5 flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm hover:bg-black/10">
                <span aria-hidden="true">📄</span>
                <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                <span className="shrink-0 text-xs opacity-70">{fmtSize(m.media_size)}</span>
            </a>
        );
    }
    // Sent by them but no file reached us: say so plainly instead of showing a bare placeholder.
    if (dir === 'in' && (kind && kind !== 'text')) {
        return (
            <p className="mb-1 rounded-lg bg-black/5 px-3 py-2 text-xs leading-5 text-gray-600">
                📎 {TYPE_LABEL[kind] || 'Attachment'} received. Our WhatsApp provider did not pass the file itself to us, so it can&apos;t be shown here. Open the chat in WhatsApp to view it.
            </p>
        );
    }
    return null;
}

function Bubble({ m, name }) {
    const mine = m.direction === 'out';
    const placeholderOnly = m.direction === 'in' && (m.body_text === '[unsupported]' || (m.msg_type && m.msg_type !== 'text' && /^\[[^\]]+\]$/.test(m.body_text || '')));
    const text = placeholderOnly ? '' : m.body_text;
    return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'rounded-br-md bg-green-100 text-gray-800' : 'rounded-bl-md bg-gray-100 text-gray-800'}`}>
                <Attachment m={placeholderOnly && !m.has_media && !m.msg_type ? { ...m, msg_type: 'unsupported' } : m} />
                {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
                <p className="mt-1 text-[10px] text-gray-400">
                    {mine ? (m.sent_by_name || 'You') : name} · {fmtTime(m.at)}
                </p>
            </div>
        </div>
    );
}

// WhatsApp conversation with a person: what they sent, what we sent, and a box to answer.
export default function WhatsAppConversation({ reply, onSent }) {
    const [thread, setThread] = useState(reply.thread || []);
    const [text, setText] = useState('');
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [sending, setSending] = useState(false);
    const fileRef = useRef(null);
    const endRef = useRef(null);

    const win = reply.window || {};
    const name = reply.from_name || reply.contact_name || reply.from_phone;

    useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread.length]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const pickFile = (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        if (f.size > MAX_MB * 1024 * 1024) { toast.error(`That file is larger than ${MAX_MB} MB.`); return; }
        setFile(f);
        setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    };
    const clearFile = () => { setFile(null); setPreview(null); };

    const send = async (e) => {
        e.preventDefault();
        if (!text.trim() && !file) return toast.error('Type a message or attach a file.');
        setSending(true);
        try {
            const fd = new FormData();
            if (text.trim()) fd.append('body_text', text.trim());
            if (file) fd.append('file', file);
            const r = await replyAPI.sendWhatsApp(reply.id, fd);
            setThread((t) => [...t, r.data.data]);
            setText(''); clearFile();
            toast.success('Sent on WhatsApp');
            onSent?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not send the message');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-gray-800 text-sm">WhatsApp conversation</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${win.open ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {win.open ? `Reply window open until ${fmtTime(win.expires_at)}` : 'Reply window closed'}
                </span>
            </div>

            <div className="px-4 py-4 space-y-2.5 max-h-[28rem] overflow-y-auto bg-white" aria-live="polite">
                {thread.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No messages yet.</p>}
                {thread.map((m) => <Bubble key={`${m.direction}-${m.id}`} m={m} name={name} />)}
                <div ref={endRef} />
            </div>

            {win.open ? (
                <form onSubmit={send} className="border-t border-gray-100 p-4">
                    {file && (
                        <div className="mb-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                            {preview ? <img src={preview} alt="" className="h-10 w-10 rounded object-cover" /> : <span aria-hidden="true">📎</span>}
                            <span className="min-w-0 flex-1 truncate">{file.name} <span className="text-xs text-gray-400">{fmtSize(file.size)}</span></span>
                            <button type="button" onClick={clearFile} className="text-gray-400 hover:text-gray-600" aria-label="Remove file">✕</button>
                        </div>
                    )}
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={3500}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-y"
                        placeholder={file ? 'Add a message to go with the file (optional)…' : 'Type your reply…'} />
                    <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <input ref={fileRef} type="file" accept={ACCEPT} onChange={pickFile} className="hidden" />
                            <button type="button" onClick={() => fileRef.current?.click()}
                                className="text-sm text-gray-600 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50">📎 Attach</button>
                            <span className="hidden sm:inline text-xs text-gray-400">Files up to {MAX_MB} MB are sent as a private link that works for 30 days.</span>
                        </div>
                        <button type="submit" disabled={sending}
                            className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                            {sending ? 'Sending…' : 'Send'}
                        </button>
                    </div>
                </form>
            ) : (
                <p className="border-t border-gray-100 bg-gray-50 px-5 py-4 text-sm text-gray-500">
                    WhatsApp only allows a free reply within 24 hours of {name}&apos;s last message. To start the conversation again, send them an approved template from a WhatsApp campaign.
                </p>
            )}
        </div>
    );
}

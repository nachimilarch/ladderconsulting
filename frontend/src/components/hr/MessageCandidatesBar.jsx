import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { recruitmentAPI } from '../../api/recruitment';

// Shown when candidates are ticked. Makes an Outreach contact list from them and opens the
// email or WhatsApp campaign composer with that list chosen. Nothing is sent from here.
export default function MessageCandidatesBar({ ids, onClear }) {
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    if (!ids.length) return null;

    const go = async (channel) => {
        setBusy(true);
        try {
            const r = await recruitmentAPI.createMessageList(ids);
            const d = r.data.data;
            const missing = channel === 'email' ? d.total - d.with_email : d.total - d.with_phone;
            if (missing > 0) toast(`${missing} of ${d.total} candidate${d.total === 1 ? ' has' : 's have'} no ${channel === 'email' ? 'email address' : 'phone number'} and will be skipped.`, { icon: 'ℹ️' });
            navigate(channel === 'email' ? `/outreach/email/new?list=${d.list_id}` : `/outreach/whatsapp/new?list=${d.list_id}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not prepare the message.');
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 mb-4">
            <span className="text-sm font-medium text-indigo-800">{ids.length} selected</span>
            <button disabled={busy} onClick={() => go('email')} className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">✉️ Send email</button>
            <button disabled={busy} onClick={() => go('whatsapp')} className="text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">💬 Send WhatsApp</button>
            <button disabled={busy} onClick={onClear} className="text-sm text-gray-500 hover:underline ml-auto">Clear</button>
            <p className="w-full text-xs text-indigo-700/70">You will review the message on the next screen before anything is sent.</p>
        </div>
    );
}

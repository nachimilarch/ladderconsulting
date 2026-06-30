import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { outreachCallAPI, contactListAPI } from '../../api/outreach';

const OUTCOMES = ['no_answer','voicemail','callback_scheduled','interested','not_interested','converted'];
const OUTCOME_COLORS = {
    no_answer:'bg-gray-100 text-gray-600', voicemail:'bg-blue-50 text-blue-600',
    callback_scheduled:'bg-yellow-100 text-yellow-700', interested:'bg-green-100 text-green-700',
    not_interested:'bg-red-50 text-red-500', converted:'bg-green-600 text-white',
};
const EMPTY_FORM = { contact_id:'', campaign_id:'', outcome:'', notes:'', callback_at:'', called_at:'', duration_secs:'' };

export default function OutreachCalls() {
    const [calls, setCalls]         = useState([]);
    const [contacts, setContacts]   = useState([]);
    const [total, setTotal]         = useState(0);
    const [page, setPage]           = useState(1);
    const [loading, setLoading]     = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showForm, setShowForm]   = useState(false);
    const [form, setForm]           = useState(EMPTY_FORM);
    const [outcome, setOutcomeFilter] = useState('');
    const [listId, setListId]       = useState('');
    const [lists, setLists]         = useState([]);
    const LIMIT = 20;

    const fetchCalls = (p = 1) => {
        setLoading(true);
        outreachCallAPI.getAll({ page: p, limit: LIMIT, outcome: outcome || undefined })
            .then(r => { setCalls(r.data.data || []); setTotal(r.data.total || 0); })
            .catch(() => toast.error('Failed to load calls'))
            .finally(() => setLoading(false));
    };

    const fetchContacts = (lid) => {
        if (!lid) { setContacts([]); return; }
        contactListAPI.getContacts(lid, { limit: 200 })
            .then(r => setContacts(r.data.data || []))
            .catch(() => {});
    };

    useEffect(() => {
        setPage(1); fetchCalls(1);
        contactListAPI.getAll().then(r => setLists(r.data.data || [])).catch(() => {});
    }, [outcome]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.contact_id || !form.outcome) return toast.error('Contact and outcome required');
        setSubmitting(true);
        try {
            await outreachCallAPI.log({
                contact_id:   parseInt(form.contact_id),
                outcome:      form.outcome,
                notes:        form.notes || undefined,
                callback_at:  form.callback_at || undefined,
                called_at:    form.called_at || undefined,
                duration_secs: form.duration_secs ? parseInt(form.duration_secs) : undefined,
            });
            toast.success('Call logged');
            setShowForm(false);
            setForm(EMPTY_FORM);
            fetchCalls(1);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to log call');
        } finally {
            setSubmitting(false);
        }
    };

    const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Cold Call Tracker</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Log manual cold calls against outreach contacts</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-700 transition">
                    + Log Call
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-gray-800">Log a Cold Call</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Contact List (to find contact)</label>
                            <select value={listId} onChange={e => { setListId(e.target.value); fetchContacts(e.target.value); setForm(f => ({ ...f, contact_id: '' })); }}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                                <option value="">— Select list —</option>
                                {lists.map(l => <option key={l.id} value={l.id}>{l.list_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Contact *</label>
                            <select value={form.contact_id} onChange={set('contact_id')}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                                <option value="">— Select contact —</option>
                                {contacts.map(c => (
                                    <option key={c.id} value={c.id}>{c.full_name || c.email || c.phone} {c.company_name ? `— ${c.company_name}` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Outcome *</label>
                            <select value={form.outcome} onChange={set('outcome')}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                                <option value="">— Select outcome —</option>
                                {OUTCOMES.map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Duration (seconds)</label>
                            <input type="number" min="0" value={form.duration_secs} onChange={set('duration_secs')}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                                placeholder="0" />
                        </div>
                        {form.outcome === 'callback_scheduled' && (
                            <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">Callback At *</label>
                                <input type="datetime-local" value={form.callback_at} onChange={set('callback_at')}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Called At</label>
                            <input type="datetime-local" value={form.called_at} onChange={set('called_at')}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
                        <textarea value={form.notes} onChange={set('notes')} rows={2}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none" />
                    </div>
                    <div className="flex gap-3">
                        <button type="submit" disabled={submitting}
                            className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                            {submitting ? 'Saving…' : 'Log Call'}
                        </button>
                        <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                            className="text-sm text-gray-500 hover:underline px-4">Cancel</button>
                    </div>
                </form>
            )}

            <div className="flex gap-3 mb-4">
                <select value={outcome} onChange={e => setOutcomeFilter(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                    <option value="">All Outcomes</option>
                    {OUTCOMES.map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
            ) : calls.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <p className="text-gray-400 text-sm">No cold calls logged yet.</p>
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                <tr>
                                    <th className="text-left px-4 py-3">Contact</th>
                                    <th className="text-left px-4 py-3">Company</th>
                                    <th className="text-left px-4 py-3">Outcome</th>
                                    <th className="text-left px-4 py-3">Called</th>
                                    <th className="text-left px-4 py-3">Lead</th>
                                    <th className="text-left px-4 py-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {calls.map(c => (
                                    <tr key={c.id}>
                                        <td className="px-4 py-2.5 font-medium text-gray-800">{c.contact_name || '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{c.company_name || '—'}</td>
                                        <td className="px-4 py-2.5">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OUTCOME_COLORS[c.outcome]}`}>
                                                {c.outcome.replace(/_/g,' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                                            {new Date(c.called_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {c.lead_id
                                                ? <a href={`/hr/leads/${c.lead_id}`} className="text-xs text-blue-600 hover:underline">Lead #{c.lead_id}</a>
                                                : <span className="text-xs text-gray-300">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-400 text-xs max-w-xs truncate">{c.notes || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {total > LIMIT && (
                        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                            <span>{(page-1)*LIMIT+1}–{Math.min(page*LIMIT,total)} of {total}</span>
                            <div className="flex gap-2">
                                <button disabled={page===1} onClick={() => { setPage(p=>p-1); fetchCalls(page-1); }}
                                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40">Prev</button>
                                <button disabled={page*LIMIT>=total} onClick={() => { setPage(p=>p+1); fetchCalls(page+1); }}
                                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40">Next</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

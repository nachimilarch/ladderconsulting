import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { contactListAPI } from '../../api/outreach';

export default function ContactListDetail() {
    const { id } = useParams();
    const [list, setList]       = useState(null);
    const [contacts, setContacts] = useState([]);
    const [total, setTotal]     = useState(0);
    const [page, setPage]       = useState(1);
    const [search, setSearch]   = useState('');
    const [loading, setLoading] = useState(true);
    const LIMIT = 50;

    const fetchList = () =>
        contactListAPI.getOne(id).then(r => setList(r.data.data));

    const fetchContacts = (p = 1, s = '') => {
        setLoading(true);
        contactListAPI.getContacts(id, { page: p, limit: LIMIT, search: s })
            .then(r => { setContacts(r.data.data || []); setTotal(r.data.total || 0); })
            .catch(() => toast.error('Failed to load contacts'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchList();
        fetchContacts(1, '');
    }, [id]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchContacts(1, search);
    };

    const handleUnsubscribe = async (contactId) => {
        try {
            await contactListAPI.unsubscribe(contactId);
            toast.success('Contact unsubscribed');
            fetchContacts(page, search);
        } catch {
            toast.error('Failed to unsubscribe');
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <Link to="/outreach/lists" className="text-sm text-gray-400 hover:text-gray-600">← Lists</Link>
                <span className="text-gray-300">/</span>
                <h2 className="text-xl font-bold text-gray-800">{list?.list_name || '…'}</h2>
            </div>

            {list && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><p className="text-xs text-gray-400">Total Contacts</p><p className="font-bold text-gray-800">{list.imported_contacts}</p></div>
                    <div><p className="text-xs text-gray-400">Failed Rows</p><p className="font-bold text-gray-800">{list.failed_rows}</p></div>
                    <div><p className="text-xs text-gray-400">Status</p><p className="font-bold text-gray-800 capitalize">{list.import_status}</p></div>
                    <div><p className="text-xs text-gray-400">File</p><p className="font-bold text-gray-800 truncate">{list.file_name || '—'}</p></div>
                </div>
            )}

            <form onSubmit={handleSearch} className="flex gap-3 mb-4">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, email, or company…"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500" />
                <button type="submit" className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-green-700 transition">
                    Search
                </button>
            </form>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
            ) : (
                <>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                <tr>
                                    <th className="text-left px-4 py-3">Name</th>
                                    <th className="text-left px-4 py-3">Email</th>
                                    <th className="text-left px-4 py-3">Phone</th>
                                    <th className="text-left px-4 py-3">Company</th>
                                    <th className="text-left px-4 py-3">Lead</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {contacts.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No contacts found</td></tr>
                                ) : contacts.map(c => (
                                    <tr key={c.id} className={c.is_unsubscribed ? 'opacity-40' : ''}>
                                        <td className="px-4 py-2.5 font-medium text-gray-800">{c.full_name || '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{c.email || '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{c.phone || '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{c.company_name || '—'}</td>
                                        <td className="px-4 py-2.5">
                                            {c.lead_id
                                                ? <Link to={`/hr/leads/${c.lead_id}`} className="text-xs text-blue-600 hover:underline">Lead #{c.lead_id}</Link>
                                                : <span className="text-xs text-gray-300">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {!c.is_unsubscribed && (
                                                <button onClick={() => handleUnsubscribe(c.id)}
                                                    className="text-xs text-red-400 hover:underline">Unsub</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {total > LIMIT && (
                        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                            <span>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</span>
                            <div className="flex gap-2">
                                <button disabled={page === 1} onClick={() => { setPage(p => p - 1); fetchContacts(page - 1, search); }}
                                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40">Prev</button>
                                <button disabled={page * LIMIT >= total} onClick={() => { setPage(p => p + 1); fetchContacts(page + 1, search); }}
                                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40">Next</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

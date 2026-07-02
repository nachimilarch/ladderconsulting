import { useEffect, useState } from 'react';
import { hrCompanyAPI } from '../../api/hr';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const INDUSTRY_COLORS = {
    'Technology': 'bg-blue-50 text-blue-700',
    'Finance': 'bg-green-50 text-green-700',
    'Healthcare': 'bg-red-50 text-red-700',
    'Education': 'bg-yellow-50 text-yellow-700',
    'Manufacturing': 'bg-orange-50 text-orange-700',
    'Retail': 'bg-purple-50 text-purple-700',
    'Consulting': 'bg-indigo-50 text-indigo-700',
};
const industryBadge = (industry) => {
    const cls = INDUSTRY_COLORS[industry] || 'bg-gray-100 text-gray-600';
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{industry || 'No industry set'}</span>;
};

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

export default function AssignedCompanies() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        hrCompanyAPI.list()
            .then(r => setCompanies(r.data?.data || []))
            .catch(() => toast.error('Failed to load companies'))
            .finally(() => setLoading(false));
    }, []);

    const filtered = companies.filter(c =>
        !search ||
        c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.contact_email?.toLowerCase().includes(search.toLowerCase()) ||
        c.industry?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                    {isAdmin ? 'All Companies' : 'My Companies'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                    {isAdmin
                        ? 'All approved companies on the platform'
                        : 'Companies assigned to you — click a card to see full contact details'}
                </p>
            </div>

            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by name, email, or industry…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                    {search ? 'No companies match your search.' : (isAdmin ? 'No approved companies yet.' : 'No companies assigned to you yet.')}
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(c => (
                        <div
                            key={c.id}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                        >
                            {/* Header row — always visible */}
                            <button
                                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
                                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                                        {c.company_name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-800 text-sm truncate">{c.company_name}</p>
                                        <p className="text-xs text-gray-400 truncate">{c.contact_email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-4">
                                    {industryBadge(c.industry)}
                                    {c.headquarters && (
                                        <span className="hidden sm:block text-xs text-gray-400">{c.headquarters}</span>
                                    )}
                                    <span className="text-gray-400 text-sm">{expanded === c.id ? '▲' : '▼'}</span>
                                </div>
                            </button>

                            {/* Expanded detail */}
                            {expanded === c.id && (
                                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        {/* Contact */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Contact</h4>
                                            <dl className="space-y-1 text-sm">
                                                <div className="flex gap-2">
                                                    <dt className="text-gray-400 w-24 shrink-0">Name</dt>
                                                    <dd className="text-gray-700 font-medium">{c.contact_name || '—'}</dd>
                                                </div>
                                                <div className="flex gap-2">
                                                    <dt className="text-gray-400 w-24 shrink-0">Email</dt>
                                                    <dd>
                                                        {c.contact_email
                                                            ? <a href={`mailto:${c.contact_email}`} className="text-indigo-600 hover:underline">{c.contact_email}</a>
                                                            : '—'}
                                                    </dd>
                                                </div>
                                                <div className="flex gap-2">
                                                    <dt className="text-gray-400 w-24 shrink-0">Phone</dt>
                                                    <dd>
                                                        {c.contact_phone
                                                            ? <a href={`tel:${c.contact_phone}`} className="text-indigo-600 hover:underline">{c.contact_phone}</a>
                                                            : <span className="text-gray-300 italic">Not provided</span>}
                                                    </dd>
                                                </div>
                                            </dl>
                                        </div>

                                        {/* Company info */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Company</h4>
                                            <dl className="space-y-1 text-sm">
                                                <div className="flex gap-2">
                                                    <dt className="text-gray-400 w-24 shrink-0">Size</dt>
                                                    <dd className="text-gray-700">{c.size || '—'}</dd>
                                                </div>
                                                <div className="flex gap-2">
                                                    <dt className="text-gray-400 w-24 shrink-0">Location</dt>
                                                    <dd className="text-gray-700">{c.headquarters || '—'}</dd>
                                                </div>
                                                <div className="flex gap-2">
                                                    <dt className="text-gray-400 w-24 shrink-0">Website</dt>
                                                    <dd>
                                                        {c.website
                                                            ? <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">{c.website}</a>
                                                            : '—'}
                                                    </dd>
                                                </div>
                                                {isAdmin && c.exec_name && (
                                                    <div className="flex gap-2">
                                                        <dt className="text-gray-400 w-24 shrink-0">Executive</dt>
                                                        <dd className="text-gray-700">{c.exec_name}</dd>
                                                    </div>
                                                )}
                                            </dl>
                                        </div>

                                        {/* Stats */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Activity</h4>
                                            <div className="flex gap-6 text-sm">
                                                <div>
                                                    <p className="text-xl font-bold text-indigo-600">{c.job_count ?? 0}</p>
                                                    <p className="text-xs text-gray-400">Job Postings</p>
                                                </div>
                                                <div>
                                                    <p className="text-xl font-bold text-indigo-600">{c.application_count ?? 0}</p>
                                                    <p className="text-xs text-gray-400">Applications</p>
                                                </div>
                                                {c.placement_fee_percent && (
                                                    <div>
                                                        <p className="text-xl font-bold text-green-600">{c.placement_fee_percent}%</p>
                                                        <p className="text-xs text-gray-400">Placement Rate</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* About */}
                                        {c.description && (
                                            <div>
                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">About</h4>
                                                <p className="text-sm text-gray-600 leading-relaxed">{c.description}</p>
                                            </div>
                                        )}
                                    </div>

                                    {c.executive_assigned_at && (
                                        <p className="text-xs text-gray-400 mt-3">
                                            Assigned to you on {fmtDate(c.executive_assigned_at)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

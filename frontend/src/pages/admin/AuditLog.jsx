import { useEffect, useState, useCallback } from 'react';
import { adminAuditAPI } from '../../api/admin';
import toast from 'react-hot-toast';

const PAGE_SIZE = 25;

const entityIcon = (type) => ({
    company: '🏢', candidate: '👤', staff: '👥', settings: '⚙️', training: '🎓',
}[type] || '📋');

export default function AuditLog() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [entityFilter, setEntityFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        const params = { limit: PAGE_SIZE, page };
        if (entityFilter) params.entity = entityFilter;
        if (actionFilter) params.action = actionFilter;
        adminAuditAPI.getLogs(params)
            .then((r) => {
                setLogs(r.data.data || []);
                setTotal(r.data.total || 0);
            })
            .catch(() => toast.error('Failed to load audit logs'))
            .finally(() => setLoading(false));
    }, [page, entityFilter, actionFilter]);

    useEffect(() => { load(); }, [load]);

    const exportCsv = () => {
        if (logs.length === 0) return;
        const headers = ['ID', 'Admin', 'Action', 'Entity Type', 'Entity ID', 'IP', 'Date'];
        const rows = logs.map((l) => [
            l.id,
            l.admin_email,
            l.action,
            l.entity_type || '',
            l.entity_id || '',
            l.ip_address || '',
            new Date(l.created_at).toISOString(),
        ]);
        const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-page${page}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Audit Log</h2>
                    <p className="text-sm text-gray-500 mt-1">{total} entries total</p>
                </div>
                <button
                    onClick={exportCsv}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                    Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-6">
                <select
                    value={entityFilter}
                    onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All entity types</option>
                    <option value="company">Company</option>
                    <option value="candidate">Candidate</option>
                    <option value="staff">Staff</option>
                    <option value="settings">Settings</option>
                    <option value="training">Training</option>
                </select>
                <input
                    type="text"
                    placeholder="Filter by action…"
                    value={actionFilter}
                    onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {loading ? (
                    <p className="p-6 text-gray-400 text-sm">Loading…</p>
                ) : logs.length === 0 ? (
                    <p className="p-6 text-gray-400 text-sm">No audit log entries found.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                {['Type', 'Admin', 'Action', 'Details', 'IP', 'Date'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.map((log) => {
                                let details = null;
                                try { if (log.new_value) details = JSON.parse(log.new_value); } catch { /* ignore */ }
                                return (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <span title={log.entity_type}>{entityIcon(log.entity_type)}</span>
                                            {log.entity_id && <span className="text-gray-400 text-xs ml-1">#{log.entity_id}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">{log.admin_email}</td>
                                        <td className="px-4 py-3">
                                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                                            {details
                                                ? Object.entries(details).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ip_address || '—'}</td>
                                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useEffect, useState, useCallback } from 'react';
import { notificationAPI } from '../api/notifications';

const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const LIMIT = 20;

    const load = useCallback(() => {
        setLoading(true);
        notificationAPI.list({ unread: unreadOnly ? 'true' : 'false', limit: LIMIT, offset: page * LIMIT })
            .then(r => {
                setNotifications(r.data?.data || []);
                setTotal(r.data?.total || 0);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [unreadOnly, page]);

    useEffect(() => { load(); }, [load]);

    const markRead = async (id) => {
        await notificationAPI.markRead(id).catch(() => {});
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    };

    const markAllRead = async () => {
        await notificationAPI.markAllRead().catch(() => {});
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    };

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={unreadOnly}
                            onChange={e => { setUnreadOnly(e.target.checked); setPage(0); }}
                            className="rounded"
                        />
                        Unread only
                    </label>
                    <button
                        onClick={markAllRead}
                        className="text-xs text-indigo-600 hover:underline"
                    >
                        Mark all read
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : notifications.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="text-3xl mb-3 text-gray-300">🔔</div>
                    <p className="text-gray-500 text-sm">No notifications.</p>
                </div>
            ) : (
                <div className="flex flex-col divide-y divide-gray-100 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    {notifications.map(n => (
                        <div
                            key={n.id}
                            onClick={() => !n.is_read && markRead(n.id)}
                            className={`px-5 py-4 transition ${!n.is_read ? 'bg-indigo-50/40 cursor-pointer hover:bg-indigo-50' : ''}`}
                        >
                            <div className="flex items-start gap-3">
                                {!n.is_read && (
                                    <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                )}
                                <div className={!n.is_read ? '' : 'ml-5'}>
                                    <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                                    <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
                                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {total > LIMIT && (
                <div className="flex items-center justify-between mt-4">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="text-sm text-indigo-600 hover:underline disabled:text-gray-300"
                    >
                        ← Previous
                    </button>
                    <span className="text-xs text-gray-500">{page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}</span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={(page + 1) * LIMIT >= total}
                        className="text-sm text-indigo-600 hover:underline disabled:text-gray-300"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}

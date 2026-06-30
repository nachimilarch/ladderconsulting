import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

const POLL_INTERVAL = 30000; // 30 seconds

export default function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef(null);
    const navigate = useNavigate();

    const fetchCount = useCallback(async () => {
        try {
            const { data } = await notificationAPI.unreadCount();
            setUnreadCount(data.count || 0);
        } catch { /* non-fatal */ }
    }, []);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await notificationAPI.list({ unread: 'false', limit: 10 });
            setNotifications(data.data || []);
            setUnreadCount(data.data?.filter(n => !n.is_read).length || 0);
        } catch { /* non-fatal */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchCount]);

    useEffect(() => {
        if (open) fetchNotifications();
    }, [open, fetchNotifications]);

    // Close panel on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleMarkRead = async (notif) => {
        if (!notif.is_read) {
            await notificationAPI.markRead(notif.id).catch(() => {});
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
            setUnreadCount(c => Math.max(0, c - 1));
        }
        setOpen(false);
        // Navigate to relevant page based on notification type
        const meta = notif.metadata ? JSON.parse(notif.metadata) : {};
        if (notif.type.includes('interview')) navigate('/hr/interview-requests');
        else if (notif.type.includes('offer')) navigate('/hr/offer-requests');
        else if (notif.type.includes('invoice') || notif.type.includes('payment')) navigate('/company/payments');
    };

    const handleMarkAllRead = async () => {
        await notificationAPI.markAllRead().catch(() => {});
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                onClick={() => setOpen(o => !o)}
                className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition"
                aria-label="Notifications"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-indigo-600 hover:underline"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                        {loading ? (
                            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Loading…</div>
                        ) : notifications.length === 0 ? (
                            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">No notifications</div>
                        ) : (
                            notifications.map(n => (
                                <button
                                    key={n.id}
                                    onClick={() => handleMarkRead(n)}
                                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${!n.is_read ? 'bg-indigo-50/40' : ''}`}
                                >
                                    <div className="flex items-start gap-2">
                                        {!n.is_read && (
                                            <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                        )}
                                        <div className={!n.is_read ? '' : 'ml-4'}>
                                            <p className="text-xs font-semibold text-gray-800 leading-snug">{n.title}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="border-t border-gray-100 px-4 py-2.5">
                        <button
                            onClick={() => { setOpen(false); navigate('/notifications'); }}
                            className="text-xs text-indigo-600 hover:underline w-full text-center"
                        >
                            View all notifications →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

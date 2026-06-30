const db = require('../config/db');

// GET /api/notifications
exports.list = async (req, res) => {
    const { unread, type, limit = 50, offset = 0 } = req.query;
    const conditions = ['user_id = ?', 'deleted_at IS NULL'];
    const params = [req.user.id];

    if (unread === 'true') { conditions.push('is_read = 0'); }
    if (type) { conditions.push('type = ?'); params.push(type); }

    params.push(parseInt(limit), parseInt(offset));

    try {
        const [rows] = await db.query(
            `SELECT id, type, title, body, is_read, metadata, created_at
             FROM notifications
             WHERE ${conditions.join(' AND ')}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            params
        );
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND deleted_at IS NULL${unread === 'true' ? ' AND is_read = 0' : ''}`,
            [req.user.id]
        );
        res.json({ success: true, data: rows, total });
    } catch (err) {
        console.error('[notification.list]', err.message);
        res.status(500).json({ message: 'Failed to fetch notifications.' });
    }
};

// GET /api/notifications/unread-count
exports.unreadCount = async (req, res) => {
    try {
        const [[{ count }]] = await db.query(
            `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL`,
            [req.user.id]
        );
        res.json({ count: parseInt(count) });
    } catch (err) {
        console.error('[notification.unreadCount]', err.message);
        res.status(500).json({ message: 'Failed to get count.' });
    }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
    try {
        await db.query(
            `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[notification.markRead]', err.message);
        res.status(500).json({ message: 'Failed to mark as read.' });
    }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
    try {
        await db.query(
            `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL`,
            [req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[notification.markAllRead]', err.message);
        res.status(500).json({ message: 'Failed to mark all as read.' });
    }
};

const db = require('../config/db');

/**
 * Fire-and-forget audit entry — never throws, never blocks the response.
 * details goes into new_value JSON column.
 */
const logAction = async (adminId, action, entityType, entityId, details, ip) => {
    try {
        await db.query(
            `INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, new_value, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                adminId,
                action,
                entityType || null,
                entityId || null,
                details ? JSON.stringify(details) : null,
                ip || null,
            ]
        );
    } catch (err) {
        console.error('[AuditLog] Failed to write log:', err.message);
    }
};

module.exports = { logAction };

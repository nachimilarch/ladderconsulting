const jwt = require('jsonwebtoken');

let maintenanceOn = false;
let cachedAt = 0;
const TTL = 60 * 1000; // 60 seconds

// Allows adminController to bust the cache after settings change
const bustCache = () => { cachedAt = 0; };

const maintenanceCheck = async (req, res, next) => {
    // Always allow auth routes through
    if (req.path.startsWith('/api/auth') || req.path === '/api/health') {
        return next();
    }

    const now = Date.now();
    if (now - cachedAt > TTL) {
        try {
            const db = require('../config/db');
            const [[row]] = await db.query(
                "SELECT value FROM platform_settings WHERE setting_key = 'maintenance_mode'"
            );
            maintenanceOn = row?.value === 'true';
            cachedAt = now;
        } catch {
            return next(); // DB error → allow through
        }
    }

    if (!maintenanceOn) return next();

    // Parse JWT to check if admin — without blocking if token missing/invalid
    const token =
        req.cookies?.token ||
        (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null);

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.role === 'admin') return next();
        } catch { /* fall through */ }
    }

    return res.status(503).json({
        message: 'Platform is currently under maintenance. Please try again later.',
        maintenance: true,
    });
};

maintenanceCheck.bustCache = bustCache;
module.exports = maintenanceCheck;

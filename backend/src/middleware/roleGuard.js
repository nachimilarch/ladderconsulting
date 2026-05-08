// Usage: router.get('/admin-only', auth, roleGuard('ladder_admin'), handler)
// Usage: router.get('/multi-role', auth, roleGuard('hr_staff', 'ladder_admin'), handler)

module.exports = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  next();
};
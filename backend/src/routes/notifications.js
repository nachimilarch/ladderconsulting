const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

// All routes require authentication; user_id scoping is enforced in controller
router.get('/unread-count', authenticateToken, ctrl.unreadCount);
router.get('/',             authenticateToken, ctrl.list);
router.patch('/read-all',   authenticateToken, ctrl.markAllRead);
router.patch('/:id/read',   authenticateToken, ctrl.markRead);

module.exports = router;

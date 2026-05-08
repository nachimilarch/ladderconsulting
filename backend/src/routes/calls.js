// backend/routes/calls.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/callController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('hr_staff', 'admin'));
router.post('/', ctrl.logCall);
router.get('/', ctrl.getCalls);

module.exports = router;
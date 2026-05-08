// backend/routes/reports.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('hr_staff', 'admin'));
router.get('/hr', ctrl.hrReport);

module.exports = router;
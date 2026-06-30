const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('hr_staff', 'admin'));

router.get('/hiring',       ctrl.getHiringReport);
router.get('/hr',           ctrl.hrReport);
router.get('/calls',        ctrl.getCallReport);
router.get('/leads',        ctrl.getLeadReport);
router.get('/productivity', authorizeRole('admin'), ctrl.getProductivityReport);

module.exports = router;

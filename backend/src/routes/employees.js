const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/employeeController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('hr_staff', 'admin'));

// These static routes must come before /:id
router.get('/stats',           ctrl.getDashboardStats);
router.get('/available-users', authorizeRole('admin'), ctrl.getAvailableUsers);

router.get('/',                ctrl.getAll);
router.get('/:id',             ctrl.getOne);
router.post('/',               authorizeRole('admin'), ctrl.create);
router.put('/:id',             authorizeRole('admin'), ctrl.update);
router.put('/:id/assign-role-department', authorizeRole('admin'), ctrl.assignRoleDept);
router.delete('/:id',          authorizeRole('admin'), ctrl.remove);

router.get('/:id/attendance',  ctrl.getAttendance);
router.post('/:id/attendance', authorizeRole('admin'), ctrl.addAttendance);

module.exports = router;

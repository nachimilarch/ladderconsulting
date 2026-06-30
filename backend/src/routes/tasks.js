const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/taskController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('hr_staff', 'admin'));

router.get('/',                ctrl.getAll);
router.post('/',               authorizeRole('admin'), ctrl.create);
router.get('/:id',             ctrl.getOne);
router.patch('/:id/status',    ctrl.updateStatus);
router.post('/:id/notes',      ctrl.addNote);
router.get('/:id/notes',       ctrl.getNotes);
router.delete('/:id',          authorizeRole('admin'), ctrl.remove);

module.exports = router;

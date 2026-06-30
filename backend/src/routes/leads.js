const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/leadController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('hr_staff', 'admin'));

router.get('/',                ctrl.getAll);
router.post('/',               ctrl.create);
router.get('/:id',             ctrl.getOne);
router.put('/:id',             ctrl.update);
router.put('/:id/stage',       ctrl.updateStage);
router.put('/:id/assign',      authorizeRole('admin'), ctrl.assign);
router.delete('/:id',          ctrl.remove);

module.exports = router;

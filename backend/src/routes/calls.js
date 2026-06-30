const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/callController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken, authorizeRole('hr_staff', 'admin'));

router.get('/',    ctrl.getCalls);
router.post('/',   ctrl.logCall);
router.put('/:id', ctrl.updateCall);
router.delete('/:id', ctrl.deleteCall);

module.exports = router;

const router = require('express').Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const ctrl = require('../controllers/hrPackageController');

const hrAdmin = [authenticateToken, authorizeRole('hr_staff', 'admin')];

router.get('/',              ...hrAdmin, ctrl.listPackageRequests);
router.post('/:id/activate', ...hrAdmin, ctrl.activatePackage);
router.post('/:id/dismiss',  ...hrAdmin, ctrl.dismissRequest);

module.exports = router;

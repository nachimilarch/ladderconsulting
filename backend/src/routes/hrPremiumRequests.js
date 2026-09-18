const router = require('express').Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const ctrl = require('../controllers/companyPremiumController');

const hrAdmin = [authenticateToken, authorizeRole('hr_staff', 'admin')];

router.get('/',              ...hrAdmin, ctrl.listPremiumRequests);
router.post('/:id/approve',  ...hrAdmin, ctrl.approvePremiumRequest);
router.post('/:id/dismiss',  ...hrAdmin, ctrl.dismissPremiumRequest);

module.exports = router;

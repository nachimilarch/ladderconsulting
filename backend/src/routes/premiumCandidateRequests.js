const router = require('express').Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const ctrl = require('../controllers/premiumCandidateReviewController');

const exec = [authenticateToken, authorizeRole('hr_staff', 'admin')];

router.get('/',              ...exec, ctrl.listRequests);
router.get('/:id',           ...exec, ctrl.getRequestDetail);
router.put('/:id/approve',   ...exec, ctrl.approveRequest);
router.put('/:id/reject',    ...exec, ctrl.rejectRequest);

module.exports = router;

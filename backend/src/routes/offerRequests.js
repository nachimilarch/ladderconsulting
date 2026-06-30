const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/offerRequestController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Company routes
router.post('/',
    authenticateToken, authorizeRole('company'),
    ctrl.submitOfferRequest
);
router.get('/:applicationId/status',
    authenticateToken, authorizeRole('company'),
    ctrl.getRequestStatus
);

// Executive (hr_staff) routes — static paths before /:id
router.get('/executive',
    authenticateToken, authorizeRole('hr_staff', 'admin'),
    ctrl.listExecRequests
);
router.get('/executive/:id',
    authenticateToken, authorizeRole('hr_staff', 'admin'),
    ctrl.getRequestDetail
);
router.put('/executive/:id/approve',
    authenticateToken, authorizeRole('hr_staff', 'admin'),
    ctrl.approveRequest
);
router.put('/executive/:id/reject',
    authenticateToken, authorizeRole('hr_staff', 'admin'),
    ctrl.rejectRequest
);

module.exports = router;

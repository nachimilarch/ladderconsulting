const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const ctrl = require('../controllers/interviewRequestController');

// Company routes
router.post('/',
    authenticateToken, authorizeRole('company'),
    ctrl.submitRequest
);
router.get('/',
    authenticateToken, authorizeRole('company'),
    ctrl.getRequestStatus
);
router.post('/:id/reschedule',
    authenticateToken, authorizeRole('company'),
    ctrl.submitReschedule
);

// Executive / Admin routes — static paths before /:id
router.get('/executive',
    authenticateToken, authorizeRole('hr_staff', 'admin'),
    ctrl.listExecRequests
);
// Scheduled interviews view + confirm-on-behalf (must precede /executive/:id)
router.get('/executive/scheduled',
    authenticateToken, authorizeRole('hr_staff', 'admin'),
    ctrl.listExecScheduled
);
router.patch('/executive/slots/:id/confirm',
    authenticateToken, authorizeRole('hr_staff', 'admin'),
    ctrl.execConfirmSlot
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

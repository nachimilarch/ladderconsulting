const router = require('express').Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const ctrl = require('../controllers/aiSubscriptionController');

router.use(authenticateToken, authorizeRole('company', 'candidate'));

router.get('/status',      ctrl.getStatus);
router.post('/subscribe',  ctrl.subscribe);
router.post('/pay-invoice', ctrl.payInvoice);
router.post('/cancel',     ctrl.cancel);

module.exports = router;

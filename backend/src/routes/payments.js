const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/paymentController');

// Verify payment status — called by frontend return URL handler
router.get('/verify/:cashfreeOrderId', authenticateToken, ctrl.verifyPayment);

// Cashfree webhook — no auth, signature verified in controller
// Raw body is needed for signature verification
router.post('/webhook/cashfree', express.raw({ type: 'application/json' }), (req, res, next) => {
    req.rawBody = req.body;
    req.body = JSON.parse(req.body.toString());
    next();
}, ctrl.cashfreeWebhook);

module.exports = router;

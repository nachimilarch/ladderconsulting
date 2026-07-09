const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/paymentController');

// Verify payment status — called by frontend return URL handler
router.get('/verify/:cashfreeOrderId', authenticateToken, ctrl.verifyPayment);

// Cashfree webhook — no auth, signature verified in controller
// Raw body needed for HMAC signature verification; express.json() may have
// already parsed it if Content-Type matching fired first, so guard both cases.
router.post('/webhook/cashfree', express.raw({ type: '*/*' }), (req, res, next) => {
    if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body;
        try { req.body = JSON.parse(req.body.toString()); } catch { req.body = {}; }
    } else {
        // Already parsed by global express.json() — rawBody unavailable, signature check will fail
        req.rawBody = Buffer.from(JSON.stringify(req.body));
    }
    next();
}, ctrl.cashfreeWebhook);

module.exports = router;

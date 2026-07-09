const axios = require('axios');
const crypto = require('crypto');

// Strip non-digits, drop leading country code (+91/0), pad/truncate to 10 digits.
// Falls back to a known-valid test number if the result isn't 10 digits.
const sanitizePhone = (raw) => {
    if (!raw) return '9000000000';
    const digits = String(raw).replace(/\D/g, '');
    const trimmed = digits.startsWith('91') && digits.length === 12 ? digits.slice(2)
                  : digits.startsWith('0')  && digits.length === 11 ? digits.slice(1)
                  : digits;
    return trimmed.length === 10 ? trimmed : '9000000000';
};

const getBaseUrl = () => {
    const env = process.env.CASHFREE_ENV || 'TEST';
    return env === 'PROD'
        ? (process.env.CASHFREE_BASE_URL_PROD || 'https://api.cashfree.com/pg')
        : (process.env.CASHFREE_BASE_URL_TEST || 'https://sandbox.cashfree.com/pg');
};

const getHeaders = () => ({
    'x-api-version': '2023-08-01',
    'x-client-id': process.env.CASHFREE_APP_ID,
    'x-client-secret': process.env.CASHFREE_SECRET_KEY,
    'Content-Type': 'application/json',
});

// Create a Cashfree payment order
exports.createOrder = async ({
    orderId, amount, currency = 'INR',
    customerName, customerEmail, customerPhone,
    orderNote, returnUrl,
}) => {
    // CASHFREE_TEST_AMOUNT (in ₹) overrides the real amount for live payment testing.
    // Set to 1 in .env while verifying prod credentials, then remove.
    const testOverride = process.env.CASHFREE_TEST_AMOUNT ? parseFloat(process.env.CASHFREE_TEST_AMOUNT) : null;
    const finalAmount  = testOverride != null ? testOverride : parseFloat(amount);

    const payload = {
        order_id: orderId,
        order_amount: finalAmount,
        order_currency: currency,
        customer_details: {
            customer_id: `cust_${Date.now()}`,
            customer_name: customerName || 'Company User',
            customer_email: customerEmail,
            customer_phone: sanitizePhone(customerPhone),
        },
        order_meta: {
            return_url: returnUrl,
            notify_url: `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/payments/webhook/cashfree`,
        },
        order_note: orderNote || 'Payment to LadderStep Human Consulting',
    };

    const response = await axios.post(
        `${getBaseUrl()}/orders`,
        payload,
        { headers: getHeaders() }
    );
    return response.data; // { order_id, payment_session_id, order_status, ... }
};

// Fetch order status from Cashfree
exports.getOrderStatus = async (orderId) => {
    const response = await axios.get(
        `${getBaseUrl()}/orders/${orderId}`,
        { headers: getHeaders() }
    );
    return response.data;
};

// Fetch payments for an order
exports.getOrderPayments = async (orderId) => {
    const response = await axios.get(
        `${getBaseUrl()}/orders/${orderId}/payments`,
        { headers: getHeaders() }
    );
    return response.data;
};

// Verify webhook signature
// Cashfree sends: x-webhook-signature header = HMAC-SHA256(payload, secret)
exports.verifyWebhookSignature = (rawBody, signature) => {
    const secret = process.env.CASHFREE_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64');
    return expected === signature;
};

exports.getEnv = () => process.env.CASHFREE_ENV || 'TEST';

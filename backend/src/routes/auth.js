const express = require('express');
const router = express.Router();
const {
    register,
    verifyEmail,
    login,
    microsoftLogin,
    googleLogin,
    forgotPassword,
    resetPassword,
    logout,
    getMe,
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Public routes — no auth middleware
router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/microsoft', microsoftLogin);
router.post('/google', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getMe);

module.exports = router;
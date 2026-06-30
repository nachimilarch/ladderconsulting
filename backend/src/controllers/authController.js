const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/db');
const { sendEmail } = require('../utils/email');
const { verifyMicrosoftIdToken } = require('../utils/msVerify');

const DEV_MODE = process.env.NODE_ENV !== 'production';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// SSO is mandatory for these roles — password login is rejected outright
// regardless of whether the account predates this change.
const MICROSOFT_ONLY_ROLES = ['hr_staff', 'admin'];
const GOOGLE_ONLY_ROLES = ['candidate', 'company'];
// When SSO_ENFORCED=true, password login is blocked for SSO-only roles.
// Leave unset (default false) until Microsoft + Google SSO are fully configured.
const SSO_ENFORCED = process.env.SSO_ENFORCED === 'true';

// Safe email helper — never crashes the request
const trySendEmail = async (options) => {
    try {
        await sendEmail(options);
    } catch (err) {
        console.warn('Email send failed (non-fatal):', err.message);
    }
};

const issueSessionCookie = (res, user) => {
    const payload = { id: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};

const linkOAuthIdentity = async (userId, provider, providerUserId, email) => {
    await db.query(
        `INSERT IGNORE INTO user_oauth_identities (user_id, provider, provider_user_id, email)
         VALUES (?, ?, ?, ?)`,
        [userId, provider, providerUserId, email]
    );
};

// ─── REGISTER ────────────────────────────────────────────────────────────────
// Password-based self-registration is retired in favour of SSO (see
// microsoftLogin/googleLogin below). Kept as a clear redirect rather than a
// 404 in case anything still links here.
exports.register = async (req, res) => {
    const { role } = req.body;

    if (GOOGLE_ONLY_ROLES.includes(role)) {
        return res.status(400).json({ message: 'Self-registration with a password is no longer available. Please use "Sign up with Google" instead.' });
    }
    if (MICROSOFT_ONLY_ROLES.includes(role)) {
        return res.status(400).json({ message: 'Staff accounts are created by an administrator. Please contact your admin, then sign in with Microsoft.' });
    }
    return res.status(400).json({ message: 'Invalid role selected.' });
};

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
    const { token } = req.body;

    try {
        const [rows] = await db.query(
            `SELECT id, role_id, email_verify_token_expires FROM users
       WHERE email_verify_token = ? AND is_email_verified = 0`,
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Invalid or already used verification token.' });
        }

        if (new Date() > new Date(rows[0].email_verify_token_expires)) {
            return res.status(400).json({ message: 'Token expired. Please register again.' });
        }

        await db.query(
            `UPDATE users SET is_email_verified = 1, email_verify_token = NULL, email_verify_token_expires = NULL
       WHERE id = ?`,
            [rows[0].id]
        );

        res.json({ message: 'Email verified successfully. You may now log in.' });
    } catch (err) {
        console.error('Verify email error:', err);
        res.status(500).json({ message: 'Server error during email verification.' });
    }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const [rows] = await db.query(
            `SELECT u.id, u.name, u.email, u.password, u.is_email_verified, u.status,
              r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = rows[0];

        if (SSO_ENFORCED) {
            if (MICROSOFT_ONLY_ROLES.includes(user.role)) {
                return res.status(403).json({ message: 'Please sign in with Microsoft.' });
            }
            if (GOOGLE_ONLY_ROLES.includes(user.role)) {
                return res.status(403).json({ message: 'Please sign in with Google.' });
            }
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        if (!user.is_email_verified) {
            return res.status(403).json({ message: 'Please verify your email before logging in.' });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({ message: 'Account suspended. Contact support.' });
        }

        issueSessionCookie(res, user);

        res.json({
            message: 'Login successful.',
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

// ─── MICROSOFT LOGIN (hr_staff, admin) ────────────────────────────────────────
// No auto-provisioning — the users row must already exist (created via
// adminController.createStaff). Matched purely by email since "any Microsoft
// account" is allowed (no tenant restriction).
exports.microsoftLogin = async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken is required.' });

    try {
        const claims = await verifyMicrosoftIdToken(idToken);
        if (!claims.email) {
            return res.status(400).json({ message: 'Your Microsoft account has no email address.' });
        }

        const [rows] = await db.query(
            `SELECT u.id, u.name, u.email, u.status, r.name AS role
             FROM users u JOIN roles r ON u.role_id = r.id
             WHERE u.email = ? AND u.deleted_at IS NULL`,
            [claims.email]
        );

        if (rows.length === 0) {
            return res.status(403).json({ message: 'No account found for this email. Ask your administrator to create one, then try again.' });
        }

        const user = rows[0];
        if (!MICROSOFT_ONLY_ROLES.includes(user.role)) {
            return res.status(403).json({ message: 'Microsoft sign-in is not available for your account type.' });
        }
        if (user.status === 'suspended') {
            return res.status(403).json({ message: 'Account suspended. Contact support.' });
        }

        await linkOAuthIdentity(user.id, 'microsoft', claims.providerUserId, claims.email);
        await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
        issueSessionCookie(res, user);

        res.json({
            message: 'Login successful.',
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        console.error('Microsoft login error:', err);
        res.status(401).json({ message: 'Microsoft sign-in failed. Please try again.' });
    }
};

// ─── GOOGLE LOGIN (candidate, company) ────────────────────────────────────────
// Auto-provisions on first sign-in, mirroring the retired register() flow:
// candidates get instant active access, companies get status='pending' +
// a company_approvals row for admin review (email is already verified by
// Google so no separate verify-email step is needed either way).
exports.googleLogin = async (req, res) => {
    const { idToken, role } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken is required.' });

    try {
        const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();

        if (!payload.email || !payload.email_verified) {
            return res.status(400).json({ message: 'Your Google account email is not verified.' });
        }
        const email = payload.email;

        const [rows] = await db.query(
            `SELECT u.id, u.name, u.email, u.status, r.name AS role
             FROM users u JOIN roles r ON u.role_id = r.id
             WHERE u.email = ? AND u.deleted_at IS NULL`,
            [email]
        );

        let user = rows[0];

        if (user) {
            if (!GOOGLE_ONLY_ROLES.includes(user.role)) {
                return res.status(403).json({ message: 'Google sign-in is not available for your account type.' });
            }
            if (user.status === 'suspended') {
                return res.status(403).json({ message: 'Account suspended. Contact support.' });
            }
        } else {
            if (!GOOGLE_ONLY_ROLES.includes(role)) {
                return res.status(400).json({ message: 'role must be candidate or company.' });
            }

            const [[roleRow]] = await db.query('SELECT id FROM roles WHERE name = ?', [role]);
            const randomHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
            const status = role === 'company' ? 'pending' : 'active';

            const [result] = await db.query(
                `INSERT INTO users (name, email, password, role_id, status, is_email_verified)
                 VALUES (?, ?, ?, ?, ?, 1)`,
                [payload.name || email, email, randomHash, roleRow.id, status]
            );
            const userId = result.insertId;

            if (role === 'company') {
                await db.query(`INSERT INTO company_approvals (user_id, status) VALUES (?, 'pending')`, [userId]);
            }

            user = { id: userId, name: payload.name || email, email, status, role };
        }

        await linkOAuthIdentity(user.id, 'google', payload.sub, email);

        if (user.role === 'company' && user.status === 'pending') {
            return res.status(403).json({ message: 'Registration successful. Your account is pending admin approval.' });
        }

        await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
        issueSessionCookie(res, user);

        res.json({
            message: 'Login successful.',
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        console.error('Google login error:', err);
        res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
    }
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const [rows] = await db.query('SELECT id, name FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.json({ message: 'If that email exists, a reset link has been sent.' });
        }

        const user = rows[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 60 * 60 * 1000);

        await db.query(
            'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
            [resetToken, expiry, user.id]
        );

        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

        await trySendEmail({
            to: email,
            subject: 'Reset your LadderStep Human Consulting password',
            html: `
        <p>Hello ${user.name},</p>
        <p>Reset your password (valid 1 hour): <a href="${resetUrl}">${resetUrl}</a></p>
      `,
        });

        // In dev mode, return the token directly so you can test without email
        res.json({
            message: 'If that email exists, a reset link has been sent.',
            ...(DEV_MODE && { dev_reset_url: resetUrl }),
        });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
    const { token, password } = req.body;

    try {
        const [rows] = await db.query(
            `SELECT id FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()`,
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired reset token.' });
        }

        const hashed = await bcrypt.hash(password, 12);
        await db.query(
            `UPDATE users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?`,
            [hashed, rows[0].id]
        );

        res.json({ message: 'Password reset successful. You may now log in.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
exports.logout = (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully.' });
};

// ─── GET CURRENT USER ─────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.name, u.email, u.status, r.name AS role
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
            [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });
        res.json({ user: rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};
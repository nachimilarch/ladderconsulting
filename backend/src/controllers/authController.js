const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { sendEmail } = require('../utils/email');

const DEV_MODE = process.env.NODE_ENV !== 'production';

// Safe email helper — never crashes the request
const trySendEmail = async (options) => {
    try {
        await sendEmail(options);
    } catch (err) {
        console.warn('Email send failed (non-fatal):', err.message);
    }
};

// ─── REGISTER ────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
    const { name, email, password, role, company_name, phone, address } = req.body;

    const allowedRoles = ['candidate', 'company', 'hr_staff'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role selected.' });
    }

    try {
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Email already registered.' });
        }

        const [roleRow] = await db.query('SELECT id FROM roles WHERE name = ?', [role]);
        if (roleRow.length === 0) {
            return res.status(400).json({ message: 'Role not found. Ensure roles table is seeded.' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const verifyToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const status = role === 'company' ? 'pending' : 'active';

        // In dev mode, auto-verify email so you can login immediately
        const isVerified = DEV_MODE ? 1 : 0;

        const [result] = await db.query(
            `INSERT INTO users (name, email, password, role_id, status, is_email_verified, email_verify_token, email_verify_token_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, hashedPassword, roleRow[0].id, status, isVerified,
                DEV_MODE ? null : verifyToken,
                DEV_MODE ? null : tokenExpiry]
        );

        const userId = result.insertId;

        if (role === 'company') {
            if (!company_name) {
                return res.status(400).json({ message: 'Company name is required.' });
            }
            await db.query(
                `INSERT INTO company_approvals (user_id, company_name, company_email, phone, address)
         VALUES (?, ?, ?, ?, ?)`,
                [userId, company_name, email, phone || null, address || null]
            );
        }

        // Send email without blocking or crashing the response
        if (!DEV_MODE) {
            const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${verifyToken}`;
            await trySendEmail({
                to: email,
                subject: 'Verify your Ladder Consulting account',
                html: `
          <p>Hello ${name},</p>
          <p>Please verify your email: <a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>Expires in 24 hours.</p>
          ${role === 'company' ? '<p><strong>Note:</strong> Admin approval required after verification.</p>' : ''}
        `,
            });
        }

        res.status(201).json({
            message: DEV_MODE
                ? 'Registration successful. Dev mode: email auto-verified, you can login now.'
                : role === 'company'
                    ? 'Registration successful. Please verify your email. Admin approval required.'
                    : 'Registration successful. Please verify your email.',
        });

    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Server error during registration.', detail: err.message });
    }
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

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        if (!user.is_email_verified) {
            return res.status(403).json({ message: 'Please verify your email before logging in.' });
        }

        if (user.role === 'company' && user.status === 'pending') {
            return res.status(403).json({
                message: 'Your account is pending admin approval.',
            });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({ message: 'Account suspended. Contact support.' });
        }

        const payload = { id: user.id, email: user.email, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({
            message: 'Login successful.',
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login.' });
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
            subject: 'Reset your Ladder Consulting password',
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
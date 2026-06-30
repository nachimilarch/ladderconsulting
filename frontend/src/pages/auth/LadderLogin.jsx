import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { msalInstance, msalLoginRequest } from '../../msalConfig';

const ROLE_HOME = {
    candidate: '/candidate',
    company:   '/company',
    hr_staff:  '/hr',
    admin:     '/admin',
    trainer:   '/admin/training',
};

export default function LadderLogin() {
    const { loginWithMicrosoft, login, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showManual, setShowManual] = useState(false);

    if (!authLoading && user) {
        return <Navigate to={ROLE_HOME[user.role] || '/dashboard'} replace />;
    }

    const handleMicrosoftLogin = async () => {
        setError('');
        setSubmitting(true);
        try {
            await msalInstance.loginRedirect(msalLoginRequest);
        } catch (err) {
            setSubmitting(false);
            setError(err.message || err.errorCode || 'Microsoft sign-in failed. Please try again.');
        }
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const loggedIn = await login(form.email, form.password);
            navigate(ROLE_HOME[loggedIn.role] || '/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card-sm">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <img src="/logo-full.png" alt="LadderStep Human Consulting" className="h-24 object-contain" />
                </div>

                <h1 className="auth-title">Team Login</h1>
                <p className="auth-subtitle">For LadderStep staff — HR executives, admins &amp; trainers</p>

                {error && <div className="alert-error mb-5">{error}</div>}

                {/* Microsoft SSO */}
                <button
                    type="button"
                    onClick={msalInstance ? handleMicrosoftLogin : () => setError('Microsoft login requires HTTPS.')}
                    disabled={submitting}
                    className="flex items-center justify-center gap-3 w-full border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition shadow-sm"
                >
                    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
                        <path fill="#f25022" d="M1 1h9v9H1z" />
                        <path fill="#00a4ef" d="M1 11h9v9H1z" />
                        <path fill="#7fba00" d="M11 1h9v9h-9z" />
                        <path fill="#ffb900" d="M11 11h9v9h-9z" />
                    </svg>
                    Sign in with Microsoft
                </button>

                {/* Manual login toggle (trainers) */}
                <div className="mt-5 pt-5 border-t border-gray-100">
                    {!showManual ? (
                        <p className="text-xs text-center text-gray-400">
                            Trainer?{' '}
                            <button
                                type="button"
                                className="link text-xs"
                                onClick={() => setShowManual(true)}
                            >
                                Sign in with email &amp; password
                            </button>
                        </p>
                    ) : (
                        <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                            <p className="text-xs font-medium text-gray-500 text-center">Trainer / Manual Login</p>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="form-input"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <div className="flex items-center justify-between">
                                    <label className="form-label">Password</label>
                                    <Link to="/forgot-password" className="link text-xs">Forgot password?</Link>
                                </div>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    className="form-input"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <button type="submit" disabled={submitting} className="btn-primary">
                                {submitting ? 'Signing in…' : 'Sign In'}
                            </button>
                            <button type="button" className="text-xs text-gray-400 hover:text-gray-600 text-center" onClick={() => setShowManual(false)}>
                                ← Back
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-xs text-center text-gray-300 mt-6">
                    <Link to="/login" className="hover:text-gray-400 transition">← Back to main sign in</Link>
                </p>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ROLE_HOME = {
    candidate: '/candidate',
    company:   '/company',
    hr_staff:  '/hr',
    admin:     '/admin',
    trainer:   '/admin/training',
};

// The one role not covered by either SSO provider — kept as a plain
// email+password form, linked from the main Login page as a secondary path.
export default function TrainerLogin() {
    const { login, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!authLoading && user) {
        return <Navigate to={ROLE_HOME[user.role] || '/dashboard'} replace />;
    }

    const handleSubmit = async (e) => {
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
                <div className="flex justify-center mb-6">
                    <img src="/logo-full.png" alt="LadderStep Human Consulting" className="h-24 object-contain" />
                </div>

                <h1 className="auth-title">Trainer Sign In</h1>
                <p className="auth-subtitle">Sign in with your email and password</p>

                {error && <div className="alert-error mb-5">{error}</div>}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="form-group">
                        <label className="form-label">Email address</label>
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
                            <Link to="/forgot-password" className="link text-xs">
                                Forgot password?
                            </Link>
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

                    <button type="submit" disabled={submitting} className="btn-primary mt-1">
                        {submitting ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="text-sm text-center text-gray-500 mt-6">
                    <Link to="/login" className="link">← Back to main sign in</Link>
                </p>
            </div>
        </div>
    );
}

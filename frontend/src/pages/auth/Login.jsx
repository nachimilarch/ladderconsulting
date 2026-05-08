import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(form.email, form.password);
            const routes = {
                candidate: '/candidate',
                company: '/dashboard/company',
                hr_staff: '/hr',
                admin: '/dashboard/admin',
                trainer: '/dashboard/admin',
            };
            navigate(routes[user.role] || '/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card-sm">
                {/* Logo */}
                <div className="auth-logo">
                    <div className="auth-logo-badge">L</div>
                    <span className="auth-logo-text">Ladder Consulting</span>
                </div>

                <h1 className="auth-title">Welcome back</h1>
                <p className="auth-subtitle">Sign in to your account</p>

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

                    <button type="submit" disabled={loading} className="btn-primary mt-1">
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Signing in...
                            </span>
                        ) : 'Sign In'}
                    </button>
                </form >

                <p className="text-sm text-center text-gray-500 mt-6">
                    Don't have an account?{' '}
                    <Link to="/register" className="link">Create one</Link>
                </p>
            </div >
        </div >
    );
}
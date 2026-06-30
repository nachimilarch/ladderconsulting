import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';
import { msalInstance, msalLoginRequest } from '../../msalConfig';

const ROLE_HOME = {
    candidate: '/candidate',
    company:   '/company',
    hr_staff:  '/hr',
    admin:     '/admin',
    trainer:   '/admin/training',
};

export default function Login() {
    const { loginWithMicrosoft, loginWithGoogle, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Already authenticated — send to their dashboard
    if (!authLoading && user) {
        return <Navigate to={ROLE_HOME[user.role] || '/dashboard'} replace />;
    }

    const handleMicrosoftLogin = async () => {
        setError('');
        setSubmitting(true);
        try {
            const result = await msalInstance.loginPopup(msalLoginRequest);
            const loggedIn = await loginWithMicrosoft(result.idToken);
            navigate(ROLE_HOME[loggedIn.role] || '/dashboard');
        } catch (err) {
            if (err.errorCode === 'user_cancelled') {
                // nothing — user closed the popup intentionally
            } else if (err.errorCode === 'interaction_in_progress') {
                // A previous popup was interrupted and left a lock in sessionStorage.
                // Clear all MSAL keys so the next click works cleanly.
                Object.keys(sessionStorage)
                    .filter(k => k.includes('msal'))
                    .forEach(k => sessionStorage.removeItem(k));
                setError('Sign-in was interrupted. Please click "Sign in with Microsoft" again.');
            } else {
                const msg = err.response?.data?.message
                    || err.message
                    || err.errorCode
                    || 'Microsoft sign-in failed.';
                console.error('[MS login]', err);
                setError(msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setError('');
        setSubmitting(true);
        try {
            const loggedIn = await loginWithGoogle(credentialResponse.credential);
            navigate(ROLE_HOME[loggedIn.role] || '/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Google sign-in failed.');
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

                <h1 className="auth-title">Welcome back</h1>
                <p className="auth-subtitle">Sign in to your account</p>

                {error && <div className="alert-error mb-5">{error}</div>}

                {/* Candidates & Companies */}
                <div className="flex flex-col gap-3">
                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => setError('Google sign-in failed.')}
                            width="100%"
                        />
                    </div>
                </div>

                {/* Employee Login */}
                <div className="mt-5 pt-5 border-t border-gray-100">
                    <p className="text-xs text-center text-gray-400 mb-3 font-medium tracking-wide uppercase">Employee Login</p>
                    <button
                        type="button"
                        onClick={msalInstance ? handleMicrosoftLogin : () => setError('Microsoft login requires HTTPS. Please visit https://theladderconsulting.com')}
                        disabled={submitting}
                        className="flex items-center justify-center gap-2 w-full border border-gray-200 rounded-lg py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-60 transition"
                    >
                        <svg width="14" height="14" viewBox="0 0 21 21" aria-hidden="true">
                            <path fill="#f25022" d="M1 1h9v9H1z" />
                            <path fill="#00a4ef" d="M1 11h9v9H1z" />
                            <path fill="#7fba00" d="M11 1h9v9h-9z" />
                            <path fill="#ffb900" d="M11 11h9v9h-9z" />
                        </svg>
                        Sign in with Microsoft
                    </button>
                    <p className="text-xs text-center text-gray-400 mt-3">
                        <Link to="/login/trainer" className="link">Manual Login</Link>
                    </p>
                </div>

                <p className="text-sm text-center text-gray-500 mt-5">
                    New hiring company or candidate?{' '}
                    <Link to="/register" className="link">Create an account</Link>
                </p>
            </div>
        </div>
    );
}

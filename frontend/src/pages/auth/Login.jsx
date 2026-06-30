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
            // Redirect flow — page navigates away to Microsoft; auth result is handled
            // by handleRedirectPromise() in main.jsx → AuthContext on the way back.
            await msalInstance.loginRedirect(msalLoginRequest);
        } catch (err) {
            setSubmitting(false);
            console.error('[MS login]', err);
            setError(err.message || err.errorCode || 'Microsoft sign-in failed. Please try again.');
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

                <div className="flex flex-col gap-3">
                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => setError('Google sign-in failed.')}
                            width="100%"
                        />
                    </div>
                </div>

                <p className="text-sm text-center text-gray-500 mt-5">
                    New hiring company or candidate?{' '}
                    <Link to="/register" className="link">Create an account</Link>
                </p>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
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
    const [searchParams] = useSearchParams();
    // The website links here with ?role=candidate or ?role=company; the account's real role still decides the dashboard.
    const asked = searchParams.get('role');
    const who = asked === 'company' ? 'company' : asked === 'candidate' ? 'candidate' : null;
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

                <h1 className="auth-title">{who === 'company' ? 'Company login' : who === 'candidate' ? 'Candidate login' : 'Welcome back'}</h1>
                <p className="auth-subtitle">{who === 'company' ? 'Sign in to manage your jobs, shortlists and interviews' : who === 'candidate' ? 'Sign in to your jobs, applications and interviews' : 'Sign in to your account'}</p>

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
                    {who === 'company' ? 'New hiring company?' : who === 'candidate' ? 'New here?' : 'New hiring company or candidate?'}{' '}
                    <Link to={who ? `/register?role=${who}` : '/register'} className="link">Create an account</Link>
                </p>
                {who && (
                    <p className="text-sm text-center text-gray-500 mt-2">
                        {who === 'company' ? 'Looking for a job?' : 'Hiring?'}{' '}
                        <Link to={`/login?role=${who === 'company' ? 'candidate' : 'company'}`} className="link">{who === 'company' ? 'Candidate login' : 'Company login'}</Link>
                    </p>
                )}

                <p className="text-xs text-center text-gray-400 mt-4 leading-5">
                    By signing in you agree to our{' '}
                    <Link to="/terms-of-service" className="underline hover:text-gray-600">Terms of Service</Link> and{' '}
                    <Link to="/privacy-policy" className="underline hover:text-gray-600">Privacy Policy</Link>.
                    {' '}See also our{' '}
                    <Link to="/refund-and-cancellation" className="underline hover:text-gray-600">Refund &amp; Cancellation Policy</Link>.
                </p>
            </div>
        </div>
    );
}

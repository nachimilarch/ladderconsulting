import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';

const ROLE_HOME = {
    candidate: '/candidate',
    company:   '/company',
};

export default function Register() {
    const { loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [role, setRole] = useState('candidate');
    const [error, setError] = useState('');
    const [pending, setPending] = useState('');

    const handleGoogleSuccess = async (credentialResponse) => {
        setError('');
        setPending('');
        try {
            const user = await loginWithGoogle(credentialResponse.credential, role);
            navigate(ROLE_HOME[user.role] || '/dashboard');
        } catch (err) {
            const message = err.response?.data?.message;
            if (err.response?.status === 403 && message?.toLowerCase().includes('pending')) {
                setPending(message);
            } else {
                setError(message || 'Sign up failed.');
            }
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="flex justify-center mb-6">
                    <img src="/logo-full.png" alt="LadderStep Human Consulting" className="h-20 object-contain" />
                </div>

                <h1 className="text-2xl font-bold text-gray-800 mb-2">Create Account</h1>
                <p className="text-sm text-gray-500 mb-6">Join LadderStep Human Consulting</p>

                {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded p-3 mb-4 text-sm">{error}</div>}
                {pending && <div className="bg-green-50 text-green-600 border border-green-200 rounded p-3 mb-4 text-sm">{pending}</div>}

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">I am a</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setRole('candidate')}
                            className={`py-2.5 rounded-lg text-sm font-medium border transition ${
                                role === 'candidate'
                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            Candidate
                        </button>
                        <button
                            type="button"
                            onClick={() => setRole('company')}
                            className={`py-2.5 rounded-lg text-sm font-medium border transition ${
                                role === 'company'
                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            Hiring Company
                        </button>
                    </div>
                </div>

                <div className="flex justify-center">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError('Sign up failed.')}
                        width="100%"
                        text="signup_with"
                    />
                </div>

                <p className="text-sm text-center text-gray-500 mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-600 font-medium hover:underline">Login</Link>
                </p>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api/axios';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('verifying'); // verifying | success | error
    const [message, setMessage] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) {
            setStatus('error');
            setMessage('No verification token found.');
            return;
        }
        api.post('/auth/verify-email', { token })
            .then(({ data }) => { setStatus('success'); setMessage(data.message); })
            .catch(err => { setStatus('error'); setMessage(err.response?.data?.message || 'Verification failed.'); });
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm text-center">
                {status === 'verifying' && <p className="text-gray-500">Verifying your email...</p>}
                {status === 'success' && (
                    <>
                        <div className="text-green-500 text-4xl mb-4">✓</div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Email Verified!</h2>
                        <p className="text-gray-500 text-sm mb-4">{message}</p>
                        <Link to="/login" className="text-blue-600 font-medium hover:underline text-sm">Go to Login</Link>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <div className="text-red-500 text-4xl mb-4">✗</div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Verification Failed</h2>
                        <p className="text-gray-500 text-sm mb-4">{message}</p>
                        <Link to="/register" className="text-blue-600 font-medium hover:underline text-sm">Re-register</Link>
                    </>
                )}
            </div>
        </div>
    );
}
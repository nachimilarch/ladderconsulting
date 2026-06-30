import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { paymentAPI } from '../../api/payments';

export default function ResumeUnlockCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying'); // verifying | success | failed | pending

    useEffect(() => {
        const orderId = searchParams.get('txnOrderId');
        if (!orderId) { setStatus('failed'); return; }

        paymentAPI.verify(orderId)
            .then(({ data }) => {
                if (data.status === 'success') setStatus('success');
                else if (data.status === 'pending') setStatus('pending');
                else setStatus('failed');
            })
            .catch(() => setStatus('failed'));
    }, []); // eslint-disable-line

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                {status === 'verifying' && (
                    <>
                        <div className="text-4xl mb-4 animate-pulse">⏳</div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Verifying Payment…</h2>
                        <p className="text-sm text-gray-500">Please wait while we confirm your payment.</p>
                    </>
                )}
                {status === 'success' && (
                    <>
                        <div className="text-5xl mb-4">🔓</div>
                        <h2 className="text-xl font-bold text-green-700 mb-2">Resume Unlocked!</h2>
                        <p className="text-sm text-gray-600 mb-6">Your payment was received. The full profile and resume are now available in your Talent Pool.</p>
                        <button
                            onClick={() => navigate('/company/talent')}
                            className="bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition w-full"
                        >
                            Back to Talent Pool
                        </button>
                    </>
                )}
                {status === 'failed' && (
                    <>
                        <div className="text-5xl mb-4">❌</div>
                        <h2 className="text-xl font-bold text-red-700 mb-2">Payment Failed</h2>
                        <p className="text-sm text-gray-600 mb-6">Your payment could not be processed. Please try again.</p>
                        <button
                            onClick={() => navigate('/company/talent')}
                            className="bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition w-full"
                        >
                            Back to Talent Pool
                        </button>
                    </>
                )}
                {status === 'pending' && (
                    <>
                        <div className="text-5xl mb-4">🕐</div>
                        <h2 className="text-xl font-bold text-yellow-700 mb-2">Payment Pending</h2>
                        <p className="text-sm text-gray-600 mb-6">Payment is being processed. The unlock will apply automatically once confirmed. If it doesn't update in 5 minutes, contact support.</p>
                        <button
                            onClick={() => navigate('/company/talent')}
                            className="bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition w-full"
                        >
                            Back to Talent Pool
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

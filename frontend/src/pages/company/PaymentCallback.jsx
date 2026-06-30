import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { paymentAPI } from '../../api/payments';

export default function PaymentCallback() {
    const { invoiceId } = useParams();
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
    }, []);

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
                        <div className="text-5xl mb-4">✅</div>
                        <h2 className="text-xl font-bold text-green-700 mb-2">Payment Successful!</h2>
                        <p className="text-sm text-gray-600 mb-6">Your payment has been received and the invoice has been updated.</p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => navigate(`/company/payments/${invoiceId}`)}
                                className="bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
                            >
                                View Invoice
                            </button>
                            <button
                                onClick={() => navigate('/company/payments')}
                                className="border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition"
                            >
                                Back to Payments
                            </button>
                        </div>
                    </>
                )}
                {status === 'failed' && (
                    <>
                        <div className="text-5xl mb-4">❌</div>
                        <h2 className="text-xl font-bold text-red-700 mb-2">Payment Failed</h2>
                        <p className="text-sm text-gray-600 mb-6">Your payment could not be processed. Please try again.</p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => navigate(`/company/payments/${invoiceId}`)}
                                className="bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => navigate('/company/payments')}
                                className="border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition"
                            >
                                Back to Payments
                            </button>
                        </div>
                    </>
                )}
                {status === 'pending' && (
                    <>
                        <div className="text-5xl mb-4">🕐</div>
                        <h2 className="text-xl font-bold text-yellow-700 mb-2">Payment Pending</h2>
                        <p className="text-sm text-gray-600 mb-6">Payment is being processed. Your invoice will update shortly. If it doesn't update in 5 minutes, contact support.</p>
                        <button
                            onClick={() => navigate('/company/payments')}
                            className="bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition w-full"
                        >
                            Back to Payments
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { companyRequestAPI } from '../../api/company';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    pending:     'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    approved:    'bg-green-100 text-green-700',
    rejected:    'bg-red-100 text-red-600',
    cancelled:   'bg-gray-100 text-gray-500',
};

const INV_STATUS = {
    pending:  'bg-yellow-100 text-yellow-700',
    paid:     'bg-green-100 text-green-700',
    waived:   'bg-teal-100 text-teal-700',
    overdue:  'bg-red-100 text-red-600',
    cancelled:'bg-gray-100 text-gray-500',
};

const fmtType = (t) => ({
    candidate_profile_access: 'Candidate Profile Access',
    interview_scheduling: 'Interview Scheduling',
    offer_letter_release: 'Offer Letter Release',
}[t] || t);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function CompanyRequestsPage() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        companyRequestAPI.list()
            .then(r => setRequests(r.data?.data || []))
            .catch(() => { toast.error('Failed to load requests'); setRequests([]); })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        companyRequestAPI.list()
            .then(r => setRequests(r.data?.data || []))
            .catch(() => { toast.error('Failed to load requests'); setRequests([]); })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
                <button
                    onClick={load}
                    className="text-sm text-indigo-600 hover:underline"
                >
                    Refresh
                </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <p className="text-sm font-semibold text-blue-700">Offer letter requests</p>
                <p className="text-xs text-blue-600 mt-0.5">
                    After selecting a candidate in the Interviews page, submit an offer letter release request. Your LadderStep Human Consulting executive will confirm the placement fee and unlock the offer letter.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : requests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="text-4xl mb-3">📋</div>
                    <h3 className="font-semibold text-gray-700 mb-1">No requests yet</h3>
                    <p className="text-sm text-gray-500">
                        Requests for candidate profile access or interview scheduling will appear here.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h3 className="font-semibold text-gray-900">{fmtType(req.request_type)}</h3>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {req.status.replace('_', ' ')}
                                        </span>
                                        {req.grant_id && (
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                                Access granted
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mb-3">
                                        {req.job_title} · Submitted {fmtDate(req.created_at)}
                                        {req.resolved_at ? ` · Resolved ${fmtDate(req.resolved_at)}` : ''}
                                    </p>

                                    {/* Invoice */}
                                    {req.invoice_number ? (
                                        <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-500 font-medium">Invoice</span>
                                                <span className={`px-2 py-0.5 rounded font-medium ${INV_STATUS[req.invoice_status] || 'bg-gray-100 text-gray-500'}`}>
                                                    {req.invoice_status}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-gray-700">
                                                <span>{req.invoice_number}</span>
                                                <span>₹{Number(req.amount).toLocaleString('en-IN')} {req.currency}</span>
                                            </div>
                                            {req.due_date && (
                                                <p className="text-gray-400">Due: {fmtDate(req.due_date)}</p>
                                            )}
                                            {req.invoice_status === 'pending' && (
                                                <p className="text-yellow-700 bg-yellow-50 rounded px-2 py-1 mt-1">
                                                    Payment pending — contact LadderStep Human Consulting to proceed.
                                                </p>
                                            )}
                                        </div>
                                    ) : req.status === 'pending' ? (
                                        <p className="text-xs text-gray-400 italic">Invoice will be sent after review.</p>
                                    ) : null}

                                    {/* Grant info */}
                                    {req.grant_id && (
                                        <div className="mt-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                                            Access granted on {fmtDate(req.granted_at)}
                                            {req.expires_at ? ` · Expires ${fmtDate(req.expires_at)}` : ' · No expiry'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

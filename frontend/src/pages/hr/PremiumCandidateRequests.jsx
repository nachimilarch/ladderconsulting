import { useEffect, useState } from 'react';
import { premiumCandidateReviewAPI } from '../../api/premiumCandidateReview';
import { hrDocumentAPI } from '../../api/candidate';
import toast from 'react-hot-toast';

const fmtINR = (n) => `₹${parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function DetailPanel({ requestId, onClose, onActed }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);

    useEffect(() => {
        premiumCandidateReviewAPI.detail(requestId)
            .then(({ data }) => setDetail(data.data))
            .catch(() => toast.error('Failed to load request.'))
            .finally(() => setLoading(false));
    }, [requestId]);

    const handleApprove = async () => {
        if (!window.confirm(`Approve ${detail.candidate_name}'s Premium verification?`)) return;
        setActing(true);
        try {
            const { data } = await premiumCandidateReviewAPI.approve(requestId);
            toast.success(data.message || 'Approved.');
            onActed();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to approve.');
        } finally {
            setActing(false);
        }
    };

    const handleReject = async () => {
        const reason = window.prompt('Reason for rejection (sent to candidate):') ?? null;
        if (reason === null) return;
        setActing(true);
        try {
            await premiumCandidateReviewAPI.reject(requestId, reason || undefined);
            toast.success('Request rejected.');
            onActed();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reject.');
        } finally {
            setActing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[85vh] overflow-y-auto">
                {loading ? (
                    <p className="text-sm text-gray-400">Loading…</p>
                ) : !detail ? (
                    <p className="text-sm text-gray-400">Not found.</p>
                ) : (
                    <>
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">{detail.candidate_name}</h3>
                                <p className="text-xs text-gray-500">{detail.candidate_email} {detail.candidate_phone ? `· ${detail.candidate_phone}` : ''}</p>
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                            <div className="bg-gray-50 rounded-lg px-3 py-2">
                                <p className="text-gray-400">Declared CTC</p>
                                <p className="font-semibold text-gray-800">{fmtINR(detail.declared_annual_ctc)}/yr</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg px-3 py-2">
                                <p className="text-gray-400">Headline</p>
                                <p className="font-semibold text-gray-800">{detail.headline || '—'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg px-3 py-2">
                                <p className="text-gray-400">Experience</p>
                                <p className="font-semibold text-gray-800">{detail.total_experience ? `${parseFloat(detail.total_experience).toFixed(1)} yrs` : '—'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg px-3 py-2">
                                <p className="text-gray-400">Location</p>
                                <p className="font-semibold text-gray-800">{detail.current_location || '—'}</p>
                            </div>
                        </div>

                        <p className="text-xs font-semibold text-gray-600 mb-2">Payslips ({detail.payslips.length})</p>
                        {detail.payslips.length === 0 ? (
                            <p className="text-xs text-gray-400 mb-4">No payslips uploaded.</p>
                        ) : (
                            <div className="flex flex-col gap-1.5 mb-4">
                                {detail.payslips.map(p => (
                                    <a
                                        key={p.id}
                                        href={hrDocumentAPI.downloadUrl(detail.candidate_id, p.id)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between text-xs border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition"
                                    >
                                        <span className="text-gray-700 truncate">{p.original_name}</span>
                                        <span className="text-gray-400 shrink-0 ml-2">{fmtDate(p.created_at)}</span>
                                    </a>
                                ))}
                            </div>
                        )}

                        {detail.status === 'pending' ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleApprove}
                                    disabled={acting}
                                    className="flex-1 bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
                                >
                                    {acting ? '…' : 'Approve'}
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={acting}
                                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition"
                                >
                                    Reject
                                </button>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500">
                                Status: <span className="font-semibold capitalize">{detail.status}</span>
                                {detail.review_note ? ` — ${detail.review_note}` : ''}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function PremiumCandidateRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState(null);

    const load = () => {
        setLoading(true);
        premiumCandidateReviewAPI.list('pending')
            .then(({ data }) => setRequests(data.data || []))
            .catch(() => toast.error('Failed to load requests.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    if (loading) return <div className="text-gray-400 text-sm p-4">Loading…</div>;

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Candidate Premium Requests</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Candidates who've declared ≥₹6 LPA and uploaded payslips for verification.
                </p>
            </div>

            {requests.length === 0 ? (
                <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-12 text-center text-sm text-gray-400">
                    No pending requests.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {requests.map(r => (
                        <button
                            key={r.id}
                            onClick={() => setOpenId(r.id)}
                            className="text-left bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900">{r.candidate_name}</p>
                                    <p className="text-xs text-gray-500">{r.candidate_email}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-semibold text-indigo-700">{fmtINR(r.declared_annual_ctc)}/yr</p>
                                    <p className="text-[11px] text-gray-400">{r.payslip_count} payslip{r.payslip_count !== 1 ? 's' : ''} · {fmtDate(r.created_at)}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {openId && (
                <DetailPanel
                    requestId={openId}
                    onClose={() => setOpenId(null)}
                    onActed={() => { setOpenId(null); load(); }}
                />
            )}
        </div>
    );
}

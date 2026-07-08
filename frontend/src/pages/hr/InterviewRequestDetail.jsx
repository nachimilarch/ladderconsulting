import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { interviewRequestAPI } from '../../api/payments';
import toast from 'react-hot-toast';

const fmtDT = (d) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
}) + ' IST' : '—';

const EMPTY_APPROVE = { slot_datetime: '', duration_mins: '', mode: '', meeting_link: '', location_detail: '' };

export default function InterviewRequestDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [approveForm, setApproveForm] = useState(EMPTY_APPROVE);
    const [rejectReason, setRejectReason] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        interviewRequestAPI.getExecDetail(id)
            .then(r => {
                const data = r.data?.data || null;
                setRequest(data);
                if (data?.metadata) {
                    const meta = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
                    setApproveForm({
                        slot_datetime: meta.proposed_datetime ? new Date(meta.proposed_datetime).toISOString().slice(0, 16) : '',
                        duration_mins: meta.duration_mins || 60,
                        mode: meta.mode || 'video',
                        meeting_link: meta.meeting_link || '',
                        location_detail: meta.location_detail || '',
                    });
                }
            })
            .catch(() => toast.error('Failed to load request.'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleApprove = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                slot_datetime: approveForm.slot_datetime,
                duration_mins: parseInt(approveForm.duration_mins) || 60,
                mode: approveForm.mode,
                meeting_link: approveForm.meeting_link || undefined,
                location_detail: approveForm.location_detail || undefined,
            };
            await interviewRequestAPI.approve(id, payload);
            toast.success('Interview approved and slot created.');
            navigate('/hr/interview-requests');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to approve request.');
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async (e) => {
        e.preventDefault();
        if (!rejectReason.trim()) return toast.error('Rejection reason is required.');
        setSaving(true);
        try {
            await interviewRequestAPI.reject(id, { rejection_reason: rejectReason });
            toast.success('Request rejected. Company has been notified.');
            navigate('/hr/interview-requests');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reject request.');
        } finally {
            setSaving(false);
        }
    };

    const f = (k) => (e) => setApproveForm(p => ({ ...p, [k]: e.target.value }));

    if (loading) return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>;
    if (!request) return <div className="text-center py-12 text-red-500">Request not found.</div>;

    const meta = request.metadata ? (typeof request.metadata === 'string' ? JSON.parse(request.metadata) : request.metadata) : {};
    const isFinalized = ['resolved', 'rejected', 'cancelled'].includes(request.status);

    return (
        <div className="max-w-3xl mx-auto">
            <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
                ← Back
            </button>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
                <div className="flex items-center gap-2 mb-4">
                    <h1 className="text-xl font-bold text-gray-900">Interview Request Detail</h1>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        request.status === 'resolved' ? 'bg-green-100 text-green-700' :
                        request.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-500'
                    }`}>
                        {request.status}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Company</p>
                        <p className="font-medium text-gray-800">{request.company_name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Candidate</p>
                        <p className="font-medium text-gray-800">{request.candidate_name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Job Title</p>
                        <p className="text-gray-700">{request.job_title}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Contact</p>
                        <p className="text-gray-700">{request.company_contact}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Submitted</p>
                        <p className="text-gray-700">{fmtDT(request.created_at)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Request Type</p>
                        <p className="text-gray-700 capitalize">{request.request_type?.replace('_', ' ')}</p>
                    </div>
                </div>

                {request.request_note && (
                    <div className="mt-4 bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Company Note</p>
                        <p className="text-sm text-gray-700">{request.request_note}</p>
                    </div>
                )}

                <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Proposed Interview Details</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                            <p className="text-xs text-gray-400">Date & Time</p>
                            <p className="font-medium text-gray-800">{fmtDT(meta.proposed_datetime)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Mode</p>
                            <p className="capitalize text-gray-700">{meta.mode}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Duration</p>
                            <p className="text-gray-700">{meta.duration_mins || 60} mins</p>
                        </div>
                        {meta.meeting_link && (
                            <div className="col-span-2">
                                <p className="text-xs text-gray-400">Meeting Link</p>
                                <a href={meta.meeting_link} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs hover:underline break-all">{meta.meeting_link}</a>
                            </div>
                        )}
                        {meta.location_detail && (
                            <div className="col-span-2">
                                <p className="text-xs text-gray-400">Location</p>
                                <p className="text-gray-700">{meta.location_detail}</p>
                            </div>
                        )}
                    </div>
                </div>

                {request.rejection_reason && (
                    <div className="mt-4 bg-red-50 rounded-xl p-3 border border-red-100">
                        <p className="text-xs text-red-400 uppercase tracking-wide mb-1">Rejection Reason</p>
                        <p className="text-sm text-red-700">{request.rejection_reason}</p>
                    </div>
                )}
            </div>

            {!isFinalized && (
                <div className="flex gap-3">
                    <button
                        onClick={() => { setShowApprove(true); setShowReject(false); }}
                        className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 transition"
                    >
                        Approve & Confirm Interview
                    </button>
                    <button
                        onClick={() => { setShowReject(true); setShowApprove(false); }}
                        className="flex-1 bg-red-50 text-red-600 border border-red-200 py-2.5 rounded-xl text-sm font-medium hover:bg-red-100 transition"
                    >
                        Reject with Reason
                    </button>
                </div>
            )}

            {/* Approve Form */}
            {showApprove && (
                <div className="mt-4 bg-white rounded-2xl border border-green-200 shadow-sm p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Confirm Interview Details</h2>
                    <p className="text-xs text-gray-500 mb-4">You can modify the proposed details before approving. Your confirmed details will be used to create the interview slot.</p>
                    <form onSubmit={handleApprove} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date & Time *</label>
                            <input
                                type="datetime-local"
                                value={approveForm.slot_datetime}
                                onChange={f('slot_datetime')}
                                required
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Duration (mins)</label>
                            <input
                                type="number"
                                value={approveForm.duration_mins}
                                onChange={f('duration_mins')}
                                min="15" step="15"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
                            <select value={approveForm.mode} onChange={f('mode')}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="video">Video Call</option>
                                <option value="phone">Phone</option>
                                <option value="in_person">In Person</option>
                            </select>
                        </div>
                        {approveForm.mode === 'video' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Meeting Link</label>
                                <input type="url" value={approveForm.meeting_link} onChange={f('meeting_link')}
                                    placeholder="https://meet.google.com/..."
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                        )}
                        {approveForm.mode === 'in_person' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                                <input value={approveForm.location_detail} onChange={f('location_detail')}
                                    placeholder="Office address / room"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                        )}
                        <div className="md:col-span-2 flex gap-3">
                            <button type="submit" disabled={saving || !approveForm.slot_datetime}
                                className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition">
                                {saving ? 'Confirming…' : 'Confirm & Create Interview Slot'}
                            </button>
                            <button type="button" onClick={() => setShowApprove(false)}
                                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Reject Form */}
            {showReject && (
                <div className="mt-4 bg-white rounded-2xl border border-red-200 shadow-sm p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Reject Interview Request</h2>
                    <form onSubmit={handleReject} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Reason for Rejection *</label>
                            <textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                rows={3}
                                required
                                placeholder="e.g. Unavailable at that time, please propose an alternate slot..."
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button type="submit" disabled={saving || !rejectReason.trim()}
                                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition">
                                {saving ? 'Rejecting…' : 'Reject & Notify Company'}
                            </button>
                            <button type="button" onClick={() => setShowReject(false)}
                                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

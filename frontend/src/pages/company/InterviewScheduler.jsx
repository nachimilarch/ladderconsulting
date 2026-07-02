import { useEffect, useState, useCallback } from 'react';
import { companyInterviewAPI, offerRequestAPI } from '../../api/interview';
import { interviewRequestAPI } from '../../api/payments';
import { companyJobAPI, companyAPI } from '../../api/company';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    proposed: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    rescheduled: 'bg-blue-100 text-blue-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
};

const MODE_LABELS = { video: 'Video', phone: 'Phone', in_person: 'In-Person' };

const EMPTY_REQUEST = {
    application_id: '', proposed_datetime: '', duration_mins: 60,
    mode: 'video', meeting_link: '', location_detail: '', request_note: '',
};

const EMPTY_OUTCOME = { result: 'selected', feedback: '', interviewer_name: '' };
const EMPTY_OFFER = { joining_date: '', valid_until: '', notes: '' };
const EMPTY_OFFER_REQUEST = { offered_ctc: '', request_note: '' };
const EMPTY_RESCHEDULE = { proposed_datetime: '', duration_mins: 60, mode: 'video', meeting_link: '', location_detail: '', request_note: '' };

export default function InterviewScheduler() {
    const [slots, setSlots] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [shortlisted, setShortlisted] = useState([]);
    const [selectedJob, setSelectedJob] = useState('');
    const [loading, setLoading] = useState(true);

    // Request panel
    const [showRequest, setShowRequest] = useState(false);
    const [requestForm, setRequestForm] = useState(EMPTY_REQUEST);
    const [savingRequest, setSavingRequest] = useState(false);

    // Reschedule panel
    const [rescheduleSlot, setRescheduleSlot] = useState(null);
    const [rescheduleForm, setRescheduleForm] = useState(EMPTY_RESCHEDULE);
    const [savingReschedule, setSavingReschedule] = useState(false);

    // Outcome panel
    const [outcomeSlot, setOutcomeSlot] = useState(null);
    const [outcome, setOutcome] = useState(EMPTY_OUTCOME);
    const [savingOutcome, setSavingOutcome] = useState(false);

    // Offer letter grant statuses
    const [grantStatuses, setGrantStatuses] = useState({});

    // Offer letter request panel (placement fee)
    const [offerReqSlot, setOfferReqSlot] = useState(null);
    const [offerReqForm, setOfferReqForm] = useState(EMPTY_OFFER_REQUEST);
    const [savingOfferReq, setSavingOfferReq] = useState(false);

    // Offer generation panel
    const [offerSlot, setOfferSlot] = useState(null);
    const [offerForm, setOfferForm] = useState(EMPTY_OFFER);
    const [savingOffer, setSavingOffer] = useState(false);

    // Track pending interview requests per application
    const [interviewRequestStatuses, setInterviewRequestStatuses] = useState({});

    // Contracted placement-fee rate (Platinum only) — % of ANNUAL CTC, null = default 1x-monthly
    const [feePercent, setFeePercent] = useState(null);

    const loadSlots = useCallback(() =>
        companyInterviewAPI.listSlots().then(({ data }) => setSlots(data.slots || [])),
        []);

    const fetchGrantStatus = useCallback(async (applicationId) => {
        if (!applicationId || grantStatuses[applicationId] !== undefined) return;
        try {
            const { data } = await offerRequestAPI.getStatus(applicationId);
            setGrantStatuses(prev => ({ ...prev, [applicationId]: data }));
        } catch { /* non-fatal */ }
    }, [grantStatuses]);

    const fetchInterviewRequestStatus = useCallback(async (applicationId) => {
        if (!applicationId || interviewRequestStatuses[applicationId] !== undefined) return;
        try {
            const { data } = await interviewRequestAPI.getStatus(applicationId);
            setInterviewRequestStatuses(prev => ({ ...prev, [applicationId]: data }));
        } catch { /* non-fatal */ }
    }, [interviewRequestStatuses]);

    useEffect(() => {
        Promise.all([companyInterviewAPI.listSlots(), companyJobAPI.list()])
            .then(([slotRes, jobRes]) => {
                setSlots(slotRes.data.slots || []);
                setJobs(jobRes.data.jobs || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
        companyAPI.getProfile()
            .then(({ data }) => setFeePercent(data?.company?.placement_fee_percent ?? null))
            .catch(() => {});
    }, []);

    useEffect(() => {
        slots.forEach(s => {
            if (s.outcome_result === 'selected' && s.application_id) fetchGrantStatus(s.application_id);
        });
    }, [slots]);

    useEffect(() => {
        if (!selectedJob) { setShortlisted([]); return; }
        companyJobAPI.getApplications(selectedJob)
            .then(({ data }) => {
                const apps = (data.applications || []).filter(a =>
                    ['shortlisted', 'under_review'].includes(a.status)
                );
                setShortlisted(apps);
                apps.forEach(a => fetchInterviewRequestStatus(a.id));
            })
            .catch(console.error);
    }, [selectedJob]);

    const rf = (k) => (e) => setRequestForm(prev => ({ ...prev, [k]: e.target.value }));

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        setSavingRequest(true);
        try {
            await interviewRequestAPI.submit({
                application_id: parseInt(requestForm.application_id),
                proposed_datetime: requestForm.proposed_datetime,
                duration_mins: parseInt(requestForm.duration_mins) || 60,
                mode: requestForm.mode,
                meeting_link: requestForm.meeting_link || undefined,
                location_detail: requestForm.location_detail || undefined,
                request_note: requestForm.request_note || undefined,
            });
            toast.success('Interview request submitted. Awaiting executive confirmation.');
            setShowRequest(false);
            setRequestForm(EMPTY_REQUEST);
            setSelectedJob('');
            // Refresh status for this application
            const appId = requestForm.application_id;
            setInterviewRequestStatuses(prev => { const n = { ...prev }; delete n[appId]; return n; });
            setTimeout(() => fetchInterviewRequestStatus(appId), 500);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setSavingRequest(false);
        }
    };

    const handleSubmitReschedule = async (e) => {
        e.preventDefault();
        if (!rescheduleSlot) return;
        setSavingReschedule(true);
        try {
            // Find the original company_request id for this application
            const statusData = interviewRequestStatuses[rescheduleSlot.application_id];
            const requestId = statusData?.request_id;
            if (!requestId) {
                toast.error('Could not find original request. Please contact support.');
                setSavingReschedule(false);
                return;
            }
            await interviewRequestAPI.reschedule(requestId, {
                proposed_datetime: rescheduleForm.proposed_datetime,
                duration_mins: parseInt(rescheduleForm.duration_mins) || 60,
                mode: rescheduleForm.mode,
                meeting_link: rescheduleForm.meeting_link || undefined,
                location_detail: rescheduleForm.location_detail || undefined,
                request_note: rescheduleForm.request_note || undefined,
            });
            toast.success('Reschedule request submitted.');
            setRescheduleSlot(null);
            setRescheduleForm(EMPTY_RESCHEDULE);
            loadSlots();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit reschedule request.');
        } finally {
            setSavingReschedule(false);
        }
    };

    const handleCancel = async (slotId) => {
        if (!window.confirm('Cancel this interview slot?')) return;
        try {
            await companyInterviewAPI.cancelSlot(slotId);
            loadSlots();
        } catch { toast.error('Failed to cancel interview.'); }
    };

    const handleRecordOutcome = async (e) => {
        e.preventDefault();
        setSavingOutcome(true);
        try {
            await companyInterviewAPI.recordOutcome(outcomeSlot.id, outcome);
            toast.success('Outcome recorded.');
            setOutcomeSlot(null);
            setOutcome(EMPTY_OUTCOME);
            loadSlots();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record outcome.');
        } finally {
            setSavingOutcome(false);
        }
    };

    const handleSubmitOfferRequest = async (e) => {
        e.preventDefault();
        setSavingOfferReq(true);
        try {
            await offerRequestAPI.submit({
                application_id: offerReqSlot.application_id,
                offered_ctc: parseFloat(offerReqForm.offered_ctc),
                request_note: offerReqForm.request_note,
            });
            toast.success('Offer letter request submitted.');
            setOfferReqSlot(null);
            setOfferReqForm(EMPTY_OFFER_REQUEST);
            setGrantStatuses(prev => { const n = { ...prev }; delete n[offerReqSlot.application_id]; return n; });
            fetchGrantStatus(offerReqSlot.application_id);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setSavingOfferReq(false);
        }
    };

    const handleGenerateOffer = async (e) => {
        e.preventDefault();
        setSavingOffer(true);
        const gs = grantStatuses[offerSlot.application_id];
        // gs.offered_ctc is already the annual figure entered at request time.
        const annualCTC = gs?.offered_ctc ? parseFloat(gs.offered_ctc) : null;
        try {
            await companyInterviewAPI.generateOffer(offerSlot.id, {
                ctc: annualCTC,
                joining_date: offerForm.joining_date || null,
                valid_until: offerForm.valid_until || null,
                notes: offerForm.notes || null,
            });
            toast.success('Offer sent to candidate.');
            setOfferSlot(null);
            setOfferForm(EMPTY_OFFER);
            loadSlots();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to generate offer.');
        } finally {
            setSavingOffer(false);
        }
    };

    const canRecordOutcome = (slot) =>
        ['confirmed', 'proposed', 'rescheduled'].includes(slot.status) && !slot.outcome_result;

    const renderOfferLetterAction = (slot) => {
        if (slot.outcome_result !== 'selected' || slot.offer_id) return null;
        const gs = grantStatuses[slot.application_id];
        if (!gs || gs.status === 'none') {
            return (
                <button onClick={() => { setOfferReqSlot(slot); setOfferReqForm(EMPTY_OFFER_REQUEST); }}
                    className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-100 transition">
                    Request Offer Letter Release
                </button>
            );
        }
        if (gs.status === 'pending' || gs.status === 'in_progress') {
            return <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg px-3 py-1.5">Awaiting Approval</span>;
        }
        if (gs.status === 'rejected') {
            return (
                <div className="flex flex-col items-end gap-1">
                    <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5">Request Rejected</span>
                    <span className="text-[10px] text-red-400">{gs.rejection_reason}</span>
                    <button onClick={() => { setOfferReqSlot(slot); setOfferReqForm(EMPTY_OFFER_REQUEST); }}
                        className="text-xs text-indigo-600 hover:underline mt-0.5">Re-submit Request</button>
                </div>
            );
        }
        if (gs.status === 'approved' || gs.status === 'resolved') {
            return (
                <button onClick={() => { setOfferSlot(slot); setOfferForm(EMPTY_OFFER); }}
                    className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 transition">
                    Generate Offer Letter
                </button>
            );
        }
        return null;
    };

    // ctcVal is the ANNUAL CTC the company enters. feePercent (Platinum contracted
    // rate) applies directly to it — 8.33% = 1/12 = exactly one month's salary.
    // Default (no contracted rate) fee is 1x monthly CTC, i.e. annual / 12.
    // Placement fees (Platinum %) carry 18% GST on top; Single/5-Pack are GST-inclusive.
    const ctcVal = parseFloat(offerReqForm.offered_ctc);
    const estimatedFee = !isNaN(ctcVal) && ctcVal > 0
        ? Math.round(feePercent != null ? ctcVal * (parseFloat(feePercent) / 100) : ctcVal / 12)
        : null;
    const estimatedGst   = estimatedFee != null ? Math.round(estimatedFee * 0.18) : null;
    const estimatedTotal = estimatedFee != null ? estimatedFee + estimatedGst : null;

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
                <button onClick={() => setShowRequest(v => !v)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
                    {showRequest ? 'Cancel' : '+ Request Interview Slot'}
                </button>
            </div>

            {/* Request Interview Slot Form */}
            {showRequest && (
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-6 mb-6">
                    <h2 className="font-semibold text-gray-800 mb-2">Request Interview Slot</h2>
                    <p className="text-xs text-gray-500 mb-4">
                        Submit your proposed interview details. Your assigned LadderStep Human Consulting executive will review and confirm the slot.
                    </p>
                    <form onSubmit={handleSubmitRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Job Posting</label>
                            <select value={selectedJob} onChange={e => { setSelectedJob(e.target.value); setRequestForm(prev => ({ ...prev, application_id: '' })); }}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">Select a job</option>
                                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Candidate *</label>
                            <select value={requestForm.application_id}
                                onChange={e => setRequestForm(prev => ({ ...prev, application_id: e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                disabled={!selectedJob}>
                                <option value="">Select candidate</option>
                                {shortlisted.map(a => {
                                    const reqStatus = interviewRequestStatuses[a.id];
                                    const hasPending = reqStatus?.status && !['none', 'rejected', 'cancelled'].includes(reqStatus.status);
                                    return (
                                        <option key={a.id} value={a.id} disabled={hasPending}>
                                            {a.candidate_name}{hasPending ? ` (${reqStatus.status})` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Proposed Date & Time *</label>
                            <input type="datetime-local" value={requestForm.proposed_datetime} onChange={rf('proposed_datetime')} required
                                min={new Date().toISOString().slice(0, 16)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Duration (mins)</label>
                            <input type="number" value={requestForm.duration_mins} onChange={rf('duration_mins')} min="15" step="15"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
                            <select value={requestForm.mode} onChange={rf('mode')}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="video">Video Call</option>
                                <option value="phone">Phone</option>
                                <option value="in_person">In Person</option>
                            </select>
                        </div>
                        {requestForm.mode === 'video' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Meeting Link</label>
                                <input type="url" value={requestForm.meeting_link} onChange={rf('meeting_link')} placeholder="https://meet.google.com/..."
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        )}
                        {requestForm.mode === 'in_person' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                                <input value={requestForm.location_detail} onChange={rf('location_detail')} placeholder="Office address / room"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        )}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Note to Executive (optional)</label>
                            <textarea value={requestForm.request_note} onChange={rf('request_note')} rows={2}
                                placeholder="Any context or special requirements..."
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="md:col-span-2 flex gap-3">
                            <button type="submit" disabled={savingRequest || !requestForm.application_id}
                                className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition">
                                {savingRequest ? 'Submitting…' : 'Submit Request'}
                            </button>
                            <button type="button" onClick={() => setShowRequest(false)}
                                className="border border-gray-300 text-gray-600 px-5 py-2 rounded-xl text-sm hover:bg-gray-50 transition">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Record Outcome Modal */}
            {outcomeSlot && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="font-semibold text-gray-800 mb-4">Record Outcome — {outcomeSlot.candidate_name}</h2>
                        <form onSubmit={handleRecordOutcome} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Result</label>
                                <select value={outcome.result} onChange={e => setOutcome(o => ({ ...o, result: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                                    <option value="selected">Selected</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="hold">On Hold</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Interviewer Name</label>
                                <input value={outcome.interviewer_name} onChange={e => setOutcome(o => ({ ...o, interviewer_name: e.target.value }))}
                                    placeholder="Who conducted the interview?"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Feedback / Notes</label>
                                <textarea value={outcome.feedback} onChange={e => setOutcome(o => ({ ...o, feedback: e.target.value }))}
                                    rows={3} placeholder="Interview notes..."
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={savingOutcome}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                                    {savingOutcome ? 'Saving…' : 'Save Outcome'}
                                </button>
                                <button type="button" onClick={() => setOutcomeSlot(null)}
                                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reschedule Modal */}
            {rescheduleSlot && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="font-semibold text-gray-800 mb-1">Request Reschedule</h2>
                        <p className="text-xs text-gray-500 mb-4">{rescheduleSlot.candidate_name} · {rescheduleSlot.job_title}</p>
                        <form onSubmit={handleSubmitReschedule} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">New Proposed Date & Time *</label>
                                <input type="datetime-local" value={rescheduleForm.proposed_datetime}
                                    onChange={e => setRescheduleForm(f => ({ ...f, proposed_datetime: e.target.value }))}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
                                <select value={rescheduleForm.mode} onChange={e => setRescheduleForm(f => ({ ...f, mode: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                                    <option value="video">Video Call</option>
                                    <option value="phone">Phone</option>
                                    <option value="in_person">In Person</option>
                                </select>
                            </div>
                            {rescheduleForm.mode === 'video' && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Meeting Link</label>
                                    <input type="url" value={rescheduleForm.meeting_link}
                                        onChange={e => setRescheduleForm(f => ({ ...f, meeting_link: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Note to Executive</label>
                                <textarea value={rescheduleForm.request_note}
                                    onChange={e => setRescheduleForm(f => ({ ...f, request_note: e.target.value }))}
                                    rows={2} placeholder="Reason for reschedule..."
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={savingReschedule || !rescheduleForm.proposed_datetime}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                                    {savingReschedule ? 'Submitting…' : 'Submit Reschedule Request'}
                                </button>
                                <button type="button" onClick={() => setRescheduleSlot(null)}
                                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Request Offer Letter Release Modal */}
            {offerReqSlot && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="font-semibold text-gray-800 mb-1">Request Offer Letter Release</h2>
                        <p className="text-xs text-gray-500 mb-4">Candidate: <strong>{offerReqSlot.candidate_name}</strong> · {offerReqSlot.job_title}</p>

                        <form onSubmit={handleSubmitOfferRequest} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Offered Annual CTC (INR) *</label>
                                <input type="number" min="1" value={offerReqForm.offered_ctc}
                                    onChange={e => setOfferReqForm(f => ({ ...f, offered_ctc: e.target.value }))}
                                    required placeholder="e.g. 100000"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            {estimatedFee && !offerReqSlot.prepaid_unlock && (
                                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                                    <div className="flex justify-between text-gray-500">
                                        <span>Placement Fee {feePercent != null ? `(${parseFloat(feePercent)}% of CTC)` : '(1× monthly CTC)'}</span>
                                        <span>₹{estimatedFee.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-500">
                                        <span>GST (18%)</span>
                                        <span>₹{estimatedGst.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1">
                                        <span>Total Payable</span>
                                        <span>₹{estimatedTotal.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Message to Executive (optional)</label>
                                <textarea value={offerReqForm.request_note}
                                    onChange={e => setOfferReqForm(f => ({ ...f, request_note: e.target.value }))}
                                    rows={2} placeholder="Any context or notes..."
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={savingOfferReq || !offerReqForm.offered_ctc}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                                    {savingOfferReq ? 'Submitting…' : 'Submit Request'}
                                </button>
                                <button type="button" onClick={() => setOfferReqSlot(null)}
                                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Generate Offer Modal */}
            {offerSlot && (() => {
                const gs = grantStatuses[offerSlot.application_id];
                // gs.offered_ctc is the annual figure entered at request time.
                const annualCTC = gs?.offered_ctc ? parseFloat(gs.offered_ctc) : null;
                const monthlyCTC = annualCTC ? annualCTC / 12 : null;
                const fmtINR = (n) => n ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';
                return (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                            <h2 className="font-semibold text-gray-800 mb-1">Generate Offer — {offerSlot.candidate_name}</h2>
                            <p className="text-xs text-green-600 mb-4">
                                {offerSlot.prepaid_unlock ? 'Offer letter is approved.' : 'Placement fee confirmed. Offer letter is approved.'}
                            </p>
                            <div className="bg-gray-50 rounded-xl p-3 mb-4 grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <p className="text-gray-400 uppercase tracking-wide mb-0.5">Annual CTC</p>
                                    <p className="font-semibold text-gray-800">{fmtINR(annualCTC)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 uppercase tracking-wide mb-0.5">Monthly Equivalent</p>
                                    <p className="font-semibold text-indigo-700">{fmtINR(monthlyCTC)}</p>
                                </div>
                            </div>
                            <form onSubmit={handleGenerateOffer} className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Joining Date *</label>
                                    <input type="date" value={offerForm.joining_date} required
                                        onChange={e => setOfferForm(o => ({ ...o, joining_date: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Offer Valid Until</label>
                                    <input type="date" value={offerForm.valid_until}
                                        onChange={e => setOfferForm(o => ({ ...o, valid_until: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                                    <textarea value={offerForm.notes}
                                        onChange={e => setOfferForm(o => ({ ...o, notes: e.target.value }))}
                                        rows={2} placeholder="Benefits, probation period..."
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                                </div>
                                <div className="flex gap-3">
                                    <button type="submit" disabled={savingOffer || !offerForm.joining_date}
                                        className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                                        {savingOffer ? 'Sending…' : 'Generate & Send Offer'}
                                    </button>
                                    <button type="button" onClick={() => setOfferSlot(null)}
                                        className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

            {/* Slots List */}
            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
            ) : slots.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="text-3xl mb-3 text-gray-300">🗓</div>
                    <h3 className="font-semibold text-gray-700 mb-1">No interviews scheduled</h3>
                    <p className="text-sm text-gray-500">Submit an interview slot request to get started.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {slots.map(slot => {
                        const statusCls = STATUS_COLORS[slot.status] || 'bg-gray-100 text-gray-500';
                        return (
                            <div key={slot.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-semibold text-gray-900">{slot.candidate_name}</h3>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCls}`}>
                                                {slot.status}
                                            </span>
                                            {slot.candidate_confirmed ? (
                                                <span className="text-xs text-green-600 font-medium">Confirmed by candidate</span>
                                            ) : (
                                                <span className="text-xs text-gray-400">Awaiting candidate confirmation</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2">{slot.job_title}</p>
                                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                            <span>{new Date(slot.slot_datetime).toLocaleString('en-IN', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit',
                                            })}</span>
                                            <span>{MODE_LABELS[slot.mode]}</span>
                                            <span>{slot.duration_mins} min</span>
                                        </div>
                                        {slot.outcome_result && (
                                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${slot.outcome_result === 'selected' ? 'bg-green-100 text-green-700' :
                                                        slot.outcome_result === 'rejected' ? 'bg-red-100 text-red-600' :
                                                            'bg-yellow-100 text-yellow-700'
                                                    }`}>Outcome: {slot.outcome_result}</span>
                                                {slot.offer_id && <span className="text-xs text-teal-600 font-medium">Offer sent</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2 shrink-0 items-end">
                                        {canRecordOutcome(slot) && (
                                            <button onClick={() => { setOutcomeSlot(slot); setOutcome(EMPTY_OUTCOME); }}
                                                className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-100 transition">
                                                Record Outcome
                                            </button>
                                        )}
                                        {renderOfferLetterAction(slot)}
                                        {['proposed', 'confirmed'].includes(slot.status) && (
                                            <button onClick={() => { setRescheduleSlot(slot); setRescheduleForm({ ...EMPTY_RESCHEDULE, mode: slot.mode }); }}
                                                className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition">
                                                Request Reschedule
                                            </button>
                                        )}
                                        {['proposed', 'confirmed', 'rescheduled'].includes(slot.status) && (
                                            <button onClick={() => handleCancel(slot.id)}
                                                className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 transition">
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

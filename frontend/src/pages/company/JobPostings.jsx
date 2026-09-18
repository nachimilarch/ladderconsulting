import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { companyJobAPI, talentPoolAPI, premiumAPI } from '../../api/company';
import toast from 'react-hot-toast';
import AiAssistantPromo from '../../components/AiAssistantPromo';

const CASHFREE_SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';

const loadCashfreeSDK = () => new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const s = document.createElement('script');
    s.src = CASHFREE_SDK_URL;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
});

// Non-blocking pricing banner for Standard-tier companies — job posting is
// priced per-JD (₹3,999 each, charged at the point of posting via Cashfree,
// see handleSave below), not a one-time account activation, so there's
// nothing to "unlock" up front any more. This just surfaces the pricing and
// the Platinum alternative. Fully self-contained (own status fetch, own
// request handler) — matches components/company/PremiumTierCard.jsx's pattern.
function PlatinumBanner() {
    const [premiumRequestedAt, setPremiumRequestedAt] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [note, setNote] = useState('');
    const [requesting, setRequesting] = useState(false);
    const [justRequested, setJustRequested] = useState(false);

    useEffect(() => {
        talentPoolAPI.activationStatus()
            .then(r => setPremiumRequestedAt(r.data?.premium_requested_at || null))
            .catch(() => {});
    }, []);

    const handleRequestPremium = async () => {
        setRequesting(true);
        try {
            const { data } = await premiumAPI.request(note.trim() || undefined);
            toast.success(data?.message || 'Request sent.');
            setJustRequested(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send request.');
        } finally {
            setRequesting(false);
        }
    };

    const alreadyRequested = justRequested || !!premiumRequestedAt;

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-6 text-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-gray-700">
                    <strong>₹3,999</strong> per job you post. A placement fee also applies per hire.
                </p>
                {!alreadyRequested && (
                    <button onClick={() => setExpanded(x => !x)} className="text-yellow-700 font-semibold hover:underline text-xs shrink-0">
                        {expanded ? 'Hide' : '⭐ Or go Platinum — no per-job fee →'}
                    </button>
                )}
                {alreadyRequested && (
                    <span className="text-green-700 text-xs font-medium shrink-0">✓ Platinum request sent — your executive will follow up.</span>
                )}
            </div>
            {expanded && !alreadyRequested && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                    <p className="text-xs text-gray-500 mb-2">
                        Platinum: no listing/per-job fee, full pool including Premium candidates, 8.33% placement fee per hire instead. Requires executive approval.
                    </p>
                    <div className="flex gap-2">
                        <input
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Optional note for your executive…"
                            className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                            onClick={handleRequestPremium}
                            disabled={requesting}
                            className="border border-yellow-400 text-yellow-700 font-semibold px-4 py-1.5 rounded-lg hover:bg-yellow-100 disabled:opacity-60 transition text-xs whitespace-nowrap"
                        >
                            {requesting ? '…' : 'Request Platinum Access'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const STATUS_COLORS = {
    pending_payment: 'bg-amber-100 text-amber-700',
    draft:   'bg-gray-100 text-gray-600',
    active:  'bg-green-100 text-green-700',
    paused:  'bg-yellow-100 text-yellow-700',
    closed:  'bg-red-100 text-red-600',
};

const EMPTY_FORM = {
    title: '', description: '', requirements: '', location: '',
    job_type: 'full_time', work_mode: 'onsite',
    salary_min: '', salary_max: '', experience_min: '', experience_max: '',
    openings: 1, status: 'active',
};

export default function JobPostings() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [companyTier, setCompanyTier] = useState('standard');
    const [payingJobId, setPayingJobId] = useState(null);

    const load = () => {
        setLoading(true);
        companyJobAPI.list()
            .then(({ data }) => setJobs(data.jobs || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        talentPoolAPI.activationStatus()
            .then(r => setCompanyTier(r.data?.company_tier || 'standard'))
            .catch(() => {});
    }, []);

    const redirectToCheckout = async (payment) => {
        await loadCashfreeSDK();
        const mode = payment.cashfree_env === 'PROD' ? 'production' : 'sandbox';
        const cf = new window.Cashfree({ mode });
        cf.checkout({ paymentSessionId: payment.payment_session_id });
    };

    const handlePayNow = async (jobId) => {
        setPayingJobId(jobId);
        try {
            const { data } = await companyJobAPI.pay(jobId);
            if (data?.payment_session_id) await redirectToCheckout(data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to initiate payment.');
            setPayingJobId(null);
        }
    };

    const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };
    const openEdit = (job) => {
        setEditing(job);
        setForm({
            title: job.title || '', description: job.description || '',
            requirements: job.requirements || '', location: job.location || '',
            job_type: job.job_type || 'full_time', work_mode: job.work_mode || 'onsite',
            salary_min: job.salary_min || '', salary_max: job.salary_max || '',
            experience_min: job.experience_min || '', experience_max: job.experience_max || '',
            openings: job.openings || 1,
            status: job.status || 'draft',
        });
        setError('');
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            if (editing) {
                // Editing an already-posted job is free — no per-JD fee applies.
                await companyJobAPI.update(editing.id, form);
                setShowModal(false);
                load();
            } else {
                const { data } = await companyJobAPI.create(form);
                setShowModal(false);
                load();
                if (data?.payment_session_id) {
                    // Standard tier: job was created as 'pending_payment' — it
                    // only goes live once this Cashfree checkout succeeds.
                    await redirectToCheckout(data);
                }
                // Platinum tier: data.id present, job is already live, nothing more to do.
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save job.');
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (id, status) => {
        try {
            await companyJobAPI.setStatus(id, status);
            load();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this job posting?')) return;
        try {
            await companyJobAPI.remove(id);
            load();
        } catch (err) {
            console.error(err);
        }
    };

    const f = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
                <button onClick={openCreate}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
                    + Post a Job
                </button>
            </div>

            <AiAssistantPromo text="ask it to draft this job posting for you, or find matching candidates once it's live." />

            {companyTier !== 'premium' && <PlatinumBanner />}

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
            ) : jobs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                    <div className="text-4xl mb-3">💼</div>
                    <h3 className="font-semibold text-gray-700 mb-1">No job postings yet</h3>
                    <p className="text-sm text-gray-500 mb-4">Post your first job to start receiving applications.</p>
                    <button onClick={openCreate}
                        className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
                        + Post a Job
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                {['Job Title', 'Type', 'Location', 'Openings', 'Applicants', 'Status', 'Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {jobs.map(job => (
                                <tr key={job.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-800">{job.title}</div>
                                        </td>
                                    <td className="px-4 py-3 text-gray-600 capitalize">{job.job_type?.replace('_', ' ')}</td>
                                    <td className="px-4 py-3 text-gray-600">{job.location || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">{job.openings}</td>
                                    <td className="px-4 py-3 text-gray-600">{job.applicant_count}</td>
                                    <td className="px-4 py-3">
                                        {job.status === 'pending_payment' ? (
                                            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${STATUS_COLORS.pending_payment}`}>
                                                Awaiting Payment
                                            </span>
                                        ) : (
                                            <select
                                                value={job.status}
                                                onChange={e => handleStatusChange(job.id, e.target.value)}
                                                className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${STATUS_COLORS[job.status]}`}
                                            >
                                                <option value="draft">Draft</option>
                                                <option value="active">Active</option>
                                                <option value="paused">Paused</option>
                                                <option value="closed">Closed</option>
                                            </select>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 flex gap-2 items-center">
                                        {job.status === 'pending_payment' ? (
                                            <button onClick={() => handlePayNow(job.id)}
                                                disabled={payingJobId === job.id}
                                                className="text-indigo-600 hover:underline text-xs font-medium disabled:opacity-60">
                                                {payingJobId === job.id ? 'Redirecting…' : 'Pay ₹3,999'}
                                            </button>
                                        ) : (
                                            <button onClick={() => openEdit(job)}
                                                className="text-indigo-600 hover:underline text-xs">Edit</button>
                                        )}
                                        <button onClick={() => handleDelete(job.id)}
                                            className="text-red-500 hover:underline text-xs">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-800">
                                {editing ? 'Edit Job' : 'Post a New Job'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                        </div>

                        {error && (
                            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Job Title *</label>
                                    <input value={form.title} onChange={f('title')} required
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Job Type</label>
                                    <select value={form.job_type} onChange={f('job_type')}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="full_time">Full Time</option>
                                        <option value="part_time">Part Time</option>
                                        <option value="contract">Contract</option>
                                        <option value="internship">Internship</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Work Mode</label>
                                    <select value={form.work_mode} onChange={f('work_mode')}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="onsite">Onsite</option>
                                        <option value="remote">Remote</option>
                                        <option value="hybrid">Hybrid</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                                    <input value={form.location} onChange={f('location')} placeholder="e.g. Bangalore, India"
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Openings</label>
                                    <input type="number" min="1" value={form.openings} onChange={f('openings')}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Min Salary (₹/yr)</label>
                                    <input type="number" value={form.salary_min} onChange={f('salary_min')} placeholder="e.g. 500000"
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Max Salary (₹/yr)</label>
                                    <input type="number" value={form.salary_max} onChange={f('salary_max')} placeholder="e.g. 1000000"
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Min Experience (yrs)</label>
                                    <input type="number" step="0.5" value={form.experience_min} onChange={f('experience_min')}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Max Experience (yrs)</label>
                                    <input type="number" step="0.5" value={form.experience_max} onChange={f('experience_max')}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                {editing && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                                    <select value={form.status} onChange={f('status')}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                        <option value="paused">Paused</option>
                                    </select>
                                </div>
                                )}

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Job Description *</label>
                                    <textarea value={form.description} onChange={f('description')} required rows={4}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Requirements</label>
                                    <textarea value={form.requirements} onChange={f('requirements')} rows={3}
                                        placeholder="List skills, qualifications, and requirements..."
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={saving}
                                    className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition">
                                    {saving ? 'Saving...' : editing ? 'Update Job' : 'Post Job'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50 transition">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

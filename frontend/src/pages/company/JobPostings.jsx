import { useEffect, useState } from 'react';
import { companyJobAPI } from '../../api/company';

const STATUS_COLORS = {
    draft:   'bg-gray-100 text-gray-600',
    active:  'bg-green-100 text-green-700',
    paused:  'bg-yellow-100 text-yellow-700',
    closed:  'bg-red-100 text-red-600',
};

const EMPTY_FORM = {
    title: '', description: '', requirements: '', location: '',
    job_type: 'full_time', work_mode: 'onsite',
    salary_min: '', salary_max: '', experience_min: '', experience_max: '',
    openings: 1, deadline: '', status: 'active',
};

export default function JobPostings() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = () => {
        setLoading(true);
        companyJobAPI.list()
            .then(({ data }) => setJobs(data.jobs || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };
    const openEdit = (job) => {
        setEditing(job);
        setForm({
            title: job.title || '', description: job.description || '',
            requirements: job.requirements || '', location: job.location || '',
            job_type: job.job_type || 'full_time', work_mode: job.work_mode || 'onsite',
            salary_min: job.salary_min || '', salary_max: job.salary_max || '',
            experience_min: job.experience_min || '', experience_max: job.experience_max || '',
            openings: job.openings || 1, deadline: job.deadline?.split('T')[0] || '',
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
                await companyJobAPI.update(editing.id, form);
            } else {
                await companyJobAPI.create(form);
            }
            setShowModal(false);
            load();
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
                                        {job.deadline && (
                                            <div className="text-xs text-gray-400">
                                                Deadline: {new Date(job.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 capitalize">{job.job_type?.replace('_', ' ')}</td>
                                    <td className="px-4 py-3 text-gray-600">{job.location || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">{job.openings}</td>
                                    <td className="px-4 py-3 text-gray-600">{job.applicant_count}</td>
                                    <td className="px-4 py-3">
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
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button onClick={() => openEdit(job)}
                                            className="text-indigo-600 hover:underline text-xs">Edit</button>
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

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Application Deadline</label>
                                    <input type="date" value={form.deadline} onChange={f('deadline')}
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

// src/pages/hr/LeadPipeline.jsx
import { useEffect, useState } from 'react';
import { leadAPI, employeeAPI } from '../../api/hr';

const STAGES = ['new', 'contacted', 'warm', 'converted', 'lost'];
const STAGE_COLORS = {
    new: 'bg-gray-100 border-gray-300',
    contacted: 'bg-blue-50 border-blue-300',
    warm: 'bg-yellow-50 border-yellow-300',
    converted: 'bg-green-50 border-green-300',
    lost: 'bg-red-50 border-red-300',
};
const EMPTY_FORM = {
    company_name: '', contact_person: '', contact_email: '',
    contact_phone: '', source: '', assigned_to: '', notes: '',
};

export default function LeadPipeline() {
    const [leads, setLeads] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const load = () =>
        leadAPI.getAll({}).then(r => setLeads(r.data.leads)).catch(console.error);

    useEffect(() => {
        load();
        employeeAPI.getAll().then(r => setEmployees(r.data.employees)).catch(console.error);
    }, []);

    const handleStageChange = async (leadId, newStage) => {
        try {
            await leadAPI.updateStage(leadId, newStage);
            load();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await leadAPI.create(form);
            setShowForm(false);
            setForm(EMPTY_FORM);
            load();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create lead.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this lead?')) return;
        try {
            await leadAPI.remove(id);
            load();
        } catch (err) {
            console.error(err);
        }
    };

    const byStage = (stage) => leads.filter(l => l.stage === stage);

    return (
        <div className="max-w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Lead Pipeline</h2>
                <button
                    onClick={() => { setShowForm(!showForm); setError(''); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                    {showForm ? 'Cancel' : '+ Add Lead'}
                </button>
            </div>

            {/* Add Lead Form */}
            {showForm && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
                    <h3 className="font-semibold text-gray-700 mb-4">New Lead</h3>
                    {error && (
                        <div className="bg-red-50 text-red-600 border border-red-200 rounded p-3 mb-3 text-sm">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { label: 'Company Name', name: 'company_name', required: true },
                            { label: 'Contact Person', name: 'contact_person' },
                            { label: 'Contact Email', name: 'contact_email', type: 'email' },
                            { label: 'Contact Phone', name: 'contact_phone' },
                            { label: 'Source', name: 'source' },
                        ].map(({ label, name, type = 'text', required }) => (
                            <div key={name}>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                                <input
                                    type={type}
                                    value={form[name]}
                                    onChange={e => setForm({ ...form, [name]: e.target.value })}
                                    required={required}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        ))}

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Assign To</label>
                            <select
                                value={form.assigned_to}
                                onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Unassigned</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                            <textarea
                                value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                                rows={2}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="md:col-span-3 flex gap-3">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition"
                            >
                                {submitting ? 'Creating...' : 'Create Lead'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setError(''); }}
                                className="border border-gray-300 px-5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Kanban Board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
                {STAGES.map(stage => (
                    <div key={stage} className="flex-shrink-0 w-64">
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-700 capitalize">{stage}</h3>
                            <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                                {byStage(stage).length}
                            </span>
                        </div>

                        {/* Cards */}
                        <div className="space-y-3 min-h-24">
                            {byStage(stage).map(lead => (
                                <div
                                    key={lead.id}
                                    className={`border rounded-xl p-4 ${STAGE_COLORS[stage]} shadow-sm`}
                                >
                                    <p className="font-semibold text-gray-800 text-sm">{lead.company_name}</p>

                                    {lead.contact_person && (
                                        <p className="text-xs text-gray-500 mt-1">👤 {lead.contact_person}</p>
                                    )}
                                    {lead.contact_phone && (
                                        <p className="text-xs text-gray-400">📞 {lead.contact_phone}</p>
                                    )}
                                    {lead.assigned_to_name && (
                                        <p className="text-xs text-gray-400 mt-1">🧑‍💼 {lead.assigned_to_name}</p>
                                    )}
                                    {lead.notes && (
                                        <p className="text-xs text-gray-400 mt-1 italic truncate">{lead.notes}</p>
                                    )}

                                    {/* Move to stage buttons */}
                                    <div className="mt-3 flex gap-1 flex-wrap">
                                        {STAGES.filter(s => s !== stage).map(s => (
                                            <button
                                                key={s}
                                                onClick={() => handleStageChange(lead.id, s)}
                                                className="text-xs border border-gray-300 rounded px-2 py-0.5 bg-white hover:bg-gray-100 capitalize transition"
                                            >
                                                → {s}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => handleDelete(lead.id)}
                                        className="mt-2 text-xs text-red-500 hover:underline"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}

                            {!byStage(stage).length && (
                                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400">
                                    No leads
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
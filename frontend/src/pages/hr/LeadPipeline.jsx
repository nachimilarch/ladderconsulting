import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { leadAPI, employeeAPI } from '../../api/hr';
import { useDebounce } from '../../hooks/useDebounce';

const STAGES = ['new', 'contacted', 'interested', 'proposal', 'converted', 'lost'];
const STAGE_CONFIG = {
    new:       { label: 'New',       color: 'bg-gray-50 border-gray-300',   badge: 'bg-gray-200 text-gray-600' },
    contacted: { label: 'Contacted', color: 'bg-blue-50 border-blue-300',   badge: 'bg-blue-100 text-blue-700' },
    interested:{ label: 'Interested',color: 'bg-yellow-50 border-yellow-300', badge: 'bg-yellow-100 text-yellow-700' },
    proposal:  { label: 'Proposal',  color: 'bg-orange-50 border-orange-300', badge: 'bg-orange-100 text-orange-700' },
    converted: { label: 'Converted', color: 'bg-green-50 border-green-300', badge: 'bg-green-100 text-green-700' },
    lost:      { label: 'Lost',      color: 'bg-red-50 border-red-300',     badge: 'bg-red-100 text-red-600' },
};

const EMPTY_FORM = {
    company_name: '', contact_name: '', contact_email: '',
    contact_phone: '', source: '', assigned_to: '', notes: '',
};

export default function LeadPipeline() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [leads, setLeads] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search);
    const [stageFilter, setStageFilter] = useState('');

    const load = () =>
        leadAPI.getAll({ search: debouncedSearch || undefined, stage: stageFilter || undefined })
            .then(r => setLeads(r.data.data || []))
            .catch(console.error);

    useEffect(() => {
        load();
        if (isAdmin) {
            employeeAPI.getAll({}).then(r => setEmployees(r.data.data || [])).catch(console.error);
        }
    }, [debouncedSearch, stageFilter]);

    const handleStageChange = async (leadId, newStage) => {
        try {
            await leadAPI.updateStage(leadId, newStage);
            load();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update stage.');
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
        await leadAPI.remove(id).catch(console.error);
        load();
    };

    const byStage = (stage) => leads.filter(l => l.stage === stage);

    return (
        <div className="max-w-full p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Lead Pipeline</h2>
                <div className="flex gap-3 flex-wrap">
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search company/contact..."
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                        <option value="">All stages</option>
                        {STAGES.map(s => <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
                    </select>
                    <button onClick={() => { setShowForm(!showForm); setError(''); }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                        {showForm ? 'Cancel' : '+ Add Lead'}
                    </button>
                </div>
            </div>

            {/* Add Lead Form */}
            {showForm && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
                    <h3 className="font-semibold text-gray-700 mb-4">New Lead</h3>
                    {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded p-3 mb-3 text-sm">{error}</div>}
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { label: 'Company Name', name: 'company_name', required: true },
                            { label: 'Contact Name', name: 'contact_name' },
                            { label: 'Contact Email', name: 'contact_email', type: 'email' },
                            { label: 'Contact Phone', name: 'contact_phone' },
                            { label: 'Source', name: 'source' },
                        ].map(({ label, name, type = 'text', required }) => (
                            <div key={name}>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                                <input type={type} value={form[name]}
                                    onChange={e => setForm({ ...form, [name]: e.target.value })}
                                    required={required}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        ))}

                        {isAdmin && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Assign To</label>
                                <select value={form.assigned_to}
                                    onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                                    <option value="">Unassigned</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                                rows={2}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                        </div>

                        <div className="md:col-span-3 flex gap-3">
                            <button type="submit" disabled={submitting}
                                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                                {submitting ? 'Creating...' : 'Create Lead'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Kanban Board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
                {STAGES.map(stage => {
                    const cfg = STAGE_CONFIG[stage];
                    const stageLeads = byStage(stage);
                    return (
                        <div key={stage} className="flex-shrink-0 w-64">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-gray-700">{cfg.label}</h3>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                    {stageLeads.length}
                                </span>
                            </div>

                            <div className="space-y-3 min-h-24">
                                {stageLeads.map(lead => (
                                    <div key={lead.id}
                                        className={`border rounded-xl p-4 ${cfg.color} shadow-sm`}>
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <p className="font-semibold text-gray-800 text-sm leading-tight">{lead.company_name}</p>
                                            <Link to={`/hr/leads/${lead.id}`}
                                                className="text-indigo-500 hover:text-indigo-700 text-xs shrink-0">View</Link>
                                        </div>
                                        {lead.contact_name && <p className="text-xs text-gray-500 mt-0.5">👤 {lead.contact_name}</p>}
                                        {lead.contact_phone && <p className="text-xs text-gray-400">📞 {lead.contact_phone}</p>}
                                        {lead.assigned_to_name && <p className="text-xs text-gray-400 mt-1">🧑‍💼 {lead.assigned_to_name}</p>}
                                        {lead.notes && <p className="text-xs text-gray-400 mt-1 italic truncate">{lead.notes}</p>}

                                        {/* Stage move buttons */}
                                        <div className="mt-3 flex gap-1 flex-wrap">
                                            {STAGES.filter(s => s !== stage).map(s => (
                                                <button key={s} onClick={() => handleStageChange(lead.id, s)}
                                                    className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white hover:bg-gray-100 capitalize transition">
                                                    → {STAGE_CONFIG[s].label}
                                                </button>
                                            ))}
                                        </div>

                                        <button onClick={() => handleDelete(lead.id)}
                                            className="mt-2 text-xs text-red-500 hover:underline">Delete</button>
                                    </div>
                                ))}
                                {!stageLeads.length && (
                                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400">
                                        No leads
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

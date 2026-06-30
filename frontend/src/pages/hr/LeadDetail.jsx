import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { leadAPI, employeeAPI } from '../../api/hr';

const STAGES = ['new', 'contacted', 'interested', 'proposal', 'converted', 'lost'];
const OUTCOME_COLORS = {
    no_answer: 'bg-gray-100 text-gray-500',
    voicemail: 'bg-gray-100 text-gray-600',
    callback_scheduled: 'bg-yellow-100 text-yellow-700',
    interested: 'bg-green-100 text-green-700',
    not_interested: 'bg-red-100 text-red-600',
    converted: 'bg-blue-100 text-blue-700',
};

export default function LeadDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [assignTo, setAssignTo] = useState('');

    const load = () => {
        setLoading(true);
        leadAPI.getOne(id)
            .then(r => {
                setLead(r.data.data);
                const d = r.data.data;
                setForm({
                    company_name: d.company_name || '',
                    contact_name: d.contact_name || '',
                    contact_email: d.contact_email || '',
                    contact_phone: d.contact_phone || '',
                    source: d.source || '',
                    notes: d.notes || '',
                });
                setAssignTo(d.assigned_to || '');
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
        if (isAdmin) {
            employeeAPI.getAll({}).then(r => setEmployees(r.data.data || [])).catch(console.error);
        }
    }, [id]);

    const handleUpdate = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMsg('');
        try {
            await leadAPI.update(id, form);
            setMsg('Lead updated.');
            setEditMode(false);
            load();
        } catch (err) {
            setMsg(err.response?.data?.message || 'Failed to update.');
        } finally {
            setSaving(false);
        }
    };

    const handleStageChange = async (stage) => {
        try {
            await leadAPI.updateStage(id, stage);
            load();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update stage.');
        }
    };

    const handleAssign = async () => {
        if (!assignTo) return;
        try {
            await leadAPI.assign(id, assignTo);
            setMsg('Lead reassigned.');
            load();
        } catch (err) {
            setMsg(err.response?.data?.message || 'Failed to assign.');
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this lead?')) return;
        await leadAPI.remove(id);
        navigate('/hr/leads');
    };

    if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>;
    if (!lead) return <div className="p-6 text-gray-500">Lead not found.</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <Link to="/hr/leads" className="text-sm text-indigo-600 hover:underline">← Lead Pipeline</Link>
                <div className="flex gap-2">
                    <button onClick={() => setEditMode(!editMode)}
                        className="text-sm border border-gray-300 px-4 py-1.5 rounded-lg hover:bg-gray-50">
                        {editMode ? 'Cancel' : 'Edit'}
                    </button>
                    <button onClick={handleDelete}
                        className="text-sm border border-red-200 text-red-600 px-4 py-1.5 rounded-lg hover:bg-red-50">
                        Delete
                    </button>
                </div>
            </div>

            {msg && (
                <div className={`text-sm p-3 rounded ${msg.includes('success') || msg.includes('updated') || msg.includes('assigned') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {msg}
                </div>
            )}

            {/* Lead info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                {editMode ? (
                    <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { label: 'Company Name', key: 'company_name', required: true },
                            { label: 'Contact Name', key: 'contact_name' },
                            { label: 'Contact Email', key: 'contact_email', type: 'email' },
                            { label: 'Contact Phone', key: 'contact_phone' },
                            { label: 'Source', key: 'source' },
                        ].map(({ label, key, type = 'text', required }) => (
                            <div key={key}>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                                <input type={type} value={form[key] || ''}
                                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                                    required={required}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                            </div>
                        ))}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                        </div>
                        <div className="md:col-span-2">
                            <button type="submit" disabled={saving}
                                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 mb-1">{lead.company_name}</h1>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-sm">
                            {[
                                { label: 'Contact', val: lead.contact_name || '—' },
                                { label: 'Email', val: lead.contact_email || '—' },
                                { label: 'Phone', val: lead.contact_phone || '—' },
                                { label: 'Source', val: lead.source || '—' },
                                { label: 'Assigned To', val: lead.assigned_to_name || 'Unassigned' },
                                { label: 'Created', val: new Date(lead.created_at).toLocaleDateString('en-IN') },
                            ].map(({ label, val }) => (
                                <div key={label}>
                                    <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                                    <p className="font-medium text-gray-800 mt-0.5">{val}</p>
                                </div>
                            ))}
                        </div>
                        {lead.notes && (
                            <div className="mt-4">
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                                <p className="text-sm text-gray-600">{lead.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Stage pipeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Pipeline Stage</h3>
                <div className="flex gap-2 flex-wrap">
                    {STAGES.map(s => (
                        <button key={s} onClick={() => handleStageChange(s)}
                            className={`px-3 py-1.5 rounded-lg text-sm capitalize border transition ${
                                lead.stage === s
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300'
                            }`}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Admin: reassign */}
            {isAdmin && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">Reassign Lead</h3>
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Assign To</label>
                            <select value={assignTo} onChange={e => setAssignTo(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                                <option value="">Unassigned</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <button onClick={handleAssign}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                            Assign
                        </button>
                    </div>
                </div>
            )}

            {/* Call history */}
            {lead.calls?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">Call History</h3>
                    <div className="space-y-2">
                        {lead.calls.map(c => (
                            <div key={c.id} className="flex items-start justify-between border border-gray-100 rounded-xl px-4 py-3 gap-3">
                                <div>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${OUTCOME_COLORS[c.outcome] || 'bg-gray-100 text-gray-500'}`}>
                                        {c.outcome?.replace(/_/g, ' ')}
                                    </span>
                                    {c.notes && <p className="text-xs text-gray-400 mt-1">{c.notes}</p>}
                                    <p className="text-xs text-gray-400">{c.employee_name}</p>
                                </div>
                                <span className="text-xs text-gray-400 shrink-0">
                                    {new Date(c.called_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

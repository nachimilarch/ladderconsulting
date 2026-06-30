import { useEffect, useState } from 'react';
import { adminStaffAPI } from '../../api/admin';
import toast from 'react-hot-toast';

const EMPTY_FORM = { full_name: '', email: '', phone: '' };

export default function HRStaffManagement() {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [performance, setPerformance] = useState(null);
    const [perfMember, setPerfMember] = useState(null);

    const load = () => {
        setLoading(true);
        adminStaffAPI.list()
            .then((r) => {
                const list = Array.isArray(r.data) ? r.data : r.data?.data ?? r.data?.staff ?? [];
                setStaff(list);
            })
            .catch(() => { toast.error('Failed to load staff'); setStaff([]); })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => {
        setEditId(null);
        setForm(EMPTY_FORM);
        setShowCreate(true);
    };

    const openEdit = (member) => {
        setEditId(member.id);
        setForm({ full_name: member.full_name || '', email: member.email, phone: member.phone || '' });
        setShowCreate(true);
    };

    const handleSave = async () => {
        if (!form.full_name || !form.email) return toast.error('Name and email are required');
        setSaving(true);
        try {
            if (editId) {
                await adminStaffAPI.update(editId, form);
                toast.success('Staff member updated');
            } else {
                await adminStaffAPI.create(form);
                toast.success('Staff member created — password setup email sent');
            }
            setShowCreate(false);
            load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (id) => {
        if (!confirm('Deactivate this staff member?')) return;
        try {
            await adminStaffAPI.deactivate(id);
            toast.success('Staff member deactivated');
            load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Deactivation failed');
        }
    };

    const openPerformance = async (member) => {
        try {
            const r = await adminStaffAPI.getPerformance(member.id);
            setPerformance(r.data);
            setPerfMember(member);
        } catch {
            toast.error('Failed to load performance data');
        }
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">HR Staff Management</h2>
                <button
                    onClick={openCreate}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                >
                    + Add Staff Member
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {loading ? (
                    <p className="p-6 text-gray-400 text-sm">Loading…</p>
                ) : (Array.isArray(staff) ? staff : []).length === 0 ? (
                    <p className="p-6 text-gray-400 text-sm">No HR staff members yet.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                {['Name', 'Email', 'Phone', 'Calls', 'Leads', 'Status', 'Actions'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(Array.isArray(staff) ? staff : []).map((m) => (
                                <tr key={m.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-800">{m.full_name || '—'}</td>
                                    <td className="px-4 py-3 text-gray-500">{m.email}</td>
                                    <td className="px-4 py-3 text-gray-500">{m.phone || '—'}</td>
                                    <td className="px-4 py-3 text-gray-500">{m.call_count ?? 0}</td>
                                    <td className="px-4 py-3 text-gray-500">{m.lead_count ?? 0}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                            m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {m.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button onClick={() => openEdit(m)} className="text-indigo-600 hover:underline text-xs">Edit</button>
                                            <button onClick={() => openPerformance(m)} className="text-teal-600 hover:underline text-xs">Stats</button>
                                            {m.status === 'active' && (
                                                <button onClick={() => handleDeactivate(m.id)} className="text-red-500 hover:underline text-xs">Deactivate</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create/Edit modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                        <h3 className="font-semibold text-gray-800 mb-4">
                            {editId ? 'Edit Staff Member' : 'Add Staff Member'}
                        </h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Full Name', key: 'full_name', type: 'text' },
                                { label: 'Email', key: 'email', type: 'email', disabled: !!editId },
                                { label: 'Phone', key: 'phone', type: 'tel' },
                            ].map(({ label, key, type, disabled }) => (
                                <div key={key}>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                                    <input
                                        type={type}
                                        value={form[key]}
                                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                        disabled={disabled}
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                                    />
                                </div>
                            ))}
                        </div>
                        {!editId && (
                            <p className="text-xs text-gray-400 mt-3">
                                A password setup link will be emailed to the new staff member.
                            </p>
                        )}
                        <div className="flex justify-end gap-3 mt-5">
                            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Performance modal */}
            {performance && perfMember && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-800">{perfMember.full_name} — Performance</h3>
                            <button onClick={() => setPerformance(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <dl className="space-y-2 text-sm">
                            {[
                                ['Total Calls', performance.total_calls],
                                ['Calls This Month', performance.calls_this_month],
                                ['Leads Created', performance.total_leads],
                                ['Leads Converted', performance.converted_leads],
                                ['Conversion Rate', performance.conversion_rate ? `${performance.conversion_rate}%` : '0%'],
                                ['Tasks Completed', performance.tasks_completed],
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                                    <dt className="text-gray-500">{k}</dt>
                                    <dd className="font-semibold text-gray-800">{v ?? 0}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>
            )}
        </div>
    );
}

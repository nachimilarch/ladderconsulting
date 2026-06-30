import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { employeeAPI } from '../../api/hr';

export default function EmployeeDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [emp, setEmp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [attendance, setAttendance] = useState([]);
    const [attMonth, setAttMonth] = useState(new Date().toISOString().slice(0, 7));
    const [roleForm, setRoleForm] = useState({ role: '', department: '', designation: '' });
    const [roleSaving, setRoleSaving] = useState(false);
    const [roleMsg, setRoleMsg] = useState('');

    const load = () => {
        setLoading(true);
        employeeAPI.getOne(id)
            .then(r => {
                setEmp(r.data.data);
                setRoleForm({
                    role: r.data.data.role || '',
                    department: r.data.data.department || '',
                    designation: r.data.data.designation || '',
                });
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [id]);

    useEffect(() => {
        employeeAPI.getAttendance(id, { month: attMonth })
            .then(r => setAttendance(r.data.data || []))
            .catch(console.error);
    }, [id, attMonth]);

    const handleAssignRoleDept = async (e) => {
        e.preventDefault();
        setRoleSaving(true);
        setRoleMsg('');
        try {
            await employeeAPI.assignRoleDept(id, roleForm);
            setRoleMsg('Updated successfully.');
            load();
        } catch (err) {
            setRoleMsg(err.response?.data?.message || 'Failed to update.');
        } finally {
            setRoleSaving(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>;
    if (!emp) return <div className="p-6 text-gray-500">Employee not found.</div>;

    const statusColor = (s) => ({
        present: 'text-green-600', absent: 'text-red-500', half_day: 'text-yellow-600', leave: 'text-gray-500'
    }[s] || 'text-gray-500');

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <Link to="/hr/employees" className="text-sm text-indigo-600 hover:underline">← Employees</Link>
            </div>

            {/* Profile card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{emp.name}</h1>
                        <p className="text-sm text-gray-500">{emp.email}</p>
                        {emp.phone && <p className="text-sm text-gray-500">{emp.phone}</p>}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {emp.status}
                    </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
                    {[
                        { label: 'Employee Code', val: emp.employee_code || '—' },
                        { label: 'Department',    val: emp.department || '—' },
                        { label: 'Designation',   val: emp.designation || '—' },
                        { label: 'Date Joined',   val: emp.date_joined ? new Date(emp.date_joined).toLocaleDateString('en-IN') : '—' },
                        { label: 'Manager',       val: emp.manager_name || '—' },
                        { label: 'Role',          val: emp.role || '—' },
                    ].map(({ label, val }) => (
                        <div key={label}>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                            <p className="font-medium text-gray-800 mt-0.5">{val}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick stats */}
            {emp.stats && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Calls Made', val: emp.stats.calls_made, color: 'text-indigo-600' },
                        { label: 'Leads Assigned', val: emp.stats.leads_assigned, color: 'text-yellow-600' },
                        { label: 'Tasks Completed', val: emp.stats.tasks_completed, color: 'text-green-600' },
                    ].map(({ label, val, color }) => (
                        <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-center">
                            <div className={`text-2xl font-bold ${color}`}>{val}</div>
                            <div className="text-xs text-gray-500 mt-1">{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Admin: Role & Department assignment */}
            {isAdmin && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">Assign Role & Department</h3>
                    {roleMsg && (
                        <div className={`text-xs mb-3 p-2 rounded ${roleMsg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {roleMsg}
                        </div>
                    )}
                    <form onSubmit={handleAssignRoleDept} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                            <select value={roleForm.role} onChange={e => setRoleForm({ ...roleForm, role: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                                <option value="">No change</option>
                                <option value="hr_staff">hr_staff</option>
                                <option value="trainer">trainer</option>
                                <option value="admin">admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                            <input value={roleForm.department}
                                onChange={e => setRoleForm({ ...roleForm, department: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
                            <input value={roleForm.designation}
                                onChange={e => setRoleForm({ ...roleForm, designation: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                        </div>
                        <div className="md:col-span-3">
                            <button type="submit" disabled={roleSaving}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                                {roleSaving ? 'Saving...' : 'Update'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Attendance */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">Attendance</h3>
                    <input type="month" value={attMonth} onChange={e => setAttMonth(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                </div>
                {attendance.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No attendance records for this month.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>{['Date', 'Check In', 'Check Out', 'Status', 'Notes'].map(h => (
                                <th key={h} className="px-3 py-2 text-left">{h}</th>
                            ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {attendance.map(a => (
                                <tr key={a.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2">{new Date(a.date).toLocaleDateString('en-IN')}</td>
                                    <td className="px-3 py-2">{a.check_in || '—'}</td>
                                    <td className="px-3 py-2">{a.check_out || '—'}</td>
                                    <td className={`px-3 py-2 capitalize font-medium ${statusColor(a.status)}`}>{a.status}</td>
                                    <td className="px-3 py-2 text-gray-400 text-xs">{a.notes || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

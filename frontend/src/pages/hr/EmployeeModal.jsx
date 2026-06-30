import { useEffect, useState } from 'react';
import { employeeAPI } from '../../api/hr';

export default function EmployeeModal({ employee, employees = [], onClose, onSaved }) {
    const isEdit = !!employee;

    // Edit form: employee fields
    const [form, setForm] = useState({
        name: employee?.name || '',
        phone: employee?.phone || '',
        employee_code: employee?.employee_code || '',
        department: employee?.department || '',
        designation: employee?.designation || '',
        date_joined: employee?.date_joined?.slice(0, 10) || '',
        manager_id: employee?.manager_id || '',
    });

    // Create form: pick an existing hr_staff user
    const [availableUsers, setAvailableUsers] = useState([]);
    const [createForm, setCreateForm] = useState({
        user_id: '',
        employee_code: '',
        department: '',
        designation: '',
        date_joined: '',
        manager_id: '',
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isEdit) {
            employeeAPI.getAvailableUsers()
                .then(r => setAvailableUsers(r.data.data || []))
                .catch(() => {});
        }
    }, [isEdit]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isEdit) {
                await employeeAPI.update(employee.id, form);
            } else {
                if (!createForm.user_id) {
                    setError('Please select a user account.');
                    setLoading(false);
                    return;
                }
                await employeeAPI.create(createForm);
            }
            onSaved();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save.');
        } finally {
            setLoading(false);
        }
    };

    const f = isEdit ? form : createForm;
    const setF = isEdit ? setForm : setCreateForm;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-screen overflow-y-auto">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                    {isEdit ? 'Edit Employee' : 'Add Employee'}
                </h3>
                {error && (
                    <div className="bg-red-50 text-red-600 border border-red-200 rounded p-3 mb-3 text-sm">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Create: pick user account */}
                    {!isEdit && (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                User Account (hr_staff) <span className="text-red-500">*</span>
                            </label>
                            {availableUsers.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No unlinked hr_staff users found. Users must register first.</p>
                            ) : (
                                <select value={createForm.user_id}
                                    onChange={e => setCreateForm({ ...createForm, user_id: e.target.value })}
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select user...</option>
                                    {availableUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Edit: show name + phone */}
                    {isEdit && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                                <input value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                                <input value={form.phone}
                                    onChange={e => setForm({ ...form, phone: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </>
                    )}

                    {/* Shared fields */}
                    {[
                        { label: 'Employee Code', key: 'employee_code' },
                        { label: 'Department', key: 'department' },
                        { label: 'Designation', key: 'designation' },
                    ].map(({ label, key }) => (
                        <div key={key}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                            <input value={f[key] || ''}
                                onChange={e => setF({ ...f, [key]: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    ))}

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date Joined</label>
                        <input type="date" value={f.date_joined || ''}
                            onChange={e => setF({ ...f, date_joined: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Manager</label>
                        <select value={f.manager_id || ''}
                            onChange={e => setF({ ...f, manager_id: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">None</option>
                            {employees
                                .filter(e => !isEdit || e.id !== employee?.id)
                                .map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={loading}
                            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" onClick={onClose}
                            className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

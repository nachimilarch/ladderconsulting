import { useState } from 'react';
import { employeeAPI } from '../../api/hr';

const EMPTY = { name: '', email: '', phone: '', department: '', designation: '', date_joined: '', status: 'active' };

export default function EmployeeModal({ employee, onClose, onSaved }) {
    const [form, setForm] = useState(employee || EMPTY);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (employee) {
                await employeeAPI.update(employee.id, form);
            } else {
                await employeeAPI.create(form);
            }
            onSaved();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">{employee ? 'Edit Employee' : 'Add Employee'}</h3>
                {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded p-3 mb-3 text-sm">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-3">
                    {[
                        { label: 'Full Name', name: 'name', required: true },
                        { label: 'Email', name: 'email', type: 'email', required: true },
                        { label: 'Phone', name: 'phone' },
                        { label: 'Department', name: 'department' },
                        { label: 'Designation', name: 'designation' },
                        { label: 'Date Joined', name: 'date_joined', type: 'date' },
                    ].map(({ label, name, type = 'text', required }) => (
                        <div key={name}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                            <input type={type} value={form[name] || ''} onChange={e => setForm({ ...form, [name]: e.target.value })}
                                required={required}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    ))}

                    {employee && (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    )}

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
import { useEffect, useState } from 'react';
import { employeeAPI } from '../../api/hr';
import EmployeeModal from '../hr/EmployeeModal';

export default function Employees() {
    const [employees, setEmployees] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [search, setSearch] = useState('');

    const load = () => employeeAPI.getAll().then(r => setEmployees(r.data.employees));
    useEffect(() => { load(); }, []);

    const handleDelete = async (id) => {
        if (!confirm('Delete this employee?')) return;
        await employeeAPI.remove(id);
        load();
    };

    const filtered = employees.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Employees</h2>
                <button onClick={() => { setEditing(null); setModalOpen(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                    + Add Employee
                </button>
            </div>

            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-xs mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                            {['Name', 'Email', 'Phone', 'Department', 'Designation', 'Status', 'Actions'].map(h => (
                                <th key={h} className="px-4 py-3 text-left">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.map(emp => (
                            <tr key={emp.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-800">{emp.name}</td>
                                <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                                <td className="px-4 py-3 text-gray-600">{emp.phone || '—'}</td>
                                <td className="px-4 py-3 text-gray-600">{emp.department || '—'}</td>
                                <td className="px-4 py-3 text-gray-600">{emp.designation || '—'}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                        }`}>{emp.status}</span>
                                </td>
                                <td className="px-4 py-3 flex gap-2">
                                    <button onClick={() => { setEditing(emp); setModalOpen(true); }}
                                        className="text-blue-600 hover:underline text-xs">Edit</button>
                                    <button onClick={() => handleDelete(emp.id)}
                                        className="text-red-500 hover:underline text-xs">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {!filtered.length && (
                            <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No employees found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {modalOpen && (
                <EmployeeModal
                    employee={editing}
                    onClose={() => setModalOpen(false)}
                    onSaved={() => { setModalOpen(false); load(); }}
                />
            )}
        </div>
    );
}
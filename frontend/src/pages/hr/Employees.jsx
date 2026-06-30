import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { employeeAPI } from '../../api/hr';
import { useDebounce } from '../../hooks/useDebounce';
import EmployeeModal from './EmployeeModal';

export default function Employees() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search);
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const load = () => {
        setLoading(true);
        employeeAPI.getAll({ search: debouncedSearch, department: filterDept, status: filterStatus })
            .then(r => setEmployees(r.data.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [debouncedSearch, filterDept, filterStatus]);

    const handleDelete = async (id) => {
        if (!confirm('Delete this employee?')) return;
        await employeeAPI.remove(id);
        load();
    };

    const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Employees</h2>
                {isAdmin && (
                    <button onClick={() => { setEditing(null); setModalOpen(true); }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                        + Add Employee
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or code..."
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">All departments</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                {['Name', 'Code', 'Department', 'Designation', 'Date Joined', 'Status', 'Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-gray-800">{emp.name}</p>
                                        <p className="text-xs text-gray-400">{emp.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{emp.employee_code || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">{emp.department || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">{emp.designation || '—'}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                        {emp.date_joined ? new Date(emp.date_joined).toLocaleDateString('en-IN') : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {emp.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <Link to={`/hr/employees/${emp.id}`}
                                            className="text-indigo-600 hover:underline text-xs">View</Link>
                                        {isAdmin && (
                                            <>
                                                <button onClick={() => { setEditing(emp); setModalOpen(true); }}
                                                    className="text-blue-600 hover:underline text-xs">Edit</button>
                                                <button onClick={() => handleDelete(emp.id)}
                                                    className="text-red-500 hover:underline text-xs">Delete</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!employees.length && (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                                    No employees found.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {modalOpen && (
                <EmployeeModal
                    employee={editing}
                    employees={employees}
                    onClose={() => setModalOpen(false)}
                    onSaved={() => { setModalOpen(false); load(); }}
                />
            )}
        </div>
    );
}

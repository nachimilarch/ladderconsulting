import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { taskAPI, employeeAPI } from '../../api/hr';

const STATUS_COLORS = {
    pending:     'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed:   'bg-green-100 text-green-700',
    cancelled:   'bg-gray-100 text-gray-500',
};
const PRIORITY_COLORS = {
    low:    'text-gray-400',
    medium: 'text-yellow-500',
    high:   'text-red-500',
    urgent: 'text-red-700 font-bold',
};

const EMPTY_FORM = { title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' };

export default function Tasks() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [noteTaskId, setNoteTaskId] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    const load = () => {
        setLoading(true);
        taskAPI.getAll({ status: filterStatus || undefined, assigned_to: filterEmployee || undefined })
            .then(r => setTasks(r.data.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [filterStatus, filterEmployee]);
    useEffect(() => {
        if (isAdmin) {
            employeeAPI.getAll({}).then(r => setEmployees(r.data.data || [])).catch(console.error);
        }
    }, [isAdmin]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setFormError('');
        setSubmitting(true);
        try {
            await taskAPI.create(form);
            setShowForm(false);
            setForm(EMPTY_FORM);
            load();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to create task.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = async (id, status) => {
        await taskAPI.updateStatus(id, status).catch(console.error);
        load();
    };

    const handleAddNote = async (taskId) => {
        if (!noteText.trim()) return;
        try {
            await taskAPI.addNote(taskId, noteText);
            setNoteTaskId(null);
            setNoteText('');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add note.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete task?')) return;
        await taskAPI.remove(id).catch(console.error);
        load();
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Tasks</h2>
                {isAdmin && (
                    <button onClick={() => setShowForm(!showForm)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                        + New Task
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                {isAdmin && (
                    <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                        <option value="">All employees</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                )}
            </div>

            {/* Create Form — admin only */}
            {isAdmin && showForm && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
                    {formError && <div className="bg-red-50 text-red-600 border border-red-200 rounded p-2 mb-3 text-xs">{formError}</div>}
                    <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="col-span-full md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
                            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Assign To</label>
                            <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                                <option value="">Unassigned</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                        </div>
                        <div className="col-span-full">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={2}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                        </div>
                        <div className="col-span-full flex gap-3">
                            <button type="submit" disabled={submitting}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                                {submitting ? 'Creating...' : 'Create Task'}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)}
                                className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Task List */}
            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                {['Title', 'Assigned To', 'Priority', 'Due Date', 'Status', 'Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tasks.map(task => (
                                <tr key={task.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <Link to={`/hr/tasks/${task.id}`}
                                            className="font-medium text-gray-800 hover:text-indigo-600">{task.title}</Link>
                                        {task.description && (
                                            <p className="text-xs text-gray-400 truncate max-w-xs">{task.description}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{task.assigned_to_name || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`font-medium capitalize text-xs ${PRIORITY_COLORS[task.priority]}`}>
                                            {task.priority}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">
                                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN') : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <select value={task.status} onChange={e => handleStatusChange(task.id, e.target.value)}
                                            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${STATUS_COLORS[task.status]}`}>
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            {isAdmin && <option value="cancelled">Cancelled</option>}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2 items-center">
                                        <Link to={`/hr/tasks/${task.id}`}
                                            className="text-indigo-500 hover:underline text-xs">View</Link>
                                        <button onClick={() => setNoteTaskId(task.id === noteTaskId ? null : task.id)}
                                            className="text-blue-500 hover:underline text-xs">Note</button>
                                        {isAdmin && (
                                            <button onClick={() => handleDelete(task.id)}
                                                className="text-red-500 hover:underline text-xs">Del</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!tasks.length && (
                                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No tasks found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Inline Note */}
            {noteTaskId && (
                <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-700 mb-2">Add note to task #{noteTaskId}</p>
                    <div className="flex gap-3">
                        <input value={noteText} onChange={e => setNoteText(e.target.value)}
                            placeholder="Type your progress note..."
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={() => handleAddNote(noteTaskId)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Add</button>
                        <button onClick={() => { setNoteTaskId(null); setNoteText(''); }}
                            className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}

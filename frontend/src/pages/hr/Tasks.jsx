import { useEffect, useState } from 'react';
import { taskAPI, employeeAPI } from '../../api/hr';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
};
const PRIORITY_COLORS = {
  low: 'text-gray-400',
  medium: 'text-yellow-500',
  high: 'text-red-500',
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [noteTaskId, setNoteTaskId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });

  const load = () => taskAPI.getAll({ status: filterStatus, assigned_to: filterEmployee })
    .then(r => setTasks(r.data.tasks));
  useEffect(() => { load(); }, [filterStatus, filterEmployee]);
  useEffect(() => { employeeAPI.getAll().then(r => setEmployees(r.data.employees)); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    await taskAPI.create(form);
    setShowForm(false);
    setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
    load();
  };

  const handleStatusChange = async (id, status) => {
    await taskAPI.updateStatus(id, status);
    load();
  };

  const handleAddNote = async (taskId) => {
    if (!noteText.trim()) return;
    await taskAPI.addNote(taskId, noteText);
    setNoteTaskId(null);
    setNoteText('');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete task?')) return;
    await taskAPI.remove(id);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Tasks</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="col-span-full md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
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
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="col-span-full flex gap-3">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Create</button>
              <button type="button" onClick={() => setShowForm(false)}
                className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Task List */}
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
                  <p className="font-medium text-gray-800">{task.title}</p>
                  {task.description && <p className="text-xs text-gray-400 truncate max-w-xs">{task.description}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{task.assigned_to_name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`font-medium capitalize ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <select value={task.status} onChange={e => handleStatusChange(task.id, e.target.value)}
                    className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${STATUS_COLORS[task.status]}`}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </td>
                <td className="px-4 py-3 flex gap-2 items-center">
                  <button onClick={() => setNoteTaskId(task.id === noteTaskId ? null : task.id)}
                    className="text-blue-500 hover:underline text-xs">Note</button>
                  <button onClick={() => handleDelete(task.id)}
                    className="text-red-500 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {!tasks.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No tasks found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Inline Note Input */}
      {noteTaskId && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-700 mb-2">Add note to task #{noteTaskId}</p>
          <div className="flex gap-3">
            <input value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Type your progress note..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => handleAddNote(noteTaskId)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Add</button>
            <button onClick={() => setNoteTaskId(null)}
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
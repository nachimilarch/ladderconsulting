import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { taskAPI } from '../../api/hr';

const STATUS_COLORS = {
    pending:     'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed:   'bg-green-100 text-green-700',
    cancelled:   'bg-gray-100 text-gray-500',
};
const PRIORITY_COLORS = {
    low: 'text-gray-500', medium: 'text-yellow-600', high: 'text-red-500', urgent: 'text-red-700 font-bold',
};

export default function TaskDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [noteText, setNoteText] = useState('');
    const [noteLoading, setNoteLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [timeHrs, setTimeHrs] = useState('');
    const [msg, setMsg] = useState('');

    const load = () => {
        setLoading(true);
        taskAPI.getOne(id)
            .then(r => setTask(r.data.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [id]);

    const handleStatusChange = async (status) => {
        setStatusLoading(true);
        setMsg('');
        try {
            await taskAPI.updateStatus(id, status, timeHrs ? parseFloat(timeHrs) : undefined);
            setMsg('Status updated.');
            setTimeHrs('');
            load();
        } catch (err) {
            setMsg(err.response?.data?.message || 'Failed to update status.');
        } finally {
            setStatusLoading(false);
        }
    };

    const handleAddNote = async () => {
        if (!noteText.trim()) return;
        setNoteLoading(true);
        try {
            await taskAPI.addNote(id, noteText);
            setNoteText('');
            load();
        } catch (err) {
            setMsg(err.response?.data?.message || 'Failed to add note.');
        } finally {
            setNoteLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this task?')) return;
        await taskAPI.remove(id);
        navigate('/hr/tasks');
    };

    if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>;
    if (!task) return <div className="p-6 text-gray-500">Task not found.</div>;

    const STATUSES = ['pending', 'in_progress', 'completed'];
    if (isAdmin) STATUSES.push('cancelled');

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <Link to="/hr/tasks" className="text-sm text-indigo-600 hover:underline">← Tasks</Link>
                {isAdmin && (
                    <button onClick={handleDelete}
                        className="text-sm border border-red-200 text-red-600 px-4 py-1.5 rounded-lg hover:bg-red-50">
                        Delete Task
                    </button>
                )}
            </div>

            {msg && (
                <div className={`text-sm p-3 rounded ${msg.includes('updated') || msg.includes('added') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {msg}
                </div>
            )}

            {/* Task info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
                        {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                        {task.status?.replace('_', ' ')}
                    </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {[
                        { label: 'Assigned To', val: task.assigned_to_name || '—' },
                        { label: 'Assigned By', val: task.assigned_by_name || '—' },
                        { label: 'Priority',    val: <span className={`capitalize ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span> },
                        { label: 'Due Date',    val: task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN') : '—' },
                        { label: 'Completed At', val: task.completed_at ? new Date(task.completed_at).toLocaleString('en-IN') : '—' },
                        { label: 'Time Logged', val: task.time_logged_hrs ? `${task.time_logged_hrs} hrs` : '—' },
                    ].map(({ label, val }) => (
                        <div key={label}>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                            <p className="font-medium text-gray-800 mt-0.5">{val}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Status update */}
            {task.status !== 'completed' && task.status !== 'cancelled' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">Update Status</h3>
                    <div className="flex flex-wrap gap-3 items-end">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Time Logged (hrs)</label>
                            <input type="number" step="0.5" min="0" value={timeHrs}
                                onChange={e => setTimeHrs(e.target.value)}
                                placeholder="e.g. 2.5"
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none" />
                        </div>
                        {STATUSES.filter(s => s !== task.status).map(s => (
                            <button key={s} onClick={() => handleStatusChange(s)}
                                disabled={statusLoading}
                                className={`px-4 py-2 rounded-lg text-sm capitalize border transition disabled:opacity-60 ${
                                    s === 'completed' ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                                    : s === 'cancelled' ? 'border-red-200 text-red-600 hover:bg-red-50'
                                    : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                }`}>
                                Mark {s.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Progress Notes</h3>

                {task.notes?.length > 0 ? (
                    <div className="space-y-3 mb-4">
                        {task.notes.map(n => (
                            <div key={n.id} className="border border-gray-100 rounded-xl px-4 py-3">
                                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                    <span className="font-medium text-gray-600">{n.author_name || 'Unknown'}</span>
                                    <span>{new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-sm text-gray-700">{n.note}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 mb-4">No notes yet.</p>
                )}

                <div className="flex gap-3">
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                        placeholder="Add a progress note..."
                        rows={2}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={handleAddNote} disabled={noteLoading || !noteText.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60 self-end">
                        {noteLoading ? '...' : 'Add'}
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { callAPI, employeeAPI } from '../../api/hr';

const OUTCOMES = ['connected', 'no_answer', 'callback_scheduled', 'not_interested', 'converted'];
const OUTCOME_COLORS = {
    connected: 'bg-green-100 text-green-700',
    converted: 'bg-blue-100 text-blue-700',
    no_answer: 'bg-gray-100 text-gray-500',
    callback_scheduled: 'bg-yellow-100 text-yellow-700',
    not_interested: 'bg-red-100 text-red-600',
};
const EMPTY_FORM = { employee_id: '', contact_name: '', contact_phone: '', contact_company: '', outcome: 'connected', notes: '', callback_at: '' };

export default function ColdCalling() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [calls, setCalls] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [filters, setFilters] = useState({ outcome: '', date_from: '', date_to: '' });
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { employeeAPI.getAll().then(r => setEmployees(r.data.employees)); }, []);
    useEffect(() => { loadCalls(); }, [filters, page]);

    const loadCalls = () => {
        callAPI.getAll({ ...filters, page, limit: 15 })
            .then(r => { setCalls(r.data.calls); setTotal(r.data.total); });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await callAPI.log(form);
            setForm(EMPTY_FORM);
            loadCalls();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to log call.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Cold Calling</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Log Form */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 lg:col-span-1">
                    <h3 className="font-semibold text-gray-700 mb-4">Log a Call</h3>
                    {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded p-2 mb-3 text-xs">{error}</div>}
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
                            <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">Select employee</option>
                                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                            </select>
                        </div>
                        {[
                            { label: 'Contact Name', name: 'contact_name', required: true },
                            { label: 'Phone', name: 'contact_phone' },
                            { label: 'Company', name: 'contact_company' },
                        ].map(({ label, name, required }) => (
                            <div key={name}>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                                <input value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })}
                                    required={required}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        ))}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Outcome</label>
                            <select value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {OUTCOMES.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                            </select>
                        </div>
                        {form.outcome === 'callback_scheduled' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Callback At</label>
                                <input type="datetime-local" value={form.callback_at} onChange={e => setForm({ ...form, callback_at: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <button type="submit" disabled={submitting}
                            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                            {submitting ? 'Logging...' : 'Log Call'}
                        </button>
                    </form>
                </div>

                {/* History */}
                <div className="lg:col-span-2">
                    {/* Filters */}
                    <div className="flex gap-3 mb-4 flex-wrap">
                        <select value={filters.outcome} onChange={e => setFilters({ ...filters, outcome: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">All outcomes</option>
                            {OUTCOMES.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                        </select>
                        <input type="date" value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                        <input type="date" value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                <tr>
                                    {['Contact', 'Company', 'Employee', 'Outcome', 'Notes', 'Called At'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {calls.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium">{c.contact_name}<br /><span className="text-xs text-gray-400">{c.contact_phone}</span></td>
                                        <td className="px-4 py-3 text-gray-600">{c.contact_company || '—'}</td>
                                        <td className="px-4 py-3 text-gray-600">{c.employee_name}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${OUTCOME_COLORS[c.outcome]}`}>
                                                {c.outcome.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.notes || '—'}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.called_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                                {!calls.length && (
                                    <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No calls found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                        <span>Showing {calls.length} of {total}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
                            <button onClick={() => setPage(p => p + 1)} disabled={page * 15 >= total}
                                className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
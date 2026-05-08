import { useState } from 'react';
import { reportAPI } from '../../api/hr';
import KPICard from '../../components/hr/KPICard';

export default function Reports() {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const [filters, setFilters] = useState({ date_from: weekAgo, date_to: today });
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const { data } = await reportAPI.hr(filters);
            setReport(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">HR Reports</h2>

            {/* Filter bar */}
            <div className="flex gap-3 items-end mb-6 flex-wrap">
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                    <input type="date" value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                    <input type="date" value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={fetchReport} disabled={loading}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                    {loading ? 'Loading...' : 'Generate Report'}
                </button>
            </div>

            {report && (
                <div className="space-y-8">
                    {/* Calls KPIs */}
                    <section>
                        <h3 className="font-semibold text-gray-700 mb-3">📞 Cold Calling</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <KPICard title="Total Calls" value={report.calls.summary.total_calls} color="blue" />
                            <KPICard title="Connected" value={report.calls.summary.connected} color="green" />
                            <KPICard title="Converted" value={report.calls.summary.converted} color="blue" />
                            <KPICard title="Callbacks" value={report.calls.summary.callbacks_scheduled} color="yellow" />
                            <KPICard title="No Answer" value={report.calls.summary.no_answer} color="red" />
                        </div>
                    </section>

                    {/* Calls by employee */}
                    {report.calls.by_employee.length > 0 && (
                        <section>
                            <h3 className="font-semibold text-gray-700 mb-3">Calls by Employee</h3>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                        <tr>
                                            {['Employee', 'Total', 'Connected', 'Converted'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {report.calls.by_employee.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium">{row.name}</td>
                                                <td className="px-4 py-3">{row.total}</td>
                                                <td className="px-4 py-3 text-green-600">{row.connected}</td>
                                                <td className="px-4 py-3 text-blue-600">{row.converted}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* Leads KPIs */}
                    <section>
                        <h3 className="font-semibold text-gray-700 mb-3">🔥 Leads</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <KPICard title="Total Leads" value={report.leads.total_leads} color="blue" />
                            <KPICard title="New" value={report.leads.new_leads} color="yellow" />
                            <KPICard title="Contacted" value={report.leads.contacted} color="blue" />
                            <KPICard title="Warm" value={report.leads.warm} color="yellow" />
                            <KPICard title="Converted" value={report.leads.converted} color="green" />
                        </div>
                    </section>

                    {/* Tasks KPIs */}
                    <section>
                        <h3 className="font-semibold text-gray-700 mb-3">✅ Tasks</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <KPICard title="Total Tasks" value={report.tasks.total_tasks} color="blue" />
                            <KPICard title="Pending" value={report.tasks.pending} color="yellow" />
                            <KPICard title="In Progress" value={report.tasks.in_progress} color="blue" />
                            <KPICard title="Completed" value={report.tasks.completed_in_range} color="green" />
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
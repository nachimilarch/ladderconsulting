import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { callAPI, leadAPI, taskAPI } from '../../api/hr';
import KPICard from '../../components/hr/KPICard';
import { useAuth } from '../../context/AuthContext';

export default function HRDashboard() {
    const { user, logout } = useAuth();
    const [kpi, setKpi] = useState({ callsToday: 0, leadsTotal: 0, tasksPending: 0, leadsConverted: 0 });

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];

        Promise.all([
            callAPI.getAll({ date_from: today, date_to: today, limit: 1 }),
            leadAPI.getAll({}),
            taskAPI.getAll({ status: 'pending' }),
            leadAPI.getAll({ stage: 'converted' }),
        ]).then(([calls, leads, tasks, converted]) => {
            setKpi({
                callsToday: calls.data.total,
                leadsTotal: leads.data.leads.length,
                tasksPending: tasks.data.tasks.length,
                leadsConverted: converted.data.leads.length,
            });
        }).catch(console.error);
    }, []);

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Nav */}
            <nav className="bg-white shadow px-6 py-4 flex items-center justify-between">
                <h1 className="text-lg font-bold text-blue-600">Ladder Consulting — HR</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{user?.name}</span>
                    <button onClick={logout} className="text-red-500 hover:underline">Logout</button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">HR Dashboard</h2>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <KPICard title="Calls Today" value={kpi.callsToday} color="blue" />
                    <KPICard title="Leads in Pipeline" value={kpi.leadsTotal} color="yellow" />
                    <KPICard title="Tasks Pending" value={kpi.tasksPending} color="red" />
                    <KPICard title="Leads Converted" value={kpi.leadsConverted} color="green" />
                </div>

                {/* Navigation tiles */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                        { label: 'Employees', to: '/hr/employees', icon: '👥' },
                        { label: 'Cold Calling', to: '/hr/calls', icon: '📞' },
                        { label: 'Lead Pipeline', to: '/hr/leads', icon: '🔥' },
                        { label: 'Tasks', to: '/hr/tasks', icon: '✅' },
                        { label: 'Reports', to: '/hr/reports', icon: '📊' },
                    ].map(({ label, to, icon }) => (
                        <Link key={to} to={to}
                            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition flex items-center gap-3">
                            <span className="text-2xl">{icon}</span>
                            <span className="font-medium text-gray-700">{label}</span>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    );
}
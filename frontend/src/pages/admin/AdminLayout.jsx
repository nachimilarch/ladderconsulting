import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { adminAnalyticsAPI } from '../../api/admin';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../components/NotificationBell';

const navItems = [
    { label: 'Dashboard',  to: '/admin',           icon: '📊' },
    { label: 'Companies',  to: '/admin/companies', icon: '🏢' },
    { label: 'Job Postings', to: '/admin/jobs',   icon: '💼' },
    { label: 'Premium Requests', to: '/admin/premium', icon: '⭐', badgeKey: 'premium' },
    { label: 'HR Staff',   to: '/admin/staff',     icon: '👥' },
    { label: 'Hiring',     to: '/hr',              icon: '🎯' },
    { label: 'Outreach',   to: '/outreach',        icon: '📡' },
    { label: 'Analytics',  to: '/admin/analytics', icon: '📈' },
    { label: 'Payments',   to: '/admin/payments',  icon: '💳' },
    { label: 'Audit Log',  to: '/admin/audit-log', icon: '📋' },
    { label: 'Training',   to: '/admin/training',  icon: '🎓' },
    { label: 'Settings',   to: '/admin/settings',  icon: '⚙️' },
];

export default function AdminLayout() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [pendingPremium, setPendingPremium] = useState(0);

    // Live count of requests waiting on an admin. Refreshed on every page change,
    // so approving one in the queue clears the badge as soon as you move on.
    useEffect(() => {
        if (user?.role !== 'admin') return;
        adminAnalyticsAPI.getSummary()
            .then(r => {
                const s = r.data?.data?.summary;
                setPendingPremium(Number(s?.pending_company_premium_requests || 0) + Number(s?.pending_candidate_premium_requests || 0));
            })
            .catch(() => {});
    }, [location.pathname, location.search, user?.role]);

    // Trainers share this shell but may only use the Training studio — filter the
    // nav so they aren't presented a wall of admin-only links that 403.
    const isTrainer = user?.role === 'trainer';
    const visibleNav = isTrainer
        ? navItems.filter(i => i.to === '/admin/training')
        : navItems;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white flex flex-col">
                <div className="px-6 py-5 border-b border-gray-700 flex items-center gap-3">
                    <div className="bg-white rounded-lg p-1.5 shrink-0">
                        <img src="/logo-icon.png" alt="LadderStep" className="w-7 h-7 object-contain" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white leading-tight">{isTrainer ? 'Training Studio' : 'LadderStep Admin'}</h1>
                        <p className="text-xs text-gray-400 mt-0.5">{isTrainer ? 'Trainer' : 'Control Panel'}</p>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-4">
                    {visibleNav.map(({ label, to, icon, badgeKey }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/admin'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                                    isActive
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`
                            }
                        >
                            <span>{icon}</span>
                            {label}
                            {badgeKey === 'premium' && pendingPremium > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-[11px] font-semibold rounded-full px-2 py-0.5">
                                    {pendingPremium}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="px-6 py-4 border-t border-gray-700">
                    <button
                        onClick={handleLogout}
                        className="w-full text-left text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto flex flex-col">
                {/* Top bar with notification bell */}
                <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end">
                    <NotificationBell />
                </div>
                <div className="flex-1 overflow-y-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

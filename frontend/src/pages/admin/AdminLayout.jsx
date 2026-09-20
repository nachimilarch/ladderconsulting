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

function AdminNav({ items, pendingPremium, isTrainer, onNavigate, onLogout }) {
    return (
        <>
            <div className="px-6 py-5 border-b border-white/10 flex items-center gap-3">
                <div className="bg-white rounded-lg p-1.5 shrink-0">
                    <img src="/logo-icon.png" alt="LadderStep" className="w-7 h-7 object-contain" />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-white leading-tight">{isTrainer ? 'Training Studio' : 'LadderStep Admin'}</h1>
                    <p className="text-xs text-brand-300 mt-0.5">{isTrainer ? 'Trainer' : 'Control Panel'}</p>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
                {items.map(({ label, to, icon, badgeKey }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/admin'}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                isActive
                                    ? 'bg-brand-600 text-white font-medium shadow-sm'
                                    : 'text-brand-100/80 hover:bg-white/10 hover:text-white'
                            }`
                        }
                    >
                        <span className="w-5 text-center">{icon}</span>
                        {label}
                        {badgeKey === 'premium' && pendingPremium > 0 && (
                            <span className="ml-auto bg-warning-500 text-white text-[11px] font-semibold rounded-full px-2 py-0.5">
                                {pendingPremium}
                            </span>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="px-6 py-4 border-t border-white/10">
                <button
                    onClick={onLogout}
                    className="w-full text-left text-sm text-brand-200/80 hover:text-white transition-colors"
                >
                    Sign out
                </button>
            </div>
        </>
    );
}

export default function AdminLayout() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [pendingPremium, setPendingPremium] = useState(0);
    const [drawerOpen, setDrawerOpen] = useState(false);

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

    const current = visibleNav.find(i => (i.to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(i.to)));

    return (
        <div className="flex h-[100dvh] bg-gray-50">
            {/* Sidebar (desktop) */}
            <aside className="hidden md:flex w-64 shrink-0 bg-brand-950 text-white flex-col">
                <AdminNav items={visibleNav} pendingPremium={pendingPremium} isTrainer={isTrainer} onLogout={handleLogout} />
            </aside>

            {/* Drawer (phones and small tablets) */}
            {drawerOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
                    <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-brand-950 text-white flex flex-col shadow-xl">
                        <AdminNav
                            items={visibleNav}
                            pendingPremium={pendingPremium}
                            isTrainer={isTrainer}
                            onNavigate={() => setDrawerOpen(false)}
                            onLogout={handleLogout}
                        />
                    </aside>
                </div>
            )}

            {/* Main content */}
            <main className="flex-1 min-w-0 flex flex-col">
                <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center gap-3">
                    <button
                        className="md:hidden -ml-1 p-2 rounded-lg hover:bg-gray-100 text-gray-600 text-lg leading-none"
                        onClick={() => setDrawerOpen(true)}
                        aria-label="Open menu"
                    >
                        ☰
                    </button>
                    <span className="md:hidden text-sm font-semibold text-gray-800 truncate">{current?.label || 'Admin'}</span>
                    <div className="ml-auto">
                        <NotificationBell />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

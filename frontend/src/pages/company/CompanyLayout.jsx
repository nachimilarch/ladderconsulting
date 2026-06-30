import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../components/NotificationBell';

const navItems = [
    { label: 'Dashboard',   to: '/company',            icon: '📊', exact: true },
    { label: 'Talent Pool', to: '/company/talent',     icon: '👥' },
    { label: 'Job Postings',to: '/company/jobs',        icon: '💼' },
    { label: 'Shortlist',   to: '/company/shortlist',   icon: '⭐' },
    { label: 'Interviews',  to: '/company/interviews',  icon: '🗓' },
    { label: 'Offers',      to: '/company/offers',      icon: '📨' },
    { label: 'Payments',    to: '/company/payments',    icon: '💳' },
    { label: 'Training',    to: '/company/training',    icon: '🎓' },
    { label: 'Requests',    to: '/company/requests',    icon: '📩' },
    { label: 'Profile',     to: '/company/profile',     icon: '🏢' },
];

export default function CompanyLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (item) =>
        item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <img src="/logo-icon.png" alt="LadderStep" className="w-9 h-9 object-contain shrink-0" />
                    <div>
                        <div className="text-sm font-bold text-gray-900 leading-none">LadderStep <span className="text-brand-600">Human Consulting</span></div>
                        <div className="text-xs text-gray-400 mt-0.5">Company Portal</div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        ☰
                    </button>
                    <NotificationBell />
                    <span className="hidden md:block text-sm text-gray-600">{user?.name}</span>
                    <button onClick={logout} className="hidden md:block text-sm text-red-500 hover:underline">
                        Logout
                    </button>
                </div>
            </nav>

            <div className="flex flex-1 overflow-hidden">
                {/* Desktop sidebar */}
                <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 py-4 gap-1 shrink-0">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all duration-150 ${
                                isActive(item)
                                    ? 'text-indigo-700 bg-indigo-50 border-r-2 border-indigo-600'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                        >
                            <span className="text-base">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                    <div className="mt-auto px-5 pt-4 border-t border-gray-100">
                        <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                        <button onClick={logout} className="text-sm text-red-500 hover:underline mt-1">
                            Logout
                        </button>
                    </div>
                </aside>

                {/* Mobile overlay */}
                {mobileOpen && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
                        <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col py-4 gap-1">
                            <div className="px-5 pb-3 border-b border-gray-100 mb-2">
                                <div className="font-bold text-gray-900 text-sm">Company Menu</div>
                            </div>
                            {navItems.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setMobileOpen(false)}
                                    className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all ${
                                        isActive(item) ? 'text-indigo-700 bg-indigo-50' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-base">{item.icon}</span>
                                    {item.label}
                                </Link>
                            ))}
                            <div className="mt-auto px-5 pt-4 border-t border-gray-100">
                                <div className="text-sm text-gray-500">{user?.name}</div>
                                <button onClick={() => { logout(); setMobileOpen(false); }} className="text-sm text-red-500 hover:underline mt-1">
                                    Logout
                                </button>
                            </div>
                        </aside>
                    </div>
                )}

                <main className="flex-1 overflow-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

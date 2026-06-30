import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
    { label: 'Dashboard', to: '/candidate', icon: '📊', exact: true },
    { label: 'My Profile', to: '/candidate/profile', icon: '👤' },
    { label: 'Browse Jobs', to: '/candidate/jobs', icon: '💼' },
    { label: 'Applications', to: '/candidate/applications', icon: '📋' },
    { label: 'Interviews', to: '/candidate/interviews', icon: '🗓' },
    { label: 'Documents', to: '/candidate/documents', icon: '📁' },
];

export default function CandidateLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (item) => {
        if (item.exact) return location.pathname === item.to;
        return location.pathname.startsWith(item.to);
    };

    return (
        <div className="page">
            {/* Navbar */}
            <nav className="navbar">
                <div className="navbar-brand">
                    <img src="/logo-icon.png" alt="LadderStep" className="w-9 h-9 object-contain shrink-0" />
                    <div>
                        <div className="navbar-title">LadderStep <span className="text-brand-600">Human Consulting</span></div>
                        <div className="navbar-subtitle">Candidate Portal</div>
                    </div>
                </div>
                <div className="navbar-actions">
                    {/* Mobile menu toggle */}
                    <button
                        className="md:hidden btn-icon"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        ☰
                    </button>
                    <span className="navbar-user hidden md:inline">{user?.name}</span>
                    <button onClick={logout} className="navbar-logout hidden md:inline">
                        Logout
                    </button>
                </div>
            </nav>

            <div className="flex flex-1">
                {/* Sidebar — Desktop */}
                <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 py-4 gap-1 shrink-0">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all duration-150 ${
                                isActive(item)
                                    ? 'text-blue-700 bg-blue-50 border-r-2 border-blue-600'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                    <div className="mt-auto px-5 pt-4 border-t border-gray-100">
                        <div className="text-xs text-gray-400">{user?.email}</div>
                        <button onClick={logout} className="text-sm text-red-500 hover:underline mt-1">
                            Logout
                        </button>
                    </div>
                </aside>

                {/* Mobile sidebar overlay */}
                {mobileOpen && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
                        <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col py-4 gap-1 animate-slide-up">
                            <div className="px-5 pb-3 border-b border-gray-100 mb-2">
                                <div className="font-bold text-gray-900">Menu</div>
                            </div>
                            {navItems.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setMobileOpen(false)}
                                    className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all duration-150 ${
                                        isActive(item)
                                            ? 'text-blue-700 bg-blue-50'
                                            : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-lg">{item.icon}</span>
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

                {/* Main content */}
                <main className="flex-1 p-6 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

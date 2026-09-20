import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../NotificationBell';
import useHrData from './useHrData';

// The sidebar follows the hiring workflow in order (companies, sourcing, interviews,
// offers, billing), so the daily routine reads top to bottom. `badge` names a live count.
const NAV = [
    { title: null, items: [
        { label: 'Dashboard',         to: '/hr',                             icon: '🏠', exact: true },
    ] },
    { title: 'Your workflow', items: [
        { label: 'My Companies',      to: '/hr/companies',                   icon: '🏢', step: 1 },
        { label: 'Resume Sourcing',   to: '/hr/sourcing',                    icon: '📄', step: 2 },
        { label: 'Interviews',        to: '/hr/interviews',                  icon: '🗓', step: 3, badge: 'interviews', also: ['/hr/interview-requests', '/hr/scheduled-interviews'] },
        { label: 'Offer Requests',    to: '/hr/offer-requests',              icon: '📋', step: 4, badge: 'offers' },
        { label: 'Invoices',          to: '/hr/invoices',                    icon: '🧾', step: 5, hint: 'placement fees' },
    ] },
    { title: 'Approvals', items: [
        { label: 'Company Premium',   to: '/hr/premium-requests',            icon: '⭐', badge: 'companyPremium' },
        { label: 'Candidate Premium', to: '/hr/premium-candidate-requests',  icon: '🌟', badge: 'candidatePremium' },
    ] },
    { title: 'Work', items: [
        { label: 'Tasks',             to: '/hr/tasks',                       icon: '✅' },
        { label: 'Reports',           to: '/hr/reports',                     icon: '📈' },
        { label: 'Outreach',          to: '/outreach',                       icon: '📡' },
    ] },
];

// Phone tab bar: the four screens used most, then "More" for everything else.
const TABS = [
    { label: 'Home',       to: '/hr',                icon: '🏠', exact: true },
    { label: 'Sourcing',   to: '/hr/sourcing',       icon: '📄' },
    { label: 'Interviews', to: '/hr/interviews',     icon: '🗓', badge: 'interviews', also: ['/hr/interview-requests', '/hr/scheduled-interviews'] },
    { label: 'Offers',     to: '/hr/offer-requests', icon: '📋', badge: 'offers' },
    { label: 'More',       menu: true,                icon: '☰' },
];

const Count = ({ n, className = '' }) =>
    n > 0 ? (
        <span className={`bg-warning-500 text-white text-[11px] font-semibold rounded-full min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center ${className}`}>
            {n > 99 ? '99+' : n}
        </span>
    ) : null;

export default function HRLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const data = useHrData(location.pathname);

    const isAdmin = user?.role === 'admin';
    const isActive = (item) => (item.exact
        ? location.pathname === item.to
        : [item.to, ...(item.also || [])].some((p) => location.pathname.startsWith(p)));
    const initial = (user?.name || 'H').trim()[0]?.toUpperCase();

    return (
        <div className="page staff-portal">
            {/* Top bar */}
            <nav className="navbar">
                <Link to={isAdmin ? '/admin' : '/hr'} className="navbar-brand min-w-0">
                    <img src="/logo-icon.png" alt="LadderStep" className="w-9 h-9 object-contain shrink-0" />
                    <div className="min-w-0">
                        <div className="navbar-title truncate">LadderStep <span className="text-indigo-400 hidden sm:inline">Human Consulting</span></div>
                        <div className="navbar-subtitle hidden sm:block">{isAdmin ? 'Hiring Portal (Admin View)' : 'Hiring Portal'}</div>
                    </div>
                </Link>
                <div className="navbar-actions">
                    {isAdmin && (
                        <Link to="/admin" className="hidden md:inline text-xs text-indigo-600 hover:underline font-medium">
                            ← Admin Dashboard
                        </Link>
                    )}
                    <NotificationBell />
                    <span className="navbar-user hidden md:inline">{user?.name}</span>
                    <button onClick={logout} className="navbar-logout hidden md:inline">Logout</button>
                    <button
                        className="md:hidden w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center"
                        onClick={() => setMenuOpen(true)}
                        aria-label="Open menu"
                    >
                        {initial}
                    </button>
                </div>
            </nav>

            <div className="flex flex-1 min-w-0">
                {/* Sidebar (desktop) */}
                <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 py-4 shrink-0 sticky top-[65px] self-start h-[calc(100vh-65px)] overflow-y-auto">
                    {isAdmin && (
                        <Link to="/admin"
                            className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition">
                            <span>⬅</span> Admin Dashboard
                        </Link>
                    )}
                    {NAV.map((group, gi) => (
                        <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
                            {group.title && (
                                <p className="px-5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.title}</p>
                            )}
                            {group.items.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all duration-150 ${
                                        isActive(item)
                                            ? 'text-indigo-700 bg-indigo-50 border-r-2 border-indigo-600'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                >
                                    {item.step ? (
                                        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                            isActive(item) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                                        }`}>{item.step}</span>
                                    ) : (
                                        <span className="text-lg w-6 text-center shrink-0">{item.icon}</span>
                                    )}
                                    <span className="leading-tight min-w-0 flex-1">
                                        {item.label}
                                        {item.hint && <span className="block text-[11px] font-normal text-gray-400">{item.hint}</span>}
                                    </span>
                                    {item.badge && <Count n={data.counts[item.badge]} />}
                                </Link>
                            ))}
                        </div>
                    ))}
                    <div className="mt-auto px-5 pt-4 border-t border-gray-100">
                        <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                        <button onClick={logout} className="text-sm text-red-500 hover:underline mt-1">Logout</button>
                    </div>
                </aside>

                {/* Main content: extra bottom padding on phones so the tab bar never covers it */}
                <main className="flex-1 min-w-0 p-4 sm:p-6 pb-28 md:pb-6 overflow-x-hidden overflow-y-auto">
                    <Outlet context={data} />
                </main>
            </div>

            {/* Phone tab bar */}
            <nav
                className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 grid grid-cols-5"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                {TABS.map((tab) => {
                    const active = !tab.menu && isActive(tab);
                    const inner = (
                        <>
                            <span className="relative text-xl leading-none">
                                {tab.icon}
                                {tab.badge && data.counts[tab.badge] > 0 && (
                                    <span className="absolute -top-1.5 -right-3 bg-warning-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                                        {data.counts[tab.badge] > 99 ? '99+' : data.counts[tab.badge]}
                                    </span>
                                )}
                            </span>
                            <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
                        </>
                    );
                    const cls = `flex flex-col items-center justify-center gap-0.5 py-2 ${active ? 'text-indigo-700' : 'text-gray-500'}`;
                    return tab.menu ? (
                        <button key="more" onClick={() => setMenuOpen(true)} className={cls} aria-label="More">{inner}</button>
                    ) : (
                        <Link key={tab.to} to={tab.to} className={cls}>{inner}</Link>
                    );
                })}
            </nav>

            {/* Phone menu (everything, grouped) */}
            {menuOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
                    <aside className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col overflow-y-auto">
                        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center">{initial}</div>
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-gray-900 truncate">{user?.name}</div>
                                <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                            </div>
                            <button onClick={() => setMenuOpen(false)} className="text-2xl text-gray-400 w-9 h-9" aria-label="Close menu">×</button>
                        </div>
                        {isAdmin && (
                            <Link to="/admin" onClick={() => setMenuOpen(false)}
                                className="mx-4 mt-3 flex items-center gap-2 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-medium text-indigo-700">
                                <span>⬅</span> Admin Dashboard
                            </Link>
                        )}
                        <div className="py-2 flex-1">
                            {NAV.map((group, gi) => (
                                <div key={gi} className="py-1">
                                    {group.title && (
                                        <p className="px-5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.title}</p>
                                    )}
                                    {group.items.map((item) => (
                                        <Link
                                            key={item.to}
                                            to={item.to}
                                            onClick={() => setMenuOpen(false)}
                                            className={`flex items-center gap-3 px-5 py-3 text-[15px] font-medium ${
                                                isActive(item) ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 active:bg-gray-50'
                                            }`}
                                        >
                                            <span className="text-xl w-7 text-center">{item.icon}</span>
                                            <span className="flex-1">{item.label}</span>
                                            {item.badge && <Count n={data.counts[item.badge]} />}
                                        </Link>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div className="p-5 border-t border-gray-100">
                            <button onClick={() => { setMenuOpen(false); logout(); }} className="w-full text-left text-red-500 font-medium">Logout</button>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}

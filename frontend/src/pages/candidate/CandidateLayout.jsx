import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChatbotWidget from '../../components/ChatbotWidget';
import NotificationBell from '../../components/NotificationBell';
import { askAssistant } from '../../utils/assistant';

// The sidebar mirrors the candidate journey, in order: build a profile, find jobs,
// apply, then interviews and offers. Numbering it makes the workflow obvious.
const NAV = [
    { title: null, items: [
        { label: 'Dashboard',    to: '/candidate',              icon: '🏠', exact: true },
    ] },
    { title: 'Your journey', items: [
        { label: 'My Profile',   to: '/candidate/profile',      icon: '👤', step: 1 },
        { label: 'Browse Jobs',  to: '/candidate/jobs',         icon: '💼', step: 2 },
        { label: 'Applications', to: '/candidate/applications', icon: '📋', step: 3, hint: 'and offers' },
        { label: 'Interviews',   to: '/candidate/interviews',   icon: '🗓', step: 4 },
    ] },
    { title: 'More', items: [
        { label: 'Documents',    to: '/candidate/documents',    icon: '📁' },
        { label: 'Premium',      to: '/candidate/premium',      icon: '⭐' },
        { label: 'How to Use',   to: '/candidate/help',         icon: '❓' },
    ] },
];
const ALL_ITEMS = NAV.flatMap((g) => g.items);

// Phone tab bar: the five things people do most, with the AI assistant in the middle.
const TABS = [
    { label: 'Home',         to: '/candidate',              icon: '🏠', exact: true },
    { label: 'Jobs',         to: '/candidate/jobs',         icon: '💼' },
    { label: 'Ask AI',       ai: true,                      icon: '✨' },
    { label: 'Applied',      to: '/candidate/applications', icon: '📋' },
    { label: 'Profile',      to: '/candidate/profile',      icon: '👤' },
];

export default function CandidateLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    const isActive = (item) => (item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to));
    const initial = (user?.name || 'C').trim()[0]?.toUpperCase();

    return (
        <div className="page candidate-portal">
            {/* Top bar */}
            <nav className="navbar">
                <Link to="/candidate" className="navbar-brand min-w-0">
                    <img src="/logo-icon.png" alt="LadderStep" className="w-9 h-9 object-contain shrink-0" />
                    <div className="min-w-0">
                        <div className="navbar-title truncate">LadderStep <span className="text-indigo-400 hidden sm:inline">Human Consulting</span></div>
                        <div className="navbar-subtitle hidden sm:block">Candidate Portal</div>
                    </div>
                </Link>
                <div className="navbar-actions">
                    <button
                        onClick={() => askAssistant()}
                        className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-1.5 rounded-full shadow-sm hover:shadow transition"
                    >
                        ✨ Ask AI
                    </button>
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
                                    <span className="leading-tight">
                                        {item.label}
                                        {item.hint && <span className="block text-[11px] font-normal text-gray-400">{item.hint}</span>}
                                    </span>
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
                    <Outlet />
                </main>
            </div>

            {/* Phone tab bar */}
            <nav
                className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 grid grid-cols-5"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                {TABS.map((tab) => {
                    if (tab.ai) {
                        return (
                            <button
                                key="ai"
                                onClick={() => askAssistant()}
                                className="flex flex-col items-center justify-center gap-0.5 py-1.5 -mt-4"
                                aria-label="Ask the AI assistant"
                            >
                                <span className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-xl flex items-center justify-center shadow-lg ring-4 ring-white">✨</span>
                                <span className="text-[10px] font-semibold text-indigo-700">Ask AI</span>
                            </button>
                        );
                    }
                    const active = isActive(tab);
                    return (
                        <Link
                            key={tab.to}
                            to={tab.to}
                            className={`flex flex-col items-center justify-center gap-0.5 py-2 ${active ? 'text-indigo-700' : 'text-gray-500'}`}
                        >
                            <span className="text-xl leading-none">{tab.icon}</span>
                            <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Phone menu (everything not on the tab bar) */}
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
                        <div className="py-2 flex-1">
                            {ALL_ITEMS.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setMenuOpen(false)}
                                    className={`flex items-center gap-3 px-5 py-3 text-[15px] font-medium ${
                                        isActive(item) ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 active:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-xl w-7 text-center">{item.icon}</span>
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                        <div className="p-5 border-t border-gray-100">
                            <button onClick={() => { setMenuOpen(false); logout(); }} className="w-full text-left text-red-500 font-medium">Logout</button>
                        </div>
                    </aside>
                </div>
            )}

            <ChatbotWidget mobileLauncher={false} />
        </div>
    );
}

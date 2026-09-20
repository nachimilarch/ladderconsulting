import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import { companyAPI } from '../../api/company';
import toast from 'react-hot-toast';
import CompanyTour from '../../components/company/CompanyTour';
import WelcomeModal from '../../components/company/WelcomeModal';
import useCompanyData from '../../components/company/useCompanyData';
import ChatbotWidget from '../../components/ChatbotWidget';
import { askAssistant } from '../../utils/assistant';

// The sidebar follows the hiring journey in order: post a job, find candidates, review
// them, interview, make an offer. `tour` is what the product tour spotlights; `badge`
// names a live count that means "something is waiting on you".
const NAV = [
    { title: null, items: [
        { label: 'Dashboard',   to: '/company',            icon: '🏠', exact: true },
    ] },
    { title: 'Your hiring journey', items: [
        { label: 'Job Postings', to: '/company/jobs',       icon: '💼', step: 1, tour: 'job-postings', badge: 'jobs' },
        { label: 'Talent Pool',  to: '/company/talent',     icon: '👥', step: 2, tour: 'talent-pool' },
        { label: 'Shortlist',    to: '/company/shortlist',  icon: '⭐', step: 3, tour: 'shortlist', hint: 'applications', badge: 'shortlist' },
        { label: 'Interviews',   to: '/company/interviews', icon: '🗓', step: 4, tour: 'interviews', badge: 'interviews' },
        { label: 'Offers',       to: '/company/offers',     icon: '📨', step: 5, tour: 'offers' },
    ] },
    { title: 'More', items: [
        { label: 'Payments',     to: '/company/payments',   icon: '💳', tour: 'payments', badge: 'payments' },
        { label: 'Training',     to: '/company/training',   icon: '🎓' },
        { label: 'Requests',     to: '/company/requests',   icon: '📩' },
        { label: 'Profile',      to: '/company/profile',    icon: '🏢' },
        { label: 'How to Use',   to: '/company/help',       icon: '❓', tour: 'help' },
    ] },
];

// Phone tab bar: the screens used most, with the AI assistant in the middle.
const TABS = [
    { label: 'Home',      to: '/company',           icon: '🏠', exact: true },
    { label: 'Jobs',      to: '/company/jobs',      icon: '💼', badge: 'jobs' },
    { label: 'Ask AI',    ai: true,                 icon: '✨' },
    { label: 'Shortlist', to: '/company/shortlist', icon: '⭐', badge: 'shortlist' },
    { label: 'More',      menu: true,                icon: '☰' },
];

const Count = ({ n }) =>
    n > 0 ? (
        <span className="bg-warning-500 text-white text-[11px] font-semibold rounded-full min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center">
            {n > 99 ? '99+' : n}
        </span>
    ) : null;

export default function CompanyLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const data = useCompanyData(location.pathname);

    // Welcome form state
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardChecked, setOnboardChecked] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        company_name: '', industry: '', size: '', headquarters: '',
        website: '', description: '', contact_phone: '',
    });

    // Check profile completeness on first load
    useEffect(() => {
        companyAPI.getProfile()
            .then(r => {
                const co = r.data?.company || r.data;
                if (!co?.industry || !co?.headquarters) {
                    setForm(f => ({
                        ...f,
                        company_name:   co?.company_name  || user?.name || '',
                        industry:       co?.industry      || '',
                        size:           co?.size          || '',
                        headquarters:   co?.headquarters  || '',
                        website:        co?.website       || '',
                        description:    co?.description   || '',
                        contact_phone:  co?.contact_phone || '',
                    }));
                    setShowOnboarding(true);
                }
            })
            .catch(() => {})
            .finally(() => setOnboardChecked(true));
    }, []); // eslint-disable-line

    const handleOnboardSubmit = async (e) => {
        e.preventDefault();
        if (!form.company_name.trim()) { toast.error('Company name is required'); return; }
        if (!form.industry)            { toast.error('Please select an industry'); return; }
        if (!form.headquarters.trim()) { toast.error('Location / HQ is required'); return; }
        if (!/^\+?[0-9]{7,15}$/.test(form.contact_phone.replace(/\s/g, ''))) { toast.error('Enter a valid contact phone number'); return; }
        setSaving(true);
        try {
            await companyAPI.updateProfile(form);
            toast.success('Company profile saved!');
            setShowOnboarding(false);
            data.refresh();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const isActive = (item) => (item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to));
    const initial = (user?.name || 'C').trim()[0]?.toUpperCase();
    const onboardingOpen = !onboardChecked || showOnboarding;

    return (
        <div className="page company-portal">
            {/* Top bar */}
            <nav className="navbar">
                <Link to="/company" className="navbar-brand min-w-0">
                    <img src="/logo-icon.png" alt="LadderStep" className="w-9 h-9 object-contain shrink-0" />
                    <div className="min-w-0">
                        <div className="navbar-title truncate">LadderStep <span className="text-indigo-400 hidden sm:inline">Human Consulting</span></div>
                        <div className="navbar-subtitle hidden sm:block">Company Portal</div>
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
                                    data-tour={item.tour}
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
                    <Outlet context={{ ...data, onboardingOpen }} />
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

            {onboardChecked && showOnboarding && (
                <WelcomeModal form={form} setForm={setForm} saving={saving} onSubmit={handleOnboardSubmit} />
            )}

            {/* Product tour */}
            <CompanyTour hold={onboardingOpen} />
            <ChatbotWidget mobileLauncher={false} />
        </div>
    );
}

import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import { companyAPI } from '../../api/company';
import toast from 'react-hot-toast';

const INDUSTRIES = [
    'Technology', 'Finance', 'Banking', 'Healthcare', 'Education', 'Manufacturing',
    'Retail', 'E-commerce', 'Consulting', 'Real Estate', 'Media & Entertainment',
    'Logistics', 'Automotive', 'Energy', 'Hospitality', 'Telecommunications', 'Other',
];
const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

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

    // Onboarding modal state
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
        setSaving(true);
        try {
            await companyAPI.updateProfile(form);
            toast.success('Company profile saved!');
            setShowOnboarding(false);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

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

            {/* ── Onboarding modal ─────────────────────────────────────────── */}
            {onboardChecked && showOnboarding && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-3 mb-1">
                                <img src="/logo-icon.png" alt="" className="w-8 h-8 object-contain" />
                                <h2 className="text-lg font-bold text-gray-900">Welcome to LadderStep!</h2>
                            </div>
                            <p className="text-sm text-gray-500">
                                Complete your company profile so our team can best assist you with hiring.
                            </p>
                        </div>

                        <form onSubmit={handleOnboardSubmit} className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name <span className="text-red-500">*</span></label>
                                <input
                                    value={form.company_name}
                                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Acme Corp"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Industry <span className="text-red-500">*</span></label>
                                    <select
                                        value={form.industry}
                                        onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select…</option>
                                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Company Size</label>
                                    <select
                                        value={form.size}
                                        onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select…</option>
                                        {SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Location / Headquarters <span className="text-red-500">*</span></label>
                                <input
                                    value={form.headquarters}
                                    onChange={e => setForm(f => ({ ...f, headquarters: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Bangalore, Karnataka"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Website</label>
                                    <input
                                        value={form.website}
                                        onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="https://example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Phone</label>
                                    <input
                                        value={form.contact_phone}
                                        onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="+91 98765 43210"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">About the Company</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    rows={3}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    placeholder="Brief description of your company, culture, and what you do…"
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                                >
                                    {saving ? 'Saving…' : 'Save & Continue'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

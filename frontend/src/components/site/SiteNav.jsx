import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Bars3Icon, XMarkIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { Button } from './ui';
import { navigationLinks, contactEmail, companyInfo } from './siteContent';

const desktopLink = ({ isActive }) =>
    `relative px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-sitegold after:transition-transform after:duration-300 ${
        isActive
            ? 'text-site-deep after:scale-x-100'
            : 'text-slate-600 hover:text-site-deep after:scale-x-0 hover:after:scale-x-100'
    }`;

export default function SiteNav() {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 8);
    const { user } = useAuth();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <>
            {/* Utility bar: scrolls away, desktop only */}
            <div className="hidden md:block bg-site-ink text-slate-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between text-xs">
                    <p className="hidden lg:block tracking-wide">{companyInfo.tagline}</p>
                    <div className="ml-auto flex items-center gap-6">
                        <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-2 hover:text-white transition-colors">
                            <EnvelopeIcon className="h-4 w-4 text-sitegold-light" aria-hidden="true" />
                            {contactEmail}
                        </a>
                        {!user && <Link to="/login" className="font-medium text-sitegold-light hover:text-white transition-colors">Client Portal →</Link>}
                    </div>
                </div>
            </div>

            <header className={`sticky top-0 z-50 bg-white/95 backdrop-blur transition-shadow duration-300 ${scrolled ? 'shadow-[0_8px_30px_-12px_rgba(6,27,46,0.25)]' : 'border-b border-slate-200/70'}`}>
                <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main">
                    <div className={`flex items-center justify-between transition-all duration-300 ${scrolled ? 'h-16' : 'h-20'}`}>
                        <Link to="/" className="flex items-center gap-3 shrink-0" aria-label="LadderStep Human Consulting, home">
                            <img src="/site/logo_notext.jpeg" alt="" className={`w-auto object-contain transition-all duration-300 ${scrolled ? 'h-10' : 'h-12'}`} />
                            <img src="/site/logo_text.jpeg" alt="LadderStep Human Consulting" className={`w-auto object-contain hidden sm:block transition-all duration-300 ${scrolled ? 'h-8' : 'h-9'}`} />
                        </Link>

                        <div className="hidden xl:flex items-center gap-1">
                            {navigationLinks.map((l) => (
                                <NavLink key={l.href} to={l.href} end className={desktopLink}>{l.label}</NavLink>
                            ))}
                            <span className="w-px h-6 bg-slate-200 mx-4" aria-hidden="true" />
                            {user ? (
                                <Button to="/dashboard" size="sm" arrow>My Dashboard</Button>
                            ) : (
                                <>
                                    <Link to="/login" className="px-3 py-2 mr-1 text-sm font-semibold text-site hover:text-site-deep transition-colors">Login</Link>
                                    <Button to="/register" size="sm" arrow>Get Started</Button>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => setOpen(!open)}
                            className="xl:hidden -mr-2 p-2 rounded-lg text-slate-600 hover:text-site-deep hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sitegold"
                            aria-label={open ? 'Close menu' : 'Open menu'}
                            aria-expanded={open}
                        >
                            {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
                        </button>
                    </div>
                </nav>

                {open && (
                    <div className="xl:hidden border-t border-slate-200 bg-white">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-1">
                            {navigationLinks.map((l) => (
                                <NavLink
                                    key={l.href} to={l.href} end onClick={() => setOpen(false)}
                                    className={({ isActive }) => `block rounded-lg px-3 py-3 text-base font-medium ${isActive ? 'bg-site-mist text-site-deep' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    {l.label}
                                </NavLink>
                            ))}
                            <div className="flex gap-3 pt-4">
                                {user ? (
                                    <Button to="/dashboard" className="flex-1" arrow>My Dashboard</Button>
                                ) : (
                                    <>
                                        <Button to="/login" variant="outline" className="flex-1">Login</Button>
                                        <Button to="/register" className="flex-1">Get Started</Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </header>
        </>
    );
}

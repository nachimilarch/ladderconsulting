import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bars3Icon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { Button } from './ui';
import { Lockup } from './Brand';
import { navigationLinks, pillars, pillarHref } from './siteContent';

const linkBase = 'relative px-3 py-2 text-[0.9375rem] font-medium whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:origin-left after:bg-ls-blue after:transition-transform after:duration-300';
const linkState = (active) => (active
    ? 'text-ls-navy after:scale-x-100'
    : 'text-ls-muted hover:text-ls-navy after:scale-x-0 hover:after:scale-x-100');

// Services link with a small menu of the four pillars.
function ServicesMenu({ active }) {
    const [open, setOpen] = useState(false);
    const wrap = useRef(null);
    const closeTimer = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const show = () => { clearTimeout(closeTimer.current); setOpen(true); };
    const hide = () => { closeTimer.current = setTimeout(() => setOpen(false), 120); };

    return (
        <div ref={wrap} className="relative" onMouseEnter={show} onMouseLeave={hide}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-haspopup="true"
                className={`${linkBase} ${linkState(active)} inline-flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ls-blue`}
            >
                Services
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} aria-hidden="true" />
            </button>
            {open && (
                <div className="absolute left-1/2 top-full z-50 w-[22rem] -translate-x-1/2 pt-3">
                    <div className="rounded-md border border-ls-line border-t-[3px] border-t-ls-blue bg-white p-2 shadow-[0_18px_40px_-20px_rgba(20,33,61,0.35)]">
                        {pillars.map((p) => (
                            <Link
                                key={p.slug}
                                to={pillarHref(p)}
                                onClick={() => setOpen(false)}
                                className="flex items-baseline gap-3 rounded px-3 py-2.5 hover:bg-ls-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-ls-blue"
                            >
                                <span className="w-6 text-xs font-semibold tabular-nums text-ls-blue">0{p.step}</span>
                                <span>
                                    <span className="block font-semibold text-ls-navy">{p.word}</span>
                                    <span className="block text-sm text-ls-muted">{p.name}</span>
                                </span>
                            </Link>
                        ))}
                        <Link to="/services" onClick={() => setOpen(false)} className="mt-1 block border-t border-ls-line px-3 pb-1 pt-3 text-sm font-semibold text-ls-blue underline underline-offset-4 hover:text-ls-navy">
                            All services
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SiteNav() {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 8);
    const { user } = useAuth();
    const { pathname } = useLocation();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <header className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${scrolled ? 'shadow-[0_10px_30px_-18px_rgba(20,33,61,0.45)]' : 'border-b border-ls-line'}`}>
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main">
                <div className={`flex items-center justify-between gap-6 transition-all duration-300 ${scrolled ? 'h-16' : 'h-20'}`}>
                    <Link to="/" className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ls-blue" aria-label="Ladderstep Consulting, home">
                        <Lockup className={`w-auto transition-all duration-300 ${scrolled ? 'h-9' : 'h-11'}`} />
                    </Link>

                    <div className="hidden lg:flex items-center gap-1">
                        {navigationLinks.map((l) => (l.href === '/services'
                            ? <ServicesMenu key={l.href} active={pathname.startsWith('/services')} />
                            : (
                                <NavLink key={l.href} to={l.href} end className={({ isActive }) => `${linkBase} ${linkState(isActive)}`}>
                                    {l.label}
                                </NavLink>
                            )))}
                        <span className="w-px h-6 bg-ls-line mx-4" aria-hidden="true" />
                        {user ? (
                            <Button to="/dashboard" variant="navy" size="sm" arrow>My dashboard</Button>
                        ) : (
                            <>
                                <Link to="/login" className="px-3 py-2 mr-1 text-[0.9375rem] font-semibold text-ls-blue hover:text-ls-navy transition-colors">Log in</Link>
                                <Button to="/register" variant="navy" size="sm">Get started</Button>
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => setOpen(!open)}
                        className="lg:hidden -mr-2 p-2 rounded-md text-ls-navy hover:bg-ls-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-ls-blue"
                        aria-label={open ? 'Close menu' : 'Open menu'}
                        aria-expanded={open}
                    >
                        {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
                    </button>
                </div>
            </nav>

            {open && (
                <div className="lg:hidden border-t border-ls-line bg-white max-h-[calc(100vh-5rem)] overflow-y-auto">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                        {navigationLinks.map((l) => (
                            <div key={l.href}>
                                <NavLink
                                    to={l.href} end onClick={() => setOpen(false)}
                                    className={({ isActive }) => `block rounded-md px-3 py-3 text-base font-semibold ${isActive ? 'bg-ls-paper text-ls-navy' : 'text-ls-navy hover:bg-ls-paper'}`}
                                >
                                    {l.label}
                                </NavLink>
                                {l.href === '/services' && (
                                    <div className="mb-1 ml-3 border-l-2 border-ls-line pl-3">
                                        {pillars.map((p) => (
                                            <NavLink
                                                key={p.slug} to={pillarHref(p)} onClick={() => setOpen(false)}
                                                className={({ isActive }) => `flex items-baseline gap-3 rounded-md px-3 py-2 text-[0.9375rem] ${isActive ? 'bg-ls-paper text-ls-navy font-semibold' : 'text-ls-muted hover:bg-ls-paper'}`}
                                            >
                                                <span className="text-xs font-semibold tabular-nums text-ls-blue">0{p.step}</span>
                                                {p.word}
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div className="flex gap-3 pt-4">
                            {user ? (
                                <Button to="/dashboard" variant="navy" className="flex-1" arrow onClick={() => setOpen(false)}>My dashboard</Button>
                            ) : (
                                <>
                                    <Button to="/login" variant="outline" className="flex-1">Log in</Button>
                                    <Button to="/register" variant="navy" className="flex-1">Get started</Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

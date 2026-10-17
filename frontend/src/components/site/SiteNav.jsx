import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bars3Icon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { Button } from './ui';
import { Lockup } from './Brand';
import { ScrollPlane } from './interactive';
import { enquiryHref, navigationLinks, pillars, pillarHref } from './siteContent';

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
                4 Pillars
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
                                    <span className="block text-sm text-ls-muted">{p.lead}</span>
                                </span>
                            </Link>
                        ))}
                        <Link to="/#pillars" onClick={() => setOpen(false)} className="mt-1 block border-t border-ls-line px-3 pb-1 pt-3 text-sm font-semibold text-ls-blue underline underline-offset-4 hover:text-ls-navy">
                            The 4 Pillars
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
    const loginRef = useRef(null);

    useEffect(() => {
        const close = (e) => {
            const d = loginRef.current;
            if (d?.open && (e.type === 'keydown' ? e.key === 'Escape' : !d.contains(e.target))) d.removeAttribute('open');
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
    }, []);

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
                        <Lockup className={`w-auto transition-all duration-300 ${scrolled ? 'h-10' : 'h-12'}`} />
                    </Link>

                    <div className="hidden lg:flex items-center gap-1 whitespace-nowrap">
                        {navigationLinks.filter((l) => l.href !== '/').map((l) => (l.menu
                            ? <ServicesMenu key="pillars" active={pillars.some((p) => pathname === pillarHref(p))} />
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
                                {/* One "Login As" menu: pick Candidate or Company. Closes on outside click, Escape or navigation. */}
                                <details ref={loginRef} className="group relative mr-1">
                                    <summary className="flex cursor-pointer list-none items-center gap-1 px-2.5 py-2 text-[0.9375rem] font-semibold text-ls-blue hover:text-ls-navy transition-colors [&::-webkit-details-marker]:hidden">
                                        Login As <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                                    </summary>
                                    <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-ls-line bg-white py-1 shadow-lg">
                                        <Link to="/login?role=candidate" onClick={(e) => e.currentTarget.closest('details')?.removeAttribute('open')} className="block px-4 py-2.5 text-sm font-semibold text-ls-navy hover:bg-ls-blue-50">Candidate</Link>
                                        <Link to="/login?role=company" onClick={(e) => e.currentTarget.closest('details')?.removeAttribute('open')} className="block px-4 py-2.5 text-sm font-semibold text-ls-navy hover:bg-ls-blue-50">Company</Link>
                                    </div>
                                </details>
                                <Button to={enquiryHref('call')} variant="navy" size="sm">Book a Call</Button>
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

            <ScrollPlane />

            {open && (
                <div className="lg:hidden border-t border-ls-line bg-white max-h-[calc(100vh-5rem)] overflow-y-auto">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                        {navigationLinks.map((l) => (
                            <div key={l.href || 'pillars'}>
                                {l.menu ? (
                                    <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.18em] text-ls-muted">{l.label}</p>
                                ) : (
                                    <NavLink
                                        to={l.href} end onClick={() => setOpen(false)}
                                        className={({ isActive }) => `block rounded-md px-3 py-3 text-base font-semibold ${isActive ? 'bg-ls-paper text-ls-navy' : 'text-ls-navy hover:bg-ls-paper'}`}
                                    >
                                        {l.label}
                                    </NavLink>
                                )}
                                {l.menu && (
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
                        {!user && (
                            <div className="pt-4">
                                <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-ls-muted">Login as</p>
                                <div className="flex gap-3">
                                <Button to="/login?role=candidate" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Candidate</Button>
                                <Button to="/login?role=company" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Company</Button>
                                </div>
                            </div>
                        )}
                        <div className="flex gap-3 pt-3">
                            {user ? (
                                <Button to="/dashboard" variant="navy" className="flex-1" arrow onClick={() => setOpen(false)}>My dashboard</Button>
                            ) : (
                                <>
                                    <Button to={enquiryHref('call')} variant="navy" className="flex-1" onClick={() => setOpen(false)}>Book a Call</Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

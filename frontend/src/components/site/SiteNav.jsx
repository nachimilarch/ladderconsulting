import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from './ui';
import { navigationLinks } from './siteContent';

const linkCls = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${isActive ? 'text-site' : 'text-sitegray-dark hover:text-site'}`;

export default function SiteNav() {
    const [open, setOpen] = useState(false);
    const { user } = useAuth();

    return (
        <header className="sticky top-0 z-50">
            <nav className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20 py-2">
                        <Link to="/" className="flex items-center gap-3 shrink-0">
                            <img src="/site/logo_notext.jpeg" alt="LadderStep" className="h-12 w-auto object-contain" />
                            <img src="/site/logo_text.jpeg" alt="LadderStep Human Consulting" className="h-10 w-auto object-contain hidden sm:block" />
                        </Link>

                        <div className="hidden xl:flex items-center gap-1">
                            {navigationLinks.map((l) => (
                                <NavLink key={l.href} to={l.href} end className={linkCls}>{l.label}</NavLink>
                            ))}
                            <span className="w-px h-6 bg-sitegray/40 mx-3" aria-hidden="true" />
                            {user ? (
                                <Button to="/dashboard" size="sm">My Dashboard</Button>
                            ) : (
                                <>
                                    <Button to="/login" variant="outline" size="sm" className="mr-2">Login</Button>
                                    <Button to="/register" size="sm">Get Started</Button>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => setOpen(!open)}
                            className="xl:hidden text-sitegray-dark hover:text-site focus:outline-none"
                            aria-label="Toggle menu"
                            aria-expanded={open}
                        >
                            <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                {open ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
                            </svg>
                        </button>
                    </div>
                </div>

                {open && (
                    <div className="xl:hidden px-2 pb-4 pt-2 space-y-1 bg-white border-t">
                        {navigationLinks.map((l) => (
                            <NavLink key={l.href} to={l.href} end onClick={() => setOpen(false)}
                                className={({ isActive }) => `block px-3 py-2 text-base font-medium ${isActive ? 'text-site' : 'text-sitegray-dark hover:text-site'}`}>
                                {l.label}
                            </NavLink>
                        ))}
                        <div className="flex gap-2 px-3 pt-3">
                            {user ? (
                                <Button to="/dashboard" size="sm" className="flex-1">My Dashboard</Button>
                            ) : (
                                <>
                                    <Button to="/login" variant="outline" size="sm" className="flex-1">Login</Button>
                                    <Button to="/register" size="sm" className="flex-1">Get Started</Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </nav>
        </header>
    );
}

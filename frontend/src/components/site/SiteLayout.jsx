import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';

// Wraps every public marketing page. Uses Inter (already loaded by index.html), so no extra font request.
// The marketing pages show the Ladderstep "Take-off" favicon; the portal keeps its own when you leave.
export default function SiteLayout() {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        const link = document.querySelector('link[rel="icon"]');
        if (!link) return undefined;
        const previous = { href: link.getAttribute('href'), type: link.getAttribute('type') };
        link.setAttribute('href', '/site/favicon.svg');
        link.setAttribute('type', 'image/svg+xml');
        return () => {
            if (previous.href) link.setAttribute('href', previous.href);
            if (previous.type) link.setAttribute('type', previous.type);
        };
    }, []);

    useEffect(() => {
        if (hash) {
            document.getElementById(hash.slice(1))?.scrollIntoView();
            return;
        }
        window.scrollTo(0, 0);
    }, [pathname, hash]);

    return (
        <div className="ls-site flex flex-col min-h-screen bg-white font-sans text-ls-navy antialiased">
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-ls-navy focus:px-4 focus:py-2 focus:text-white">
                Skip to content
            </a>
            <SiteNav />
            <main id="main" className="flex-1"><Outlet /></main>
            <SiteFooter />
        </div>
    );
}

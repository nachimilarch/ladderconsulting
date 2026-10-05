import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';

const FONT_LINK_ID = 'site-fonts';

// Wraps every public marketing page. Playfair Display is only fetched here, so portal pages never pay for it.
export default function SiteLayout() {
    const { pathname } = useLocation();

    useEffect(() => {
        if (document.getElementById(FONT_LINK_ID)) return;
        const link = document.createElement('link');
        link.id = FONT_LINK_ID;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap';
        document.head.appendChild(link);
    }, []);

    useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

    return (
        <div className="flex flex-col min-h-screen bg-white font-sitebody text-slate-700 antialiased">
            <SiteNav />
            <main className="flex-1"><Outlet /></main>
            <SiteFooter />
        </div>
    );
}

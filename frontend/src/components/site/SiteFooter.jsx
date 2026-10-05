import { Link } from 'react-router-dom';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { navigationLinks, companyInfo, contactEmail, mainServices } from './siteContent';

const link = 'text-sm text-slate-400 hover:text-white transition-colors';
const heading = 'text-xs font-semibold uppercase tracking-[0.2em] text-sitegold-light mb-5';

export default function SiteFooter() {
    return (
        <footer className="relative bg-site-ink text-slate-300">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sitegold/60 to-transparent" aria-hidden="true" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
                <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12">
                    <div className="lg:col-span-5">
                        {/* The logo files have a white background, so they sit on a white tile */}
                        <Link to="/" className="inline-flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg shadow-black/20" aria-label="LadderStep Human Consulting, home">
                            <img src="/site/logo_notext.jpeg" alt="" className="h-10 w-auto" />
                            <img src="/site/logo_text.jpeg" alt="LadderStep Human Consulting" className="h-8 w-auto" />
                        </Link>
                        <p className="mt-6 text-sm leading-relaxed text-slate-400 max-w-md">{companyInfo.description}</p>
                        <p className="mt-4 font-sitehead text-lg italic text-sitegold-light max-w-md leading-snug">&ldquo;{companyInfo.tagline}&rdquo;</p>
                    </div>

                    <div className="lg:col-span-2">
                        <h4 className={heading}>Explore</h4>
                        <ul className="space-y-3">
                            {navigationLinks.map((l) => (
                                <li key={l.href}><Link to={l.href} className={link}>{l.label}</Link></li>
                            ))}
                        </ul>
                    </div>

                    <div className="lg:col-span-2">
                        <h4 className={heading}>Services</h4>
                        <ul className="space-y-3">
                            {mainServices.map((s) => (
                                <li key={s.key}><Link to={s.href} className={link}>{s.title}</Link></li>
                            ))}
                        </ul>
                    </div>

                    <div className="lg:col-span-3">
                        <h4 className={heading}>Get in touch</h4>
                        <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors break-all">
                            <EnvelopeIcon className="h-5 w-5 shrink-0 text-sitegold-light" aria-hidden="true" />
                            {contactEmail}
                        </a>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Link to="/login" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors">Login</Link>
                            <Link to="/register" className="rounded-lg bg-sitegold px-4 py-2 text-sm font-semibold text-site-ink hover:bg-sitegold-light transition-colors">Get Started</Link>
                        </div>
                    </div>
                </div>

                <div className="mt-14 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                    <p>© {new Date().getFullYear()} {companyInfo.name}. All rights reserved.</p>
                    <p className="tracking-wide">Inspired by <span className="text-slate-400">Viksit Bharat 2047</span></p>
                </div>
            </div>
        </footer>
    );
}

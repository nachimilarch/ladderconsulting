import { Link } from 'react-router-dom';
import { EnvelopeIcon, MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { Lockup } from './Brand';
import { navigationLinks, companyInfo, contactEmail, pillars, pillarHref, legalLinks } from './siteContent';

const link = 'text-sm text-white/70 hover:text-white transition-colors';
const heading = 'text-xs font-semibold uppercase tracking-[0.22em] text-ls-blue-soft mb-5';

export default function SiteFooter() {
    return (
        <footer className="bg-ls-navy text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
                <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-12">
                    <div className="sm:col-span-2 lg:col-span-5">
                        <Link to="/" aria-label="LadderStep Consulting, home" className="inline-block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                            <Lockup tone="dark" tagline className="h-16 w-auto" />
                        </Link>
                        <p className="mt-7 text-sm leading-relaxed text-white/70 max-w-md">{companyInfo.short}</p>
                    </div>

                    <div className="lg:col-span-2">
                        <h2 className="sr-only">Pages</h2>
                        <p className={heading} aria-hidden="true">LadderStep</p>
                        <ul className="space-y-3">
                            {navigationLinks.filter((l) => !l.menu).map((l) => (
                                <li key={l.href}><Link to={l.href} className={link}>{l.label}</Link></li>
                            ))}
                        </ul>
                    </div>

                    <div className="lg:col-span-2">
                        <h2 className={heading}>4 Pillars</h2>
                        <ul className="space-y-3">
                            {pillars.map((p) => (
                                <li key={p.slug}><Link to={pillarHref(p)} className={link}>{p.word}</Link></li>
                            ))}
                        </ul>
                    </div>

                    <div className="lg:col-span-3">
                        <h2 className={heading}>Contact</h2>
                        <ul className="space-y-4 text-sm">
                            <li>
                                <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-2 text-white hover:text-ls-blue-soft underline underline-offset-4 decoration-ls-blue-bright break-all">
                                    <EnvelopeIcon className="h-5 w-5 shrink-0 text-ls-blue-soft" aria-hidden="true" />
                                    {contactEmail}
                                </a>
                            </li>
                            <li>
                                <a href={companyInfo.phoneHref} className="inline-flex items-center gap-2 text-white hover:text-ls-blue-soft">
                                    <PhoneIcon className="h-5 w-5 shrink-0 text-ls-blue-soft" aria-hidden="true" />
                                    {companyInfo.phone}
                                </a>
                            </li>
                            <li className="flex items-start gap-2 text-white/80">
                                <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-ls-blue-soft" aria-hidden="true" />
                                {companyInfo.city}
                            </li>
                        </ul>
                        <div className="mt-6">
                            <Link to="/login" className="inline-block rounded-md border-2 border-white/60 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-ls-navy transition-colors">Log in</Link>
                        </div>
                    </div>
                </div>

                <div className="mt-14 pt-8 border-t border-white/10 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-white/60">
                    <p>© {new Date().getFullYear()} {companyInfo.name}. All rights reserved.</p>
                    <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                        {legalLinks.map((l) => (
                            <li key={l.href}><Link to={l.href} className="hover:text-white underline-offset-4 hover:underline">{l.label}</Link></li>
                        ))}
                    </ul>
                </div>
            </div>
        </footer>
    );
}

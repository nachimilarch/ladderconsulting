import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

const VARIANTS = {
    primary: 'bg-site text-white hover:bg-site-deep shadow-lg shadow-site/20',
    gold: 'bg-sitegold text-site-ink hover:bg-sitegold-light shadow-lg shadow-sitegold/20',
    white: 'bg-white text-site hover:bg-site-mist shadow-lg shadow-black/10',
    outline: 'border border-site/25 text-site hover:border-site hover:bg-site hover:text-white',
    light: 'border border-white/30 text-white hover:bg-white/10 hover:border-white/60',
};
const SIZES = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
};

// A link (to = in-app route, href = anchor/mailto/external) or a real button, styled the same way.
export function Button({ children, to, href, variant = 'primary', size = 'md', arrow = false, className = '', ...rest }) {
    const classes = `group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sitegold focus-visible:ring-offset-2 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
    const content = (
        <>
            {children}
            {arrow && <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />}
        </>
    );
    if (to) return <Link to={to} className={classes}>{content}</Link>;
    if (href) return <a href={href} className={classes}>{content}</a>;
    return <button type="button" className={classes} {...rest}>{content}</button>;
}

export function Eyebrow({ children, tone = 'light', className = '' }) {
    const color = tone === 'dark' ? 'text-sitegold-light' : 'text-sitegold-dark';
    const line = tone === 'dark' ? 'bg-sitegold-light/60' : 'bg-sitegold-dark/60';
    return (
        <p className={`inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] ${color} ${className}`}>
            <span className={`h-px w-8 ${line}`} aria-hidden="true" />
            {children}
        </p>
    );
}

export function SectionHeading({ eyebrow, title, subtitle, align = 'center', tone = 'light', className = '' }) {
    const center = align === 'center';
    return (
        <div className={`${center ? 'text-center mx-auto' : ''} max-w-4xl mb-14 ${className}`}>
            {eyebrow && <Eyebrow tone={tone} className="mb-4">{eyebrow}</Eyebrow>}
            <h2 className={`font-sitehead font-bold tracking-tight leading-[1.1] text-balance text-3xl sm:text-4xl lg:text-[2.75rem] ${tone === 'dark' ? 'text-white' : 'text-site-deep'}`}>
                {title}
            </h2>
            {subtitle && (
                <p className={`mt-5 text-lg leading-relaxed ${tone === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{subtitle}</p>
            )}
        </div>
    );
}

// Fades and lifts its children in as they scroll into view. Shown at once when motion is reduced
// or the browser has no IntersectionObserver, so content is never left invisible.
export function Reveal({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const [shown, setShown] = useState(
        () => typeof IntersectionObserver === 'undefined'
            || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    );

    useEffect(() => {
        if (shown) return undefined;
        const el = ref.current;
        if (!el) return undefined;
        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setShown(true); io.disconnect(); }
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        io.observe(el);
        return () => io.disconnect();
    }, [shown]);

    return (
        <div
            ref={ref}
            style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
            className={`transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
        >
            {children}
        </div>
    );
}

// The deep-navy surface used behind the hero, page headers and call-to-action bands.
export function DarkBackdrop({ glow = 'right' }) {
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 bg-gradient-to-br from-site-ink via-site-deep to-site" />
            <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                    backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '64px 64px',
                    WebkitMaskImage: 'radial-gradient(ellipse at 70% 30%, #000 20%, transparent 72%)',
                    maskImage: 'radial-gradient(ellipse at 70% 30%, #000 20%, transparent 72%)',
                }}
            />
            <div className={`absolute -top-40 h-[34rem] w-[34rem] rounded-full bg-site-light/25 blur-3xl ${glow === 'left' ? '-left-40' : '-right-40'}`} />
            <div className={`absolute top-10 h-64 w-64 rounded-full bg-sitegold/[0.07] blur-3xl ${glow === 'left' ? 'left-1/4' : 'right-1/4'}`} />
            <div className="absolute -bottom-48 left-1/3 h-[28rem] w-[28rem] rounded-full bg-site-light/30 blur-3xl" />
        </div>
    );
}

// Page banner for the inner pages, with a breadcrumb back to Home.
export function PageHero({ eyebrow, title, subtitle, crumb }) {
    return (
        <section className="relative isolate overflow-hidden text-white">
            <DarkBackdrop />
            {/* Faint rising-bars watermark, echoing the logo */}
            <svg className="pointer-events-none absolute bottom-0 right-[6%] hidden h-[85%] w-auto text-white opacity-[0.08] lg:block" viewBox="0 0 330 300" fill="currentColor" aria-hidden="true" focusable="false">
                <rect x="0" y="200" width="66" height="100" rx="3" />
                <rect x="88" y="140" width="66" height="160" rx="3" />
                <rect x="176" y="80" width="66" height="220" rx="3" />
                <rect x="264" y="10" width="66" height="290" rx="3" />
            </svg>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
                <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-sm text-slate-300">
                    <Link to="/" className="hover:text-white transition-colors">Home</Link>
                    <span aria-hidden="true" className="text-slate-500">/</span>
                    <span className="text-sitegold-light">{crumb || title}</span>
                </nav>
                {eyebrow && <Eyebrow tone="dark" className="mb-5">{eyebrow}</Eyebrow>}
                <h1 className="font-sitehead font-bold tracking-tight leading-[1.05] text-balance text-4xl sm:text-5xl lg:text-6xl max-w-4xl text-white">
                    {title}
                </h1>
                <p className="mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-slate-200">{subtitle}</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sitegold/60 to-transparent" aria-hidden="true" />
        </section>
    );
}

// The closing call-to-action band shown near the bottom of every page.
export function CtaBand({ title, text, children }) {
    return (
        <section className="relative isolate overflow-hidden text-white">
            <DarkBackdrop glow="left" />
            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24 text-center">
                <h2 className="font-sitehead font-bold tracking-tight leading-[1.1] text-balance text-3xl sm:text-4xl lg:text-5xl text-white">{title}</h2>
                <p className="mt-5 text-lg text-slate-200 max-w-2xl mx-auto leading-relaxed">{text}</p>
                <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">{children}</div>
            </div>
        </section>
    );
}

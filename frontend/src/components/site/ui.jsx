import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { Plane } from './Brand';

// Ladderstep brand components. Flat, square-ish (4 to 8px radius), navy and blue for weight,
// red kept to one action per screen.

const VARIANTS = {
    // Red is the primary action. White on #E63946 only passes contrast for large bold labels,
    // so smaller buttons use the darker red shade (brand file, section 4).
    primary: {
        lg: 'bg-ls-red text-white hover:bg-ls-red-shade',
        md: 'bg-ls-red-shade text-white hover:bg-[#9A1D2B]',
        sm: 'bg-ls-red-shade text-white hover:bg-[#9A1D2B]',
    },
    navy: 'bg-ls-navy text-white hover:bg-ls-blue',
    outline: 'border-2 border-ls-navy text-ls-navy hover:bg-ls-navy hover:text-white',
    light: 'border-2 border-white/70 text-white hover:border-white hover:bg-white hover:text-ls-navy',
};
const SIZES = {
    sm: 'px-4 py-2 text-sm font-semibold',
    md: 'px-6 py-3 text-sm font-semibold',
    lg: 'px-7 py-3.5 text-lg font-bold',
};

// A link (to = in-app route, href = anchor/mailto/external) or a real button, styled the same way.
export function Button({ children, to, href, variant = 'primary', size = 'md', arrow = false, className = '', ...rest }) {
    const tone = variant === 'primary' ? VARIANTS.primary[size] : VARIANTS[variant];
    const ring = variant === 'light' ? 'focus-visible:outline-white' : 'focus-visible:outline-ls-blue';
    const classes = `group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${ring} ${tone} ${SIZES[size]} ${className}`;
    const content = (
        <>
            {children}
            {arrow && <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.25} aria-hidden="true" />}
        </>
    );
    if (to) return <Link to={to} className={classes}>{content}</Link>;
    if (href) return <a href={href} className={classes}>{content}</a>;
    return <button type="button" className={classes} {...rest}>{content}</button>;
}

// A tiny two-step glyph, echoing the base of the mark.
export function StepGlyph({ className = '' }) {
    return (
        <svg viewBox="0 0 12 8" className={`h-2 w-3 shrink-0 ${className}`} fill="currentColor" aria-hidden="true" focusable="false">
            <rect x="0" y="4" width="12" height="4" />
            <rect x="0" y="0" width="7" height="4" opacity="0.6" />
        </svg>
    );
}

// Small uppercase label, widely tracked like CONSULTING in the lockup.
export function Eyebrow({ children, tone = 'light', className = '' }) {
    const color = tone === 'dark' ? 'text-ls-blue-soft' : 'text-ls-blue';
    return (
        <p className={`inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] ${color} ${className}`}>
            <StepGlyph />
            {children}
        </p>
    );
}

export function SectionHeading({ eyebrow, title, subtitle, align = 'left', tone = 'light', className = '' }) {
    const center = align === 'center';
    return (
        <div className={`${center ? 'text-center mx-auto' : ''} max-w-3xl mb-12 lg:mb-14 ${className}`}>
            {eyebrow && <Eyebrow tone={tone} className="mb-4">{eyebrow}</Eyebrow>}
            <h2 className={`font-bold tracking-tight leading-[1.1] text-balance text-3xl sm:text-4xl lg:text-[2.75rem] ${tone === 'dark' ? 'text-white' : 'text-ls-navy'}`}>
                {title}
            </h2>
            {subtitle && (
                <p className={`mt-5 text-lg leading-relaxed ${tone === 'dark' ? 'text-white/75' : 'text-ls-muted'}`}>{subtitle}</p>
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

// Stair-shaped section edge: the next section climbs into this one, left to right.
// `fill` is a Tailwind text colour class for the section that follows.
export function StepEdge({ fill = 'text-white', className = '' }) {
    return (
        <svg
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-6 w-full sm:h-10 lg:h-12 ${fill} ${className}`}
            viewBox="0 0 1200 48" preserveAspectRatio="none" fill="currentColor" aria-hidden="true" focusable="false"
        >
            <path d="M0 48V36H300V24H600V12H900V0H1200V48Z" />
        </svg>
    );
}

// Page banner for the inner pages, with a breadcrumb back to Home.
export function PageHero({ eyebrow, title, subtitle, crumbs = [], children }) {
    return (
        <section className="relative isolate overflow-hidden bg-ls-navy text-white">
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-24 lg:pt-20 lg:pb-32">
                <nav aria-label="Breadcrumb" className="mb-8">
                    <ol className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                        <li><Link to="/" className="hover:text-white underline-offset-4 hover:underline">Home</Link></li>
                        {crumbs.map((c, i) => (
                            <li key={c.label} className="flex items-center gap-2">
                                <span aria-hidden="true" className="text-white/40">/</span>
                                {c.href && i < crumbs.length - 1
                                    ? <Link to={c.href} className="hover:text-white underline-offset-4 hover:underline">{c.label}</Link>
                                    : <span className="text-ls-blue-soft" aria-current="page">{c.label}</span>}
                            </li>
                        ))}
                    </ol>
                </nav>
                {eyebrow && <Eyebrow tone="dark" className="mb-5">{eyebrow}</Eyebrow>}
                <h1 className="font-bold tracking-tight leading-[1.05] text-balance text-4xl sm:text-5xl lg:text-6xl max-w-4xl text-white">
                    {title}
                </h1>
                {subtitle && <p className="mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-white/80">{subtitle}</p>}
                {children}
            </div>
            <StepEdge />
        </section>
    );
}

// The closing contact call-to-action, shown near the bottom of every page. Carries the plane motif.
export function CtaBand({ title, text, children }) {
    return (
        <section className="relative isolate overflow-hidden bg-ls-navy text-white">
            <svg className="pointer-events-none absolute right-0 top-0 hidden h-full w-1/2 md:block" viewBox="0 0 600 300" preserveAspectRatio="xMaxYMid meet" fill="none" aria-hidden="true" focusable="false">
                <path d="M40 290 C 220 280, 380 200, 520 70" stroke="#4C7BFF" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
            </svg>
            <Plane tone="dark" className="pointer-events-none absolute right-[8%] top-10 hidden h-16 w-auto md:block" />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
                <div className="max-w-2xl">
                    <h2 className="font-bold tracking-tight leading-[1.1] text-balance text-3xl sm:text-4xl lg:text-5xl text-white">{title}</h2>
                    {text && <p className="mt-5 text-lg text-white/80 leading-relaxed">{text}</p>}
                    <div className="mt-9 flex flex-col sm:flex-row gap-3">{children}</div>
                </div>
            </div>
        </section>
    );
}

// White card with a thin blue top rule (brand "cards on white").
export function Card({ children, className = '', accent = 'blue', as: Tag = 'div', ...rest }) {
    const top = accent === 'red' ? 'border-t-ls-red' : 'border-t-ls-blue';
    return (
        <Tag className={`rounded-md border border-ls-line border-t-[3px] ${top} bg-white ${className}`} {...rest}>
            {children}
        </Tag>
    );
}

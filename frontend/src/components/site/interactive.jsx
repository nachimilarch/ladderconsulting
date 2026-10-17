import { useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    ArrowRightIcon, BanknotesIcon, BriefcaseIcon, BuildingOffice2Icon, CheckIcon, ClipboardDocumentCheckIcon, Cog6ToothIcon,
    ComputerDesktopIcon, CpuChipIcon, DocumentTextIcon, MegaphoneIcon, PlusIcon, ShieldCheckIcon, ShieldExclamationIcon,
    TruckIcon, UserCircleIcon, UserGroupIcon, UserPlusIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { Button, StepGlyph } from './ui';
import { Mark, Plane } from './Brand';
import { Backdrop, PillarArt } from './graphics';
import { useInView, usePrefersReducedMotion, useScrollProgress } from './motion';
import { ctaBlocks, enquiryHref, home, pillarHref, pillars } from './siteContent';
import { TONES, toneAt, toneFor } from './tones';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-blue';

// ── Home: the four pillars as a ladder you can climb. It also plays through them on its own until you pick one. ──
export function PillarExplorer() {
    const reduced = usePrefersReducedMotion();
    const [active, setActive] = useState(0);
    const [picked, setPicked] = useState(false);
    const [hover, setHover] = useState(false);
    const [ref, inView] = useInView({ threshold: 0.35, once: false });
    const uid = useId();
    const auto = inView && !picked && !hover && !reduced;
    const p = pillars[active];
    const pt = toneFor(p.slug);

    const choose = (i) => { setPicked(true); setActive(i); };
    const onKey = (e) => {
        const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        const next = (active + dir + pillars.length) % pillars.length;
        choose(next);
        document.getElementById(`${uid}-tab-${next}`)?.focus();
    };

    return (
        <div ref={ref} className="grid gap-6 lg:grid-cols-12 lg:items-center" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-3 lg:col-span-5" onKeyDown={onKey}>
                {pillars.map((pl, i) => {
                    const on = i === active;
                    const t = toneFor(pl.slug);
                    return (
                        <button
                            key={pl.slug}
                            id={`${uid}-tab-${i}`}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            aria-controls={`${uid}-panel`}
                            tabIndex={on ? 0 : -1}
                            onClick={() => choose(i)}
                            style={{ '--w': `${70 + i * 10}%` }}
                            className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-md border border-l-[6px] px-5 py-5 text-left transition-all duration-300 lg:w-[var(--w)] ${focusRing} ${on
                                ? `${t.solid} ${t.border} border-l-white text-white shadow-lg lg:translate-x-3`
                                : `${t.tint} ${t.tintBorder} ${t.rail} text-ls-navy ${t.glow} hover:lg:translate-x-1.5`}`}
                        >
                            {on && auto && (
                                <span
                                    key={`${active}-bar`}
                                    aria-hidden="true"
                                    className="absolute inset-y-0 left-0 w-full origin-left bg-white/20 motion-safe:animate-ls-bar"
                                    onAnimationEnd={() => setActive((a) => (a + 1) % pillars.length)}
                                />
                            )}
                            <span className={`relative grid h-9 min-w-9 place-items-center rounded-full px-1 text-sm font-bold tabular-nums tracking-wider ${on ? 'bg-white text-ls-navy' : `${t.solid} text-white`}`}>0{pl.step}</span>
                            <span className="relative text-xl font-bold">{pl.word}</span>
                            <ArrowRightIcon className={`relative ml-auto h-5 w-5 transition-transform ${on ? 'translate-x-0 text-white' : `-translate-x-1 ${t.text} opacity-0 group-hover:translate-x-0 group-hover:opacity-100`}`} strokeWidth={2.25} aria-hidden="true" />
                        </button>
                    );
                })}
            </div>

            <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${active}`} className={`relative isolate overflow-hidden rounded-md border-t-4 text-white shadow-xl transition-colors duration-500 lg:col-span-7 ${pt.panel} ${pt.topBright}`}>
                <Backdrop glow={pt.hex.bright} glow2={pt.hex.bright} />
                <div key={active} className="grid gap-6 p-7 motion-safe:animate-ls-panel sm:p-10 md:grid-cols-2 md:items-center">
                    <div>
                        <p className={`text-6xl font-bold tabular-nums leading-none ${pt.softText}`} aria-hidden="true">0{p.step}</p>
                        <h3 className="mt-3 text-3xl font-bold tracking-tight text-white">{p.word}</h3>
                        <p className={`mt-2 text-lg font-semibold leading-snug ${pt.softText}`}>{p.lead}</p>
                        <p className="mt-4 leading-relaxed text-white/80">{p.summary}</p>
                        <ul className="mt-5 flex flex-wrap gap-2">
                            {p.offerings.map((o, i) => (
                                <li key={o} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-medium text-white motion-safe:animate-ls-pop" style={{ animationDelay: `${120 + i * 70}ms` }}>
                                    <span className={`h-2 w-2 rounded-full ${pt.brightBg}`} aria-hidden="true" />{o}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-7">
                            <Button to={pillarHref(p)} variant="light" arrow>Learn more<span className="sr-only"> about {p.word}</span></Button>
                        </div>
                    </div>
                    <PillarArt slug={p.slug} className="mx-auto max-w-[22rem] md:max-w-none" />
                </div>
            </div>
        </div>
    );
}

// ── Home intro: the hats a founder wears, floating around the mark. Each one leads to the pillar that covers it. ──
const HAT_ICONS = { selling: MegaphoneIcon, hiring: UserPlusIcon, 'staying compliant': ClipboardDocumentCheckIcon, 'managing risk': ShieldExclamationIcon, 'finding money to grow': BanknotesIcon };
const HAT_POS = [
    { cls: 'left-0 top-[3%]', end: [20, 11] },
    { cls: 'right-0 top-[13%]', end: [80, 21] },
    { cls: 'left-0 top-[41%]', end: [20, 49] },
    { cls: 'right-0 top-[56%]', end: [80, 64] },
    { cls: 'left-1/2 top-[82%] -translate-x-1/2', end: [50, 89] },
];

export function HatChips() {
    const { hats } = home.intro;
    const [hover, setHover] = useState(-1);
    return (
        <div className="relative mx-auto aspect-square w-full max-w-xl sm:aspect-[5/4]">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                {hats.map((h, i) => (
                    <line
                        key={h.label} x1="50" y1="50" x2={HAT_POS[i].end[0]} y2={HAT_POS[i].end[1]}
                        vectorEffect="non-scaling-stroke" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round"
                        stroke={hover === i ? toneFor(h.pillar).hex.main : toneFor(h.pillar).hex.bright} strokeOpacity={hover === i ? 1 : 0.55} className="motion-safe:animate-ls-dash" style={{ transition: 'stroke 0.2s' }}
                    />
                ))}
            </svg>
            <div className="absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center sm:h-36 sm:w-36" aria-hidden="true">
                <span className="absolute inset-0 rounded-full border-2 border-ls-blue-bright/60 motion-safe:animate-ls-ring" />
                <span className="absolute -inset-2 rounded-full bg-ls-blue-100/70" />
                <span className="absolute inset-0 rounded-full bg-ls-navy ring-4 ring-ls-blue-bright/30" />
                <Mark tone="dark" animate className="relative h-10 w-auto sm:h-16" />
            </div>
            {hats.map((h, i) => {
                const Icon = HAT_ICONS[h.label] || BriefcaseIcon;
                const target = pillars.find((p) => p.slug === h.pillar);
                const t = toneFor(h.pillar);
                return (
                    <Link
                        key={h.label}
                        to={pillarHref(target)}
                        onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)} onFocus={() => setHover(i)} onBlur={() => setHover(-1)}
                        className={`absolute z-10 rounded-full ${HAT_POS[i].cls} ${focusRing}`}
                    >
                        <span
                            className={`flex items-center gap-2.5 rounded-full border bg-white py-2 pl-2 pr-4 text-sm font-semibold text-ls-navy shadow-card transition-colors hover:text-white motion-safe:animate-ls-float sm:text-base ${t.tintBorder} ${t.hoverFill}`}
                            style={{ animationDelay: `${i * 0.8}s`, animationDuration: `${4.5 + i * 0.6}s` }}
                        >
                            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${t.solid} text-white`}>
                                <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
                            </span>
                            {h.label}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}

// ── A scrolling strip of everything we offer, in the document's own names. Pauses under the pointer. ──
export function Marquee() {
    const items = pillars.flatMap((p) => p.offerings.map((o) => ({ o, tone: toneFor(p.slug) })));
    return (
        <div className="relative overflow-hidden border-y-4 border-ls-blue-bright bg-ls-blue py-5">
            <div className="flex w-max hover:[animation-play-state:paused] motion-safe:animate-ls-marquee motion-reduce:w-auto motion-reduce:flex-wrap motion-reduce:justify-center">
                {[0, 1].map((k) => (
                    <ul key={k} aria-hidden={k === 1 ? 'true' : undefined} className={`flex shrink-0 items-center motion-reduce:flex-wrap motion-reduce:justify-center ${k === 1 ? 'motion-reduce:hidden' : ''}`}>
                        {items.map(({ o, tone }) => (
                            <li key={o} className="flex items-center gap-6 pr-6">
                                <span className="whitespace-nowrap text-lg font-semibold text-white">{o}</span>
                                <StepGlyph className={tone.brightText} />
                            </li>
                        ))}
                    </ul>
                ))}
            </div>
        </div>
    );
}

// ── Talent: how a requirement travels through the portal. ──
const FLOW_ICONS = [DocumentTextIcon, CpuChipIcon, UserGroupIcon, BriefcaseIcon];
export function HiringFlow({ flow, tone = 'teal' }) {
    const t = TONES[tone] || TONES.teal;
    const [ref, inView] = useInView({ threshold: 0.3 });
    return (
        <ol ref={ref} className="grid gap-8 lg:grid-cols-4 lg:gap-0">
            {flow.map((s, i) => {
                const Icon = FLOW_ICONS[i] || UserCircleIcon;
                const last = i === flow.length - 1;
                return (
                    <li key={s.title} className={`relative flex gap-5 transition-all duration-700 lg:flex-col lg:items-center lg:px-3 lg:text-center ${inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`} style={{ transitionDelay: `${i * 140}ms` }}>
                        <span className={`relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-full text-white shadow-md ring-4 ${last ? `bg-ls-navy ${t.ring}` : `${t.solid} ${t.ring}`}`}>
                            <Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                            <span className={`absolute inset-0 rounded-full border-2 ${t.border} motion-safe:animate-ls-ring`} style={{ animationDelay: `${i * 0.5}s` }} aria-hidden="true" />
                        </span>
                        {!last && (
                            <span className="absolute left-[calc(50%+2.5rem)] right-[calc(-50%+2.5rem)] top-7 hidden h-0 lg:block" aria-hidden="true">
                                <span className={`absolute inset-x-0 top-0 border-t-2 border-dashed ${t.border} opacity-50`} />
                                <span className="absolute -top-[5px] h-2.5 w-2.5 rounded-full bg-ls-red motion-safe:animate-ls-travel" style={{ animationDelay: `${i * 0.7}s` }} />
                            </span>
                        )}
                        <span className="lg:mt-5">
                            <span className="block text-lg font-bold text-ls-navy">{s.title}</span>
                            <span className="mt-1 block leading-relaxed text-ls-muted">{s.text}</span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

// Pop-in chips, used for lists of single words (the roles we hire for).
export function ChipList({ items, tone = 'teal' }) {
    const t = TONES[tone] || TONES.teal;
    const [ref, inView] = useInView({ threshold: 0.4 });
    return (
        <ul ref={ref} className="flex flex-wrap gap-2.5">
            {items.map((r, i) => (
                <li
                    key={r}
                    className={`rounded-full border-2 px-4 py-2 text-base font-semibold text-ls-navy transition-colors hover:text-white ${i % 3 === 1 ? `${t.tint2} border-transparent` : `${t.tint} ${t.tintBorder}`} ${t.hoverFill} ${inView ? 'motion-safe:animate-ls-pop' : 'opacity-0 motion-reduce:opacity-100'}`}
                    style={{ animationDelay: `${i * 80}ms` }}
                >
                    {r}
                </li>
            ))}
        </ul>
    );
}

// ── A numbered process you can step through. The plane rides the track to the step in focus. ──
export function ProcessStepper({ steps, tone = 'blue' }) {
    const t = TONES[tone] || TONES.blue;
    const reduced = usePrefersReducedMotion();
    const [ref, inView] = useInView({ threshold: 0.4, once: false });
    const [active, setActive] = useState(0);
    const [picked, setPicked] = useState(false);
    const [hover, setHover] = useState(false);
    const n = steps.length;
    const uid = useId();

    useEffect(() => {
        if (!inView || picked || hover || reduced) return undefined;
        const t = setInterval(() => setActive((a) => (a + 1) % n), 3200);
        return () => clearInterval(t);
    }, [inView, picked, hover, reduced, n]);

    const pct = (i) => (n > 1 ? (i / (n - 1)) * 100 : 0);
    const s = steps[active];

    return (
        <div ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            <div className="relative mx-6 mt-12 h-28 sm:mx-14">
                <span className={`absolute inset-x-0 top-6 h-1 rounded ${t.tint2}`} aria-hidden="true" />
                <span className={`absolute left-0 top-6 h-1 rounded ${t.solid} transition-[width] duration-700 ease-out`} style={{ width: `${pct(active)}%` }} aria-hidden="true" />
                <span className="absolute -top-9 -translate-x-1/2 transition-[left] duration-700 ease-out" style={{ left: `${pct(active)}%` }} aria-hidden="true">
                    <Plane className="h-8 w-auto motion-safe:animate-ls-float" />
                </span>
                {steps.map((st, i) => {
                    const on = i === active;
                    return (
                        <button
                            key={st.title}
                            type="button"
                            aria-current={on ? 'step' : undefined}
                            aria-controls={`${uid}-detail`}
                            onClick={() => { setPicked(true); setActive(i); }}
                            className={`group absolute top-0 flex -translate-x-1/2 flex-col items-center gap-3 rounded-md ${focusRing}`}
                            style={{ left: `${pct(i)}%` }}
                        >
                            <span className={`grid h-12 w-12 place-items-center rounded-full border-2 text-base font-bold tabular-nums transition-all duration-300 ${on ? `scale-110 ${t.border} ${t.solid} text-white shadow-lg` : i < active ? 'border-ls-navy bg-ls-navy text-white' : `${t.tintBorder} ${t.tint} text-ls-navy ${t.groupHoverBorder}`}`}>
                                {i + 1}
                            </span>
                            <span className={`text-sm font-bold transition-colors sm:text-base ${on ? `${t.text} underline decoration-2 underline-offset-4` : 'text-ls-muted group-hover:text-ls-navy'}`}>{st.title}</span>
                        </button>
                    );
                })}
            </div>
            <div id={`${uid}-detail`} aria-live="polite" className="mt-4 min-h-[8rem]">
                <div key={active} className={`rounded-md border border-l-[6px] ${t.tintBorder} ${t.rail} ${t.tint} p-6 shadow-card sm:p-8 motion-safe:animate-ls-panel`}>
                    <p className={`text-sm font-bold tabular-nums tracking-[0.2em] ${t.text}`}>0{active + 1}</p>
                    <h3 className="mt-2 text-2xl font-bold text-ls-navy">{s.title}</h3>
                    <p className="mt-2 text-lg leading-relaxed text-ls-muted">{s.text}</p>
                </div>
            </div>
        </div>
    );
}

// ── Protection: the compliance areas as a checklist that ticks itself off (and can be ticked by hand). ──
export function ComplianceChecklist({ items, tone = 'indigo' }) {
    const t = TONES[tone] || TONES.indigo;
    const reduced = usePrefersReducedMotion();
    const [ref, inView] = useInView({ threshold: 0.4 });
    const [on, setOn] = useState(() => new Set());
    const [manual, setManual] = useState(false);
    const n = items.length;

    useEffect(() => {
        if (!inView || manual) return undefined;
        const timers = items.map((_, i) => setTimeout(() => setOn((s) => new Set(s).add(i)), reduced ? 0 : 350 + i * 320));
        return () => timers.forEach(clearTimeout);
    }, [inView, manual, reduced, items]);

    const toggle = (i) => {
        setManual(true);
        setOn((s) => { const next = new Set(s); if (next.has(i)) next.delete(i); else next.add(i); return next; });
    };
    const R = 54;
    const circ = 2 * Math.PI * R;
    const done = on.size === n;

    return (
        <div ref={ref} className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
            <div className="relative mx-auto h-36 w-36" aria-hidden="true">
                <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                    <circle cx="70" cy="70" r={R} fill="none" stroke={t.hex.soft} strokeOpacity="0.45" strokeWidth="12" />
                    <circle cx="70" cy="70" r={R} fill="none" stroke={done ? t.hex.main : t.hex.bright} strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - on.size / n)} style={{ transition: 'stroke-dashoffset 0.4s ease-out, stroke 0.3s' }} />
                </svg>
                <span className="absolute inset-0 grid place-items-center">
                    <ShieldCheckIcon className={`h-12 w-12 transition-colors duration-300 ${done ? t.text : 'text-ls-navy/25'}`} strokeWidth={1.5} />
                </span>
                {done && <span className={`absolute inset-0 rounded-full border-2 ${t.border} motion-safe:animate-ls-ring`} />}
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
                {items.map((it, i) => {
                    const checked = on.has(i);
                    return (
                        <li key={it}>
                            <button
                                type="button"
                                aria-pressed={checked}
                                onClick={() => toggle(i)}
                                className={`flex w-full items-center gap-3 rounded-md border px-4 py-3.5 text-left text-lg font-semibold transition-colors duration-300 ${focusRing} ${checked ? `${t.border} ${t.tint2} text-ls-navy` : `${t.tintBorder} bg-white text-ls-muted ${t.hoverBorder} ${t.hoverTint}`}`}
                            >
                                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded border-2 transition-colors duration-300 ${checked ? `${t.border} ${t.solid} text-white` : 'border-[#8A92A3] bg-white text-transparent'}`}>
                                    <CheckIcon className={`h-4 w-4 ${checked ? 'motion-safe:animate-ls-pop' : ''}`} strokeWidth={3} aria-hidden="true" />
                                </span>
                                {it}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

// ── Who we work with: pick an industry to see how we typically help. ──
const INDUSTRY_ICONS = [Cog6ToothIcon, BuildingOffice2Icon, TruckIcon, ComputerDesktopIcon];
export function IndustryExplorer({ industries }) {
    const [active, setActive] = useState(0);
    const uid = useId();
    const it = industries[active];
    const Icon = INDUSTRY_ICONS[active] || BriefcaseIcon;
    const at = toneAt(active);
    const helps = it.help.split(/,\s+/);

    const onKey = (e) => {
        const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        const next = (active + dir + industries.length) % industries.length;
        setActive(next);
        document.getElementById(`${uid}-tab-${next}`)?.focus();
    };

    return (
        <div className="grid gap-6 lg:grid-cols-12">
            <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-2 lg:col-span-5" onKeyDown={onKey}>
                {industries.map((ind, i) => {
                    const I = INDUSTRY_ICONS[i] || BriefcaseIcon;
                    const on = i === active;
                    const tt = toneAt(i);
                    return (
                        <button
                            key={ind.name}
                            id={`${uid}-tab-${i}`}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            aria-controls={`${uid}-panel`}
                            tabIndex={on ? 0 : -1}
                            onClick={() => setActive(i)}
                            className={`flex items-center gap-4 rounded-md border border-l-[6px] px-5 py-4 text-left transition-all duration-300 ${focusRing} ${on ? `${tt.solid} ${tt.border} border-l-white text-white shadow-lg lg:translate-x-3` : `${tt.tint} ${tt.tintBorder} ${tt.rail} text-ls-navy ${tt.glow}`}`}
                        >
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${on ? 'bg-white text-ls-navy' : `${tt.solid} text-white`}`}>
                                <I className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
                            </span>
                            <span className="text-lg font-bold">{ind.name}</span>
                        </button>
                    );
                })}
            </div>
            <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${active}`} className={`relative isolate overflow-hidden rounded-md border border-t-[5px] p-7 shadow-card transition-colors duration-500 sm:p-10 lg:col-span-7 ${at.tint} ${at.tintBorder} ${at.top}`}>
                <div key={active} className="motion-safe:animate-ls-panel">
                    <span className={`grid h-16 w-16 place-items-center rounded-full ring-8 ${at.ring} ${at.solid} text-white`}>
                        <Icon className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 text-2xl font-bold tracking-tight text-ls-navy sm:text-3xl">{it.name}</h3>
                    <p className={`mt-6 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${at.chip}`}>How we typically help</p>
                    <ul className="mt-4 space-y-3">
                        {helps.map((h, i) => (
                            <li key={h} className="flex items-start gap-3 text-lg leading-snug text-ls-navy motion-safe:animate-ls-fade-up" style={{ animationDelay: `${100 + i * 90}ms` }}>
                                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${at.solid} text-white`}><CheckIcon className="h-4 w-4" strokeWidth={3} aria-hidden="true" /></span>
                                <span className="first-letter:uppercase">{h}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

// ── FAQs: one open at a time, smooth height. ──
export function Accordion({ items }) {
    const [open, setOpen] = useState(0);
    const uid = useId();
    return (
        <div className="space-y-3">
            {items.map((f, i) => {
                const on = open === i;
                const t = toneAt(i);
                return (
                    <div key={f.q} className={`rounded-md border border-l-[6px] bg-white transition-all duration-300 ${on ? `${t.tint} ${t.tintBorder} ${t.rail} shadow-card` : `border-ls-line ${t.rail} ${t.hoverBorder} ${t.hoverTint}`}`}>
                        <h3>
                            <button
                                type="button"
                                id={`${uid}-q-${i}`}
                                aria-expanded={on}
                                aria-controls={`${uid}-a-${i}`}
                                onClick={() => setOpen(on ? -1 : i)}
                                className={`group flex w-full items-start justify-between gap-6 px-5 py-5 text-left text-lg font-bold text-ls-navy ${focusRing}`}
                            >
                                <span className="transition-colors">{f.q}</span>
                                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-300 ${on ? `rotate-45 ${t.border} ${t.solid} text-white` : `${t.border} ${t.text} bg-white ${t.groupFill} group-hover:text-white`}`} aria-hidden="true">
                                    <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
                                </span>
                            </button>
                        </h3>
                        <div id={`${uid}-a-${i}`} role="region" aria-labelledby={`${uid}-q-${i}`} className={`grid transition-[grid-template-rows] duration-300 ease-out ${on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                            <div className="overflow-hidden">
                                <p className={`px-5 pb-6 pr-12 text-lg leading-relaxed text-ls-muted transition-opacity duration-300 ${on ? 'opacity-100' : 'opacity-0'}`}>{f.a}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── A call-to-action that follows you down the page, using the document's reusable CTA blocks. ──
function blockFor(pathname) {
    if (pathname === '/talent') return ctaBlocks.hiring;
    if (pathname === '/protection') return ctaBlocks.insurance;
    if (pathname === '/growth') return ctaBlocks.funding;
    if (pathname === '/contact') return null;
    return ctaBlocks.general;
}

export function FloatingCta() {
    const { pathname } = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [nearEnd, setNearEnd] = useState(false);
    const [closedOn, setClosedOn] = useState(null);
    const block = blockFor(pathname);
    const ft = TONES[{ '/strategy': 'blue', '/talent': 'teal', '/protection': 'indigo', '/growth': 'red' }[pathname]] || TONES.blue;

    useEffect(() => {
        const on = () => {
            setScrolled(window.scrollY > 700);
            // leave the page's own closing call-to-action and the footer uncovered
            setNearEnd(document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 900);
        };
        on();
        window.addEventListener('scroll', on, { passive: true });
        return () => window.removeEventListener('scroll', on);
    }, []);

    if (!block) return null;
    const show = scrolled && !nearEnd && closedOn !== pathname;
    return (
        <div
            className={`fixed bottom-4 right-4 z-40 max-w-[calc(100%-2rem)] transition-all duration-500 ease-out ${show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
            aria-hidden={!show}
        >
            <div className={`flex items-center gap-2 rounded-md border border-t-4 border-white/15 ${ft.topBright} ${ft.panel} py-2 pl-3 pr-2 text-white shadow-[0_18px_40px_-12px_rgba(20,33,61,0.6)] sm:gap-3`}>
                <Plane className="hidden h-6 w-auto shrink-0 sm:block" />
                <p className="sr-only">{block.text}</p>
                <Button to={block.to || enquiryHref(block.topic)} variant="light" size="sm" tabIndex={show ? 0 : -1}>{block.label}</Button>
                <button type="button" onClick={() => setClosedOn(pathname)} tabIndex={show ? 0 : -1} aria-label="Close" className="rounded p-1.5 text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

// Reading progress along the bottom edge of the header, with the plane at its tip.
export function ScrollPlane() {
    const p = useScrollProgress();
    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-transparent" aria-hidden="true">
            <div className="h-full origin-left bg-gradient-to-r from-ls-blue-bright via-ls-indigo-bright to-ls-red-bright" style={{ transform: `scaleX(${p})` }} />
            <Plane className="absolute -top-3 h-4 w-auto -translate-x-1/2" style={{ left: `${p * 100}%`, opacity: p > 0.005 && p < 0.995 ? 1 : 0, transition: 'opacity 0.2s' }} />
        </div>
    );
}

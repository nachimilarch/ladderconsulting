import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ArrowRightIcon, BoltIcon, BuildingOffice2Icon, CheckIcon, FireIcon, HeartIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, Card, CtaBand, Eyebrow, PageHero, Reveal, SectionHeading, StepBar, Testimonials } from '../../components/site/ui';
import { PillarArt, ShieldGap } from '../../components/site/graphics';
import { ChipList, ComplianceChecklist, HiringFlow, ProcessStepper } from '../../components/site/interactive';
import { clientQuotes, enquiryHref, pillars, pillarHref } from '../../components/site/siteContent';
import { TONES, toneAt, toneFor } from '../../components/site/tones';

// Four rising bars on the page banner, with the current pillar lit.
function StepIndicator({ current }) {
    return (
        <ol className="mt-12 grid max-w-xl grid-cols-4 gap-2 sm:gap-3" aria-label="The 4 Pillars">
            {pillars.map((p, i) => {
                const active = p.slug === current;
                const t = toneFor(p.slug);
                return (
                    <li key={p.slug}>
                        <Link to={pillarHref(p)} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" aria-current={active ? 'page' : undefined}>
                            <span className="flex h-14 items-end" aria-hidden="true">
                                <span
                                    className={`block w-full origin-bottom transition-all duration-300 motion-safe:animate-[ls-grow_0.7s_cubic-bezier(0.2,0.8,0.2,1)_both] ${active ? t.brightBg : `${t.bright40} group-hover:-translate-y-1`}`}
                                    style={{ height: `${(i + 1) * 25}%`, animationDelay: `${i * 90}ms` }}
                                />
                            </span>
                            <span className={`mt-3 block text-xs sm:text-sm font-semibold ${active ? 'text-white' : 'text-white/75 group-hover:text-white'}`}>
                                <span className={`tabular-nums ${t.softText}`}>0{p.step}</span> {p.word}
                            </span>
                        </Link>
                    </li>
                );
            })}
        </ol>
    );
}

// A CTA is either an in-app link (`to`) or an enquiry (`topic`) that opens the contact form for that subject.
const ctaTarget = (c) => (c.to ? c.to : enquiryHref(c.topic));

// One bullet is a plain string, or { lead, text } with the lead in bold.
function Bullet({ b, i = 0, t }) {
    return (
        <Reveal delay={i * 70}>
            <li className="flex items-start gap-3 text-lg leading-relaxed text-ls-navy">
                <span className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full ${t.solid} text-white`}><CheckIcon className="h-4 w-4" strokeWidth={3} aria-hidden="true" /></span>
                {typeof b === 'string' ? b : <span><strong className="font-bold">{b.lead}</strong> {b.text}</span>}
            </li>
        </Reveal>
    );
}

const COVER_ICONS = [WrenchScrewdriverIcon, BuildingOffice2Icon, FireIcon, HeartIcon];

// The right-hand side of a feature panel, chosen by the kind of feature it is.
function FeatureVisual({ f, t }) {
    if (f.kind === 'compliance') {
        return <Card tone={t.key} surface="tint" className="p-7 sm:p-9"><ComplianceChecklist items={f.checklist} tone={t.key} /></Card>;
    }
    if (f.kind === 'gap') return <ShieldGap />;
    if (f.kind === 'insurance') {
        // Four cover cards: pale wash, bold navy focal card, white, pale wash. Each is hover-filled with its own colour.
        const looks = ['tint', 'navy', 'white', 'tint'];
        return (
            <ul className="grid gap-4 sm:grid-cols-2">
                {f.bullets.map((b, i) => {
                    const Icon = COVER_ICONS[i] || BoltIcon;
                    const ct = toneAt(i + 2);
                    const look = looks[i % looks.length];
                    const navy = look === 'navy';
                    return (
                        <li key={i} className={typeof b === 'string' ? '' : 'sm:row-span-1'}>
                            <Reveal delay={i * 90} className="h-full">
                                <div className={`group h-full rounded-md border border-t-[4px] p-6 transition-all duration-300 hover:-translate-y-1 ${navy
                                    ? `border-ls-navy bg-ls-navy ${ct.topBright} text-white shadow-[0_18px_36px_-18px_rgba(20,33,61,0.7)] hover:bg-ls-indigo`
                                    : `${look === 'white' ? 'border-ls-line bg-white' : `${ct.tintBorder} ${ct.tint}`} ${ct.top} ${ct.glow} ${ct.hoverFill}`}`}>
                                    <span className={`grid h-14 w-14 place-items-center rounded-full transition-colors duration-300 ${navy ? 'bg-white text-ls-navy' : `${ct.solid} text-white group-hover:bg-white ${ct.groupHoverText}`}`}>
                                        <Icon className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" strokeWidth={1.5} aria-hidden="true" />
                                    </span>
                                    {typeof b === 'string'
                                        ? <p className={`mt-4 text-lg font-bold leading-snug ${navy ? 'text-white' : 'text-ls-navy group-hover:text-white'}`}>{b}</p>
                                        : (
                                            <>
                                                <p className={`mt-4 text-lg font-bold ${navy ? 'text-white' : 'text-ls-navy group-hover:text-white'}`}>{b.lead}</p>
                                                <p className={`mt-2 leading-relaxed ${navy ? 'text-white/85' : 'text-ls-muted group-hover:text-white'}`}>{b.text}</p>
                                            </>
                                        )}
                                </div>
                            </Reveal>
                        </li>
                    );
                })}
            </ul>
        );
    }
    if (f.bullets || f.closing) {
        return (
            <Card tone={t.key} surface="tint" className="p-7 sm:p-9">
                {f.bullets && <ul className="space-y-4">{f.bullets.map((b, i) => <Bullet key={i} b={b} i={i} t={t} />)}</ul>}
                {f.closing && f.kind !== 'portal' && (
                    <p className={`text-lg leading-relaxed text-ls-muted ${f.bullets ? `mt-7 border-t-2 ${t.tintBorder} pt-6` : ''}`}>
                        <strong className="font-bold text-ls-navy">{f.closing.lead}</strong> {f.closing.text}
                    </p>
                )}
            </Card>
        );
    }
    return null;
}

// A larger panel: heading and text on the left, the detail on the right.
function Feature({ f, tint, t }) {
    const visual = <FeatureVisual f={f} t={t} />;
    return (
        <section className={`${tint ? t.wash : 'bg-white'} py-16 lg:py-24`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
                    <Reveal className="lg:col-span-5">
                        {f.eyebrow && <Eyebrow accent={t.key} className="mb-4">{f.eyebrow}</Eyebrow>}
                        <h2 className="text-3xl font-bold tracking-tight leading-[1.1] text-balance text-ls-navy sm:text-4xl">{f.title}</h2>
                        <StepBar accent={t.key} className="mt-5" />
                        <p className="mt-5 text-lg leading-relaxed text-ls-muted">{f.text}</p>
                    </Reveal>
                    {visual && <Reveal delay={120} className="lg:col-span-7">{visual}</Reveal>}
                </div>

                {f.kind === 'portal' && (
                    <div className="mt-16 lg:mt-20">
                        <HiringFlow flow={f.flow} tone={t.key} />
                        <div className="mt-14 grid gap-5 lg:grid-cols-12 lg:items-center lg:gap-10">
                            <p className="text-lg leading-relaxed text-ls-muted lg:col-span-4">
                                <strong className="font-bold text-ls-navy">{f.closing.lead}</strong> {f.closing.text}
                            </p>
                            <div className="lg:col-span-8"><ChipList items={f.roles} tone={t.key} /></div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

// A link to the previous or next pillar, in that pillar's colour. It fills solid on hover.
function NeighbourCard({ to, t, label, dir, navy = false }) {
    const next = dir === 'next';
    const Arrow = next ? ArrowRightIcon : ArrowLeftIcon;
    const arrow = <Arrow className={`h-6 w-6 shrink-0 transition-transform ${next ? 'group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} strokeWidth={2.25} aria-hidden="true" />;
    return (
        <Link
            to={to}
            className={`group flex items-center gap-5 rounded-md border p-6 transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-blue ${next ? 'justify-end border-r-[6px] text-right' : 'border-l-[6px]'} ${navy
                ? 'border-ls-navy bg-ls-navy text-white hover:bg-ls-blue'
                : `${t.tintBorder} ${t.tint} ${next ? t.railR : t.rail} ${t.glow} ${t.hoverFill}`}`}
        >
            {!next && <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors ${navy ? 'bg-white text-ls-navy' : `${t.solid} text-white group-hover:bg-white ${t.groupHoverText}`}`}>{arrow}</span>}
            <span className={`text-lg font-bold ${navy ? 'text-white' : 'text-ls-navy group-hover:text-white'}`}>{label}</span>
            {next && <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors ${navy ? 'bg-white text-ls-navy' : `${t.solid} text-white group-hover:bg-white ${t.groupHoverText}`}`}>{arrow}</span>}
        </Link>
    );
}

// /strategy, /talent, /protection and /growth share this layout; the copy comes from siteContent.js.
export function PillarPage({ slug: forcedSlug }) {
    const params = useParams();
    const slug = forcedSlug || params.slug;
    const index = pillars.findIndex((x) => x.slug === slug);
    const p = pillars[index];
    usePageMeta(p?.meta.title, p?.meta.description);

    if (!p) return <Navigate to="/" replace />;

    const prev = pillars[index - 1];
    const next = pillars[index + 1];
    const features = p.features || [];
    const t = toneFor(p.slug);
    // Alternate the section backgrounds so the page keeps a rhythm whatever sections it has.
    let shade = 0;
    const nextTint = () => (shade++ % 2 === 1);

    return (
        <div>
            <PageHero
                eyebrow={`Pillar ${p.step}: ${p.word}`}
                title={p.headline}
                subtitle={p.intro}
                crumbs={[{ label: p.word }]}
                tone={t.key}
                art={<PillarArt slug={p.slug} />}
            >
                <StepIndicator current={p.slug} />
            </PageHero>

            {features.map((f) => <Feature key={f.title} f={f} tint={nextTint()} t={t} />)}

            {p.services && (
                <section className={`${nextTint() ? t.wash : 'bg-white'} py-20 lg:py-28`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <SectionHeading title={p.servicesHeading} accent={t.key} />
                        <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 ${p.services.length % 3 === 1 ? '' : 'lg:grid-cols-3'}`}>
                            {p.services.map((item, i) => {
                                // Pale wash, bold pillar-colour focal card, white; the next row runs on in the same rhythm.
                                const look = ['tint', 'deep', 'white', 'white', 'tint', 'navy'][i % 6];
                                const bold = look === 'deep' || look === 'navy';
                                const surface = look === 'navy'
                                    ? 'border-ls-navy bg-ls-navy border-t-ls-blue-bright text-white hover:bg-ls-blue'
                                    : look === 'deep'
                                        ? `border-transparent ${t.deepBg} ${t.topBright} text-white`
                                        : look === 'tint'
                                            ? `${t.tintBorder} ${t.tint} ${t.top} ${t.hoverFill}`
                                            : `border-ls-line bg-white ${t.top} ${t.hoverFill}`;
                                return (
                                    <Reveal key={item.title} delay={(i % 3) * 90} className="h-full">
                                        <div className={`group relative h-full overflow-hidden rounded-md border border-t-[4px] p-7 transition-all duration-300 hover:-translate-y-1 ${t.glow} sm:p-8 ${surface}`}>
                                            <span className={`absolute -right-2 -top-4 select-none text-8xl font-bold tabular-nums transition-colors duration-300 ${bold ? 'text-white/10' : `${t.ghostOnTint} group-hover:text-white/15`}`} aria-hidden="true">{i + 1}</span>
                                            <h3 className={`relative text-xl font-bold ${bold ? 'text-white' : 'text-ls-navy group-hover:text-white'}`}>{item.title}</h3>
                                            <p className={`relative mt-3 leading-relaxed ${bold ? 'text-white/90' : 'text-ls-muted group-hover:text-white'}`}>{item.text}</p>
                                            <span className={`absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100 ${bold ? t.brightBg : 'bg-white/70'}`} aria-hidden="true" />
                                        </div>
                                    </Reveal>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {p.why && (
                <section className={`${nextTint() ? t.wash : 'bg-white'} py-20 lg:py-28`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <SectionHeading title={p.whyHeading} accent={t.key} />
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            {p.why.map((w, i) => {
                                const look = ['deep', 'tint', 'tint', 'white'][i % 4];
                                const bold = look === 'deep';
                                return (
                                    <Reveal key={w.title} delay={(i % 2) * 90} className="h-full">
                                        <div className={`group h-full rounded-md border border-t-[4px] p-6 transition-all duration-300 hover:-translate-y-1 ${t.glow} ${bold
                                            ? `border-transparent ${t.deepBg} ${t.topBright} text-white`
                                            : `${look === 'tint' ? `${t.tintBorder} ${t.tint}` : 'border-ls-line bg-white'} ${t.top} ${t.hoverFill}`}`}>
                                            <h3 className={`flex items-center gap-3 text-xl font-bold ${bold ? 'text-white' : 'text-ls-navy group-hover:text-white'}`}>
                                                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums transition-colors ${bold ? `${t.brightBg} text-ls-navy` : `${t.solid} text-white group-hover:bg-white ${t.groupHoverText}`}`}>{i + 1}</span>
                                                {w.title}
                                            </h3>
                                            <p className={`mt-3 text-lg leading-relaxed ${bold ? 'text-white/90' : 'text-ls-muted group-hover:text-white'}`}>{w.text}</p>
                                        </div>
                                    </Reveal>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {p.steps && (
                <section className={`${nextTint() ? t.wash : 'bg-white'} py-20 lg:py-28`}>
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <SectionHeading title={p.stepsHeading} accent={t.key} className="!mb-0" />
                        <ProcessStepper steps={p.steps} tone={t.key} />
                    </div>
                </section>
            )}

            {p.clientSuccess && (
                <section className={`${nextTint() ? t.wash : 'bg-white'} py-20 lg:py-28`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <SectionHeading title={p.clientSuccess.heading} subtitle={p.clientSuccess.text} accent={t.key} />
                        <Testimonials items={p.clientSuccess.items.map((n) => clientQuotes[n])} tone={p.clientSuccess.items.length === 1 ? t : undefined} />
                    </div>
                </section>
            )}

            {/* Previous / next pillar: each card wears the colour of the pillar it leads to */}
            <section className="bg-gradient-to-b from-ls-paper to-ls-navy-50 py-14 lg:py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {prev ? <NeighbourCard to={pillarHref(prev)} t={toneFor(prev.slug)} label={`0${prev.step} ${prev.word}`} dir="prev" /> : <span className="hidden md:block" />}
                        {next
                            ? <NeighbourCard to={pillarHref(next)} t={toneFor(next.slug)} label={`0${next.step} ${next.word}`} dir="next" />
                            : <NeighbourCard to="/who-we-work-with" t={TONES.blue} label="Who We Work With" dir="next" navy />}
                    </div>
                </div>
            </section>

            <CtaBand title={p.cta.title}>
                <Button to={ctaTarget(p.cta.primary)} size="lg" arrow>{p.cta.primary.label}</Button>
                {p.cta.secondary && (
                    <Button to={ctaTarget(p.cta.secondary)} variant="light" size="lg">{p.cta.secondary.label}</Button>
                )}
            </CtaBand>
        </div>
    );
}

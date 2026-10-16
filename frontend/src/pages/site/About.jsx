import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, CtaBand, PageHero, Reveal, SectionHeading } from '../../components/site/ui';
import { Mark } from '../../components/site/Brand';
import { about, enquiryHref, pillarHref, pillars } from '../../components/site/siteContent';
import { TONES, toneFor } from '../../components/site/tones';

// The four rungs, each longer than the last. Point at one to read why it matters.
function ApproachLadder() {
    const [active, setActive] = useState(null);
    const line = active === null ? null : about.approach.rungs[pillars[active].slug];
    return (
        <div>
            <ol className="space-y-3">
                {pillars.map((p, i) => {
                    const on = active === i;
                    const t = toneFor(p.slug);
                    return (
                        <li key={p.slug} style={{ width: `${58 + i * 14}%` }} className="min-w-[15rem] transition-[width] duration-500">
                            <Link
                                to={pillarHref(p)}
                                onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}
                                onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)}
                                className={`group flex items-center gap-3 rounded-md border-l-8 px-5 py-4 text-white transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-blue ${t.solid} ${t.railBright} ${on ? `translate-x-2 shadow-lg ${t.glowOn}` : ''}`}
                            >
                                <span className="grid h-7 min-w-7 place-items-center rounded-full bg-white px-1 text-xs font-bold tabular-nums tracking-wider text-ls-navy">0{p.step}</span>
                                <span className="text-lg font-bold">{p.word}</span>
                                <ArrowRightIcon className="ml-auto h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" strokeWidth={2.25} aria-hidden="true" />
                            </Link>
                        </li>
                    );
                })}
            </ol>
            <p className="mt-6 min-h-[3.5rem] text-xl font-semibold leading-snug text-ls-navy" aria-live="polite">
                {line && <span key={active} className="inline-block motion-safe:animate-ls-fade-up">{line}</span>}
            </p>
        </div>
    );
}

// One Director at a time in a spotlight: a row of faces to choose from, then the full photo, role and story.
// Every panel stays in the page (the inactive ones are hidden), so the text is there for search engines and readers.
function Directors() {
    const members = about.team.members;
    const [active, setActive] = useState(0);
    const refs = useRef([]);
    const onKey = (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            const to = e.key === 'Home' ? 0 : members.length - 1;
            setActive(to); refs.current[to]?.focus();
        } else if (step) {
            e.preventDefault();
            const to = (active + step + members.length) % members.length;
            setActive(to); refs.current[to]?.focus();
        }
    };
    return (
        <section className="relative overflow-hidden bg-ls-navy py-20 text-white lg:py-28">
            <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 1.2px, transparent 1.2px)', backgroundSize: '28px 28px' }} aria-hidden="true" />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <SectionHeading tone="dark" eyebrow="Leadership" title={about.team.directorsHeading} subtitle={about.team.directorsText} />

                <div role="tablist" aria-label="Directors" onKeyDown={onKey} className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                    {members.map((m, i) => {
                        const t = toneFor(m.pillar);
                        const on = active === i;
                        return (
                            <button
                                key={m.name} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`director-tab-${i}`}
                                aria-selected={on} aria-controls={`director-panel-${i}`} tabIndex={on ? 0 : -1}
                                onClick={() => setActive(i)}
                                className={`group flex shrink-0 items-center gap-3 rounded-full border py-1.5 pl-1.5 pr-5 text-left transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${on ? 'border-white bg-white text-ls-navy shadow-lg' : 'border-white/25 bg-ls-navy-700 text-white hover:border-white/60 hover:bg-white/10'}`}
                            >
                                <img src={m.thumb} alt="" width="48" height="48" className="h-12 w-12 rounded-full object-cover ring-2" style={{ '--tw-ring-color': t.hex.bright }} />
                                <span>
                                    <span className="block text-sm font-bold leading-tight">{m.name}</span>
                                    <span className={`block text-xs font-semibold leading-tight ${on ? 'text-ls-muted' : 'text-white/75'}`}>{m.title.split(' – ')[0]}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-10">
                    {members.map((m, i) => {
                        const t = toneFor(m.pillar);
                        const p = pillars.find((x) => x.slug === m.pillar);
                        return (
                            <div key={m.name} id={`director-panel-${i}`} role="tabpanel" aria-labelledby={`director-tab-${i}`} hidden={active !== i} className={`${active === i ? 'grid' : 'hidden'} items-center gap-10 lg:grid-cols-12 lg:gap-14`}>
                                <div className="relative mx-auto w-full max-w-xs sm:max-w-sm lg:col-span-4 lg:max-w-none motion-safe:animate-ls-fade-up">
                                    <span className="absolute -bottom-3 -right-3 h-full w-full rounded-md border-2" style={{ borderColor: t.hex.bright }} aria-hidden="true" />
                                    <img src={m.photo} alt={m.alt} width="800" height="1200" loading="lazy" className="relative aspect-[2/3] w-full rounded-md bg-ls-navy-700 object-cover" />
                                </div>
                                <div className="lg:col-span-8 motion-safe:animate-ls-fade-up">
                                    {p && (
                                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold text-white">
                                            <span className={`h-2.5 w-2.5 rounded-full ${t.brightBg}`} aria-hidden="true" />
                                            Leads {p.word}
                                        </span>
                                    )}
                                    <h3 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">{m.name}</h3>
                                    <p className={`mt-2 text-lg font-bold sm:text-xl ${t.softText}`}>{m.title}</p>
                                    {m.facts?.length > 0 && (
                                        <dl className="mt-8 grid gap-x-8 gap-y-5 border-y border-white/15 py-6 sm:grid-cols-2 xl:grid-cols-3">
                                            {m.facts.map((f) => (
                                                <div key={f.label}>
                                                    <dt className={`text-3xl font-extrabold tabular-nums sm:text-4xl ${t.softText}`}>{f.value}</dt>
                                                    <dd className="mt-1 text-sm font-medium leading-snug text-white/80">{f.label}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    )}
                                    {m.bio && <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/90">{m.bio}</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

export default function About() {
    usePageMeta(about.meta.title, about.meta.description);

    return (
        <div>
            <PageHero
                title={about.headline}
                subtitle={about.lead}
                crumbs={[{ label: 'About Us' }]}
                art={<Mark tone="dark" animate className="mx-auto h-auto w-full max-w-sm" />}
            />

            {/* Team */}
            <section className="bg-ls-navy-50 py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
                        <Reveal className="lg:col-span-7">
                            <SectionHeading className="!mb-6" eyebrow="Who we are" title={about.team.heading} />
                            <p className="max-w-2xl text-xl leading-relaxed text-ls-muted">{about.team.text}</p>
                        </Reveal>
                        {about.team.groupPhoto && (
                            <Reveal delay={120} className="lg:col-span-5">
                                <figure className="mx-auto max-w-sm lg:max-w-none">
                                    <img src={about.team.groupPhoto.src} alt={about.team.groupPhoto.alt} width="1000" height="1250" loading="lazy" className="aspect-[4/5] w-full rounded-md border-b-[6px] border-ls-red object-cover object-top shadow-[0_18px_36px_-20px_rgba(20,33,61,0.6)]" />
                                    <figcaption className="mt-3 text-sm font-semibold text-ls-muted">{about.team.groupPhoto.caption}</figcaption>
                                </figure>
                            </Reveal>
                        )}
                    </div>
                </div>
            </section>

            {about.team.members.length > 0 && <Directors />}

            {/* Approach */}
            <section className="bg-gradient-to-br from-ls-blue-50 via-ls-paper to-ls-indigo-50 py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
                    <Reveal className="lg:col-span-6">
                        <SectionHeading className="!mb-6" eyebrow="How we work" title={about.approach.heading} />
                        <p className="text-lg leading-relaxed text-ls-muted">{about.approach.intro}</p>
                        <p className="mt-5 text-lg leading-relaxed text-ls-muted">{about.approach.outro}</p>
                    </Reveal>
                    <Reveal delay={120} className="lg:col-span-6">
                        <ApproachLadder />
                    </Reveal>
                </div>
            </section>

            {/* Beliefs */}
            <section className="bg-white py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading eyebrow="Our values" title={about.beliefsHeading} />
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {about.beliefs.map((b, i) => {
                            // Pale blue, bold navy focal card, pale indigo, pale red: a colour each, one strong tile.
                            const navy = i === 1;
                            const t = [TONES.blue, TONES.teal, TONES.indigo, TONES.red][i % 4];
                            return (
                                <Reveal key={b.title} delay={i * 90} className="h-full">
                                    <div className={`group relative h-full overflow-hidden rounded-md border border-t-[4px] p-7 transition-all duration-300 hover:-translate-y-1.5 ${navy
                                        ? 'border-ls-navy border-t-ls-teal-bright bg-ls-navy text-white shadow-[0_18px_36px_-18px_rgba(20,33,61,0.7)] hover:bg-ls-teal-deep'
                                        : `${t.tint} ${t.tintBorder} ${t.top} ${t.glow} ${t.hoverFill}`}`}>
                                        <span className={`block h-2 origin-left transition-all duration-500 ${navy ? 'bg-ls-teal-bright' : `${t.solid} group-hover:bg-white`}`} style={{ width: `${(i + 1) * 25}%` }} aria-hidden="true" />
                                        <h3 className={`mt-6 text-xl font-bold ${navy ? 'text-white' : 'text-ls-navy group-hover:text-white'}`}>{b.title}</h3>
                                        <p className={`mt-2 leading-relaxed ${navy ? 'text-white/90' : 'text-ls-muted group-hover:text-white'}`}>{b.text}</p>
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>
            </section>

            <CtaBand title={about.cta.title}>
                <Button to={enquiryHref(about.cta.topic)} size="lg" arrow>{about.cta.button}</Button>
            </CtaBand>
        </div>
    );
}

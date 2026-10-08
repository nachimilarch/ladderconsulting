import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ArrowRightIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import usePageMeta from '../../components/site/usePageMeta';
import PillarSteps from '../../components/site/PillarSteps';
import { Button, Card, CtaBand, PageHero, Reveal, SectionHeading } from '../../components/site/ui';
import { pillars, pillarHref } from '../../components/site/siteContent';

// Four rising bars on the page banner, with the current pillar lit.
function StepIndicator({ current }) {
    return (
        <ol className="mt-12 grid max-w-xl grid-cols-4 gap-2 sm:gap-3" aria-label="The four pillars">
            {pillars.map((p, i) => {
                const active = p.slug === current;
                return (
                    <li key={p.slug}>
                        <Link to={pillarHref(p)} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" aria-current={active ? 'page' : undefined}>
                            <span className="flex h-14 items-end" aria-hidden="true">
                                <span
                                    className={`block w-full transition-colors ${active ? 'bg-ls-blue-bright' : 'bg-white/15 group-hover:bg-white/30'}`}
                                    style={{ height: `${(i + 1) * 25}%` }}
                                />
                            </span>
                            <span className={`mt-3 block text-xs sm:text-sm font-semibold ${active ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>
                                <span className="tabular-nums">0{p.step}</span> {p.word}
                            </span>
                        </Link>
                    </li>
                );
            })}
        </ol>
    );
}

// /services: the four pillars and everything under each.
export function Services() {
    usePageMeta('Services', 'Strategize, Enable, Secure and Scale: the four pillars of Ladderstep Consulting’s services for growing businesses.');

    return (
        <div>
            <PageHero
                eyebrow="Our services"
                title="Strategize. Enable. Secure. Scale."
                subtitle="Four pillars that take a business from a clear plan to lasting growth. Start wherever you are today."
                crumbs={[{ label: 'Services' }]}
            />

            <section className="bg-white py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <PillarSteps headingLevel="h2" />
                </div>
            </section>

            <section className="bg-ls-paper py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading eyebrow="In detail" title="What each step includes" />
                    <div className="divide-y divide-ls-line border-y border-ls-line">
                        {pillars.map((p) => (
                            <Reveal key={p.slug}>
                                <div className="grid gap-6 py-10 lg:grid-cols-12 lg:gap-10">
                                    <div className="lg:col-span-4">
                                        <p className="text-sm font-semibold tabular-nums tracking-[0.2em] text-ls-blue">0{p.step}</p>
                                        <h3 className="mt-2 text-2xl font-bold text-ls-navy">{p.word}</h3>
                                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-ls-blue">{p.name}</p>
                                        <Link to={pillarHref(p)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ls-blue underline underline-offset-4 hover:text-ls-navy">
                                            Explore {p.word}
                                            <ArrowRightIcon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                                        </Link>
                                    </div>
                                    <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:col-span-8">
                                        {p.items.map((it) => (
                                            <li key={it.title} className="border-l-2 border-ls-line pl-4">
                                                <p className="font-semibold text-ls-navy">{it.title}</p>
                                                <p className="mt-1 text-sm leading-relaxed text-ls-muted">{it.description}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <CtaBand title="Not sure where to start?" text="Tell us where your business is today. We will help you find the step that moves you furthest.">
                <Button to="/contact" size="lg" arrow>Book a strategy call</Button>
            </CtaBand>
        </div>
    );
}

// /services/:slug: one page per pillar.
export function PillarPage() {
    const { slug } = useParams();
    const index = pillars.findIndex((x) => x.slug === slug);
    const p = pillars[index];
    usePageMeta(p ? `${p.word}: ${p.name}` : 'Services', p?.subtitle);

    if (!p) return <Navigate to="/services" replace />;

    const prev = pillars[index - 1];
    const next = pillars[index + 1];

    return (
        <div>
            <PageHero
                eyebrow={`Step 0${p.step} · ${p.name}`}
                title={p.title}
                subtitle={p.subtitle}
                crumbs={[{ label: 'Services', href: '/services' }, { label: p.word }]}
            >
                <StepIndicator current={p.slug} />
            </PageHero>

            <section className="bg-white py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading eyebrow={`What ${p.word} includes`} title={p.intro} />
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {p.items.map((item, i) => (
                            <Reveal key={item.title} delay={(i % 3) * 90} className="h-full">
                                <Card className="h-full p-7 sm:p-8">
                                    <p className="text-sm font-semibold tabular-nums tracking-[0.2em] text-ls-blue">{String(i + 1).padStart(2, '0')}</p>
                                    <h3 className="mt-4 text-xl font-bold text-ls-navy">{item.title}</h3>
                                    <p className="mt-3 leading-relaxed text-ls-muted">{item.description}</p>
                                </Card>
                            </Reveal>
                        ))}
                    </div>

                    {p.slug === 'enable' && (
                        <Reveal>
                            <div className="mt-10 flex flex-col gap-6 border border-ls-line bg-ls-paper p-7 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                                <div className="flex items-start gap-4">
                                    <BriefcaseIcon className="mt-0.5 h-7 w-7 shrink-0 text-ls-blue" strokeWidth={1.5} aria-hidden="true" />
                                    <div>
                                        <p className="text-lg font-bold text-ls-navy">Hiring now?</p>
                                        <p className="mt-1 text-ls-muted">Post a role on the Ladderstep platform and our executives will source and shortlist candidates for it.</p>
                                    </div>
                                </div>
                                <Button to="/register?role=company" variant="navy" arrow className="shrink-0">Post a job</Button>
                            </div>
                        </Reveal>
                    )}
                </div>
            </section>

            {/* Previous / next step */}
            <section className="bg-ls-paper py-14 lg:py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="sr-only">More steps</h2>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {prev ? (
                            <Link to={pillarHref(prev)} className="group flex items-center gap-5 border border-ls-line bg-white p-6 transition-colors hover:border-ls-navy/30">
                                <ArrowLeftIcon className="h-5 w-5 shrink-0 text-ls-blue transition-transform group-hover:-translate-x-1" strokeWidth={2.25} aria-hidden="true" />
                                <span>
                                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-ls-muted">Previous step</span>
                                    <span className="mt-1 block text-lg font-bold text-ls-navy">0{prev.step} {prev.word}</span>
                                </span>
                            </Link>
                        ) : <span className="hidden md:block" />}
                        {next ? (
                            <Link to={pillarHref(next)} className="group flex items-center justify-end gap-5 border border-ls-line bg-white p-6 text-right transition-colors hover:border-ls-navy/30">
                                <span>
                                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-ls-muted">Next step</span>
                                    <span className="mt-1 block text-lg font-bold text-ls-navy">0{next.step} {next.word}</span>
                                </span>
                                <ArrowRightIcon className="h-5 w-5 shrink-0 text-ls-blue transition-transform group-hover:translate-x-1" strokeWidth={2.25} aria-hidden="true" />
                            </Link>
                        ) : (
                            <Link to="/services" className="group flex items-center justify-end gap-5 border border-ls-line bg-white p-6 text-right transition-colors hover:border-ls-navy/30">
                                <span>
                                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-ls-muted">All four pillars</span>
                                    <span className="mt-1 block text-lg font-bold text-ls-navy">See every service</span>
                                </span>
                                <ArrowRightIcon className="h-5 w-5 shrink-0 text-ls-blue transition-transform group-hover:translate-x-1" strokeWidth={2.25} aria-hidden="true" />
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            <CtaBand title={`Ready to ${p.word.toLowerCase()}?`} text="Tell us about your business and we will shape the right plan with you.">
                <Button to="/contact" size="lg" arrow>Book a strategy call</Button>
            </CtaBand>
        </div>
    );
}

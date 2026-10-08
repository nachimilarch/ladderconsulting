import { Navigate } from 'react-router-dom';
import { CheckIcon, BriefcaseIcon, UserCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import Hero from '../../components/site/Hero';
import PillarSteps from '../../components/site/PillarSteps';
import ContactForm from '../../components/site/ContactForm';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, Card, Eyebrow, Reveal, SectionHeading, StepEdge } from '../../components/site/ui';
import { companyInfo, contactEmail, glance, journey, platform } from '../../components/site/siteContent';

export default function Home() {
    const { user } = useAuth();
    usePageMeta(null, companyInfo.description);

    // Signed-in people used to land on their dashboard from "/", so keep that.
    if (user) return <Navigate to="/dashboard" replace />;

    return (
        <div>
            <Hero />

            {/* At a glance: plain facts about the firm */}
            <section aria-label="At a glance" className="bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 lg:pt-4">
                    <dl className="grid grid-cols-2 lg:grid-cols-4 border-y border-ls-line">
                        {glance.map((g, i) => (
                            <div
                                key={g.label}
                                className={`px-4 py-6 sm:px-6 lg:py-8 ${i % 2 === 1 ? 'border-l border-ls-line' : ''} ${i >= 2 ? 'border-t border-ls-line lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
                            >
                                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-ls-muted">{g.label}</dt>
                                <dd className="mt-2 text-lg sm:text-xl font-bold leading-snug text-ls-navy">{g.value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            {/* The four pillars */}
            <section id="pillars" className="scroll-mt-24 bg-white py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
                        <SectionHeading
                            className="lg:col-span-7 !mb-0"
                            eyebrow="What we do"
                            title="Four steps. One climb."
                        />
                        <p className="lg:col-span-5 text-lg leading-relaxed text-ls-muted">
                            Every growing business needs a clear plan, capable people, secure finances and systems that hold.
                            We help with each, in the order you need them.
                        </p>
                    </div>
                    <div className="mt-12 lg:mt-16">
                        <PillarSteps />
                    </div>
                </div>
            </section>

            {/* How we work */}
            <section className="bg-ls-paper py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading
                        eyebrow="How we work"
                        title="From clarity to growth"
                        subtitle="A simple path, taken one step at a time with your team."
                    />
                    <ol className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                        {journey.map((j, i) => (
                            <li key={j.title}>
                                <Reveal delay={i * 100}>
                                    {/* A rising block per step: together they draw a staircase across the row */}
                                    {/* On phones the blocks grow in width instead, since they stack */}
                                    <div className="flex h-2 items-end sm:h-12" aria-hidden="true">
                                        <span
                                            className={`block h-full w-[var(--step)] sm:h-[var(--step)] sm:w-full ${i === journey.length - 1 ? 'bg-ls-blue' : 'bg-ls-navy'}`}
                                            style={{ '--step': `${(i + 1) * 25}%` }}
                                        />
                                    </div>
                                    <p className="mt-6 text-sm font-semibold tabular-nums tracking-[0.2em] text-ls-blue">Step {i + 1}</p>
                                    <h3 className="mt-2 text-xl font-bold text-ls-navy">{j.title}</h3>
                                    <p className="mt-2 leading-relaxed text-ls-muted">{j.description}</p>
                                </Reveal>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* The portal */}
            <section className="bg-white py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading
                        eyebrow="The Ladderstep platform"
                        title="Hiring and getting hired, in one place"
                        subtitle="Our platform connects growing companies with the right talent, with our executives supporting every step."
                    />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {[
                            { ...platform.company, icon: BriefcaseIcon },
                            { ...platform.seeker, icon: UserCircleIcon },
                        ].map((c, i) => (
                            <Reveal key={c.title} delay={i * 120} className="h-full">
                                <Card className="flex h-full flex-col p-8 sm:p-10">
                                    <c.icon className="h-8 w-8 text-ls-blue" strokeWidth={1.5} aria-hidden="true" />
                                    <h3 className="mt-5 text-2xl font-bold text-ls-navy">{c.title}</h3>
                                    <p className="mt-2 text-lg text-ls-muted">{c.lead}</p>
                                    <ul className="mt-6 space-y-3 text-ls-navy">
                                        {c.points.map((pt) => (
                                            <li key={pt} className="flex items-start gap-3">
                                                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-ls-blue" strokeWidth={2.5} aria-hidden="true" />
                                                {pt}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-auto flex flex-wrap gap-3 pt-8">
                                        <Button to={c.register} variant="navy" arrow>Get started</Button>
                                        <Button to="/login" variant="outline">Log in</Button>
                                    </div>
                                </Card>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Navy band: one bold message */}
            <section className="relative isolate overflow-hidden bg-ls-navy text-white">
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
                    <Eyebrow tone="dark" className="mb-6">Our promise</Eyebrow>
                    <p className="max-w-5xl text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-balance">
                        Strategize. Enable. Secure. <span className="text-ls-red-bright">Scale.</span>
                    </p>
                    <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
                        Four pillars and one partner for every stage of your growth, so each step you take sets up the next.
                    </p>
                    <div className="mt-10">
                        <Button to="/about" variant="light" size="lg" arrow>About Ladderstep</Button>
                    </div>
                </div>
                <StepEdge />
            </section>

            {/* Contact */}
            <section id="contact" className="scroll-mt-24 bg-white py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 lg:gap-16">
                    <Reveal className="lg:col-span-5">
                        <Eyebrow className="mb-4">Contact us</Eyebrow>
                        <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.1] text-ls-navy">Start your climb</h2>
                        <p className="mt-5 text-lg leading-relaxed text-ls-muted">
                            Tell us about your business and where you want to take it. We will get back to you as soon as possible.
                        </p>
                        <a href={`mailto:${contactEmail}`} className="mt-8 inline-flex items-center gap-3 font-semibold text-ls-blue underline underline-offset-4 hover:text-ls-navy break-all">
                            <EnvelopeIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                            {contactEmail}
                        </a>
                    </Reveal>
                    <Reveal delay={120} className="lg:col-span-7">
                        <Card className="p-6 sm:p-10">
                            <ContactForm />
                        </Card>
                    </Reveal>
                </div>
            </section>
        </div>
    );
}

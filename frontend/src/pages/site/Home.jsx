import { Link, Navigate } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, BriefcaseIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import Hero from '../../components/site/Hero';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, CtaBand, DarkBackdrop, Eyebrow, Reveal, SectionHeading } from '../../components/site/ui';
import { companyInfo, coreValues, glance, mainServices, platform, twoPillars } from '../../components/site/siteContent';

export default function Home() {
    const { user } = useAuth();
    usePageMeta(null, companyInfo.description);

    // Signed-in people used to land on their dashboard from "/", so keep that.
    if (user) return <Navigate to="/dashboard" replace />;

    return (
        <div>
            <Hero />

            {/* At a glance: plain facts about the firm, overlapping the hero */}
            <section className="relative z-10 -mt-16 lg:-mt-24" aria-label="At a glance">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Reveal>
                        <dl className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl bg-white shadow-2xl shadow-site-ink/15 ring-1 ring-slate-900/5 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                            {glance.map((g) => (
                                <div key={g.label} className="px-6 py-6 lg:py-8 odd:border-r odd:border-slate-100 lg:odd:border-r-0">
                                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-sitegold-dark">{g.label}</dt>
                                    <dd className="mt-2 font-sitehead text-lg sm:text-xl font-bold leading-snug text-site-deep">{g.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </Reveal>
                </div>
            </section>

            {/* About */}
            <section className="py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 items-center">
                    <Reveal className="lg:col-span-6">
                        <Eyebrow className="mb-5">About LadderStep</Eyebrow>
                        <h2 className="font-sitehead font-bold tracking-tight leading-[1.1] text-balance text-3xl sm:text-4xl lg:text-[2.75rem] text-site-deep">
                            SMBs are the backbone of our economy.
                        </h2>
                        <p className="mt-6 text-lg leading-relaxed text-slate-600">{companyInfo.description}</p>
                        <p className="mt-4 text-lg leading-relaxed text-slate-600">
                            We cater to the two pillars of scaling up your business: <strong className="font-semibold text-site-deep">People &amp; Profits</strong>.
                        </p>
                        <div className="mt-8">
                            <Button to="/about" variant="outline" arrow>Learn more about us</Button>
                        </div>
                    </Reveal>

                    <Reveal delay={120} className="lg:col-span-6">
                        <figure className="relative rounded-2xl bg-site-mist p-8 sm:p-10 ring-1 ring-site/10">
                            <span className="absolute -top-5 left-8 font-sitehead text-7xl leading-none text-sitegold" aria-hidden="true">&ldquo;</span>
                            <blockquote className="font-sitehead text-xl sm:text-2xl font-semibold leading-snug text-site-deep">
                                {companyInfo.vision}.
                            </blockquote>
                            <figcaption className="mt-6 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-sitegold-dark">
                                <span className="h-px w-8 bg-sitegold-dark/60" aria-hidden="true" />
                                Our vision
                            </figcaption>
                        </figure>
                    </Reveal>
                </div>
            </section>

            {/* Services */}
            <section id="services" className="scroll-mt-24 bg-sitegray-light py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading
                        eyebrow="What we do"
                        title="Three service lines, one aim: your growth"
                        subtitle="From the people who run your business to the money that funds it, we support every step of your scaling-up journey."
                    />
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {mainServices.map((s, i) => (
                            <Reveal key={s.key} delay={i * 100} className="h-full">
                                <Link
                                    to={s.href}
                                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white p-8 ring-1 ring-slate-900/5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-site-ink/10"
                                >
                                    <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-sitegold to-sitegold-light transition-transform duration-500 group-hover:scale-x-100" aria-hidden="true" />
                                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-site text-white shadow-lg shadow-site/25">
                                        <s.icon className="h-7 w-7" aria-hidden="true" />
                                    </span>
                                    <h3 className="mt-6 font-sitehead text-2xl font-bold text-site-deep">{s.title}</h3>
                                    <p className="mt-3 leading-relaxed text-slate-600">{s.description}</p>
                                    <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                                        {s.items.slice(0, 4).map((it) => (
                                            <li key={it.title} className="flex items-start gap-2.5">
                                                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-sitegold-dark" aria-hidden="true" />
                                                {it.title}
                                            </li>
                                        ))}
                                    </ul>
                                    <span className="mt-8 inline-flex items-center gap-2 pt-1 text-sm font-semibold text-site transition-colors group-hover:text-site-deep">
                                        Explore {s.title}
                                        <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                                    </span>
                                </Link>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Two pillars */}
            <section className="relative isolate overflow-hidden text-white">
                <DarkBackdrop glow="left" />
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
                    <SectionHeading
                        tone="dark"
                        eyebrow="Our approach"
                        title="Two pillars that scale a business"
                        subtitle="Talent and money are what every growing business runs on. We help you get both right."
                    />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {[twoPillars.people, twoPillars.profits].map((p, i) => (
                            <Reveal key={p.title} delay={i * 120} className="h-full">
                                <div className="h-full rounded-2xl bg-white/[0.06] p-8 sm:p-10 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/[0.09]">
                                    <p className="font-sitehead text-sm font-semibold italic tracking-wide text-sitegold-light">0{i + 1}</p>
                                    <h3 className="mt-2 font-sitehead text-4xl font-bold text-white">{p.title}</h3>
                                    <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-sitegold-light">{p.tagline}</p>
                                    <p className="mt-5 leading-relaxed text-slate-200">{p.description}</p>
                                    <ul className="mt-6 space-y-3">
                                        {p.points.map((pt) => (
                                            <li key={pt} className="flex items-center gap-3 text-slate-100">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sitegold/20 text-sitegold-light">
                                                    <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                                                </span>
                                                {pt}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* The portal */}
            <section className="py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading
                        eyebrow="The LadderStep platform"
                        title="Hiring and getting hired, in one place"
                        subtitle="Beyond consulting, our platform connects growing companies with the right talent, with our executives supporting every step."
                    />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {[
                            { ...platform.company, icon: BriefcaseIcon },
                            { ...platform.seeker, icon: UserCircleIcon },
                        ].map((c, i) => (
                            <Reveal key={c.title} delay={i * 120} className="h-full">
                                <div className="flex h-full flex-col rounded-2xl bg-white p-8 sm:p-10 ring-1 ring-slate-900/10 shadow-sm">
                                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-site-mist text-site">
                                        <c.icon className="h-6 w-6" aria-hidden="true" />
                                    </span>
                                    <h3 className="mt-5 font-sitehead text-2xl font-bold text-site-deep">{c.title}</h3>
                                    <p className="mt-2 text-slate-600">{c.lead}</p>
                                    <ul className="mt-6 space-y-3 text-sm text-slate-700">
                                        {c.points.map((pt) => (
                                            <li key={pt} className="flex items-start gap-3">
                                                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-sitegold-dark" strokeWidth={2.5} aria-hidden="true" />
                                                {pt}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-auto flex flex-wrap gap-3 pt-8">
                                        <Button to={c.register} arrow>Get started</Button>
                                        <Button to="/login" variant="outline">Login</Button>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="bg-sitegray-light py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading eyebrow="What we stand for" title="The principles behind our work" />
                    <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                        {coreValues.map((v, i) => (
                            <Reveal key={v.title} delay={i * 90}>
                                <div className="text-center sm:text-left">
                                    <span className="mx-auto sm:mx-0 flex h-14 w-14 items-center justify-center rounded-full bg-white text-site shadow-md ring-1 ring-slate-900/5">
                                        <v.icon className="h-6 w-6" aria-hidden="true" />
                                    </span>
                                    <h3 className="mt-5 font-sitehead text-xl font-bold text-site-deep">{v.title}</h3>
                                    <p className="mt-2 leading-relaxed text-slate-600">{v.description}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <CtaBand
                title="Ready to scale with better talent and better profits?"
                text="Tell us about your business. We will get back to you as soon as possible."
            >
                <Button to="/contact" variant="gold" size="lg" arrow>Contact us</Button>
                <Button to="/about" variant="light" size="lg">About LadderStep</Button>
            </CtaBand>
        </div>
    );
}

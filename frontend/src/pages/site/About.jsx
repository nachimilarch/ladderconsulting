import { CheckIcon } from '@heroicons/react/24/outline';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, CtaBand, DarkBackdrop, Eyebrow, PageHero, Reveal, SectionHeading } from '../../components/site/ui';
import { companyInfo, coreValues, twoPillars } from '../../components/site/siteContent';

export default function About() {
    usePageMeta('About Us', companyInfo.description);

    return (
        <div>
            <PageHero
                eyebrow="About LadderStep"
                title="A consulting partner for the businesses that power India"
                subtitle={companyInfo.description}
                crumb="About Us"
            />

            {/* Pillars */}
            <section className="py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading
                        eyebrow="Our two pillars"
                        title="People and Profits"
                        subtitle="We focus on the two essential elements that drive business growth."
                    />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {[twoPillars.people, twoPillars.profits].map((p, i) => (
                            <Reveal key={p.title} delay={i * 120} className="h-full">
                                <div className="h-full rounded-2xl bg-white p-8 sm:p-10 ring-1 ring-slate-900/10 shadow-sm border-t-4 border-sitegold">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sitegold-dark">{p.tagline}</p>
                                    <h3 className="mt-3 font-sitehead text-3xl font-bold text-site-deep">{p.title}</h3>
                                    <p className="mt-4 leading-relaxed text-slate-600">{p.description}</p>
                                    <ul className="mt-6 space-y-3">
                                        {p.points.map((pt) => (
                                            <li key={pt} className="flex items-center gap-3 text-slate-700">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-site-mist text-site">
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

            {/* Vision */}
            <section className="relative isolate overflow-hidden text-white">
                <DarkBackdrop />
                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 text-center">
                    <Eyebrow tone="dark" className="mb-6">Our vision</Eyebrow>
                    <p className="font-sitehead text-2xl sm:text-3xl lg:text-4xl font-semibold leading-snug text-white">
                        <span className="text-sitegold-light">&ldquo;</span>{companyInfo.vision}<span className="text-sitegold-light">&rdquo;</span>
                    </p>
                </div>
            </section>

            {/* Values */}
            <section className="py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading
                        eyebrow="Our core values"
                        title="The principles that guide everything we do"
                    />
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {coreValues.map((v, i) => (
                            <Reveal key={v.title} delay={(i % 2) * 100} className="h-full">
                                <div className="flex h-full gap-5 rounded-2xl bg-sitegray-light p-7 ring-1 ring-slate-900/5">
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-site shadow-sm ring-1 ring-slate-900/5">
                                        <v.icon className="h-6 w-6" aria-hidden="true" />
                                    </span>
                                    <div>
                                        <h3 className="font-sitehead text-xl font-bold text-site-deep">{v.title}</h3>
                                        <p className="mt-2 leading-relaxed text-slate-600">{v.description}</p>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <CtaBand
                title="Let's build your next stage of growth"
                text="Whether it is your people, your funding or both, we would like to hear about your business."
            >
                <Button to="/contact" variant="gold" size="lg" arrow>Contact us</Button>
                <Button to="/" variant="light" size="lg">Back to home</Button>
            </CtaBand>
        </div>
    );
}

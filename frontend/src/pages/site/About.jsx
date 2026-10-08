import usePageMeta from '../../components/site/usePageMeta';
import PillarSteps from '../../components/site/PillarSteps';
import { Mark } from '../../components/site/Brand';
import { Button, CtaBand, Eyebrow, PageHero, Reveal, SectionHeading } from '../../components/site/ui';
import { brandStory, companyInfo, coreValues } from '../../components/site/siteContent';

export default function About() {
    usePageMeta('About', companyInfo.description);

    return (
        <div>
            <PageHero
                eyebrow="About Ladderstep"
                title="A consulting partner for the businesses that power India"
                subtitle={companyInfo.description}
                crumbs={[{ label: 'About' }]}
            />

            {/* Who we are + vision */}
            <section className="bg-white py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 lg:items-center">
                    <Reveal className="lg:col-span-6">
                        <Eyebrow className="mb-4">Who we are</Eyebrow>
                        <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.1] text-balance text-ls-navy">
                            SMBs are the backbone of our economy.
                        </h2>
                        <p className="mt-6 text-lg leading-relaxed text-ls-muted">
                            Growing a business takes more than ambition. It takes a clear plan, the right people, secure finances and
                            systems that hold as you grow. Ladderstep brings all four together, so you can focus on the climb.
                        </p>
                    </Reveal>
                    <Reveal delay={120} className="lg:col-span-6">
                        <figure className="border-l-4 border-ls-blue bg-ls-paper p-8 sm:p-10">
                            <figcaption className="text-xs font-semibold uppercase tracking-[0.22em] text-ls-blue">Our vision</figcaption>
                            <blockquote className="mt-4 text-2xl sm:text-[1.75rem] font-semibold leading-snug text-ls-navy">
                                {companyInfo.vision}.
                            </blockquote>
                        </figure>
                    </Reveal>
                </div>
            </section>

            {/* The idea behind the mark */}
            <section className="bg-ls-paper py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 lg:items-center">
                    <Reveal className="lg:col-span-5">
                        <div className="flex aspect-square max-w-sm items-center justify-center border border-ls-line bg-white p-12 sm:p-16 mx-auto lg:mx-0">
                            <Mark animate className="h-full w-full" title="The Ladderstep take-off mark" />
                        </div>
                    </Reveal>
                    <div className="lg:col-span-7">
                        <SectionHeading
                            className="!mb-10"
                            eyebrow="Our mark"
                            title="A disciplined climb that ends in a take-off"
                        />
                        <dl className="grid gap-8 sm:grid-cols-2">
                            {brandStory.map((b, i) => (
                                <Reveal key={b.title} delay={i * 120}>
                                    <dt className="flex items-center gap-3 text-lg font-bold text-ls-navy">
                                        <span className={`h-3 w-6 ${i === 0 ? 'bg-ls-navy' : 'bg-ls-red'}`} aria-hidden="true" />
                                        {b.title}
                                    </dt>
                                    <dd className="mt-3 leading-relaxed text-ls-muted">{b.text}</dd>
                                </Reveal>
                            ))}
                        </dl>
                    </div>
                </div>
            </section>

            {/* Pillars */}
            <section className="bg-white py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading
                        eyebrow="Our four pillars"
                        title="Strategize. Enable. Secure. Scale."
                        subtitle="Four steps every growing business takes. We help with each one, in the order you need them."
                    />
                    <PillarSteps />
                </div>
            </section>

            {/* Values */}
            <section className="bg-ls-paper py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading eyebrow="What we stand for" title="The principles behind our work" />
                    <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                        {coreValues.map((v, i) => (
                            <Reveal key={v.title} delay={i * 90}>
                                <div className="border-t-2 border-ls-navy pt-6">
                                    <v.icon className="h-7 w-7 text-ls-blue" strokeWidth={1.5} aria-hidden="true" />
                                    <h3 className="mt-5 text-xl font-bold text-ls-navy">{v.title}</h3>
                                    <p className="mt-2 leading-relaxed text-ls-muted">{v.description}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <CtaBand
                title="Let's plan your next step"
                text="Whether it is strategy, people, capital or systems, we would like to hear about your business."
            >
                <Button to="/contact" size="lg" arrow>Book a strategy call</Button>
                <Button to="/services" variant="light" size="lg">See our services</Button>
            </CtaBand>
        </div>
    );
}

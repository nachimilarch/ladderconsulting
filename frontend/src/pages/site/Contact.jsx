import { Link } from 'react-router-dom';
import { ArrowRightIcon, BriefcaseIcon, EnvelopeIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import ContactForm from '../../components/site/ContactForm';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, Card, PageHero, Reveal, SectionHeading } from '../../components/site/ui';
import { contactEmail, pillars, pillarHref, portalAccess } from '../../components/site/siteContent';

const portalIcons = { Company: BriefcaseIcon, 'Job seeker': UserCircleIcon };

export default function Contact() {
    usePageMeta('Contact', 'Get in touch with Ladderstep Consulting to plan the next step for your business.');

    return (
        <div>
            <PageHero
                eyebrow="Contact us"
                title="Start your climb"
                subtitle="Tell us where your business is today and where you want it to go. We will get back to you as soon as possible."
                crumbs={[{ label: 'Contact' }]}
            />

            <section className="bg-white py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 lg:gap-16">
                    <Reveal className="lg:col-span-5">
                        <h2 className="text-3xl font-bold tracking-tight text-ls-navy">Send us a message</h2>
                        <p className="mt-4 text-lg leading-relaxed text-ls-muted">
                            Fill out the form, or write to us directly.
                        </p>

                        <a
                            href={`mailto:${contactEmail}`}
                            className="mt-8 flex items-center gap-4 border border-ls-line bg-ls-paper p-5 transition-colors hover:border-ls-blue"
                        >
                            <EnvelopeIcon className="h-7 w-7 shrink-0 text-ls-blue" strokeWidth={1.5} aria-hidden="true" />
                            <span className="min-w-0">
                                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-ls-muted">Email us</span>
                                <span className="block truncate font-semibold text-ls-navy underline underline-offset-4 decoration-ls-line">{contactEmail}</span>
                            </span>
                        </a>

                        <div className="mt-10">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ls-muted">We can help you</p>
                            <ul className="mt-4 divide-y divide-ls-line border-y border-ls-line">
                                {pillars.map((p) => (
                                    <li key={p.slug}>
                                        <Link to={pillarHref(p)} className="group flex items-center gap-4 py-3.5 text-ls-navy">
                                            <span className="w-6 text-xs font-semibold tabular-nums text-ls-blue">0{p.step}</span>
                                            <span className="flex-1">
                                                <span className="font-semibold">{p.word}</span>
                                                <span className="text-ls-muted"> · {p.name}</span>
                                            </span>
                                            <ArrowRightIcon className="h-4 w-4 shrink-0 text-ls-blue transition-transform group-hover:translate-x-1" strokeWidth={2.25} aria-hidden="true" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Reveal>

                    <Reveal delay={120} className="lg:col-span-7">
                        <Card className="p-6 sm:p-10">
                            <ContactForm />
                        </Card>
                    </Reveal>
                </div>
            </section>

            <section className="bg-ls-paper py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading
                        eyebrow="Client portal"
                        title="Access your Ladderstep account"
                        subtitle="Sign in to your dashboard, or create an account to get started."
                    />
                    <div className="grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
                        {portalAccess.map((p, i) => {
                            const Icon = portalIcons[p.title];
                            return (
                                <Reveal key={p.title} delay={i * 120} className="h-full">
                                    <Card className="flex h-full flex-col p-8">
                                        <Icon className="h-8 w-8 text-ls-blue" strokeWidth={1.5} aria-hidden="true" />
                                        <h3 className="mt-5 text-2xl font-bold text-ls-navy">{p.title}</h3>
                                        <p className="mt-2 leading-relaxed text-ls-muted">{p.description}</p>
                                        <div className="mt-auto flex gap-3 pt-8">
                                            <Button to={p.login} variant="navy" className="flex-1">Log in</Button>
                                            <Button to={p.register} variant="outline" className="flex-1">Register</Button>
                                        </div>
                                    </Card>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>
            </section>
        </div>
    );
}

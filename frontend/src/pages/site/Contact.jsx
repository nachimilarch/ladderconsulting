import { Link } from 'react-router-dom';
import { ArrowRightIcon, BriefcaseIcon, EnvelopeIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import ContactForm from '../../components/site/ContactForm';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, PageHero, Reveal, SectionHeading } from '../../components/site/ui';
import { contactEmail, mainServices, portalAccess } from '../../components/site/siteContent';

const portalIcons = { Company: BriefcaseIcon, 'Job Seeker': UserCircleIcon };

export default function Contact() {
    usePageMeta('Contact Us', 'Get in touch with LadderStep Human Consulting to discuss how we can help your business grow.');

    return (
        <div>
            <PageHero
                eyebrow="Contact us"
                title="Let's talk about your business"
                subtitle="Get in touch with us to discuss how we can help your business grow."
                crumb="Contact Us"
            />

            <section className="py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-5 lg:gap-14">
                    <Reveal className="lg:col-span-2">
                        <h2 className="font-sitehead text-3xl font-bold tracking-tight text-site-deep">Send us a message</h2>
                        <p className="mt-4 text-lg leading-relaxed text-slate-600">
                            Fill out the form and we will get back to you as soon as possible.
                        </p>

                        <a
                            href={`mailto:${contactEmail}`}
                            className="mt-8 flex items-center gap-4 rounded-2xl bg-site-mist p-5 ring-1 ring-site/10 transition hover:ring-site/30"
                        >
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-site text-white">
                                <EnvelopeIcon className="h-6 w-6" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-sitegold-dark">Email us</span>
                                <span className="block truncate font-semibold text-site-deep">{contactEmail}</span>
                            </span>
                        </a>

                        <div className="mt-10">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sitegold-dark">We can help with</p>
                            <ul className="mt-4 space-y-3">
                                {mainServices.map((s) => (
                                    <li key={s.key}>
                                        <Link to={s.href} className="group flex items-center gap-3 text-slate-700 hover:text-site-deep transition-colors">
                                            <s.icon className="h-5 w-5 text-site" aria-hidden="true" />
                                            <span className="font-medium">{s.title}</span>
                                            <ArrowRightIcon className="h-4 w-4 opacity-0 -translate-x-1 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Reveal>

                    <Reveal delay={120} className="lg:col-span-3">
                        <div className="rounded-2xl bg-white p-6 sm:p-10 shadow-2xl shadow-site-ink/10 ring-1 ring-slate-900/5">
                            <ContactForm />
                        </div>
                    </Reveal>
                </div>
            </section>

            <section className="bg-sitegray-light py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading
                        eyebrow="Client portal"
                        title="Access your LadderStep account"
                        subtitle="Sign in to your dashboard, or create an account to get started."
                    />
                    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
                        {portalAccess.map((p, i) => {
                            const Icon = portalIcons[p.title];
                            return (
                                <Reveal key={p.title} delay={i * 120} className="h-full">
                                    <div className="flex h-full flex-col rounded-2xl bg-white p-8 ring-1 ring-slate-900/5 shadow-sm">
                                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-site text-white shadow-lg shadow-site/25">
                                            <Icon className="h-6 w-6" aria-hidden="true" />
                                        </span>
                                        <h3 className="mt-5 font-sitehead text-2xl font-bold text-site-deep">{p.title}</h3>
                                        <p className="mt-2 leading-relaxed text-slate-600">{p.description}</p>
                                        <div className="mt-auto flex gap-3 pt-8">
                                            <Button to={p.login} className="flex-1">Login</Button>
                                            <Button to={p.register} variant="outline" className="flex-1">Register</Button>
                                        </div>
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>
            </section>
        </div>
    );
}

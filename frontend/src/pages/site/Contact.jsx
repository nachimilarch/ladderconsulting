import { useSearchParams } from 'react-router-dom';
import { ArrowRightIcon, ClockIcon, EnvelopeIcon, MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline';
import ContactForm from '../../components/site/ContactForm';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, Card, PageHero, Reveal, SectionHeading } from '../../components/site/ui';
import { Accordion } from '../../components/site/interactive';
import { Backdrop, ContactArt } from '../../components/site/graphics';
import { contact, contactEmail, enquiryHref, home } from '../../components/site/siteContent';
import { TONES } from '../../components/site/tones';

const linkClass = 'rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-blue';

// One way to reach us: a coloured top edge, an icon, the detail, and a follow-up action.
function MethodCard({ tone, icon: Icon, label, delay, children }) {
    const t = TONES[tone];
    return (
        <Reveal delay={delay} className="h-full">
            <li className={`flex h-full list-none flex-col rounded-md border border-t-[4px] border-ls-line bg-white p-6 transition-all duration-300 hover:-translate-y-1 ${t.top} ${t.glow}`}>
                <span className={`grid h-12 w-12 place-items-center rounded-full ${t.solid} text-white`}>
                    <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
                </span>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-ls-muted">{label}</p>
                {children}
            </li>
        </Reveal>
    );
}

export default function Contact() {
    usePageMeta(contact.meta.title, contact.meta.description);
    const [params] = useSearchParams();
    const d = contact.details;

    return (
        <div>
            <PageHero
                title={contact.headline}
                subtitle={contact.lead}
                crumbs={[{ label: 'Contact' }]}
                art={<ContactArt />}
            />

            <section className="bg-gradient-to-b from-ls-blue-50 via-white to-white pb-20 pt-14 lg:pb-28 lg:pt-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1.35fr_1fr_1.2fr]" aria-label="Ways to reach us">
                        <MethodCard tone="red" icon={PhoneIcon} label="Call or WhatsApp" delay={0}>
                            <a href={d.phoneHref} className={`mt-2 text-xl font-bold text-ls-navy hover:text-ls-red-shade ${linkClass}`}>{d.phone}</a>
                            <a href={d.whatsappHref} target="_blank" rel="noopener noreferrer" className={`mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-ls-red-shade underline-offset-4 hover:underline ${linkClass}`}>
                                Chat on WhatsApp<ArrowRightIcon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
                            </a>
                        </MethodCard>
                        <MethodCard tone="blue" icon={EnvelopeIcon} label="Email" delay={90}>
                            <a href={`mailto:${contactEmail}`} className={`mt-2 text-lg font-bold text-ls-navy [overflow-wrap:anywhere] hover:text-ls-blue-mid ${linkClass}`}>{contactEmail}</a>
                            <p className="mt-auto pt-4 text-sm text-ls-muted">We respond within one working day.</p>
                        </MethodCard>
                        <MethodCard tone="teal" icon={MapPinIcon} label="Visit us" delay={180}>
                            <p className="mt-2 text-xl font-bold text-ls-navy">{d.place}</p>
                            <p className="text-ls-muted">{d.region}</p>
                            <a href={d.mapsHref} target="_blank" rel="noopener noreferrer" className={`mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-ls-teal underline-offset-4 hover:underline ${linkClass}`}>
                                Get directions<ArrowRightIcon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
                            </a>
                        </MethodCard>
                        <MethodCard tone="indigo" icon={ClockIcon} label="Opening hours" delay={270}>
                            {d.hours.map((h, i) => (
                                <p key={h} className={i === 0 ? 'mt-2 text-base font-bold text-ls-navy' : 'text-base font-bold text-ls-navy'}>{h}</p>
                            ))}
                        </MethodCard>
                    </ul>

                    <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-12 lg:items-start lg:gap-10">
                        <Reveal className="order-2 lg:sticky lg:top-28 lg:order-1 lg:col-span-4">
                            <aside className="relative isolate overflow-hidden rounded-md border-t-4 border-ls-red-bright bg-ls-navy p-7 text-white shadow-[0_22px_44px_-20px_rgba(20,33,61,0.75)] sm:p-8">
                                <Backdrop />
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ls-blue-soft">Response time</p>
                                <p className="mt-3 flex items-baseline gap-3">
                                    <span className="text-7xl font-bold leading-none tabular-nums text-white">1</span>
                                    <span className="text-2xl font-bold text-ls-blue-soft">working day</span>
                                </p>
                                <p className="mt-3 text-lg leading-snug text-white/85">A consultant will get back to you.</p>

                                <div className="my-7 h-px bg-white/15" aria-hidden="true" />

                                <h2 className="text-2xl font-bold tracking-tight text-white">{home.closing.title}</h2>
                                <p className="mt-3 leading-relaxed text-white/85">{home.closing.text}</p>
                                <div className="mt-6">
                                    <Button to={enquiryHref('health-check')} variant="light" arrow>{home.closing.button}</Button>
                                </div>
                            </aside>
                        </Reveal>

                        <Reveal delay={120} className="order-1 lg:order-2 lg:col-span-8">
                            <Card tone="blue" className="p-6 shadow-[0_22px_44px_-26px_rgba(20,33,61,0.45)] sm:p-10">
                                {/* key: switching between enquiry links re-seeds the form */}
                                <ContactForm key={params.get('topic') || 'none'} />
                            </Card>
                        </Reveal>
                    </div>
                </div>
            </section>

            <section className="bg-gradient-to-br from-ls-indigo-50 via-ls-paper to-ls-teal-50 py-20 lg:py-28">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading title={contact.faqsHeading} />
                    <Accordion items={contact.faqs} />
                </div>
            </section>
        </div>
    );
}

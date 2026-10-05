import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, CtaBand, PageHero, Reveal, SectionHeading } from '../../components/site/ui';
import { mainServices } from '../../components/site/siteContent';

// Training, HR Services and Corporate Finance share one layout; only the copy differs.
function ServicePage({ serviceKey, metaTitle, title, subtitle, intro, ctaTitle, ctaText, ctaLabel }) {
    usePageMeta(metaTitle, subtitle);
    const service = mainServices.find((s) => s.key === serviceKey);
    const others = mainServices.filter((s) => s.key !== serviceKey);

    return (
        <div>
            <PageHero eyebrow={service.title} title={title} subtitle={subtitle} crumb={service.title} />

            <section className="py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading eyebrow="What we offer" title={intro} />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {service.items.map((item, i) => (
                            <Reveal key={item.title} delay={(i % 3) * 90} className="h-full">
                                <div className="group relative h-full overflow-hidden rounded-2xl bg-white p-8 ring-1 ring-slate-900/10 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-site-ink/10">
                                    <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-sitegold to-sitegold-light transition-transform duration-500 group-hover:scale-x-100" aria-hidden="true" />
                                    <p className="font-sitehead text-4xl font-bold italic text-sitegold/70">{String(i + 1).padStart(2, '0')}</p>
                                    <h3 className="mt-4 font-sitehead text-xl font-bold text-site-deep">{item.title}</h3>
                                    {item.description && <p className="mt-3 leading-relaxed text-slate-600">{item.description}</p>}
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* The other two service lines */}
            <section className="bg-sitegray-light py-16 lg:py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="font-sitehead text-2xl font-bold text-site-deep">More ways we can help</h2>
                    <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                        {others.map((o) => (
                            <Link
                                key={o.key}
                                to={o.href}
                                className="group flex items-start gap-5 rounded-2xl bg-white p-6 ring-1 ring-slate-900/5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-site-ink/10"
                            >
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-site text-white">
                                    <o.icon className="h-6 w-6" aria-hidden="true" />
                                </span>
                                <span className="flex-1">
                                    <span className="block font-sitehead text-lg font-bold text-site-deep">{o.title}</span>
                                    <span className="mt-1 block text-sm leading-relaxed text-slate-600">{o.description}</span>
                                </span>
                                <ArrowRightIcon className="mt-1 h-5 w-5 shrink-0 text-site transition-transform group-hover:translate-x-1" aria-hidden="true" />
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <CtaBand title={ctaTitle} text={ctaText}>
                <Button to="/contact" variant="gold" size="lg" arrow>{ctaLabel}</Button>
            </CtaBand>
        </div>
    );
}

export function Training() {
    return (
        <ServicePage
            serviceKey="training"
            metaTitle="Training Services"
            title="Training that builds capable teams"
            subtitle="Comprehensive training programs designed to develop your team's skills and drive business success."
            intro="Programs for leaders, sales teams and everyone in between"
            ctaTitle="Ready to enhance your team's skills?"
            ctaText="Contact us to discuss your training needs and customize a program for your organization."
            ctaLabel="Get in touch"
        />
    );
}

export function HRServices() {
    return (
        <ServicePage
            serviceKey="hr"
            metaTitle="HR Services"
            title="HR foundations that help you hire and keep great people"
            subtitle="Complete HR solutions to attract, develop, and retain the right talent for your organization."
            intro="Everything from your first HR playbook to ESG consulting"
            ctaTitle="Transform your HR operations"
            ctaText="Let us help you build a strong HR foundation that supports your business growth."
            ctaLabel="Contact us"
        />
    );
}

export function CorporateFinance() {
    return (
        <ServicePage
            serviceKey="finance"
            metaTitle="Corporate Finance"
            title="Financial solutions that strengthen your profits"
            subtitle="Financial solutions to enhance your profits and optimize your business operations."
            intro="Funding, protection and cost savings for your business"
            ctaTitle="Optimize your financial operations"
            ctaText="Discover how our financial services can help reduce costs and improve profitability."
            ctaLabel="Get started"
        />
    );
}

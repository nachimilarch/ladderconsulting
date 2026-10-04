import usePageMeta from '../../components/site/usePageMeta';
import { Button, Card, PageHero } from '../../components/site/ui';
import { trainingServices, hrServices, financeServices } from '../../components/site/siteContent';

// Training, HR Services and Corporate Finance are the same layout with different copy.
function ServicePage({ metaTitle, title, subtitle, items, ctaTitle, ctaText, ctaLabel }) {
    usePageMeta(metaTitle, subtitle);

    return (
        <div>
            <PageHero title={title} subtitle={subtitle} />

            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {items.map((s) => (
                            <Card key={s.title} className="h-full">
                                <h3 className="text-xl font-sitehead font-bold text-site mb-3">{s.title}</h3>
                                {s.description && <p className="text-sitegray-dark">{s.description}</p>}
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-16 bg-sitegray-light">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-sitehead font-bold text-site mb-6">{ctaTitle}</h2>
                    <p className="text-lg text-sitegray-dark mb-8 max-w-2xl mx-auto">{ctaText}</p>
                    <Button to="/contact" size="lg">{ctaLabel}</Button>
                </div>
            </section>
        </div>
    );
}

export function Training() {
    return (
        <ServicePage
            metaTitle="Training Services"
            title="Training Services"
            subtitle="Comprehensive training programs designed to develop your team's skills and drive business success"
            items={trainingServices}
            ctaTitle="Ready to Enhance Your Team's Skills?"
            ctaText="Contact us to discuss your training needs and customize a program for your organization."
            ctaLabel="Get in Touch"
        />
    );
}

export function HRServices() {
    return (
        <ServicePage
            metaTitle="HR Services"
            title="HR Services"
            subtitle="Complete HR solutions to attract, develop, and retain the right talent for your organization"
            items={hrServices}
            ctaTitle="Transform Your HR Operations"
            ctaText="Let us help you build a strong HR foundation that supports your business growth."
            ctaLabel="Contact Us"
        />
    );
}

export function CorporateFinance() {
    return (
        <ServicePage
            metaTitle="Corporate Finance"
            title="Corporate Finance Services"
            subtitle="Financial solutions to enhance your profits and optimize your business operations"
            items={financeServices}
            ctaTitle="Optimize Your Financial Operations"
            ctaText="Discover how our financial services can help reduce costs and improve profitability."
            ctaLabel="Get Started"
        />
    );
}

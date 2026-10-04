import ContactForm from '../../components/site/ContactForm';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, Card, PageHero, SectionHeading } from '../../components/site/ui';
import { portalAccess } from '../../components/site/siteContent';

export default function Contact() {
    usePageMeta('Contact Us', 'Get in touch with LadderStep Human Consulting to discuss how we can help your business grow.');

    return (
        <div>
            <PageHero title="Contact Us" subtitle="Get in touch with us to discuss how we can help your business grow" />

            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl mx-auto">
                        <SectionHeading title="Send Us a Message" subtitle="Fill out the form below and we'll get back to you as soon as possible" />
                        <ContactForm />
                    </div>
                </div>
            </section>

            <section className="py-16 bg-sitegray-light">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading title="Client Portal Access" subtitle="Access your personalized dashboard and services" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                        {portalAccess.map((p) => (
                            <Card key={p.title} className="text-center">
                                <h3 className="text-xl font-sitehead font-bold text-site mb-3">{p.title}</h3>
                                <p className="text-sitegray-dark mb-6">{p.description}</p>
                                <div className="flex gap-3">
                                    <Button to={p.login} className="flex-1">Login</Button>
                                    <Button to={p.register} variant="outline" className="flex-1">Register</Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Hero from '../../components/site/Hero';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, Card, SectionHeading } from '../../components/site/ui';
import { mainServices, companyInfo } from '../../components/site/siteContent';

export default function Home() {
    const { user } = useAuth();
    usePageMeta(null, companyInfo.description);

    // Signed-in people used to land on their dashboard from "/", so keep that.
    if (user) return <Navigate to="/dashboard" replace />;

    return (
        <div>
            <Hero />

            <section className="py-16 bg-sitegray-light">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-3xl md:text-4xl font-sitehead font-bold text-site mb-6">About LadderStep</h2>
                        <p className="text-lg text-sitegray-dark mb-8">{companyInfo.description}</p>
                        <p className="text-lg text-sitegray-dark mb-8">
                            We cater to the 2 pillars of scaling up your business: <strong>People &amp; Profits</strong>
                        </p>
                        <Button to="/about">Learn More About Us</Button>
                    </div>
                </div>
            </section>

            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading title="Our Services" subtitle="Comprehensive solutions to help your business scale and succeed" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {mainServices.map((s) => (
                            <Card key={s.href} to={s.href} className="h-full flex flex-col">
                                <h3 className="text-xl font-sitehead font-bold text-site mb-3">{s.title}</h3>
                                <p className="text-sitegray-dark mb-4 flex-grow">{s.description}</p>
                                <span className="inline-flex items-center justify-center font-sitehead font-semibold rounded-lg border-2 border-site text-site px-4 py-2 text-sm mt-auto">
                                    Learn More
                                </span>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-16 bg-site text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-sitehead font-bold mb-6 text-white">Ready to Scale Your Business?</h2>
                    <p className="text-xl text-gray-100 mb-8 max-w-2xl mx-auto">
                        Let's work together to empower your business with better talent and better profits.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button to="/contact" variant="outline" size="lg" className="bg-white text-site hover:bg-gray-100">Contact Us</Button>
                        <Button to="/about" variant="outline" size="lg" className="border-white text-white hover:bg-white/10">Learn More</Button>
                    </div>
                </div>
            </section>
        </div>
    );
}

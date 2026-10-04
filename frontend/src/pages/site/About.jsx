import usePageMeta from '../../components/site/usePageMeta';
import { Card, PageHero, SectionHeading } from '../../components/site/ui';
import { companyInfo, twoPillars, coreValues } from '../../components/site/siteContent';

export default function About() {
    usePageMeta('About Us', companyInfo.description);

    return (
        <div>
            <PageHero title="About LadderStep" subtitle={companyInfo.description} />

            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading title="Our Two Pillars" subtitle="We focus on the essential elements that drive business growth" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[twoPillars.people, twoPillars.profits].map((p) => (
                            <Card key={p.title} className="border-l-4 border-site">
                                <h3 className="text-2xl font-sitehead font-bold text-site mb-4">{p.title}</h3>
                                <p className="text-sitegray-dark">{p.description}</p>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-16 bg-sitegray-light">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-3xl md:text-4xl font-sitehead font-bold text-site mb-6">Our Vision</h2>
                        <p className="text-xl text-sitegray-dark leading-relaxed">{companyInfo.vision}</p>
                    </div>
                </div>
            </section>

            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading title="Our Core Values" subtitle="The principles that guide everything we do" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {coreValues.map((v) => (
                            <div key={v.title} className="bg-sitegray-light p-6 rounded-lg border-l-4 border-site">
                                <h4 className="text-xl font-sitehead font-bold text-site mb-2">{v.title}</h4>
                                <p className="text-sitegray-dark">{v.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}

import usePageMeta from '../../components/site/usePageMeta';
import { Button, CtaBand, PageHero, Reveal, SectionHeading } from '../../components/site/ui';
import { IndustryExplorer } from '../../components/site/interactive';
import { enquiryHref, whoWeWorkWith as w } from '../../components/site/siteContent';
import { TONES } from '../../components/site/tones';

export default function WhoWeWorkWith() {
    usePageMeta(w.meta.title, w.meta.description);

    return (
        <div>
            <PageHero title={w.headline} crumbs={[{ label: 'Who We Work With' }]} />

            <section className="bg-gradient-to-b from-white to-ls-blue-50 py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-6 md:grid-cols-2">
                    {w.segments.map((s, i) => {
                        // A pale blue card beside a bold navy one.
                        const navy = i % 2 === 1;
                        const t = TONES.blue;
                        return (
                            <Reveal key={s.title} delay={i * 120} className="h-full">
                                <div className={`group relative h-full overflow-hidden rounded-md border border-t-[5px] p-8 transition-all duration-300 hover:-translate-y-1 sm:p-10 ${navy
                                    ? 'border-ls-navy border-t-ls-red bg-ls-navy text-white shadow-[0_22px_44px_-20px_rgba(20,33,61,0.75)] hover:bg-ls-blue'
                                    : `${t.tint} ${t.tintBorder} ${t.top} ${t.glow} ${t.hoverFill}`}`}>
                                    <span className={`absolute -right-3 -top-6 select-none text-9xl font-bold tabular-nums transition-colors duration-300 ${navy ? 'text-white/10' : `${t.ghostOnTint} group-hover:text-white/15`}`} aria-hidden="true">{i + 1}</span>
                                    <h2 className={`relative text-3xl font-bold tracking-tight ${navy ? 'text-white' : 'text-ls-navy group-hover:text-white'}`}>{s.title}</h2>
                                    <p className={`relative mt-4 text-lg leading-relaxed ${navy ? 'text-white/90' : 'text-ls-muted group-hover:text-white'}`}>{s.text}</p>
                                </div>
                            </Reveal>
                        );
                    })}
                </div>
            </section>

            <section className="bg-gradient-to-br from-ls-teal-50 via-ls-paper to-ls-indigo-50 py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading title={w.industriesHeading} />
                    <IndustryExplorer industries={w.industries} />
                </div>
            </section>

            <CtaBand title={w.cta.title}>
                <Button to={enquiryHref(w.cta.topic)} size="lg" arrow>{w.cta.button}</Button>
            </CtaBand>
        </div>
    );
}

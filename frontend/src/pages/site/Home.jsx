import { Navigate } from 'react-router-dom';
import { CheckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import Hero from '../../components/site/Hero';
import { HatChips, Marquee, PillarExplorer } from '../../components/site/interactive';
import usePageMeta from '../../components/site/usePageMeta';
import { Button, CtaBand, Reveal, SectionHeading, StepBar, Testimonials } from '../../components/site/ui';
import { enquiryHref, home } from '../../components/site/siteContent';
import { TONES } from '../../components/site/tones';

// The five "Why LadderStep" tiles: a bold navy feature tile first, then one pillar colour each.
const WHY_TILES = [
    { tone: TONES.blue, navy: true },
    { tone: TONES.blue },
    { tone: TONES.teal },
    { tone: TONES.indigo },
    { tone: TONES.red },
];

export default function Home() {
    const { user } = useAuth();
    usePageMeta(home.meta.title, home.meta.description);

    // Signed-in people used to land on their dashboard from "/", so keep that.
    if (user) return <Navigate to="/dashboard" replace />;

    const { intro, why, closing, testimonials, results } = home;

    return (
        <div>
            <Hero />

            {/* Intro: the hats, floating round the mark */}
            <section className="bg-gradient-to-b from-white via-white to-ls-blue-50 pt-16 pb-20 lg:pt-20 lg:pb-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
                    <Reveal className="lg:col-span-6">
                        <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.1] text-balance text-ls-navy">
                            {intro.heading}
                        </h2>
                        <StepBar className="mt-5" />
                        {intro.paragraphs.map((t) => (
                            <p key={t} className="mt-6 text-lg leading-relaxed text-ls-muted">{t}</p>
                        ))}
                    </Reveal>
                    <Reveal delay={120} className="lg:col-span-6">
                        <HatChips />
                    </Reveal>
                </div>
            </section>

            <Marquee />

            {/* The 4 Pillars */}
            <section id="pillars" className="scroll-mt-24 bg-gradient-to-br from-ls-blue-50 via-ls-paper to-ls-indigo-50 py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading title={home.pillarsHeading.title} subtitle={home.pillarsHeading.sub} />
                    <PillarExplorer />
                </div>
            </section>

            {/* Why LadderStep */}
            <section className="relative bg-white py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionHeading title={why.heading} />
                    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
                        {why.items.map((it, i) => {
                            const { tone: t, navy } = WHY_TILES[i % WHY_TILES.length];
                            return (
                                <li key={it.title} className={i < 2 ? 'lg:col-span-3' : 'lg:col-span-2'}>
                                    <Reveal delay={i * 90} className="h-full">
                                        <div className={`group relative h-full overflow-hidden rounded-md border border-t-[4px] p-7 transition-all duration-300 hover:-translate-y-1 ${navy
                                            ? `bg-ls-navy ${t.topBright} border-ls-navy text-white shadow-[0_18px_36px_-18px_rgba(20,33,61,0.7)] hover:bg-ls-blue hover:border-ls-blue`
                                            : `${t.tint} ${t.top} ${t.tintBorder} ${t.glow} ${t.hoverFill}`}`}>
                                            <span className={`absolute -right-3 -top-5 select-none text-8xl font-bold tabular-nums transition-colors duration-300 ${navy ? 'text-white/10' : `${t.ghostOnTint} group-hover:text-white/15`}`} aria-hidden="true">{i + 1}</span>
                                            <span className={`relative grid h-10 w-10 place-items-center rounded-full ${navy ? 'bg-ls-blue-bright text-ls-navy' : `${t.solid} text-white group-hover:bg-white ${t.groupHoverText}`}`}>
                                                <CheckIcon className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
                                            </span>
                                            <h3 className={`relative mt-4 text-xl font-bold ${navy ? 'text-white' : 'text-ls-navy group-hover:text-white'}`}>{it.title}</h3>
                                            <p className={`relative mt-2 text-lg leading-relaxed ${navy ? 'text-white/85' : 'text-ls-muted group-hover:text-white'}`}>{it.text}</p>
                                        </div>
                                    </Reveal>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </section>

            {/* Client quotes */}
            {testimonials.length > 0 && (
                <section className="bg-ls-paper py-20 lg:py-28">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <SectionHeading title="Testimonials" />
                        <Testimonials items={testimonials} />
                    </div>
                </section>
            )}

            {/* Results strip */}
            {results.length > 0 && (
                <section aria-label="Results" className="bg-white">
                    <dl className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 px-4 py-12 sm:px-6 lg:px-8">
                        {results.map((r) => (
                            <div key={r.label} className="px-4 py-4">
                                <dd className="text-4xl font-bold text-ls-navy">{r.value}</dd>
                                <dt className="mt-1 text-sm text-ls-muted">{r.label}</dt>
                            </div>
                        ))}
                    </dl>
                </section>
            )}

            <CtaBand title={closing.title} text={closing.text}>
                <Button to={enquiryHref('health-check')} size="lg" arrow>{closing.button}</Button>
            </CtaBand>
        </div>
    );
}

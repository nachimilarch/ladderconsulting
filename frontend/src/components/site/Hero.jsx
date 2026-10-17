import { Button, Eyebrow, StepEdge } from './ui';
import { Backdrop, HeroScene } from './graphics';
import { enquiryHref, home } from './siteContent';

// Navy opening: the headline on the left, the four pillars as a staircase on the right. The plane climbs it,
// and moves to whichever step you point at.
// The closing phrase of the headline gets a highlighter stroke (the words themselves are untouched).
const HIGHLIGHT = 'step at a time';
function Headline({ text }) {
    const at = text.indexOf(HIGHLIGHT);
    if (at < 0) return text;
    return (
        <>
            {text.slice(0, at)}
            <span className="whitespace-nowrap bg-gradient-to-r from-ls-red-bright to-ls-red-bright bg-[length:100%_0.16em] bg-[position:0_92%] bg-no-repeat">{HIGHLIGHT}</span>
            {text.slice(at + HIGHLIGHT.length)}
        </>
    );
}

export default function Hero() {
    const { hero } = home;
    return (
        <section className="relative isolate overflow-hidden bg-ls-navy text-white">
            <Backdrop />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-28 sm:pb-32 lg:pt-20 lg:pb-40 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-6">
                    <Eyebrow tone="dark" className="mb-6 motion-safe:animate-ls-fade-up">{hero.eyebrow}</Eyebrow>
                    <h1 className="font-bold tracking-tight leading-[1.04] text-balance text-4xl sm:text-6xl text-white motion-safe:animate-ls-fade-up [animation-delay:80ms]">
                        <Headline text={hero.headline} />
                    </h1>
                    <p className="mt-7 max-w-2xl text-lg sm:text-xl leading-relaxed text-white/80 motion-safe:animate-ls-fade-up [animation-delay:180ms]">{hero.sub}</p>
                    <div className="mt-10 flex flex-col sm:flex-row gap-3 motion-safe:animate-ls-fade-up [animation-delay:280ms]">
                        <Button to={enquiryHref(hero.primary.topic)} size="lg" arrow>{hero.primary.label}</Button>
                        <Button href={hero.secondary.href} variant="light" size="lg">{hero.secondary.label}</Button>
                    </div>
                </div>
                <div className="lg:col-span-6">
                    <HeroScene />
                </div>
            </div>
            <StepEdge />
        </section>
    );
}

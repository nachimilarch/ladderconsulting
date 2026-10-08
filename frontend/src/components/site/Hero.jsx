import { Button, Eyebrow, StepEdge } from './ui';
import { MarkShapes } from './Brand';
import { companyInfo } from './siteContent';

// The take-off mark, large and on navy: the steps build, the plane lifts off,
// and a dashed path shows the climb continuing up and to the right.
function HeroMark() {
    return (
        <svg viewBox="-6 -22 132 116" className="h-auto w-full" aria-hidden="true" focusable="false">
            <path d="M93 11 L124 -18" stroke="#4C7BFF" strokeWidth="0.9" strokeDasharray="0.5 3.2" strokeLinecap="round" fill="none" />
            <path d="M14 56 C 24 50, 32 50, 41 50" stroke="#9DB6FF" strokeOpacity="0.5" strokeWidth="0.9" strokeDasharray="0.5 3.2" strokeLinecap="round" fill="none" />
            <MarkShapes tone="dark" animate />
        </svg>
    );
}

export default function Hero() {
    return (
        <section className="relative isolate overflow-hidden bg-ls-navy text-white">
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-28 sm:pb-32 lg:pt-24 lg:pb-40 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7">
                    <Eyebrow tone="dark" className="mb-6">Business consulting for growing businesses</Eyebrow>
                    <h1 className="font-bold tracking-tight leading-[1.02] text-balance text-[2.75rem] sm:text-6xl xl:text-7xl text-white">
                        {companyInfo.headline}
                    </h1>
                    <p className="mt-5 text-sm sm:text-base font-semibold uppercase tracking-[0.18em] text-ls-blue-soft">
                        {companyInfo.tagline}
                    </p>
                    <p className="mt-7 max-w-xl text-lg sm:text-xl leading-relaxed text-white/80">
                        Ladderstep helps Small &amp; Medium Businesses plan the climb, build capable teams, secure the capital to grow,
                        and put systems in place so growth lasts.
                    </p>
                    <div className="mt-10 flex flex-col sm:flex-row gap-3">
                        <Button to="/contact" size="lg" arrow>Book a strategy call</Button>
                        <Button href="#pillars" variant="light" size="lg">Explore our services</Button>
                    </div>
                </div>
                <div className="hidden lg:block lg:col-span-5">
                    <div className="mx-auto max-w-md">
                        <HeroMark />
                    </div>
                </div>
            </div>
            <StepEdge />
        </section>
    );
}

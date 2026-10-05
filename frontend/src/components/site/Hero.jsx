import { DarkBackdrop, Button, Eyebrow } from './ui';
import HeroArt from './HeroArt';
import { heroPillars } from './siteContent';

export default function Hero() {
    return (
        <section className="relative isolate overflow-hidden text-white">
            <DarkBackdrop />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-36 lg:pt-24 lg:pb-48 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7">
                    <Eyebrow tone="dark" className="mb-6">Business consulting for SMBs</Eyebrow>
                    <h1 className="font-sitehead font-bold tracking-tight leading-[1.05] text-[2.6rem] sm:text-6xl xl:text-[4.5rem] text-white">
                        Better talent.
                        <span className="block italic font-semibold text-sitegold-light">Better profits.</span>
                    </h1>
                    <p className="mt-7 max-w-xl text-lg sm:text-xl leading-relaxed text-slate-200">
                        LadderStep helps Small &amp; Medium Businesses attract, train and retain the right people, and grow profits
                        through easier funding, lower risk and smarter spending.
                    </p>
                    <div className="mt-10 flex flex-col sm:flex-row gap-3">
                        <Button to="/contact" variant="gold" size="lg" arrow>Talk to our team</Button>
                        <Button href="#services" variant="light" size="lg">Explore services</Button>
                    </div>
                    <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-slate-300">
                        {heroPillars.map((p) => (
                            <li key={p} className="flex items-center gap-2.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-sitegold" aria-hidden="true" />
                                {p}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="hidden lg:block lg:col-span-5">
                    <HeroArt />
                </div>
            </div>
        </section>
    );
}

import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { Reveal } from './ui';
import { Plane } from './Brand';
import { pillars, pillarHref } from './siteContent';

// The signature component: Strategize, Enable, Secure and Scale as four cards that step upward
// from left to right, like the stepped base of the logo. Scale carries the red accent and the plane.
const HEIGHTS = ['lg:min-h-[19rem]', 'lg:min-h-[22rem]', 'lg:min-h-[25rem]', 'lg:min-h-[28rem]'];

export default function PillarSteps({ headingLevel = 'h3' }) {
    const Heading = headingLevel;
    return (
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            {pillars.map((p, i) => {
                const last = i === pillars.length - 1;
                return (
                    <li key={p.slug} className="h-full lg:h-auto">
                        <Reveal delay={i * 120} className="h-full">
                            <Link
                                to={pillarHref(p)}
                                className={`group relative flex h-full flex-col rounded-md border border-ls-line border-t-[3px] bg-white p-7 transition-colors duration-300 hover:border-ls-navy/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-blue ${last ? 'border-t-ls-red' : 'border-t-ls-blue'} ${HEIGHTS[i]}`}
                            >
                                <div className="flex items-start justify-between">
                                    <span className="text-sm font-semibold tabular-nums tracking-[0.2em] text-ls-blue">0{p.step}</span>
                                    {last
                                        ? <Plane className="h-9 w-auto -mt-1 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1" />
                                        : <p.icon className="h-7 w-7 text-ls-blue" strokeWidth={1.5} aria-hidden="true" />}
                                </div>
                                <Heading className="mt-8 text-[1.75rem] font-bold tracking-tight text-ls-navy">{p.word}</Heading>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-ls-blue">{p.name}</p>
                                <p className="mt-4 leading-relaxed text-ls-muted">{p.promise}</p>
                                <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-semibold text-ls-navy">
                                    <span className="underline decoration-ls-line decoration-2 underline-offset-[6px] transition-colors group-hover:decoration-ls-blue">Explore {p.word}</span>
                                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.25} aria-hidden="true" />
                                </span>
                            </Link>
                        </Reveal>
                    </li>
                );
            })}
        </ol>
    );
}

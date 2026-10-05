import { UserGroupIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { twoPillars } from './siteContent';

// Four rising towers with upward arrows and a swoosh: the LadderStep mark, redrawn as a hero illustration.
const BASE = 440;
const TOWERS = [
    { x: 78, h: 150 },
    { x: 178, h: 225 },
    { x: 278, h: 305 },
    { x: 378, h: 395 },
];

function GlassCard({ icon: Icon, title, tagline, className }) {
    return (
        <div className={`absolute flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-white shadow-2xl shadow-black/30 ring-1 ring-white/20 backdrop-blur-md ${className}`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sitegold/90 text-site-ink">
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
                <span className="block font-sitehead text-base font-bold leading-tight">{title}</span>
                <span className="block text-xs text-slate-200">{tagline}</span>
            </span>
        </div>
    );
}

export default function HeroArt() {
    return (
        <div className="relative mx-auto aspect-[560/520] w-full max-w-[34rem]" aria-hidden="true">
            <svg viewBox="0 0 560 520" className="absolute inset-0 h-full w-full" focusable="false">
                <defs>
                    <linearGradient id="hero-steel" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#F1F3F6" />
                        <stop offset="1" stopColor="#A4ABB3" />
                    </linearGradient>
                    <linearGradient id="hero-navy" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#2F78BD" />
                        <stop offset="1" stopColor="#0E3A63" />
                    </linearGradient>
                    <linearGradient id="hero-swoosh" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0" stopColor="#C6A15B" stopOpacity="0" />
                        <stop offset="0.5" stopColor="#E6D3A3" />
                        <stop offset="1" stopColor="#C6A15B" />
                    </linearGradient>
                    <radialGradient id="hero-glow" cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0" stopColor="#3E86C9" stopOpacity="0.5" />
                        <stop offset="1" stopColor="#3E86C9" stopOpacity="0" />
                    </radialGradient>
                    <filter id="hero-blur" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="9" />
                    </filter>
                </defs>

                <circle cx="290" cy="250" r="262" fill="url(#hero-glow)" />
                <circle cx="290" cy="250" r="214" fill="none" stroke="#fff" strokeOpacity="0.12" strokeDasharray="2 9" strokeLinecap="round" />

                <ellipse cx="290" cy="452" rx="250" ry="16" fill="#000" opacity="0.35" filter="url(#hero-blur)" />

                {TOWERS.map(({ x, h }, i) => {
                    const top = BASE - h;
                    const arrows = h > 260 ? [top + 62, top + 150] : [top + 56];
                    return (
                        <g key={x}>
                            <rect x={x} y={top} width="40" height={h} rx="2" fill="url(#hero-steel)" />
                            <rect x={x + 40} y={top} width="28" height={h} rx="2" fill="url(#hero-navy)" />
                            <path d={`M${x} ${top} l12 -9 h56 l-12 9 z`} fill="#fff" opacity="0.28" />
                            {arrows.map((ay) => (
                                <g key={ay}>
                                    <rect x={x + 38.5} y={ay} width="3" height="40" fill="#fff" opacity="0.95" />
                                    <path d={`M${x + 40} ${ay - 14} l-11 18 h22 z`} fill="#fff" />
                                </g>
                            ))}
                            {i === TOWERS.length - 1 && (
                                <circle cx={x + 34} cy={top - 26} r="5" fill="#E6D3A3" className="animate-site-shine" />
                            )}
                        </g>
                    );
                })}

                <path d="M40 410 C130 500 400 520 530 300" fill="none" stroke="url(#hero-swoosh)" strokeWidth="10" strokeLinecap="round" />
                <path d="M40 410 C130 500 400 520 530 300" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" strokeLinecap="round" transform="translate(0 -6)" />
            </svg>

            <GlassCard
                icon={UserGroupIcon}
                title={twoPillars.people.title}
                tagline={twoPillars.people.tagline}
                className="left-0 top-[8%] animate-site-float"
            />
            <GlassCard
                icon={BanknotesIcon}
                title={twoPillars.profits.title}
                tagline={twoPillars.profits.tagline}
                className="bottom-[10%] right-0 animate-site-float-slow"
            />
        </div>
    );
}

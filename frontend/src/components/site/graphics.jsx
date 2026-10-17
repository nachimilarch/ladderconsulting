import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrefersReducedMotion, useInView, usePointerParallax } from './motion';
import { pillars, pillarHref } from './siteContent';
import { STAIR_FILL } from './tones';

// Brand graphics for the marketing site. Flat shapes in the brand palette, no gradients on the logo shapes.
// Everything that moves is skipped when the visitor prefers reduced motion.

const C = {
    navy: '#14213D', navy700: '#1B2B4D', blue: '#1D3A8A', blueBright: '#4C7BFF', blueSoft: '#9DB6FF',
    red: '#E63946', redBright: '#FF3B5C', fold: '#C42A44', white: '#FFFFFF',
};

// The brand's paper plane, drawn around its own centre so it can be moved and rotated freely.
function PlaneShape({ dark = C.fold, mid = C.redBright, light = '#FF6F86' }) {
    return (
        <g transform="translate(-66 -45)">
            <polygon points="42,50 90,14 58,58" fill={dark} />
            <polygon points="90,14 58,58 63,67" fill={mid} />
            <polygon points="90,14 63,67 68,76" fill={light} />
        </g>
    );
}

// A dotted-grid backdrop that fades out toward the edges, for navy sections.
// `glow` is the colour of the soft light behind the top right; a smaller red glow sits bottom left.
export function Backdrop({ className = '', glow = C.blueBright, glow2 = C.redBright }) {
    const id = useId().replace(/:/g, '');
    return (
        <svg className={`pointer-events-none absolute inset-0 -z-10 h-full w-full ${className}`} aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id={`glow-${id}`} cx="82%" cy="12%" r="62%">
                    <stop offset="0" stopColor={glow} stopOpacity="0.34" />
                    <stop offset="1" stopColor={glow} stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`glow2-${id}`} cx="2%" cy="100%" r="46%">
                    <stop offset="0" stopColor={glow2} stopOpacity="0.16" />
                    <stop offset="1" stopColor={glow2} stopOpacity="0" />
                </radialGradient>
                <pattern id={`dots-${id}`} width="28" height="28" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.4" fill="#9DB6FF" fillOpacity="0.22" />
                </pattern>
                <radialGradient id={`fade-${id}`} cx="72%" cy="40%" r="75%">
                    <stop offset="0" stopColor="#fff" stopOpacity="1" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <mask id={`mask-${id}`}><rect width="100%" height="100%" fill={`url(#fade-${id})`} /></mask>
            </defs>
            <rect width="100%" height="100%" fill={`url(#glow-${id})`} />
            <rect width="100%" height="100%" fill={`url(#glow2-${id})`} />
            <rect width="100%" height="100%" fill={`url(#dots-${id})`} mask={`url(#mask-${id})`} />
        </svg>
    );
}

// A plane that flies along a curve and loops. Static at the end of the path when motion is reduced.
export function FlyingPlane({ path, end, dur = 5.5, scale = 0.8, className = '', viewBox = '0 0 600 300' }) {
    const reduced = usePrefersReducedMotion();
    return (
        <svg className={className} viewBox={viewBox} preserveAspectRatio="xMaxYMid meet" fill="none" aria-hidden="true" focusable="false">
            <path d={path} stroke={C.blueBright} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" className={reduced ? undefined : 'animate-ls-dash'} />
            {reduced ? (
                <g transform={`translate(${end[0]} ${end[1]}) scale(${scale})`}><PlaneShape /></g>
            ) : (
                <g>
                    <g transform={`scale(${scale})`}><PlaneShape /></g>
                    <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.2 1" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.85;1" dur={`${dur}s`} repeatCount="indefinite" />
                </g>
            )}
        </svg>
    );
}

// ── Home hero: a staircase of the four pillars with the plane hopping up it ─────────────────────
const STEP_FILL = STAIR_FILL;
const STEP_TEXT = [C.navy, C.navy, C.navy, C.navy];
const STEP_X = (i) => 28 + i * 126;
const STEP_H = [96, 156, 216, 276];
const BASE = 424;

export function HeroScene() {
    const reduced = usePrefersReducedMotion();
    const [active, setActive] = useState(reduced ? 3 : -1);
    const [touched, setTouched] = useState(false);
    const [wrap, p] = usePointerParallax();

    // On load the plane climbs the steps one by one, then rests on the top step until someone points at another.
    useEffect(() => {
        if (reduced || touched) return undefined;
        const timers = [0, 1, 2, 3].map((i) => setTimeout(() => setActive(i), 900 + i * 750));
        return () => timers.forEach(clearTimeout);
    }, [reduced, touched]);

    const point = (i) => { setTouched(true); setActive(i); };
    const cur = active < 0 ? 0 : active;
    const px = STEP_X(cur) + 63;
    const py = BASE - STEP_H[cur] - 46;
    const par = (k) => ({ transform: `translate(${p.x * k}px, ${p.y * k * 0.7}px)`, transition: 'transform 0.25s ease-out' });

    return (
        <div ref={wrap} className="relative mx-auto w-full max-w-[34rem]">
            <svg viewBox="0 0 560 470" className="h-auto w-full overflow-visible" role="group" aria-label="The 4 Pillars">
                {/* drifting dots */}
                <g style={par(-10)}>
                    {[[60, 70, 5], [470, 60, 4], [510, 190, 3], [30, 200, 3]].map(([x, y, r], i) => (
                        <circle key={i} cx={x} cy={y} r={r} fill={STAIR_FILL[i]} fillOpacity="0.5" className="motion-safe:animate-ls-float" style={{ animationDelay: `${i * 0.7}s`, animationDuration: `${4 + i}s` }} />
                    ))}
                </g>

                {/* the dashed climb */}
                <path
                    d={`M${STEP_X(0) + 63} ${BASE - STEP_H[0] - 46} L${STEP_X(1) + 63} ${BASE - STEP_H[1] - 46} L${STEP_X(2) + 63} ${BASE - STEP_H[2] - 46} L${STEP_X(3) + 63} ${BASE - STEP_H[3] - 46}`}
                    stroke={C.white} strokeOpacity="0.45" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" fill="none"
                    className="motion-safe:animate-ls-dash"
                />

                <g style={par(6)}>
                    {pillars.map((pl, i) => {
                        const h = STEP_H[i];
                        const lifted = active === i;
                        return (
                            <g key={pl.slug} className="motion-safe:animate-ls-pop" style={{ animationDelay: `${i * 0.12}s`, transformBox: 'fill-box', transformOrigin: 'bottom' }}>
                                <Link
                                    to={pillarHref(pl)}
                                    aria-label={`${pl.step}. ${pl.word}: ${pl.lead}`}
                                    onMouseEnter={() => point(i)}
                                    onFocus={() => point(i)}
                                    className="outline-none"
                                >
                                    <g style={{ transform: `translateY(${lifted ? -12 : 0}px)`, transition: 'transform 0.35s cubic-bezier(0.2,0.8,0.2,1), filter 0.35s', filter: lifted ? `drop-shadow(0 12px 18px rgba(0,0,0,0.4)) drop-shadow(0 0 14px ${STEP_FILL[i]}99)` : 'none' }}>
                                        <rect x={STEP_X(i)} y={BASE - h} width="126" height={h} fill={STEP_FILL[i]} stroke={C.navy} strokeWidth="2" />
                                        <text x={STEP_X(i) + 16} y={BASE - h + 34} fontSize="15" fontWeight="700" fill={STEP_TEXT[i]} letterSpacing="2">{`0${pl.step}`}</text>
                                        <text x={STEP_X(i) + 16} y={BASE - h + 62} fontSize="19" fontWeight="700" fill={STEP_TEXT[i]}>{pl.word}</text>
                                        {lifted && <rect x={STEP_X(i)} y={BASE - h} width="126" height="6" fill={C.white} />}
                                    </g>
                                </Link>
                            </g>
                        );
                    })}
                </g>

                {/* the plane rests on whichever step is in focus */}
                <g style={par(14)}>
                    <g style={{ transform: `translate(${px}px, ${py}px)`, transition: reduced ? 'none' : 'transform 0.7s cubic-bezier(0.3,0.8,0.2,1)' }}>
                        <g className="motion-safe:animate-ls-float" style={{ animationDuration: '3.2s' }}>
                            <g transform="scale(1.05) rotate(-6)"><PlaneShape /></g>
                        </g>
                    </g>
                </g>
            </svg>
            {/* what the plane is resting on */}
            <p className="mt-2 min-h-[3.25rem] text-center text-lg font-semibold text-white" aria-live="polite">
                <span key={cur} className="inline-block motion-safe:animate-ls-fade-up">{pillars[cur].lead}</span>
            </p>
        </div>
    );
}

// ── One illustration per pillar. Same viewBox for all four so they can swap in place. ──────────
const TEAL = { bright: '#35C5D6', soft: '#9BE3EC' };
const INDIGO = { bright: '#8E84FF', soft: '#C2BBFF' };
const ringStyle = { transformBox: 'fill-box', transformOrigin: 'center' };

function StrategyArt() {
    return (
        <>
            {[118, 84, 50].map((r, i) => (
                <circle key={r} cx="236" cy="156" r={r} stroke={C.blueSoft} strokeOpacity={0.55 - i * 0.1} strokeWidth="2" className="motion-safe:animate-ls-pop" style={{ ...ringStyle, animationDelay: `${i * 0.15}s` }} />
            ))}
            <circle cx="236" cy="156" r="18" fill={C.blueBright} />
            <circle cx="236" cy="156" r="18" stroke={C.blueBright} strokeWidth="2" className="motion-safe:animate-ls-ring" style={ringStyle} />
            <path d="M34 268 C 96 190, 150 262, 224 166" stroke={C.blueBright} strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" className="motion-safe:animate-ls-dash" />
            <circle cx="34" cy="268" r="8" fill={C.white} />
            {[[330, 92], [150, 112], [300, 238]].map(([x, y], i) => (
                <g key={i} className="motion-safe:animate-ls-float" style={{ animationDelay: `${i * 0.6}s` }}>
                    <circle cx={x} cy={y} r="7" fill={C.blueSoft} />
                    <circle cx={x} cy={y} r="3" fill={C.navy} />
                </g>
            ))}
            <g transform="translate(262 128) scale(0.55) rotate(8)"><g className="motion-safe:animate-ls-float"><PlaneShape /></g></g>
        </>
    );
}

function Person({ x, y, r = 22, fill = C.navy700, stroke = TEAL.soft }) {
    return (
        <g>
            <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth="2" />
            <circle cx={x} cy={y - r * 0.2} r={r * 0.28} fill={C.white} />
            <path d={`M${x - r * 0.55} ${y + r * 0.62} C ${x - r * 0.5} ${y + r * 0.18}, ${x + r * 0.5} ${y + r * 0.18}, ${x + r * 0.55} ${y + r * 0.62}`} fill={C.white} />
        </g>
    );
}

function TalentArt() {
    const orbit = Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return [236 + Math.cos(a) * 112, 156 + Math.sin(a) * 112];
    });
    return (
        <>
            <circle cx="236" cy="156" r="112" stroke={TEAL.soft} strokeOpacity="0.55" strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" className="motion-safe:animate-ls-dash" />
            <g className="motion-safe:animate-ls-orbit" style={{ transformOrigin: '236px 156px', animationDuration: '30s' }}>
                {orbit.map(([x, y], i) => (
                    <line key={`l${i}`} x1={x} y1={y} x2="236" y2="156" stroke={TEAL.bright} strokeOpacity="0.55" strokeWidth="2" />
                ))}
                {orbit.map(([x, y], i) => (
                    <g key={i} className="motion-safe:animate-ls-upright" style={{ transformOrigin: `${x}px ${y}px`, animationDuration: '30s' }}>
                        <Person x={x} y={y} />
                    </g>
                ))}
            </g>
            <circle cx="236" cy="156" r="52" fill={TEAL.bright} />
            <circle cx="236" cy="156" r="52" stroke={TEAL.bright} strokeWidth="2" className="motion-safe:animate-ls-ring" style={ringStyle} />
            <circle cx="236" cy="142" r="15" fill={C.navy} />
            <path d="M206 186 C 208 160, 264 160, 266 186 Z" fill={C.navy} />
            {/* the AI layer */}
            <g transform="translate(352 64)">
                <g className="motion-safe:animate-ls-float">
                    <path d="M0 -22 L6 -6 L22 0 L6 6 L0 22 L-6 6 L-22 0 L-6 -6 Z" fill={C.redBright} />
                </g>
            </g>
        </>
    );
}

const SHIELD = 'M236 36 L338 72 V150 C338 214 292 252 236 280 C180 252 134 214 134 150 V72 Z';
function ProtectionArt() {
    return (
        <>
            <circle cx="236" cy="158" r="132" stroke={INDIGO.soft} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="70 18" className="motion-safe:animate-ls-orbit" style={{ transformOrigin: '236px 158px', animationDuration: '40s' }} />
            <path d={SHIELD} stroke={INDIGO.bright} strokeWidth="2" className="motion-safe:animate-ls-ring" style={ringStyle} />
            <path d={SHIELD} fill="#2E2790" stroke={INDIGO.bright} strokeWidth="4" strokeLinejoin="round" pathLength="100" strokeDasharray="100" className="motion-safe:animate-ls-draw" />
            <path d="M184 160 L222 198 L290 120" stroke={C.white} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" pathLength="100" strokeDasharray="100" className="motion-safe:animate-ls-draw" style={{ animationDelay: '0.9s' }} />
        </>
    );
}

function GrowthArt() {
    const bars = [52, 92, 134, 172];
    const base = 276;
    return (
        <>
            <line x1="40" y1={base} x2="440" y2={base} stroke={C.white} strokeOpacity="0.35" strokeWidth="2" />
            {bars.map((h, i) => (
                <rect key={i} x={74 + i * 86} y={base - h} width="68" height={h} fill={STEP_FILL[i]} className="motion-safe:animate-[ls-grow_0.8s_cubic-bezier(0.2,0.8,0.2,1)_both]" style={{ transformBox: 'fill-box', transformOrigin: 'bottom', animationDelay: `${i * 0.18}s` }} />
            ))}
            <path d={`M${74 + 34} ${base - 52 - 26} L${160 + 34} ${base - 92 - 26} L${246 + 34} ${base - 134 - 26} L${332 + 34} ${base - 172 - 26}`} stroke={C.white} strokeOpacity="0.6" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" className="motion-safe:animate-ls-dash" />
            <g transform={`translate(${332 + 44} ${base - 172 - 50}) rotate(-6) scale(0.95)`}>
                <g className="motion-safe:animate-ls-float"><PlaneShape /></g>
            </g>
        </>
    );
}

const ART = { strategy: StrategyArt, talent: TalentArt, protection: ProtectionArt, growth: GrowthArt };

export function PillarArt({ slug, className = '' }) {
    const Art = ART[slug];
    if (!Art) return null;
    return (
        <svg key={slug} viewBox="0 0 472 320" className={`h-auto w-full ${className}`} fill="none" aria-hidden="true" focusable="false">
            <Art />
        </svg>
    );
}

// ── Closing the insurance gap: a ring of eight segments with one missing. It closes when scrolled into view; click to re-open it. ──
export function ShieldGap() {
    const reduced = usePrefersReducedMotion();
    const [ref, inView] = useInView({ threshold: 0.5 });
    const [closed, setClosed] = useState(false);
    const [touched, setTouched] = useState(false);

    useEffect(() => {
        if (!inView || touched) return undefined;
        const t = setTimeout(() => setClosed(true), reduced ? 0 : 1100);
        return () => clearTimeout(t);
    }, [inView, touched, reduced]);

    const toggle = () => { setTouched(true); setClosed((c) => !c); };
    const GAP = 5;
    return (
        <button
            ref={ref}
            type="button"
            onClick={toggle}
            aria-pressed={closed}
            aria-label="Closing the insurance gap"
            className="group mx-auto block w-full max-w-[22rem] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ls-blue"
        >
            <svg viewBox="0 0 320 320" className="h-auto w-full" fill="none" aria-hidden="true" focusable="false">
                <circle cx="160" cy="160" r="150" fill="#14213D" />
                {Array.from({ length: 8 }, (_, i) => {
                    const isGap = i === GAP;
                    const filled = !isGap || closed;
                    return (
                        <circle
                            key={i} cx="160" cy="160" r="116" pathLength="1" strokeWidth="22"
                            strokeDasharray="0.115 0.885" strokeLinecap="butt"
                            stroke={filled ? (isGap ? C.white : INDIGO.bright) : C.redBright}
                            strokeOpacity={filled ? 1 : 0.9}
                            style={{ transform: `rotate(${i * 45 - 90 + 2}deg)`, transformOrigin: '160px 160px', transition: 'stroke 0.5s, stroke-opacity 0.5s' }}
                            className={!filled && !reduced ? 'animate-pulse' : undefined}
                        />
                    );
                })}
                <path d="M160 82 L214 102 V158 C214 194 190 214 160 230 C130 214 106 194 106 158 V102 Z" fill="#2E2790" stroke={INDIGO.soft} strokeWidth="3" strokeLinejoin="round" />
                <path d="M134 156 L154 176 L190 132" stroke={C.white} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={closed ? 0 : 1} style={{ transition: 'stroke-dashoffset 0.6s ease-out 0.25s' }} />
            </svg>
        </button>
    );
}

// ── Contact page: an enquiry takes off from an envelope and lands on a pin, beside the four rungs ──
export function ContactArt({ className = '' }) {
    const reduced = usePrefersReducedMotion();
    const route = 'M118 196 C 140 80, 252 34, 340 90';
    return (
        <svg viewBox="0 0 472 320" className={`h-auto w-full ${className}`} fill="none" aria-hidden="true" focusable="false">
            {STAIR_FILL.map((fill, i) => (
                <rect key={fill} x={236 + i * 56} y={292 - (34 + i * 26)} width="44" height={34 + i * 26} rx="3" fill={fill} fillOpacity="0.9" />
            ))}
            <path d={route} stroke={C.blueBright} strokeOpacity="0.7" strokeWidth="2.5" strokeDasharray="2 10" strokeLinecap="round" className={reduced ? undefined : 'animate-ls-dash'} />
            <g>
                <rect x="40" y="196" width="156" height="96" rx="8" fill={C.navy700} stroke={C.blueSoft} strokeWidth="2" />
                <path d="M44 202 L118 256 L192 202" stroke={C.blueSoft} strokeWidth="2" strokeLinejoin="round" />
                <path d="M44 288 L98 240 M192 288 L138 240" stroke={C.blueSoft} strokeOpacity="0.5" strokeWidth="2" />
            </g>
            <ellipse cx="384" cy="156" rx="30" ry="9" stroke={C.redBright} strokeWidth="2" className="motion-safe:animate-ls-ring" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
            <path d="M384 156 C 366 136 350 116 350 94 A34 34 0 0 1 418 94 C 418 116 402 136 384 156 Z" fill={C.redBright} />
            <circle cx="384" cy="94" r="13" fill={C.navy} />
            {reduced ? (
                <g transform="translate(228 62) scale(0.7)"><PlaneShape /></g>
            ) : (
                <g>
                    <g transform="scale(0.7)"><PlaneShape /></g>
                    <animateMotion dur="4.6s" repeatCount="indefinite" path={route} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.2 1" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.85;1" dur="4.6s" repeatCount="indefinite" />
                </g>
            )}
        </svg>
    );
}

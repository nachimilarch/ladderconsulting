import { WORD, SUB, TAG } from './logoPaths';

// The Ladderstep Consulting "Take-off" logo, drawn inline so it stays sharp and themeable.
// A paper plane folded in three reds lifts off a two-step block (navy base, blue upper step).
// The wordmark is outlined (Montserrat), so it never depends on a web font loading.
// Third line: the four pillars (Strategy · Talent · Protection · Growth). The tagline "One strong step at a time" is not part of the logo.
// On navy the whole logo is white and only the plane stays red (the two white steps are separated by a hairline gap).

const PALETTES = {
    light: { base: '#14213D', upper: '#1D3A8A', dark: '#B52434', mid: '#DB3441', light: '#F0505A', word: '#14213D', sub: '#1D3A8A', tag: '#E63946' },
    dark: { base: '#FFFFFF', upper: '#FFFFFF', gap: true, dark: '#C42A44', mid: '#FF3B5C', light: '#FF6F86', word: '#FFFFFF', sub: '#FFFFFF', tag: '#FFFFFF' },
};

// The mark's shapes, in the brand's own coordinate space (viewBox 6 10 88 82).
// `animate` builds the steps left to right and then lifts the plane off (skipped when motion is reduced).
export function MarkShapes({ tone = 'light', c = PALETTES[tone], animate = false }) {
    const grow = { transformBox: 'fill-box', transformOrigin: 'left center' };
    return (
        <>
            <rect x="10" y="72" width="44" height="16" fill={c.base} style={grow} className={animate ? 'motion-safe:animate-ls-step-1' : undefined} />
            <rect x="10" y="56" width="26" height={c.gap ? 15 : 16} fill={c.upper} style={grow} className={animate ? 'motion-safe:animate-ls-step-2' : undefined} />
            <g className={animate ? 'motion-safe:animate-ls-takeoff' : undefined}>
                <polygon points="42,50 90,14 58,58" fill={c.dark} />
                <polygon points="90,14 58,58 63,67" fill={c.mid} />
                <polygon points="90,14 63,67 68,76" fill={c.light} />
            </g>
        </>
    );
}

// Mark only (icon). Use for small spaces; never below 16px.
export function Mark({ tone = 'light', animate = false, className = '', title }) {
    const c = PALETTES[tone];
    return (
        <svg viewBox="6 10 88 82" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
            <MarkShapes c={c} animate={animate} />
        </svg>
    );
}

// The plane on its own, for the few places the brand uses it as a motif (hero, Scale card, contact, send confirmation).
export function Plane({ tone = 'light', className = '', style }) {
    const c = PALETTES[tone];
    return (
        <svg viewBox="40 12 52 66" className={className} style={style} aria-hidden="true" focusable="false">
            <polygon points="42,50 90,14 58,58" fill={c.dark} />
            <polygon points="90,14 58,58 63,67" fill={c.mid} />
            <polygon points="90,14 63,67 68,76" fill={c.light} />
        </svg>
    );
}

// Horizontal lockup: mark, LADDERSTEP, CONSULTING and (optionally) the red tagline.
// All three text lines share one width so the block reads as a single unit.
export function Lockup({ tone = 'light', tagline = false, className = '' }) {
    const c = PALETTES[tone];
    const h = tagline ? 380 : 324;
    return (
        <svg viewBox={`170 70 1546 ${h}`} className={className} role="img" aria-label="Ladderstep Consulting" focusable="false">
            <g transform="translate(192 373) scale(3.774) translate(-10 -88)"><MarkShapes c={c} /></g>
            <path d={WORD} fill={c.word} />
            <path d={SUB} fill={c.sub} />
            {tagline && <path d={TAG} fill={c.tag} />}
        </svg>
    );
}

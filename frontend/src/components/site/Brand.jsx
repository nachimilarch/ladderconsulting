// The Ladderstep Consulting "Take-off" logo, drawn inline so it stays sharp and themeable.
// Geometry and colours come straight from ladderstep-brand/ladderstep-brand-context.md (8 Oct 2026):
// a red paper plane lifting off a two-step block. Flat, three colours, no effects.

const PALETTES = {
    light: { base: '#14213D', upper: '#1D3A8A', plane: '#E63946', fold: '#B52434', word: '#14213D', sub: '#1D3A8A', tag: '#E63946' },
    dark: { base: '#FFFFFF', upper: '#4C7BFF', plane: '#FF3B5C', fold: '#C42A44', word: '#FFFFFF', sub: '#9DB6FF', tag: '#FF3B5C' },
};

const WORDMARK_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

// The mark's shapes, in the brand's own coordinate space (viewBox 6 10 88 82).
// `animate` builds the steps left to right and then lifts the plane off (skipped when motion is reduced).
export function MarkShapes({ tone = 'light', c = PALETTES[tone], animate = false }) {
    const grow = { transformBox: 'fill-box', transformOrigin: 'left center' };
    return (
        <>
            <rect x="10" y="72" width="44" height="16" fill={c.base} style={grow} className={animate ? 'motion-safe:animate-ls-step-1' : undefined} />
            <rect x="10" y="56" width="26" height="16" fill={c.upper} style={grow} className={animate ? 'motion-safe:animate-ls-step-2' : undefined} />
            <g className={animate ? 'motion-safe:animate-ls-takeoff' : undefined}>
                <polygon points="42,50 90,14 68,76 58,58" fill={c.plane} />
                <polygon points="58,58 90,14 42,50" fill={c.fold} />
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
export function Plane({ tone = 'light', className = '' }) {
    const c = PALETTES[tone];
    return (
        <svg viewBox="40 12 52 66" className={className} aria-hidden="true" focusable="false">
            <polygon points="42,50 90,14 68,76 58,58" fill={c.plane} />
            <polygon points="58,58 90,14 42,50" fill={c.fold} />
        </svg>
    );
}

// Horizontal lockup: mark, LADDERSTEP, CONSULTING and (optionally) the red tagline.
// Text lines are fitted to the same width so the block reads as one unit, and the mark is
// sized to the height of the text block (brand file, section 3).
export function Lockup({ tone = 'light', tagline = false, className = '' }) {
    const c = PALETTES[tone];
    const w = 268;
    // Mark artwork spans x 10..90, y 14..88 in its own space; scale it to the text block height.
    const markH = tagline ? 80 : 60;
    const s = markH / 74;
    const x = Math.round(80 * s + 18);
    const y = tagline
        ? { word: 30, sub: 52, tag: 75, size: 15 }
        : { word: 30, sub: 56.5, size: 15 };
    return (
        <svg viewBox={`0 0 ${x + w} ${markH}`} className={className} role="img" aria-label="Ladderstep Consulting" focusable="false">
            <g transform={`scale(${s}) translate(-10 -14)`}><MarkShapes c={c} /></g>
            <g fontFamily={WORDMARK_FONT}>
                <text x={x} y={y.word} fontSize="34" fontWeight="700" fill={c.word} textLength={w} lengthAdjust="spacing">LADDERSTEP</text>
                <text x={x} y={y.sub} fontSize={y.size} fontWeight="400" fill={c.sub} textLength={w} lengthAdjust="spacing">CONSULTING</text>
                {tagline && (
                    <text x={x} y={y.tag} fontSize="10" fontWeight="400" fill={c.tag} textLength={w} lengthAdjust="spacing">Strategize · Enable · Secure · Scale</text>
                )}
            </g>
        </svg>
    );
}

// Colour system for the public site.
//
// Every pillar has its own identity, used wherever that pillar shows up (explorer, staircase, art, page
// banner, step indicator, service cards, nav menu, floating call-to-action, previous/next cards):
//   Strategy   bright blue   #2F5FE0  (deep #1D3A8A, on navy #4C7BFF)
//   Talent     teal          #0B7285  (deep #0A5A68, on navy #35C5D6)
//   Protection indigo        #4338B8  (deep #2E2790, on navy #8E84FF)
//   Growth     red           #B52434  (deep #8A1F30, on navy #FF3B5C)
// Navy leads, red stays the call-to-action colour (buttons), and small red text uses the red shade.
//
// Contrast (WCAG 2.1): white on main 5.5 to 8.4, white on deep 7.9 to 11.6, navy on tint 14, muted on tint
// 5.2 to 5.4, main on its own 50-tint 4.9 to 7.4. Tailwind needs whole class names, so they are spelled out.

export const TONES = {
    blue: {
        key: 'blue',
        hex: { main: '#2F5FE0', deep: '#1D3A8A', bright: '#4C7BFF', soft: '#9DB6FF', tint: '#EEF3FF', glow: 'rgba(47,95,224,0.55)' },
        solid: 'bg-ls-blue-mid', deepBg: 'bg-ls-blue', text: 'text-ls-blue-mid', groupHoverText: 'group-hover:text-ls-blue-mid', softText: 'text-ls-blue-soft', brightText: 'text-ls-blue-bright',
        brightBg: 'bg-ls-blue-bright', bright40: 'bg-ls-blue-bright/40 group-hover:bg-ls-blue-bright/70',
        tint: 'bg-ls-blue-50', hoverTint: 'hover:bg-ls-blue-50', groupHoverBorder: 'group-hover:border-ls-blue-mid', tint2: 'bg-ls-blue-100', ring: 'ring-ls-blue-100', tintBorder: 'border-ls-blue-100', border: 'border-ls-blue-mid',
        top: 'border-t-ls-blue-mid', topBright: 'border-t-ls-blue-bright', railBright: 'border-l-ls-blue-bright', rail: 'border-l-ls-blue-mid', railR: 'border-r-ls-blue-mid', ghost: 'text-ls-blue-mid/10', ghostOnTint: 'text-ls-blue-mid/[0.12]',
        hoverBorder: 'hover:border-ls-blue-mid', groupFill: 'group-hover:bg-ls-blue-mid', hoverFill: 'hover:bg-ls-blue-mid hover:border-ls-blue-mid',
        glow: 'hover:shadow-[0_18px_36px_-16px_rgba(47,95,224,0.55)]', glowOn: 'shadow-[0_18px_36px_-16px_rgba(47,95,224,0.55)]',
        panel: 'bg-gradient-to-br from-ls-navy via-ls-navy to-ls-blue', wash: 'bg-gradient-to-b from-ls-blue-50 to-white',
        chip: 'bg-ls-blue-100 text-ls-blue', stroke: 'stroke-ls-blue-mid', dot: 'bg-ls-blue-bright',
    },
    teal: {
        key: 'teal',
        hex: { main: '#0B7285', deep: '#0A5A68', bright: '#35C5D6', soft: '#9BE3EC', tint: '#E6F5F7', glow: 'rgba(11,114,133,0.55)' },
        solid: 'bg-ls-teal', deepBg: 'bg-ls-teal-deep', text: 'text-ls-teal', groupHoverText: 'group-hover:text-ls-teal', softText: 'text-ls-teal-soft', brightText: 'text-ls-teal-bright',
        brightBg: 'bg-ls-teal-bright', bright40: 'bg-ls-teal-bright/40 group-hover:bg-ls-teal-bright/70',
        tint: 'bg-ls-teal-50', hoverTint: 'hover:bg-ls-teal-50', groupHoverBorder: 'group-hover:border-ls-teal', tint2: 'bg-ls-teal-100', ring: 'ring-ls-teal-100', tintBorder: 'border-ls-teal-100', border: 'border-ls-teal',
        top: 'border-t-ls-teal', topBright: 'border-t-ls-teal-bright', railBright: 'border-l-ls-teal-bright', rail: 'border-l-ls-teal', railR: 'border-r-ls-teal', ghost: 'text-ls-teal/10', ghostOnTint: 'text-ls-teal/[0.12]',
        hoverBorder: 'hover:border-ls-teal', groupFill: 'group-hover:bg-ls-teal', hoverFill: 'hover:bg-ls-teal hover:border-ls-teal',
        glow: 'hover:shadow-[0_18px_36px_-16px_rgba(11,114,133,0.55)]', glowOn: 'shadow-[0_18px_36px_-16px_rgba(11,114,133,0.55)]',
        panel: 'bg-gradient-to-br from-ls-navy via-ls-navy to-ls-teal-deep', wash: 'bg-gradient-to-b from-ls-teal-50 to-white',
        chip: 'bg-ls-teal-100 text-ls-teal-deep', stroke: 'stroke-ls-teal', dot: 'bg-ls-teal-bright',
    },
    indigo: {
        key: 'indigo',
        hex: { main: '#4338B8', deep: '#2E2790', bright: '#8E84FF', soft: '#C2BBFF', tint: '#EFEEFF', glow: 'rgba(67,56,184,0.55)' },
        solid: 'bg-ls-indigo', deepBg: 'bg-ls-indigo-deep', text: 'text-ls-indigo', groupHoverText: 'group-hover:text-ls-indigo', softText: 'text-ls-indigo-soft', brightText: 'text-ls-indigo-bright',
        brightBg: 'bg-ls-indigo-bright', bright40: 'bg-ls-indigo-bright/40 group-hover:bg-ls-indigo-bright/70',
        tint: 'bg-ls-indigo-50', hoverTint: 'hover:bg-ls-indigo-50', groupHoverBorder: 'group-hover:border-ls-indigo', tint2: 'bg-ls-indigo-100', ring: 'ring-ls-indigo-100', tintBorder: 'border-ls-indigo-100', border: 'border-ls-indigo',
        top: 'border-t-ls-indigo', topBright: 'border-t-ls-indigo-bright', railBright: 'border-l-ls-indigo-bright', rail: 'border-l-ls-indigo', railR: 'border-r-ls-indigo', ghost: 'text-ls-indigo/10', ghostOnTint: 'text-ls-indigo/[0.12]',
        hoverBorder: 'hover:border-ls-indigo', groupFill: 'group-hover:bg-ls-indigo', hoverFill: 'hover:bg-ls-indigo hover:border-ls-indigo',
        glow: 'hover:shadow-[0_18px_36px_-16px_rgba(67,56,184,0.55)]', glowOn: 'shadow-[0_18px_36px_-16px_rgba(67,56,184,0.55)]',
        panel: 'bg-gradient-to-br from-ls-navy via-ls-navy to-ls-indigo-deep', wash: 'bg-gradient-to-b from-ls-indigo-50 to-white',
        chip: 'bg-ls-indigo-100 text-ls-indigo', stroke: 'stroke-ls-indigo', dot: 'bg-ls-indigo-bright',
    },
    red: {
        key: 'red',
        hex: { main: '#B52434', deep: '#8A1F30', bright: '#FF3B5C', soft: '#FFB0BC', tint: '#FFF0F2', glow: 'rgba(181,36,52,0.5)' },
        solid: 'bg-ls-red-shade', deepBg: 'bg-ls-red-deep', text: 'text-ls-red-shade', groupHoverText: 'group-hover:text-ls-red-shade', softText: 'text-ls-red-soft', brightText: 'text-ls-red-bright',
        brightBg: 'bg-ls-red-bright', bright40: 'bg-ls-red-bright/40 group-hover:bg-ls-red-bright/70',
        tint: 'bg-ls-red-50', hoverTint: 'hover:bg-ls-red-50', groupHoverBorder: 'group-hover:border-ls-red-shade', tint2: 'bg-ls-red-100', ring: 'ring-ls-red-100', tintBorder: 'border-ls-red-100', border: 'border-ls-red-shade',
        top: 'border-t-ls-red-shade', topBright: 'border-t-ls-red-bright', railBright: 'border-l-ls-red-bright', rail: 'border-l-ls-red-shade', railR: 'border-r-ls-red-shade', ghost: 'text-ls-red-shade/10', ghostOnTint: 'text-ls-red-shade/[0.12]',
        hoverBorder: 'hover:border-ls-red-shade', groupFill: 'group-hover:bg-ls-red-shade', hoverFill: 'hover:bg-ls-red-shade hover:border-ls-red-shade',
        glow: 'hover:shadow-[0_18px_36px_-16px_rgba(181,36,52,0.5)]', glowOn: 'shadow-[0_18px_36px_-16px_rgba(181,36,52,0.5)]',
        panel: 'bg-gradient-to-br from-ls-navy via-ls-navy to-ls-red-deep', wash: 'bg-gradient-to-b from-ls-red-50 to-white',
        chip: 'bg-ls-red-100 text-ls-red-shade', stroke: 'stroke-ls-red-shade', dot: 'bg-ls-red-bright',
    },
};

const BY_PILLAR = { strategy: 'blue', talent: 'teal', protection: 'indigo', growth: 'red' };
export const PILLAR_TONES = ['blue', 'teal', 'indigo', 'red'];

// The tone for a pillar slug (falls back to blue).
export const toneFor = (slug) => TONES[BY_PILLAR[slug]] || TONES.blue;
// The n-th tone in pillar order, for sets that are not pillars (industries, beliefs, FAQs).
export const toneAt = (i) => TONES[PILLAR_TONES[((i % 4) + 4) % 4]];

// Colours that sit on the navy hero, one per pillar step (navy text passes 4.8:1 or better on each).
export const STAIR_FILL = ['#5B86FF', '#35C5D6', '#8E84FF', '#FF3B5C'];

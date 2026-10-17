/** @type {import('tailwindcss').Config} */

// ── LadderStep Human Consulting brand theme ────────────────────────────────────────────
// "Ladder Violet" — deep, professional violet-indigo used as the single accent
// across every portal. `blue` and `indigo` are both remapped to this palette so
// the whole app (HR, Outreach, Admin, Company, Candidate) shares one identity
// without touching individual pages.
const ladderViolet = {
  50:  '#f2f1fd',
  100: '#e7e5fb',
  200: '#d3cff8',
  300: '#b5adf2',
  400: '#9486ea',
  500: '#7a63e1',
  600: '#6a47d4',
  700: '#5a38b8',
  800: '#4a2f96',
  900: '#3e2a7a',
  950: '#251849',
};

// Status colours. Every portal speaks the same language: green = done/good,
// amber = waiting/needs a look, red = failed/blocked. Tailwind's yellow, orange,
// emerald and rose are folded into these so a "pending" badge is the same amber
// on every page instead of a mix of yellow and orange.
const success = {
  50:  '#effaf4',
  100: '#d6f2e2',
  200: '#b0e5c8',
  300: '#7fd2a8',
  400: '#4ab984',
  500: '#2a9d69',
  600: '#1e8557',
  700: '#1a6b47',
  800: '#17553a',
  900: '#144631',
  950: '#08281c',
};

const warning = {
  50:  '#fffaeb',
  100: '#fef0c7',
  200: '#fedf89',
  300: '#fec84b',
  400: '#fdb022',
  500: '#f79009',
  600: '#dc6803',
  700: '#b54708',
  800: '#93370d',
  900: '#7a2e0e',
  950: '#4e1d09',
};

const danger = {
  50:  '#fef3f3',
  100: '#fee4e4',
  200: '#fdcccc',
  300: '#faa5a5',
  400: '#f47070',
  500: '#e84545',
  600: '#d32f2f',
  700: '#b02525',
  800: '#912323',
  900: '#782424',
  950: '#420f0f',
};

// Second accent for things that must be told apart from the brand violet
// (e.g. "offer sent" next to "interview scheduled"). Leans magenta, not blue.
const plum = {
  50:  '#fcf4fd',
  100: '#f7e6fa',
  200: '#efcdf4',
  300: '#e3a7ea',
  400: '#d277dc',
  500: '#ba4ec6',
  600: '#9e38ab',
  700: '#812f89',
  800: '#6a2971',
  900: '#57245c',
  950: '#3a0f3d',
};

// Cool slate neutrals — calmer, more premium than default gray
const slate = {
  50:  '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: ladderViolet,
        blue: ladderViolet,
        indigo: ladderViolet,
        violet: ladderViolet,
        gray: slate,
        success,
        warning,
        danger,
        green: success,
        emerald: success,
        yellow: warning,
        amber: warning,
        orange: warning,
        red: danger,
        rose: danger,
        purple: plum,
        fuchsia: plum,
        // Public marketing website (pages/site): the Ladderstep Consulting "Take-off" brand
        // (ladderstep-brand/ladderstep-brand-context.md, 8 Oct 2026), kept apart from the portal violet.
        // White is the canvas, navy leads, blue supports, red is the single accent per screen.
        // The bright tones are for navy backgrounds only.
        ls: {
          navy: '#14213D',
          'navy-700': '#1B2B4D',
          blue: '#1D3A8A',
          red: '#E63946',
          'red-shade': '#B52434',
          'blue-bright': '#4C7BFF',
          'red-bright': '#FF3B5C',
          'blue-soft': '#9DB6FF',
          muted: '#5B6478',
          paper: '#F6F7FA',
          line: '#E2E5EC',
          // Tints and shades derived from the palette, for card surfaces, section washes and the
          // four pillar identities (Strategy blue, Talent teal, Protection indigo, Growth red).
          // Every pairing used on the site was checked for WCAG AA (see components/site/tones.js).
          'navy-deep': '#0E1830',
          'navy-50': '#EDF0F7',
          'navy-100': '#DDE3F0',
          'blue-mid': '#2F5FE0',
          'blue-50': '#EEF3FF',
          'blue-100': '#DCE6FF',
          teal: '#0B7285',
          'teal-deep': '#0A5A68',
          'teal-bright': '#35C5D6',
          'teal-soft': '#9BE3EC',
          'teal-50': '#E6F5F7',
          'teal-100': '#C7EAEF',
          indigo: '#4338B8',
          'indigo-deep': '#2E2790',
          'indigo-bright': '#8E84FF',
          'indigo-soft': '#C2BBFF',
          'indigo-50': '#EFEEFF',
          'indigo-100': '#DEDBFF',
          'red-deep': '#8A1F30',
          'red-soft': '#FFB0BC',
          'red-50': '#FFF0F2',
          'red-100': '#FFDDE2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        // Legacy stand-in; the logo wordmark is now outlined Montserrat (see logoPaths.js).
        wordmark: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      keyframes: {
        // Logo build: the steps grow left to right, then the plane lifts off up and to the right.
        'ls-step': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'ls-takeoff': {
          '0%': { opacity: '0', transform: 'translate(-28px, 28px)' },
          '100%': { opacity: '1', transform: 'translate(0, 0)' },
        },
        'ls-path': {
          '0%': { strokeDashoffset: '400' },
          '100%': { strokeDashoffset: '0' },
        },
        'ls-fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ls-panel': {
          '0%': { opacity: '0', transform: 'translateX(18px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'ls-orbit': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'ls-upright': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(-360deg)' },
        },
        'ls-grow': {
          '0%': { transform: 'scaleY(0)' },
          '100%': { transform: 'scaleY(1)' },
        },
        'ls-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'ls-dash': {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-48' },
        },
        'ls-pop': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'ls-ring': {
          '0%': { opacity: '0.55', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1.7)' },
        },
        'ls-marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'ls-draw': {
          '0%': { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' },
        },
        'ls-bar': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'ls-travel': {
          '0%': { left: '0%', opacity: '0' },
          '15%': { opacity: '1' },
          '85%': { opacity: '1' },
          '100%': { left: 'calc(100% - 10px)', opacity: '0' },
        },
        'ls-fly': {
          '0%': { opacity: '0', transform: 'translate(-40px, 40px)' },
          '15%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translate(220px, -220px)' },
        },
      },
      animation: {
        'ls-step-1': 'ls-step 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) 0.1s both',
        'ls-step-2': 'ls-step 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) 0.45s both',
        'ls-takeoff': 'ls-takeoff 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) 0.9s both',
        'ls-path': 'ls-path 1.4s ease-out 1.2s both',
        'ls-fade-up': 'ls-fade-up 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) backwards',
        'ls-panel': 'ls-panel 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) backwards',
        'ls-orbit': 'ls-orbit 36s linear infinite',
        'ls-upright': 'ls-upright 36s linear infinite',
        'ls-float': 'ls-float 5s ease-in-out infinite',
        'ls-dash': 'ls-dash 2.4s linear infinite',
        'ls-pop': 'ls-pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3) both',
        'ls-ring': 'ls-ring 2.6s ease-out infinite',
        'ls-marquee': 'ls-marquee 60s linear infinite',
        'ls-draw': 'ls-draw 1.2s ease-out 0.2s both',
        'ls-fly': 'ls-fly 1.4s ease-in forwards',
        'ls-travel': 'ls-travel 2.2s ease-in-out infinite',
        'ls-bar': 'ls-bar 6s linear forwards',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(15 23 42 / 0.10), 0 2px 6px -2px rgb(15 23 42 / 0.08)',
        modal: '0 20px 60px -10px rgb(15 23 42 / 0.25)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}

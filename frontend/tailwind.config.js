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
        gray: slate,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
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

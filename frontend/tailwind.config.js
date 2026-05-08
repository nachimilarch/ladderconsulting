/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: { DEFAULT: '#1D4ED8', light: '#3B82F6', dark: '#1E3A8A' },
                secondary: { DEFAULT: '#7C3AED', light: '#A78BFA' },
                success: '#16A34A',
                danger: '#DC2626',
                warning: '#D97706',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
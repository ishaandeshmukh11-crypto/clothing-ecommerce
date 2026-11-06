/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#111111', soft: '#3d3d3a', muted: '#7a776f' },
        ivory: '#ffffff', // page background (clean white)
        sand: { DEFAULT: '#f4f4f2', dark: '#e7e7e4' }, // image wells & hairline borders
        clay: { DEFAULT: '#111111', dark: '#000000', light: '#3d3d3a' }, // accent = black (monochrome system)
        gold: '#8a8170', // muted taupe for small highlights
        sale: '#b3261e',
        whatsapp: '#25D366',
      },
      fontFamily: {
        display: ['"Inter Tight Variable"', '"Inter Tight"', 'Helvetica Neue', 'Arial', 'sans-serif'],
        sans: ['"Inter Tight Variable"', '"Inter Tight"', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      letterSpacing: { widest2: '0.25em' },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(12px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { fadeUp: 'fadeUp .5s ease both' },
    },
  },
  plugins: [],
};

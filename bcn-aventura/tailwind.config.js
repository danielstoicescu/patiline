/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/index.html', './public/app.js'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ferrari: '#E60000',
        maraPink: '#EC4899',
        maraPurple: '#8B5CF6',
        coffeeBrown: '#D97706',
        bcnTeal: '#0EA5E9',
      },
      boxShadow: {
        btn: '0 4px 14px 0 rgba(0, 0, 0, 0.1)',
        'card-hover': '0 12px 28px -6px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};

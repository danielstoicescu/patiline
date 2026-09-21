/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/index.html', './public/app.js'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        display: ['Archivo', '"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Paleta: calç (var de Barcelona), carbó, vermell Miró, blau ultramarí, ocre, verd mediterrani
        calc: { DEFAULT: '#EFECE4', 2: '#E6E2D8', 3: '#D9D4C7' },
        carbo: { DEFAULT: '#171716', 2: '#232321', 3: '#2F2F2C', 4: '#3D3D39' },
        vermell: { DEFAULT: '#D7301F', dark: '#B4261A', soft: '#FBE4E0' },
        blau: { DEFAULT: '#1B49B8', dark: '#153A93', soft: '#DEE5F8' },
        ocre: { DEFAULT: '#E8B52E', dark: '#B98A18', soft: '#FBF0CD' },
        verd: { DEFAULT: '#1F7A5C', dark: '#175E47', soft: '#D9EFE5' },
        ink: { DEFAULT: '#171716', 2: '#4A4A46', 3: '#7A7A73' },
        // compatibilitate cu numele vechi folosite în script
        maraPink: '#D7301F', maraPurple: '#1B49B8', bcnTeal: '#1F7A5C', ferrari: '#D7301F',
      },
      boxShadow: {
        hair: '0 0 0 1px rgba(23,23,22,.12)',
        lift: '0 10px 30px -12px rgba(23,23,22,.35)',
      },
    },
  },
  plugins: [],
};

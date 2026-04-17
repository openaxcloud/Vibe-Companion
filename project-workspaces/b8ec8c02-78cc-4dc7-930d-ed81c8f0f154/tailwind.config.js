/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{tsx,ts,jsx,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      backgroundImage: {
        'noise-texture': "url('https://www.transparenttextures.com/patterns/asfalt-dark.png')",
      },
      colors: {
        primary: {
          50: '#e0e7ff',
          100: '#c7d2fe',
          200: '#a5b4fc',
          300: '#818cf8',
          400: '#6366f1',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
          800: '#312e81',
          900: '#23226b'
        },
        accent: {
          500: '#8b5cf6'
        }
      }
    },
  },
  plugins: [],
};

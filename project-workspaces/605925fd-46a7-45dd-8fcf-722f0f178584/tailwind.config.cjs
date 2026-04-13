module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      },
      colors: {
        primary: {
          50: '#f4f4ff',
          100: '#e5e5ff',
          200: '#bebeff',
          300: '#8f8fff',
          400: '#5f5fff',
          500: '#2f2fff',
          600: '#2525d4',
          700: '#1c1ca9',
          800: '#12127e',
          900: '#090954'
        }
      }
    }
  },
  plugins: [require('@tailwindcss/forms')({ strategy: 'class' })]
};

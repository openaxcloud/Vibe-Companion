/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slack: {
          primary: '#611f69',
          secondary: '#4a154b',
          accent: '#e01e5a',
          bg: '#1a1d29',
          sidebar: '#19171d',
          hover: '#350d36'
        }
      }
    },
  },
  plugins: [],
}


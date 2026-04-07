/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          light: '#60A5FA',
          dark: '#1D4ED8',
          muted: '#E5EDFF',
        },
        accent: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#B45309',
        },
        success: {
          DEFAULT: '#16A34A',
          light: '#4ADE80',
          dark: '#166534',
        },
        danger: {
          DEFAULT: '#DC2626',
          light: '#F87171',
          dark: '#991B1B',
        },
        neutral: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2933',
          900: '#111827',
        },
        background: {
          DEFAULT: '#FFFFFF',
          subtle: '#F9FAFB',
          raised: '#F3F4F6',
          dark: '#020617',
          darkSubtle: '#020617',
        },
        marketplace: {
          primary: '#2563EB',
          primaryHover: '#1D4ED8',
          primarySoft: '#E5EDFF',
          secondary: '#0F172A',
          secondarySoft: '#111827',
          border: '#E5E7EB',
          chip: '#F3F4F6',
        },
      },
      screens: {
        xs: '480px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
        '3xl': '1920px',
      },
      boxShadow: {
        card: '0 10px 30px rgba(15, 23, 42, 0.08)',
        'card-soft': '0 4px 16px rgba(15, 23, 42, 0.06)',
        'input-focus': '0 0 0 1px rgba(37, 99, 235, 0.4)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
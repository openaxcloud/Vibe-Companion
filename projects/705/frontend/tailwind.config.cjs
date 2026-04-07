/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');
const plugin = require('tailwindcss/plugin');

module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Base palette
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          DEFAULT: '#6366f1',
        },
        secondary: {
          50: '#fdf2ff',
          100: '#f9e5ff',
          200: '#f2c7ff',
          300: '#e6a5ff',
          400: '#d681ff',
          500: '#c14cf0',
          600: '#a032d0',
          700: '#7f25a6',
          800: '#661d85',
          900: '#4d1664',
          DEFAULT: '#c14cf0',
        },
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          DEFAULT: '#06b6d4',
        },
        success: {
          50: '#ecfdf3',
          100: '#d1fadf',
          200: '#a6f4c5',
          300: '#4ade80',
          400: '#22c55e',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#166534',
          DEFAULT: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#facc15',
          400: '#eab308',
          500: '#ca8a04',
          600: '#a16207',
          700: '#854d0e',
          800: '#713f12',
          900: '#422006',
          DEFAULT: '#eab308',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          DEFAULT: '#ef4444',
        },

        // Light / Dark surfaces
        background: {
          DEFAULT: '#ffffff',
          subtle: '#f9fafb',
          muted: '#f3f4f6',
          elevated: '#ffffff',
        },
        foreground: {
          DEFAULT: '#0f172a',
          muted: '#6b7280',
          subtle: '#9ca3af',
          inverted: '#ffffff',
        },
        border: {
          DEFAULT: '#e5e7eb',
          subtle: '#e5e7eb',
          muted: '#d1d5db',
        },

        // Dark theme palette
        dark: {
          background: {
            DEFAULT: '#020617',
            subtle: '#020617',
            muted: '#0b1120',
            elevated: '#020617',
          },
          foreground: {
            DEFAULT: '#e5e7eb',
            muted: '#9ca3af',
            subtle: '#6b7280',
            inverted: '#020617',
          },
          border: {
            DEFAULT: '#1f2937',
            subtle: '#111827',
            muted: '#374151',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        heading: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },
      boxShadow: {
        'soft-sm': '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        'soft-md': '0 4px 6px -1px rgb(15 23 42 / 0.07), 0 2px 4px -2px rgb(15 23 42 / 0.05)',
        'soft-lg': '0 10px 25px -5px rgb(15 23 42 / 0.10), 0 8px 10px -6px rgb(15 23 42 / 0.10)',
        'soft-xl': '0 20px 50px -12px rgb(15 23 42 / 0.15)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      screens: {
        xs: '480px',
      },
      transitionTimingFunction: {
        'swift-out': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
    require('@tailwindcss/typography'),
    plugin(function ({ addVariant, e }) {
      addVariant('hocus', ['&:hover', '&:focus-visible']);
      addVariant('supports-backdrop-blur', '@supports (backdrop-filter: blur(0))');
      addVariant('supports-scrollbars', '@supports selector(::-webkit-scrollbar)');
      addVariant('scrollbar', '&::-webkit-scrollbar');
      addVariant('scrollbar-track', '&::-webkit-scrollbar-track');
      addVariant('scrollbar-thumb', '&::-webkit-scrollbar-thumb');
    }),
    plugin(function ({ addBase, theme }) {
      addBase({
        ':root': {
          colorScheme: 'light',
          '--bg': theme('colors.background.DEFAULT'),
          '--bg-subtle': theme('colors.background.subtle'),
          '--fg': theme('colors.foreground.DEFAULT'),
          '--fg-muted': theme('colors.foreground.muted'),
          '--border': theme('colors.border.DEFAULT'),
        },
        '.dark': {
          colorScheme: 'dark',
          '--bg': theme('colors.dark.background.DEFAULT'),
          '--bg-subtle': theme('colors.dark.background.subtle'),
          '--fg': theme('colors.dark.foreground.DEFAULT'),
          '--fg-muted': theme('colors.dark.foreground.muted'),
          '--border': theme('colors.dark.border.DEFAULT'),
        },
        'html, body': {
          fontFamily: theme('fontFamily.sans').join(','),
        },
      });
    }),
  ],
};
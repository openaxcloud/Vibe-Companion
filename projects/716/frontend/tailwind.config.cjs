/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          light: '#60A5FA',
          dark: '#1D4ED8',
        },
        accent: {
          DEFAULT: '#F97316',
          light: '#FDBA74',
          dark: '#EA580C',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          soft: '#F9FAFB',
          strong: '#111827',
        },
        muted: {
          DEFAULT: '#6B7280',
          light: '#9CA3AF',
          dark: '#4B5563',
        },
        'border-subtle': '#E5E7EB',
        'border-strong': '#111827',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['system-ui', 'ui-sans-serif', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['ui-rounded', 'SF Pro Rounded', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.25rem' }],
        'sm': ['0.875rem', { lineHeight: '1.5rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      boxShadow: {
        'card-sm': '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)',
        'card-md': '0 6px 18px rgba(15, 23, 42, 0.12)',
        'card-lg': '0 18px 45px rgba(15, 23, 42, 0.18)',
        'focus-outline': '0 0 0 1px rgba(37, 99, 235, 0.7), 0 0 0 4px rgba(191, 219, 254, 0.8)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      transitionTimingFunction: {
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            color: theme('colors.slate.800'),
            a: {
              color: theme('colors.brand.DEFAULT'),
              textDecoration: 'none',
              fontWeight: '500',
              '&:hover': {
                color: theme('colors.brand.dark'),
              },
            },
            strong: {
              color: theme('colors.slate.900'),
            },
            h1: {
              fontFamily: theme('fontFamily.display').join(','),
              fontWeight: '700',
              letterSpacing: '-0.025em',
            },
            h2: {
              fontFamily: theme('fontFamily.display').join(','),
              fontWeight: '700',
              letterSpacing: '-0.025em',
            },
            h3: {
              fontFamily: theme('fontFamily.display').join(','),
              fontWeight: '600',
            },
            h4: {
              fontFamily: theme('fontFamily.display').join(','),
              fontWeight: '600',
            },
            'ul > li::marker': {
              color: theme('colors.muted.DEFAULT'),
            },
            'ol > li::marker': {
              color: theme('colors.muted.DEFAULT'),
            },
          },
        },
        dark: {
          css: {
            color: theme('colors.slate.200'),
            a: {
              color: theme('colors.brand.light'),
              '&:hover': {
                color: theme('colors.brand.DEFAULT'),
              },
            },
            strong: {
              color: theme('colors.slate.50'),
            },
            h1: {
              color: theme('colors.white'),
            },
            h2: {
              color: theme('colors.white'),
            },
            h3: {
              color: theme('colors.slate.100'),
            },
            h4: {
              color: theme('colors.slate.100'),
            },
            'ul > li::marker': {
              color: theme('colors.muted.light'),
            },
            'ol > li::marker': {
              color: theme('colors.muted.light'),
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/line-clamp'),
  ],
};
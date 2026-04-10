/**
 * E-Code Mobile Design System
 * Apple-inspired design tokens for world-class mobile IDE experience
 *
 * Following Apple Human Interface Guidelines and Replit design principles
 */

// ============================================================================
// COLORS - iOS Dynamic Color System
// ============================================================================

export const colors = {
  // Primary Brand Colors
  primary: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    200: '#90CAF9',
    300: '#64B5F6',
    400: '#42A5F5',
    500: '#2196F3', // Main brand color
    600: '#1E88E5',
    700: '#1976D2',
    800: '#1565C0',
    900: '#0D47A1',
  },

  // Semantic Colors (Light Mode)
  light: {
    // Backgrounds (iOS layered approach)
    background: {
      primary: '#FFFFFF',
      secondary: '#F2F2F7',
      tertiary: '#FFFFFF',
      elevated: '#FFFFFF',
      grouped: {
        primary: '#F2F2F7',
        secondary: '#FFFFFF',
        tertiary: '#F2F2F7',
      },
    },

    // Text
    text: {
      primary: '#000000',
      secondary: 'rgba(60, 60, 67, 0.6)',
      tertiary: 'rgba(60, 60, 67, 0.3)',
      quaternary: 'rgba(60, 60, 67, 0.18)',
      placeholder: 'rgba(60, 60, 67, 0.3)',
    },

    // Fills (for controls)
    fill: {
      primary: 'rgba(120, 120, 128, 0.2)',
      secondary: 'rgba(120, 120, 128, 0.16)',
      tertiary: 'rgba(118, 118, 128, 0.12)',
      quaternary: 'rgba(116, 116, 128, 0.08)',
    },

    // Separators
    separator: {
      opaque: 'rgba(198, 198, 200, 1)',
      nonOpaque: 'rgba(60, 60, 67, 0.29)',
    },

    // Interactive elements
    interactive: {
      primary: '#007AFF',
      secondary: '#5856D6',
      tertiary: '#AF52DE',
    },

    // Feedback colors
    feedback: {
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      info: '#007AFF',
    },

    // Code editor syntax
    syntax: {
      keyword: '#AF52DE',
      string: '#D73A49',
      number: '#005CC5',
      comment: '#6A737D',
      function: '#6F42C1',
      variable: '#24292E',
      operator: '#D73A49',
      tag: '#22863A',
      attribute: '#6F42C1',
    },
  },

  // Dark Mode (iOS)
  dark: {
    background: {
      primary: '#000000',
      secondary: '#1C1C1E',
      tertiary: '#2C2C2E',
      elevated: '#1C1C1E',
      grouped: {
        primary: '#000000',
        secondary: '#1C1C1E',
        tertiary: '#2C2C2E',
      },
    },

    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(235, 235, 245, 0.6)',
      tertiary: 'rgba(235, 235, 245, 0.3)',
      quaternary: 'rgba(235, 235, 245, 0.18)',
      placeholder: 'rgba(235, 235, 245, 0.3)',
    },

    fill: {
      primary: 'rgba(120, 120, 128, 0.36)',
      secondary: 'rgba(120, 120, 128, 0.32)',
      tertiary: 'rgba(118, 118, 128, 0.24)',
      quaternary: 'rgba(118, 118, 128, 0.18)',
    },

    separator: {
      opaque: 'rgba(56, 56, 58, 1)',
      nonOpaque: 'rgba(84, 84, 88, 0.65)',
    },

    interactive: {
      primary: '#0A84FF',
      secondary: '#5E5CE6',
      tertiary: '#BF5AF2',
    },

    feedback: {
      success: '#30D158',
      warning: '#FF9F0A',
      error: '#FF453A',
      info: '#0A84FF',
    },

    syntax: {
      keyword: '#FF7AB2',
      string: '#FF8170',
      number: '#D9C97C',
      comment: '#6C7986',
      function: '#B281EB',
      variable: '#ACF2E4',
      operator: '#FF7AB2',
      tag: '#6BDFFF',
      attribute: '#DABAFF',
    },
  },
} as const;

// ============================================================================
// TYPOGRAPHY - San Francisco Pro (Apple's system font)
// ============================================================================

export const typography = {
  // Font families
  fontFamily: {
    system: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    mono: '"SF Mono", "Roboto Mono", "Fira Code", Consolas, Monaco, "Courier New", monospace',
    rounded: '"SF Pro Rounded", -apple-system, BlinkMacSystemFont, sans-serif',
  },

  // iOS Text Styles (Dynamic Type)
  textStyles: {
    largeTitle: {
      fontSize: '34px',
      lineHeight: '41px',
      fontWeight: 700,
      letterSpacing: '0.374px',
    },
    title1: {
      fontSize: '28px',
      lineHeight: '34px',
      fontWeight: 700,
      letterSpacing: '0.364px',
    },
    title2: {
      fontSize: '22px',
      lineHeight: '28px',
      fontWeight: 700,
      letterSpacing: '0.352px',
    },
    title3: {
      fontSize: '20px',
      lineHeight: '25px',
      fontWeight: 600,
      letterSpacing: '0.38px',
    },
    headline: {
      fontSize: '17px',
      lineHeight: '22px',
      fontWeight: 600,
      letterSpacing: '-0.408px',
    },
    body: {
      fontSize: '17px',
      lineHeight: '22px',
      fontWeight: 400,
      letterSpacing: '-0.408px',
    },
    callout: {
      fontSize: '16px',
      lineHeight: '21px',
      fontWeight: 400,
      letterSpacing: '-0.32px',
    },
    subheadline: {
      fontSize: '15px',
      lineHeight: '20px',
      fontWeight: 400,
      letterSpacing: '-0.24px',
    },
    footnote: {
      fontSize: '13px',
      lineHeight: '18px',
      fontWeight: 400,
      letterSpacing: '-0.078px',
    },
    caption1: {
      fontSize: '12px',
      lineHeight: '16px',
      fontWeight: 400,
      letterSpacing: '0px',
    },
    caption2: {
      fontSize: '11px',
      lineHeight: '13px',
      fontWeight: 400,
      letterSpacing: '0.066px',
    },
  },

  // Code editor specific
  code: {
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 400,
  },
} as const;

// ============================================================================
// SPACING - 8pt Grid System (Apple standard)
// ============================================================================

export const spacing = {
  0: '0',
  1: '2px',   // 0.25 * 8
  2: '4px',   // 0.5 * 8
  3: '8px',   // 1 * 8
  4: '12px',  // 1.5 * 8
  5: '16px',  // 2 * 8
  6: '20px',  // 2.5 * 8
  7: '24px',  // 3 * 8
  8: '32px',  // 4 * 8
  9: '40px',  // 5 * 8
  10: '48px', // 6 * 8
  11: '56px', // 7 * 8
  12: '64px', // 8 * 8
  13: '72px', // 9 * 8
  14: '80px', // 10 * 8
  15: '96px', // 12 * 8
  16: '128px', // 16 * 8
} as const;

// ============================================================================
// BORDER RADIUS - iOS style rounded corners
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
  full: '9999px',
  // iOS specific continuous corners (approximation)
  continuous: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '18px',
  },
} as const;

// ============================================================================
// SHADOWS - iOS depth and elevation
// ============================================================================

export const shadows = {
  // iOS standard shadows
  sm: {
    light: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    dark: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
  },
  md: {
    light: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    dark: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
  },
  lg: {
    light: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    dark: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)',
  },
  xl: {
    light: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    dark: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)',
  },
  // iOS modal shadow
  modal: {
    light: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    dark: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
  },
} as const;

// ============================================================================
// Z-INDEX - Layering system
// ============================================================================

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  notification: 1080,
  commandPalette: 1090,
  max: 9999,
} as const;

// ============================================================================
// ANIMATIONS - Apple-quality motion design
// ============================================================================

export const animations = {
  // Durations (Apple standard)
  duration: {
    instant: '100ms',
    fast: '200ms',
    normal: '300ms',
    slow: '400ms',
    slower: '600ms',
  },

  // Easing functions (iOS bezier curves)
  easing: {
    // Standard iOS ease curves
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',

    // Apple spring-like easing
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',

    // Smooth iOS animations
    smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    snappy: 'cubic-bezier(0.4, 0.0, 0.0, 1)',
  },

  // Framer Motion spring configs
  spring: {
    // Responsive spring (feels snappy)
    responsive: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30,
      mass: 0.8,
    },
    // Smooth spring (feels elegant)
    smooth: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 35,
      mass: 1,
    },
    // Bouncy spring (playful)
    bouncy: {
      type: 'spring' as const,
      stiffness: 500,
      damping: 20,
      mass: 1,
    },
    // Gentle spring (subtle)
    gentle: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 40,
      mass: 1.2,
    },
  },

  // Transitions
  transition: {
    fade: {
      duration: 0.2,
      ease: [0.4, 0.0, 0.2, 1],
    },
    scale: {
      duration: 0.3,
      ease: [0.175, 0.885, 0.32, 1.275],
    },
    slide: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
} as const;

// ============================================================================
// BREAKPOINTS - Responsive design
// ============================================================================

export const breakpoints = {
  // Device breakpoints
  xs: '375px',  // iPhone SE
  sm: '414px',  // iPhone Pro
  md: '768px',  // iPad
  lg: '1024px', // iPad Pro
  xl: '1280px', // Desktop
  '2xl': '1536px', // Large desktop

  // Queries
  queries: {
    mobile: '@media (max-width: 767px)',
    tablet: '@media (min-width: 768px) and (max-width: 1023px)',
    desktop: '@media (min-width: 1024px)',
    touch: '@media (hover: none) and (pointer: coarse)',
    hover: '@media (hover: hover) and (pointer: fine)',
  },
} as const;

// ============================================================================
// TOUCH TARGETS - Accessibility and usability
// ============================================================================

export const touchTargets = {
  // Minimum touch target sizes (Apple HIG)
  min: '44px',
  comfortable: '48px',
  large: '56px',

  // Hit slop for better tap accuracy
  hitSlop: {
    small: '8px',
    medium: '12px',
    large: '16px',
  },
} as const;

// ============================================================================
// BLUR - iOS-style backdrop blur
// ============================================================================

export const blur = {
  none: 'blur(0)',
  sm: 'blur(4px)',
  md: 'blur(8px)',
  lg: 'blur(12px)',
  xl: 'blur(16px)',
  '2xl': 'blur(24px)',
  '3xl': 'blur(40px)',
} as const;

// ============================================================================
// HAPTICS - Touch feedback types
// ============================================================================

export const haptics = {
  // iOS Haptic Types
  impact: {
    light: 'light',
    medium: 'medium',
    heavy: 'heavy',
    rigid: 'rigid',
    soft: 'soft',
  },
  notification: {
    success: 'success',
    warning: 'warning',
    error: 'error',
  },
  selection: 'selection',
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get color value based on theme
 */
export const getColor = (path: string, theme: 'light' | 'dark' = 'light') => {
  const keys = path.split('.');
  let value: any = theme === 'light' ? colors.light : colors.dark;

  for (const key of keys) {
    value = value?.[key];
  }

  return value || colors.light.text.primary;
};

/**
 * Get responsive spacing
 */
export const getSpacing = (...values: Array<keyof typeof spacing>) => {
  return values.map(v => spacing[v]).join(' ');
};

/**
 * Apply shadow based on theme
 */
export const getShadow = (
  size: keyof typeof shadows,
  theme: 'light' | 'dark' = 'light'
) => {
  const shadow = shadows[size];
  if (typeof shadow === 'object') {
    return shadow[theme];
  }
  return shadow;
};

// ============================================================================
// CSS CUSTOM PROPERTIES GENERATOR
// ============================================================================

/**
 * Generate CSS custom properties for the design system
 */
export const generateCSSVariables = (theme: 'light' | 'dark' = 'light') => {
  const themeColors = theme === 'light' ? colors.light : colors.dark;

  return {
    // Colors
    '--color-bg-primary': themeColors.background.primary,
    '--color-bg-secondary': themeColors.background.secondary,
    '--color-bg-tertiary': themeColors.background.tertiary,
    '--color-text-primary': themeColors.text.primary,
    '--color-text-secondary': themeColors.text.secondary,
    '--color-text-tertiary': themeColors.text.tertiary,
    '--color-interactive-primary': themeColors.interactive.primary,
    '--color-success': themeColors.feedback.success,
    '--color-warning': themeColors.feedback.warning,
    '--color-error': themeColors.feedback.error,

    // Typography
    '--font-family-system': typography.fontFamily.system,
    '--font-family-mono': typography.fontFamily.mono,

    // Spacing
    '--spacing-xs': spacing[3],
    '--spacing-sm': spacing[4],
    '--spacing-md': spacing[5],
    '--spacing-lg': spacing[7],
    '--spacing-xl': spacing[9],

    // Border radius
    '--radius-sm': borderRadius.sm,
    '--radius-md': borderRadius.md,
    '--radius-lg': borderRadius.lg,
    '--radius-xl': borderRadius.xl,

    // Shadows
    '--shadow-sm': getShadow('sm', theme),
    '--shadow-md': getShadow('md', theme),
    '--shadow-lg': getShadow('lg', theme),

    // Animations
    '--duration-fast': animations.duration.fast,
    '--duration-normal': animations.duration.normal,
    '--easing-standard': animations.easing.standard,
  };
};

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  animations,
  breakpoints,
  touchTargets,
  blur,
  haptics,
  getColor,
  getSpacing,
  getShadow,
  generateCSSVariables,
};

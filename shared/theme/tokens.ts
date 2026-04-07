/**
 * Centralized Design Tokens for E-Code Platform
 * Unified Replit-like theme for web and mobile platforms
 * 
 * These tokens match Replit's dark workspace aesthetic with E-Code branding
 */

// Color palette (HSL format for Tailwind CSS compatibility)
export const colors = {
  // Primary E-Code brand colors
  orange: {
    primary: '#F26207',      // E-Code Orange
    hover: '#D04E00',
    light: '#FF7A2B',
    tint: '#ffe4d3',
  },
  yellow: {
    primary: '#F99D25',      // E-Code Yellow-Orange
  },
  
  // Neutral colors - Dark mode (Replit-like)
  dark: {
    background: '#0e1525',
    surface: '#1c2333',
    surfaceSecondary: '#262c3b',
    surfaceTertiary: '#2f3644',
    surfaceHover: 'rgba(59, 130, 246, 0.16)',
    surfaceElevated: 'rgba(28, 35, 51, 0.92)',
    border: '#313744',
    borderStrong: '#3a4358',
    text: '#f5f9fc',
    textSecondary: '#9ba3b3',
    textMuted: '#8b95a7',
  },
  
  // Neutral colors - Light mode
  light: {
    background: '#ffffff',
    surface: '#ffffff',
    surfaceSecondary: '#ffffff',
    surfaceTertiary: '#f8f9fa',
    surfaceHover: '#f5f5f5',
    surfaceElevated: '#ffffff',
    border: '#e0e0e0',
    borderStrong: '#c1c8cd',
    text: '#1a1a1a',
    textSecondary: '#333333',
    textMuted: '#666666',
  },
  
  // Semantic colors
  semantic: {
    danger: '#dc3545',
    dangerDark: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    infoDark: '#38bdf8',
    success: '#10b981',
    successDark: '#34d399',
  },
  
  // Component-specific colors
  sidebar: {
    light: {
      bg: '#f7f8fa',
      hover: '#eef0f3',
      active: '#F26207',
      border: '#dfe3e8',
    },
    dark: {
      bg: '#1c2333',
      hover: '#262c3b',
      active: '#F26207',
      border: '#313744',
    },
  },
  
  editor: {
    light: {
      bg: '#ffffff',
      gutter: '#f7f8fa',
      selection: '#ffe4d3',
      lineHighlight: '#f7f8fa',
    },
    dark: {
      bg: '#0e1525',
      gutter: '#1c2333',
      selection: '#2d4a7c',
      lineHighlight: '#1a2332',
    },
  },
  
  terminal: {
    bg: '#0e1525',
    text: '#f5f9fc',
    cursor: '#F26207',
  },
  
  button: {
    light: {
      primary: '#F26207',
      primaryHover: '#D04E00',
      secondary: '#f7f8fa',
      secondaryHover: '#eef0f3',
    },
    dark: {
      primary: '#F26207',
      primaryHover: '#FF7A2B',
      secondary: '#262c3b',
      secondaryHover: '#313744',
    },
  },
};

// Spacing scale (Replit system)
export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
};

// Typography
export const typography = {
  fonts: {
    sans: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    mono: "'IBM Plex Mono', 'SF Mono', Monaco, 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', 'Source Code Pro', monospace",
  },
  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeights: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
};

// Border radius (Replit values)
export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

// Shadows
export const shadows = {
  light: {
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    md: '0 4px 8px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 12px 24px -6px rgba(0, 0, 0, 0.12)',
  },
  dark: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 20px rgba(0, 0, 0, 0.5)',
  },
};

// Z-index layers
export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1100,
  popover: 1060,
  tooltip: 1200,
  notification: 1300,
};

// Transitions
export const transitions = {
  fast: '0.1s cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

// Breakpoints (for mobile responsiveness)
export const breakpoints = {
  mobile: '768px',
  tablet: '1024px',
  desktop: '1280px',
};

// Export unified token object
export const tokens = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  zIndex,
  transitions,
  breakpoints,
};

export default tokens;

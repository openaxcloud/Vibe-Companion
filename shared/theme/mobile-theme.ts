/**
 * Mobile Theme Utilities
 * Provides React Native-compatible theme objects from shared tokens
 */

import { tokens } from './tokens';

/**
 * Mobile color palette (dark mode by default for Replit-like aesthetic)
 */
export const mobileColors = {
  // Primary colors
  primary: tokens.colors.orange.primary,
  primaryHover: tokens.colors.orange.light,
  secondary: tokens.colors.yellow.primary,
  
  // Background (dark mode)
  background: tokens.colors.dark.background,
  surface: tokens.colors.dark.surface,
  surfaceSecondary: tokens.colors.dark.surfaceSecondary,
  surfaceTertiary: tokens.colors.dark.surfaceTertiary,
  surfaceHover: tokens.colors.dark.surfaceHover,
  surfaceElevated: tokens.colors.dark.surfaceElevated,
  
  // Borders
  border: tokens.colors.dark.border,
  borderStrong: tokens.colors.dark.borderStrong,
  
  // Text
  text: tokens.colors.dark.text,
  textSecondary: tokens.colors.dark.textSecondary,
  textMuted: tokens.colors.dark.textMuted,
  
  // Semantic
  danger: tokens.colors.semantic.dangerDark,
  warning: tokens.colors.semantic.warning,
  info: tokens.colors.semantic.infoDark,
  success: tokens.colors.semantic.successDark,
  
  // Sidebar
  sidebarBg: tokens.colors.sidebar.dark.bg,
  sidebarHover: tokens.colors.sidebar.dark.hover,
  sidebarActive: tokens.colors.sidebar.dark.active,
  sidebarBorder: tokens.colors.sidebar.dark.border,
  
  // Editor
  editorBg: tokens.colors.editor.dark.bg,
  editorGutter: tokens.colors.editor.dark.gutter,
  editorSelection: tokens.colors.editor.dark.selection,
  editorLineHighlight: tokens.colors.editor.dark.lineHighlight,
  
  // Terminal
  terminalBg: tokens.colors.terminal.bg,
  terminalText: tokens.colors.terminal.text,
  terminalCursor: tokens.colors.terminal.cursor,
  
  // Buttons
  buttonPrimary: tokens.colors.button.dark.primary,
  buttonPrimaryHover: tokens.colors.button.dark.primaryHover,
  buttonSecondary: tokens.colors.button.dark.secondary,
  buttonSecondaryHover: tokens.colors.button.dark.secondaryHover,
};

/**
 * Mobile spacing scale
 */
export const mobileSpacing = {
  xs: parseInt(tokens.spacing[1]),    // 4
  sm: parseInt(tokens.spacing[2]),    // 8
  md: parseInt(tokens.spacing[3]),    // 12
  lg: parseInt(tokens.spacing[4]),    // 16
  xl: parseInt(tokens.spacing[5]),    // 20
  '2xl': parseInt(tokens.spacing[6]), // 24
  '3xl': parseInt(tokens.spacing[8]), // 32
  '4xl': parseInt(tokens.spacing[10]), // 40
};

/**
 * Mobile typography
 */
export const mobileTypography = {
  fontFamily: {
    sans: tokens.typography.fonts.sans,
    mono: tokens.typography.fonts.mono,
  },
  fontSize: {
    xs: parseInt(tokens.typography.sizes.xs),
    sm: parseInt(tokens.typography.sizes.sm),
    base: parseInt(tokens.typography.sizes.base),
    lg: parseInt(tokens.typography.sizes.lg),
    xl: parseInt(tokens.typography.sizes.xl),
    '2xl': parseInt(tokens.typography.sizes['2xl']),
    '3xl': parseInt(tokens.typography.sizes['3xl']),
    '4xl': parseInt(tokens.typography.sizes['4xl']),
  },
  fontWeight: {
    normal: tokens.typography.weights.normal,
    medium: tokens.typography.weights.medium,
    semibold: tokens.typography.weights.semibold,
    bold: tokens.typography.weights.bold,
  },
  lineHeight: {
    tight: parseFloat(tokens.typography.lineHeights.tight),
    normal: parseFloat(tokens.typography.lineHeights.normal),
    relaxed: parseFloat(tokens.typography.lineHeights.relaxed),
  },
};

/**
 * Mobile border radius
 */
export const mobileBorderRadius = {
  sm: parseInt(tokens.borderRadius.sm),
  md: parseInt(tokens.borderRadius.md),
  lg: parseInt(tokens.borderRadius.lg),
  xl: parseInt(tokens.borderRadius.xl),
  full: 9999,
};

/**
 * Mobile shadows (for elevation)
 */
export const mobileShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
};

/**
 * Unified mobile theme object
 */
export const mobileTheme = {
  colors: mobileColors,
  spacing: mobileSpacing,
  typography: mobileTypography,
  borderRadius: mobileBorderRadius,
  shadows: mobileShadows,
  transitions: tokens.transitions,
};

export default mobileTheme;

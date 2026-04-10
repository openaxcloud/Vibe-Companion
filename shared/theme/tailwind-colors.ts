/**
 * Tailwind Color Configuration
 * Extends Tailwind with E-Code branded colors from shared tokens
 */

import { tokens } from './tokens';

/**
 * Convert hex color to RGB values for Tailwind opacity support
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0 0';
  return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
}

/**
 * Tailwind-compatible color extensions
 */
export const tailwindColors = {
  'ecode-orange': {
    DEFAULT: tokens.colors.orange.primary,
    hover: tokens.colors.orange.hover,
    light: tokens.colors.orange.light,
    tint: tokens.colors.orange.tint,
  },
  'ecode-yellow': {
    DEFAULT: tokens.colors.yellow.primary,
  },
  // Add semantic colors for easier access
  'ecode-danger': tokens.colors.semantic.danger,
  'ecode-warning': tokens.colors.semantic.warning,
  'ecode-info': tokens.colors.semantic.info,
  'ecode-success': tokens.colors.semantic.success,
};

/**
 * Spacing scale for Tailwind
 */
export const tailwindSpacing = {
  'ecode-1': tokens.spacing[1],
  'ecode-2': tokens.spacing[2],
  'ecode-3': tokens.spacing[3],
  'ecode-4': tokens.spacing[4],
  'ecode-5': tokens.spacing[5],
  'ecode-6': tokens.spacing[6],
  'ecode-8': tokens.spacing[8],
  'ecode-10': tokens.spacing[10],
  'ecode-12': tokens.spacing[12],
};

/**
 * Border radius for Tailwind
 */
export const tailwindBorderRadius = {
  'ecode-sm': tokens.borderRadius.sm,
  'ecode-md': tokens.borderRadius.md,
  'ecode-lg': tokens.borderRadius.lg,
};

export default {
  colors: tailwindColors,
  spacing: tailwindSpacing,
  borderRadius: tailwindBorderRadius,
};

/**
 * CSS Variables Generator
 * Converts shared tokens to CSS variable strings for web platform
 */

import { tokens } from './tokens';

/**
 * Generate CSS custom properties from tokens
 * Used to populate :root and .dark class selectors
 */
export function generateCSSVariables(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  
  return {
    // Shadcn/Tailwind design tokens (HSL format)
    '--background': isDark ? '221.7 45.1% 10%' : '0 0% 99%',
    '--foreground': isDark ? '205.7 53.8% 97.5%' : '222 47% 11%',
    '--card': isDark ? '221.7 29.1% 15.5%' : '0 0% 100%',
    '--card-foreground': isDark ? '205.7 53.8% 97.5%' : '222 47% 11%',
    '--popover': isDark ? '221.7 29.1% 15.5%' : '0 0% 100%',
    '--popover-foreground': isDark ? '205.7 53.8% 97.5%' : '222 47% 11%',
    '--primary': '24 96 49',  // E-Code Orange (both modes)
    '--primary-foreground': isDark ? '210 40% 98%' : '0 0% 100%',
    '--secondary': isDark ? '222.9 21.6% 19%' : '39 96 56',
    '--secondary-foreground': isDark ? '205.7 53.8% 97.5%' : '0 0% 0%',
    '--muted': isDark ? '222.9 21.6% 19%' : '210 17% 96%',
    '--muted-foreground': isDark ? '220 13.6% 65.5%' : '215 16% 40%',
    '--accent': isDark ? '222.9 21.6% 19%' : '39 96 56',
    '--accent-foreground': isDark ? '205.7 53.8% 97.5%' : '0 0% 0%',
    '--destructive': '0 84% 60%',
    '--destructive-foreground': isDark ? '210 40% 98%' : '0 0% 100%',
    '--border': isDark ? '221.1 16.2% 22.9%' : '214 32% 88%',
    '--input': isDark ? '221.1 16.2% 22.9%' : '214 32% 90%',
    '--ring': '24 96 49',  // E-Code Orange (both modes)
    
    // Chart colors
    '--chart-1': '24 96 49',  // E-Code Orange
    '--chart-2': isDark ? '160.1 84.1% 39.4%' : '39 96 56',
    '--chart-3': isDark ? '24.6 95% 61%' : '142 71% 45%',
    '--chart-4': isDark ? '258.3 89.5% 70.3%' : '38 92% 50%',
    '--chart-5': isDark ? '0 84.2% 65.2%' : '280 87% 65%',
    
    // Sidebar colors
    '--sidebar-background': isDark ? '221.7 29.1% 15.5%' : '0 0% 98%',
    '--sidebar-foreground': isDark ? '205.7 53.8% 97.5%' : '222 47% 11%',
    '--sidebar-primary': '24 96 49',  // E-Code Orange
    '--sidebar-primary-foreground': isDark ? '210 40% 98%' : '0 0% 100%',
    '--sidebar-accent': isDark ? '222.9 21.6% 19%' : '39 96 56',
    '--sidebar-accent-foreground': isDark ? '205.7 53.8% 97.5%' : '222 47% 11%',
    '--sidebar-border': isDark ? '221.1 16.2% 22.9%' : '220 13% 88%',
    '--sidebar-ring': '24 96 49',  // E-Code Orange
    '--background-rgb': isDark ? '14, 21, 37' : '252, 252, 253',
    
    // E-Code custom tokens
    '--ecode-background': isDark ? tokens.colors.dark.background : tokens.colors.light.background,
    '--ecode-surface': isDark ? tokens.colors.dark.surface : tokens.colors.light.surface,
    '--ecode-surface-secondary': isDark ? tokens.colors.dark.surfaceSecondary : tokens.colors.light.surfaceSecondary,
    '--ecode-surface-tertiary': isDark ? tokens.colors.dark.surfaceTertiary : tokens.colors.light.surfaceTertiary,
    '--ecode-surface-hover': isDark ? tokens.colors.dark.surfaceHover : tokens.colors.light.surfaceHover,
    '--ecode-surface-elevated': isDark ? tokens.colors.dark.surfaceElevated : tokens.colors.light.surfaceElevated,
    '--ecode-border': isDark ? tokens.colors.dark.border : tokens.colors.light.border,
    '--ecode-border-strong': isDark ? tokens.colors.dark.borderStrong : tokens.colors.light.borderStrong,
    '--ecode-text': isDark ? tokens.colors.dark.text : tokens.colors.light.text,
    '--ecode-text-secondary': isDark ? tokens.colors.dark.textSecondary : tokens.colors.light.textSecondary,
    '--ecode-text-muted': isDark ? tokens.colors.dark.textMuted : tokens.colors.light.textMuted,
    '--ecode-accent': tokens.colors.orange.primary,
    '--ecode-accent-hover': isDark ? tokens.colors.orange.light : tokens.colors.orange.hover,
    '--ecode-danger': isDark ? tokens.colors.semantic.dangerDark : tokens.colors.semantic.danger,
    '--ecode-warning': tokens.colors.semantic.warning,
    '--ecode-info': isDark ? tokens.colors.semantic.infoDark : tokens.colors.semantic.info,
    
    // Sidebar
    '--ecode-sidebar-bg': isDark ? tokens.colors.sidebar.dark.bg : tokens.colors.sidebar.light.bg,
    '--ecode-sidebar-hover': isDark ? tokens.colors.sidebar.dark.hover : tokens.colors.sidebar.light.hover,
    '--ecode-sidebar-active': isDark ? tokens.colors.sidebar.dark.active : tokens.colors.sidebar.light.active,
    '--ecode-sidebar-border': isDark ? tokens.colors.sidebar.dark.border : tokens.colors.sidebar.light.border,
    
    // Editor
    '--ecode-editor-bg': isDark ? tokens.colors.editor.dark.bg : tokens.colors.editor.light.bg,
    '--ecode-editor-gutter': isDark ? tokens.colors.editor.dark.gutter : tokens.colors.editor.light.gutter,
    '--ecode-editor-selection': isDark ? tokens.colors.editor.dark.selection : tokens.colors.editor.light.selection,
    '--ecode-editor-line-highlight': isDark ? tokens.colors.editor.dark.lineHighlight : tokens.colors.editor.light.lineHighlight,
    
    // Terminal
    '--ecode-terminal-bg': tokens.colors.terminal.bg,
    '--ecode-terminal-text': tokens.colors.terminal.text,
    '--ecode-terminal-cursor': tokens.colors.terminal.cursor,
    
    // Buttons
    '--ecode-button-primary': isDark ? tokens.colors.button.dark.primary : tokens.colors.button.light.primary,
    '--ecode-button-primary-hover': isDark ? tokens.colors.button.dark.primaryHover : tokens.colors.button.light.primaryHover,
    '--ecode-button-secondary': isDark ? tokens.colors.button.dark.secondary : tokens.colors.button.light.secondary,
    '--ecode-button-secondary-hover': isDark ? tokens.colors.button.dark.secondaryHover : tokens.colors.button.light.secondaryHover,
    
    // Shadows
    '--ecode-shadow-sm': isDark ? tokens.shadows.dark.sm : tokens.shadows.light.sm,
    '--ecode-shadow-md': isDark ? tokens.shadows.dark.md : tokens.shadows.light.md,
    '--ecode-shadow-lg': isDark ? tokens.shadows.dark.lg : tokens.shadows.light.lg,
    
    // Spacing
    '--ecode-space-1': tokens.spacing[1],
    '--ecode-space-2': tokens.spacing[2],
    '--ecode-space-3': tokens.spacing[3],
    '--ecode-space-4': tokens.spacing[4],
    '--ecode-space-5': tokens.spacing[5],
    '--ecode-space-6': tokens.spacing[6],
    '--ecode-space-8': tokens.spacing[8],
    '--ecode-space-10': tokens.spacing[10],
    '--ecode-space-12': tokens.spacing[12],
    
    // Typography
    '--ecode-font-mono': tokens.typography.fonts.mono,
    '--ecode-font-sans': tokens.typography.fonts.sans,
    
    // Border radius
    '--ecode-radius-sm': tokens.borderRadius.sm,
    '--ecode-radius-md': tokens.borderRadius.md,
    '--ecode-radius-lg': tokens.borderRadius.lg,
    
    // Z-index
    '--ecode-z-dropdown': tokens.zIndex.dropdown.toString(),
    '--ecode-z-modal': tokens.zIndex.modal.toString(),
    '--ecode-z-tooltip': tokens.zIndex.tooltip.toString(),
    '--ecode-z-notification': tokens.zIndex.notification.toString(),
  };
}

/**
 * Export CSS variable strings for direct injection
 */
export const cssVariablesLight = generateCSSVariables('light');
export const cssVariablesDark = generateCSSVariables('dark');

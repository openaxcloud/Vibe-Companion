/**
 * Replit-Identical Responsive Configuration
 * Canonical breakpoints matching Replit's design system
 * @module responsive-config
 */

// Official Replit breakpoints
export const BREAKPOINTS = {
  mobile: {
    max: 767,        // Mobile: <768px
    compact: 480,    // Compact mobile: <480px (single column)
  },
  tablet: {
    min: 768,
    max: 1023,
    keyboard: true,  // Detect physical keyboard for mode switching
  },
  laptop: {
    min: 1024,
    max: 1279,
  },
  desktop: {
    min: 1280,       // Desktop: ≥1280px (full IDE layout)
  },
} as const;

// Device type detection
export type DeviceType = 'mobile' | 'tablet' | 'laptop' | 'desktop';

export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop'; // SSR fallback
  
  const width = window.innerWidth;
  
  if (width < BREAKPOINTS.mobile.max) return 'mobile';
  if (width >= BREAKPOINTS.tablet.min && width <= BREAKPOINTS.tablet.max) return 'tablet';
  if (width >= BREAKPOINTS.laptop.min && width <= BREAKPOINTS.laptop.max) return 'laptop';
  return 'desktop';
}

// Layout modes by breakpoint
export interface LayoutMode {
  columns: 1 | 2 | 3 | 4;
  navigation: 'bottom' | 'side' | 'dock';
  panels: 'drawers' | 'collapsible' | 'visible';
  editor: 'fullwidth' | 'split' | 'multi-split';
}

export const LAYOUT_MODES: Record<DeviceType, LayoutMode> = {
  mobile: {
    columns: 1,
    navigation: 'bottom',
    panels: 'drawers',
    editor: 'fullwidth',
  },
  tablet: {
    columns: 2,
    navigation: 'side',
    panels: 'collapsible',
    editor: 'split',
  },
  laptop: {
    columns: 3,
    navigation: 'dock',
    panels: 'visible',
    editor: 'multi-split',
  },
  desktop: {
    columns: 3,
    navigation: 'dock',
    panels: 'visible',
    editor: 'multi-split',
  },
};

// Touch capabilities detection
export interface DeviceCapabilities {
  hasTouch: boolean;
  hasKeyboard: boolean;
  hasHaptic: boolean;
  hasStandalone: boolean; // PWA installed
  orientation: 'portrait' | 'landscape';
}

export function getDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      hasTouch: false,
      hasKeyboard: true,
      hasHaptic: false,
      hasStandalone: false,
      orientation: 'landscape',
    };
  }
  
  return {
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    hasKeyboard: window.innerWidth >= BREAKPOINTS.tablet.min,
    hasHaptic: 'vibrate' in navigator,
    hasStandalone: window.matchMedia('(display-mode: standalone)').matches,
    orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
  };
}

// Media query helpers
export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.mobile.max}px)`,
  tablet: `(min-width: ${BREAKPOINTS.tablet.min}px) and (max-width: ${BREAKPOINTS.tablet.max}px)`,
  laptop: `(min-width: ${BREAKPOINTS.laptop.min}px) and (max-width: ${BREAKPOINTS.laptop.max}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop.min}px)`,
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
  touch: '(hover: none) and (pointer: coarse)',
  pointer: '(hover: hover) and (pointer: fine)',
} as const;

// Responsive design tokens
export const RESPONSIVE_TOKENS = {
  // Tap targets (mobile)
  tapTarget: {
    min: 44, // 44x44px minimum
    comfortable: 48,
  },
  
  // Spacing
  spacing: {
    mobile: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
    },
    desktop: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
  },
  
  // Font sizes
  fontSize: {
    mobile: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
    },
    desktop: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
    },
  },
  
  // Panel widths
  panelWidth: {
    mobile: '100%',
    tablet: 320,
    desktop: 280,
  },
  
  // Terminal heights
  terminalHeight: {
    mobile: '50%',
    desktop: 300,
  },
} as const;

// Tablet Grid System - Responsive 2-column layouts optimized for 768px-1024px
export const TABLET_GRID_CLASSES = {
  // Dashboard projects grid: 1 → 2 → 2 → 3 → 4 columns
  projects: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  projectsTabletOptimized: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  
  // Quick actions grid: 2 → 3 → 4 columns (tablet gets 3 instead of 4)
  quickActions: 'grid-cols-2 md:grid-cols-4',
  quickActionsTabletOptimized: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  
  // File browser grid: 1 → 2 columns on tablet
  fileBrowser: 'grid-cols-1',
  fileBrowserTabletOptimized: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-1',
  
  // Settings panels: 1 → 1 → 3 columns (tablet maintains sidebar)
  settings: 'grid-cols-1 gap-6 md:grid-cols-4',
  settingsTabletOptimized: 'grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4',
  
  // Settings content: Full width on mobile/tablet, 3-column on desktop
  settingsContent: 'md:col-span-3',
  settingsContentTabletOptimized: 'md:col-span-2 lg:col-span-3',
  
  // Generic 2-column grid for tablets
  twoColumn: 'grid-cols-1 md:grid-cols-2',
  
  // Cards grid: 1 → 2 → 3 → 4 columns
  cards: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  cardsTabletOptimized: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
} as const;

// Helper to get tablet-optimized grid classes
export function getTabletGridClass(component: keyof typeof TABLET_GRID_CLASSES): string {
  return TABLET_GRID_CLASSES[component];
}

/**
 * Tablet Components Index
 * Central export point for tablet-optimized UI components
 * 
 * tablet-10: Default export is EnhancedTabletIDEView (direct component, not lazy)
 * This matches the mobile pattern to avoid double lazy loading issues
 */

// Enhanced version with IDEProvider (matches mobile pattern)
export { EnhancedTabletIDEView } from './EnhancedTabletIDEView';

// Lazy-loaded version (for internal use only)
export { LazyTabletIDEView } from './LazyTabletIDEView';

// Direct import (for types and edge cases)
export { TabletIDEView } from './TabletIDEView';
export { TabletDrawerContent } from './TabletDrawerContent';
export type { TabletPanel } from './TabletIDEView';

// Re-export EnhancedTabletIDEView as default for lazy loading from IDEPage
// This follows the same pattern as mobile/index.ts
export { EnhancedTabletIDEView as default } from './EnhancedTabletIDEView';

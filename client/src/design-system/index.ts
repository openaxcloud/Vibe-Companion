/**
 * E-Code Mobile Design System
 * Central export for all design system components, hooks, and tokens
 */

// ============================================================================
// DESIGN TOKENS
// ============================================================================

import tokensModule from './tokens';
export { default as tokens } from './tokens';
export * from './tokens';

// ============================================================================
// HOOKS
// ============================================================================

import {
  useDesignSystem as _useDesignSystem,
  useDeviceType as _useDeviceType,
  useIsTouchDevice as _useIsTouchDevice,
  useResponsiveValue as _useResponsiveValue,
  useSafeArea as _useSafeArea,
} from './hooks/useDesignSystem';
export { useDesignSystem, useDeviceType, useIsTouchDevice, useResponsiveValue, useSafeArea } from './hooks/useDesignSystem';
export type { Theme, DeviceType } from './hooks/useDesignSystem';

import {
  useSwipeGesture as _useSwipeGesture,
  useLongPress as _useLongPress,
  usePullToRefresh as _usePullToRefresh,
  usePinchToZoom as _usePinchToZoom,
  useSwipeBack as _useSwipeBack,
  useDoubleTap as _useDoubleTap,
  triggerHaptic as _triggerHaptic,
} from './hooks/useGestures';
export {
  useSwipeGesture,
  useLongPress,
  usePullToRefresh,
  usePinchToZoom,
  useSwipeBack,
  useDoubleTap,
  triggerHaptic,
} from './hooks/useGestures';
export type {
  SwipeConfig,
  LongPressConfig,
  PullToRefreshConfig,
  PinchToZoomConfig,
  SwipeBackConfig,
  DoubleTapConfig,
} from './hooks/useGestures';

// ============================================================================
// COMPONENTS
// ============================================================================

// Toast Notifications
import { ToastProvider as _ToastProvider, useToast as _useToast } from './components/Toast';
export { ToastProvider, useToast } from './components/Toast';
export type { Toast, ToastType, ToastPosition } from './components/Toast';

// Empty States
import { EmptyState as _EmptyState } from './components/EmptyState';
export {
  EmptyState,
  NoFilesEmptyState,
  SearchEmptyState,
  ErrorEmptyState,
  NetworkEmptyState,
} from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';

// Loading Skeletons
export {
  Skeleton,
  TextSkeleton,
  FileTreeSkeleton,
  CodeEditorSkeleton,
  TerminalSkeleton,
  CardSkeleton,
  ListSkeleton,
  TabBarSkeleton,
  IDELoadingSkeleton,
} from './components/Skeleton';
export type {
  SkeletonProps,
  TextSkeletonProps,
  CardSkeletonProps,
} from './components/Skeleton';

// Onboarding
export {
  Onboarding,
  FeatureSpotlight,
  defaultOnboardingSteps,
} from './components/Onboarding';
export type {
  OnboardingStep,
  OnboardingProps,
  SpotlightProps,
} from './components/Onboarding';

// Context Menu
export {
  ContextMenu,
  Dropdown,
  useContextMenu,
} from './components/ContextMenu';
export type {
  ContextMenuItem,
  ContextMenuSection,
  ContextMenuProps,
  UseContextMenuReturn,
} from './components/ContextMenu';

// Command Palette (re-exported from consolidated version)
export { CommandPalette, useCommandPalette, generateDefaultCommands } from '@/components/CommandPalette';
export type {
  CommandItem as Command,
  CommandCategory,
} from '@/components/CommandPalette';

// Search & Replace
export { SearchReplace } from './components/SearchReplace';
export type {
  SearchReplaceProps,
  SearchOptions,
  SearchResult,
} from './components/SearchReplace';

// File Upload
export { FileUpload } from './components/FileUpload';
export type {
  FileUploadProps,
  UploadingFile,
} from './components/FileUpload';

// Keyboard Shortcuts
export {
  KeyboardShortcuts,
  useKeyboardShortcuts,
  defaultIDEShortcuts,
} from './components/KeyboardShortcuts';
export type {
  Shortcut,
  KeyboardShortcutsProps,
} from './components/KeyboardShortcuts';

// Status Bar
export {
  StatusBar,
  NetworkIndicator,
  BatteryIndicator,
} from './components/StatusBar';
export type {
  ConnectionStatus,
  StatusBarProps,
} from './components/StatusBar';

// Settings
export { Settings } from './components/Settings';
export type {
  SettingsSection,
  SettingsItem,
  ToggleItem,
  SelectItem,
  SliderItem,
  ActionItem,
  InfoItem,
  SettingsProps,
} from './components/Settings';

// Split View
export {
  SplitView,
  TripleSplitView,
  TabPanel,
  MultiEditorLayout,
} from './components/SplitView';
export type {
  SplitOrientation,
  PaneSize,
  SplitViewProps,
  TripleSplitViewProps,
  Tab,
  TabPanelProps,
  EditorFile,
  MultiEditorLayoutProps,
} from './components/SplitView';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Apply design system CSS variables to an element
 */
export const applyDesignTokens = (
  element: HTMLElement,
  theme: 'light' | 'dark' = 'light'
) => {
  const variables = tokensModule.generateCSSVariables(theme);
  Object.entries(variables).forEach(([key, value]) => {
    element.style.setProperty(key, value as string);
  });
};

/**
 * Detect iOS device
 */
export const isIOS = () => {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

/**
 * Detect Android device
 */
export const isAndroid = () => {
  return /Android/.test(navigator.userAgent);
};

/**
 * Detect if device has notch/safe areas
 */
export const hasNotch = () => {
  if (!isIOS()) return false;

  const iPhone = /iPhone/.test(navigator.userAgent);
  const aspect = window.screen.width / window.screen.height;

  // iPhone X and later have aspect ratio > 0.5
  return iPhone && aspect > 0.5;
};

/**
 * Get safe area insets
 */
export const getSafeAreaInsets = () => {
  const getVar = (name: string) => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  };

  return {
    top: getVar('env(safe-area-inset-top)') || '0px',
    right: getVar('env(safe-area-inset-right)') || '0px',
    bottom: getVar('env(safe-area-inset-bottom)') || '0px',
    left: getVar('env(safe-area-inset-left)') || '0px',
  };
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Format time ago
 */
export const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `${interval}y ago`;

  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval}mo ago`;

  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval}d ago`;

  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval}h ago`;

  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval}m ago`;

  return 'just now';
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  tokens: tokensModule,
  useDesignSystem: _useDesignSystem,
  useSwipeGesture: _useSwipeGesture,
  useLongPress: _useLongPress,
  usePullToRefresh: _usePullToRefresh,
  usePinchToZoom: _usePinchToZoom,
  useSwipeBack: _useSwipeBack,
  useDoubleTap: _useDoubleTap,
  triggerHaptic: _triggerHaptic,
  ToastProvider: _ToastProvider,
  useToast: _useToast,
  EmptyState: _EmptyState,
  applyDesignTokens,
  isIOS,
  isAndroid,
  hasNotch,
  getSafeAreaInsets,
  formatFileSize,
  formatTimeAgo,
  truncate,
  debounce,
  throttle,
};

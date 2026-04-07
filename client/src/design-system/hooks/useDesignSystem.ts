/**
 * useDesignSystem Hook
 * Provides easy access to design system tokens with theme support
 */

import { useMemo } from 'react';
import { useMediaQuery } from 'react-responsive';
import tokens from '../tokens';

export type Theme = 'light' | 'dark' | 'auto';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Detect system theme preference
 */
const useSystemTheme = (): 'light' | 'dark' => {
  const prefersDark = useMediaQuery({ query: '(prefers-color-scheme: dark)' });
  return prefersDark ? 'dark' : 'light';
};

/**
 * Detect device type based on viewport
 */
export const useDeviceType = (): DeviceType => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1023 });

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
};

/**
 * Detect touch capability
 */
export const useIsTouchDevice = (): boolean => {
  const isTouch = useMediaQuery({ query: '(hover: none) and (pointer: coarse)' });
  return isTouch;
};

/**
 * Main design system hook
 */
export const useDesignSystem = (preferredTheme: Theme = 'auto') => {
  const systemTheme = useSystemTheme();
  const deviceType = useDeviceType();
  const isTouch = useIsTouchDevice();

  const activeTheme: 'light' | 'dark' = useMemo(() => {
    if (preferredTheme === 'auto') return systemTheme;
    return preferredTheme;
  }, [preferredTheme, systemTheme]);

  const colors = useMemo(
    () => (activeTheme === 'light' ? tokens.colors.light : tokens.colors.dark),
    [activeTheme]
  );

  const shadows = useMemo(
    () => ({
      sm: tokens.shadows.sm[activeTheme],
      md: tokens.shadows.md[activeTheme],
      lg: tokens.shadows.lg[activeTheme],
      xl: tokens.shadows.xl[activeTheme],
      modal: tokens.shadows.modal[activeTheme],
    }),
    [activeTheme]
  );

  const cssVariables = useMemo(
    () => tokens.generateCSSVariables(activeTheme),
    [activeTheme]
  );

  return {
    // Theme
    theme: activeTheme,
    isDark: activeTheme === 'dark',

    // Device info
    device: {
      type: deviceType,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isDesktop: deviceType === 'desktop',
      isTouch,
    },

    // Tokens
    colors,
    typography: tokens.typography,
    spacing: tokens.spacing,
    borderRadius: tokens.borderRadius,
    shadows,
    zIndex: tokens.zIndex,
    animations: tokens.animations,
    breakpoints: tokens.breakpoints,
    touchTargets: tokens.touchTargets,
    blur: tokens.blur,
    haptics: tokens.haptics,

    // CSS Variables
    cssVariables,

    // Helper functions
    getColor: (path: string) => tokens.getColor(path, activeTheme),
    getSpacing: tokens.getSpacing,
    getShadow: (size: keyof typeof tokens.shadows) =>
      tokens.getShadow(size, activeTheme),
  };
};

/**
 * Hook for responsive values
 * Returns different values based on device type
 */
export const useResponsiveValue = <T,>(values: {
  mobile?: T;
  tablet?: T;
  desktop: T;
}): T => {
  const deviceType = useDeviceType();

  if (deviceType === 'mobile' && values.mobile !== undefined) {
    return values.mobile;
  }
  if (deviceType === 'tablet' && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.desktop;
};

/**
 * Hook for safe area insets (iOS notch, Android navigation)
 */
export const useSafeArea = () => {
  return useMemo(() => {
    // Get CSS environment variables
    const top = 'env(safe-area-inset-top, 0px)';
    const right = 'env(safe-area-inset-right, 0px)';
    const bottom = 'env(safe-area-inset-bottom, 0px)';
    const left = 'env(safe-area-inset-left, 0px)';

    return { top, right, bottom, left };
  }, []);
};

export default useDesignSystem;

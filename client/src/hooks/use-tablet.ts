/**
 * useTablet Hook
 * React hook for tablet-specific detection and layout optimization
 * @module use-tablet
 */

import { useState, useEffect } from 'react';
import {
  detectTablet,
  getTabletLayout,
  isIPadMultitasking,
  TabletInfo,
  TabletLayout,
} from '@/utils/tablet-detection';

export interface UseTabletReturn extends TabletInfo {
  layout: TabletLayout;
  isMultitasking: boolean;
  refresh: () => void;
}

/**
 * Primary hook for tablet detection and layout configuration
 * Provides comprehensive tablet information with auto-refresh on resize/orientation
 */
export function useTablet(): UseTabletReturn {
  const [tabletInfo, setTabletInfo] = useState<TabletInfo>(detectTablet);
  const [isMultitasking, setIsMultitasking] = useState(isIPadMultitasking);
  
  const refresh = () => {
    setTabletInfo(detectTablet());
    setIsMultitasking(isIPadMultitasking());
  };
  
  useEffect(() => {
    // Update on resize and orientation change
    const handleUpdate = () => refresh();
    
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('orientationchange', handleUpdate);
    
    // Initial update
    handleUpdate();
    
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
    };
  }, []);
  
  const layout = getTabletLayout(tabletInfo);
  
  return {
    ...tabletInfo,
    layout,
    isMultitasking,
    refresh,
  };
}

/**
 * Convenience hook - returns true if current device is a tablet
 */
export function useIsTablet(): boolean {
  const { isTablet } = useTablet();
  return isTablet;
}

/**
 * Convenience hook - returns true if current device is an iPad
 */
export function useIsIPad(): boolean {
  const { isIPad } = useTablet();
  return isIPad;
}

/**
 * Convenience hook - returns true if iPad Pro
 */
export function useIsIPadPro(): boolean {
  const { isIPadPro } = useTablet();
  return isIPadPro;
}

/**
 * Hook for tablet layout configuration only
 * More efficient if you only need layout info
 */
export function useTabletLayout(): TabletLayout {
  const { layout } = useTablet();
  return layout;
}

/**
 * Hook for tablet orientation with optimized re-renders
 */
export function useTabletOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => {
    // SSR guard
    if (typeof window === 'undefined') return 'landscape';
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  });
  
  useEffect(() => {
    const handleOrientationChange = () => {
      const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      if (newOrientation !== orientation) {
        setOrientation(newOrientation);
      }
    };
    
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [orientation]);
  
  return orientation;
}

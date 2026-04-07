import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

// Canonical breakpoints per replit.md architecture
// Mobile: ≤640px, Tablet: 641-1024px, Laptop: 1025-1440px, Desktop: >1440px
export const useIsMobile = () => useMediaQuery('(max-width: 640px)');
export const useIsTablet = () => useMediaQuery('(min-width: 641px) and (max-width: 1024px)');
export const useIsLaptop = () => useMediaQuery('(min-width: 1025px) and (max-width: 1440px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1441px)');

// Combined helper for tablet detection (includes both iPad Pro sizes)
export const useIsTabletOrLaptop = () => useMediaQuery('(min-width: 641px) and (max-width: 1440px)');

// Device type discriminator for routing decisions
// CRITICAL: Must distinguish mobile landscape (phone rotated) from tablet portrait
export type DeviceType = 'mobile' | 'tablet' | 'laptop' | 'desktop';

// Constants for mobile landscape detection
const MOBILE_LANDSCAPE_MAX_HEIGHT = 500;
const TABLET_MIN_WIDTH = 641;
const TABLET_MAX_WIDTH = 1024;

// Detects if device is a phone (portrait or landscape) vs tablet/desktop
// Mobile landscape: width > 640 but height < 500 (phone rotated)
// Tablet portrait: width 641-1024 but height > 500 (actual tablet)
function detectMobileDevice(width: number, height: number): boolean {
  // Portrait mobile: narrow width
  if (width <= 640) {
    return true;
  }
  
  // Landscape mobile: medium width but short height (phone in landscape)
  // This distinguishes phone landscape from tablet portrait
  if (width >= TABLET_MIN_WIDTH && width <= TABLET_MAX_WIDTH && height < MOBILE_LANDSCAPE_MAX_HEIGHT) {
    return true;
  }
  
  // Wider landscape mobile (larger phones like iPhone Max in landscape)
  if (width > TABLET_MAX_WIDTH && height < MOBILE_LANDSCAPE_MAX_HEIGHT) {
    return true;
  }
  
  return false;
}

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  
  useEffect(() => {
    const updateDeviceType = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Check for mobile first (includes landscape phones)
      if (detectMobileDevice(width, height)) {
        setDeviceType('mobile');
        return;
      }
      
      // Tablet: medium width with tall height (not a phone in landscape)
      if (width >= TABLET_MIN_WIDTH && width <= TABLET_MAX_WIDTH) {
        setDeviceType('tablet');
        return;
      }
      
      // Laptop: larger screens
      if (width >= 1025 && width <= 1440) {
        setDeviceType('laptop');
        return;
      }
      
      // Desktop: extra large screens
      setDeviceType('desktop');
    };
    
    // Listen for both resize and orientation changes
    window.addEventListener('resize', updateDeviceType);
    window.addEventListener('orientationchange', updateDeviceType);
    
    // Initial check
    updateDeviceType();
    
    return () => {
      window.removeEventListener('resize', updateDeviceType);
      window.removeEventListener('orientationchange', updateDeviceType);
    };
  }, []);
  
  return deviceType;
}
/**
 * Smart Polling Hook - Production-Safe Rate Limiting
 * 
 * This hook provides intelligent polling that:
 * 1. Reduces frequency when page is not visible
 * 2. Respects production rate limits (500 req/60s on free tier)
 * 3. Uses longer intervals in production vs development
 * 4. Disables background polling by default
 */

import { useEffect, useState, useCallback } from 'react';

// Production vs development polling multipliers
const PRODUCTION_MULTIPLIER = import.meta.env.PROD ? 3 : 1;

// Minimum polling intervals (in ms) to stay under rate limits
export const POLLING_INTERVALS = {
  // Critical real-time data (use sparingly!)
  REALTIME: 5000 * PRODUCTION_MULTIPLIER, // 5s dev, 15s prod
  
  // Active session monitoring
  ACTIVE: 10000 * PRODUCTION_MULTIPLIER, // 10s dev, 30s prod
  
  // Standard refresh
  STANDARD: 30000, // 30s always
  
  // Background/low-priority
  BACKGROUND: 60000, // 60s always
  
  // Very low priority (metrics, stats)
  STATS: 120000, // 2 minutes
  
  // Almost never (preferences, config)
  RARE: 300000, // 5 minutes
} as const;

/**
 * Get a safe refetchInterval that respects rate limits
 * @param baseInterval - Base interval in ms
 * @param isActive - Whether the component is actively being used
 * @param isVisible - Whether the page is visible (auto-detected if not provided)
 */
export function getSafeRefetchInterval(
  baseInterval: number,
  isActive: boolean = true,
  isVisible?: boolean
): number | false {
  // If not active, disable polling
  if (!isActive) return false;
  
  // Check visibility (defaults to document.visibilityState)
  const pageVisible = isVisible ?? (typeof document !== 'undefined' ? document.visibilityState === 'visible' : true);
  
  // If page not visible, use very long interval or disable
  if (!pageVisible) {
    return Math.max(baseInterval * 4, 60000); // At least 1 minute when hidden
  }
  
  // Apply production multiplier and minimum floor
  const safeInterval = Math.max(baseInterval * PRODUCTION_MULTIPLIER, 10000);
  
  return safeInterval;
}

/**
 * Hook to get page visibility state for conditional polling
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() => 
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );
  
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  
  return isVisible;
}

/**
 * Hook for smart polling with visibility awareness
 * Returns refetchInterval config for TanStack Query
 */
export function useSmartPolling(
  baseInterval: number = POLLING_INTERVALS.STANDARD,
  options: {
    enabled?: boolean;
    activeCondition?: boolean;
    disableInBackground?: boolean;
  } = {}
): { refetchInterval: number | false; refetchIntervalInBackground: boolean } {
  const isVisible = usePageVisibility();
  const { 
    enabled = true, 
    activeCondition = true,
    disableInBackground = true 
  } = options;
  
  const refetchInterval = getSafeRefetchInterval(
    baseInterval,
    enabled && activeCondition,
    isVisible
  );
  
  return {
    refetchInterval,
    refetchIntervalInBackground: !disableInBackground,
  };
}

/**
 * Production-safe refetch interval that adjusts based on environment
 * Use this as a direct replacement for hardcoded refetchInterval values
 */
export function getProductionSafeInterval(devInterval: number): number {
  // In production, use at least 30 seconds, and multiply dev intervals
  if (import.meta.env.PROD) {
    return Math.max(devInterval * 3, 30000);
  }
  // In development, use at least 5 seconds
  return Math.max(devInterval, 5000);
}

/**
 * Callback-based polling that only runs when page is visible
 * Use this for setInterval-based polling
 */
export function useVisiblePolling(
  callback: () => void | Promise<void>,
  interval: number,
  enabled: boolean = true
): void {
  const isVisible = usePageVisibility();
  const safeInterval = getProductionSafeInterval(interval);
  
  useEffect(() => {
    if (!enabled || !isVisible) return;
    
    // Run immediately
    callback();
    
    // Then at intervals
    const timer = setInterval(callback, safeInterval);
    return () => clearInterval(timer);
  }, [callback, safeInterval, enabled, isVisible]);
}

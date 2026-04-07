/**
 * Custom hook for swipe navigation between tabs/panels
 * Optimized for mobile touch gestures
 */

import { useRef, useEffect, useCallback } from 'react';

interface SwipeNavigationOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance for swipe (px)
  velocityThreshold?: number; // Minimum velocity (px/ms)
  enabled?: boolean;
}

export function useSwipeNavigation(
  elementRef: React.RefObject<HTMLElement>,
  options: SwipeNavigationOptions = {}
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocityThreshold = 0.3,
    enabled = true,
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, [enabled]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const touchEnd = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    const deltaX = touchEnd.x - touchStartRef.current.x;
    const deltaY = touchEnd.y - touchStartRef.current.y;
    const deltaTime = touchEnd.time - touchStartRef.current.time;

    const velocityX = Math.abs(deltaX) / deltaTime;
    const velocityY = Math.abs(deltaY) / deltaTime;

    // Determine dominant axis
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

    if (isHorizontal) {
      // Horizontal swipe
      if (Math.abs(deltaX) > threshold && velocityX > velocityThreshold) {
        if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
          // Haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(10);
          }
        } else if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
          if ('vibrate' in navigator) {
            navigator.vibrate(10);
          }
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > threshold && velocityY > velocityThreshold) {
        if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
          if ('vibrate' in navigator) {
            navigator.vibrate(10);
          }
        } else if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
          if ('vibrate' in navigator) {
            navigator.vibrate(10);
          }
        }
      }
    }

    touchStartRef.current = null;
  }, [enabled, threshold, velocityThreshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, enabled, handleTouchStart, handleTouchEnd]);

  return {
    isEnabled: enabled,
  };
}

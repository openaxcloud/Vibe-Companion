/**
 * Advanced Gesture System
 * iOS/Android-quality touch interactions with haptic feedback
 */

import { useRef, useCallback, useEffect } from 'react';
import type { PanInfo } from '@/lib/native-motion';
import { useAnimationControls } from '@/lib/native-motion';

const SPRING_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const SPRING_DURATION = 300;

// ============================================================================
// HAPTIC FEEDBACK
// ============================================================================

export const triggerHaptic = (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'
) => {
  if (!('vibrate' in navigator)) return;

  const patterns = {
    light: [10],
    medium: [20],
    heavy: [30],
    success: [10, 50, 10],
    warning: [20, 50, 20],
    error: [30, 50, 30],
    selection: [5],
  };

  navigator.vibrate(patterns[type]);
};

// ============================================================================
// SWIPE GESTURES
// ============================================================================

export interface SwipeConfig {
  threshold?: number;
  velocity?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  hapticFeedback?: boolean;
}

export const useSwipeGesture = (config: SwipeConfig) => {
  const {
    threshold = 50,
    velocity = 0.5,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    hapticFeedback = true,
  } = config;

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const { offset, velocity: vel } = info;

      // Horizontal swipe
      if (Math.abs(offset.x) > Math.abs(offset.y)) {
        if (offset.x > threshold && vel.x > velocity && onSwipeRight) {
          if (hapticFeedback) triggerHaptic('light');
          onSwipeRight();
        } else if (offset.x < -threshold && vel.x < -velocity && onSwipeLeft) {
          if (hapticFeedback) triggerHaptic('light');
          onSwipeLeft();
        }
      }
      // Vertical swipe
      else {
        if (offset.y > threshold && vel.y > velocity && onSwipeDown) {
          if (hapticFeedback) triggerHaptic('light');
          onSwipeDown();
        } else if (offset.y < -threshold && vel.y < -velocity && onSwipeUp) {
          if (hapticFeedback) triggerHaptic('light');
          onSwipeUp();
        }
      }
    },
    [threshold, velocity, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, hapticFeedback]
  );

  return {
    drag: true,
    dragConstraints: { left: 0, right: 0, top: 0, bottom: 0 },
    dragElastic: 0.2,
    onDragEnd: handleDragEnd,
  };
};

// ============================================================================
// LONG PRESS GESTURE
// ============================================================================

export interface LongPressConfig {
  delay?: number;
  onLongPress: () => void;
  onPress?: () => void;
  hapticFeedback?: boolean;
}

export const useLongPress = (config: LongPressConfig) => {
  const {
    delay = 500,
    onLongPress,
    onPress,
    hapticFeedback = true,
  } = config;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (hapticFeedback) triggerHaptic('medium');
      onLongPress();
    }, delay);
  }, [delay, onLongPress, hapticFeedback]);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!isLongPressRef.current && onPress) {
      if (hapticFeedback) triggerHaptic('selection');
      onPress();
    }
  }, [onPress, hapticFeedback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onClick: handleClick,
  };
};

// ============================================================================
// PULL TO REFRESH
// ============================================================================

export interface PullToRefreshConfig {
  threshold?: number;
  onRefresh: () => Promise<void>;
  hapticFeedback?: boolean;
}

export const usePullToRefresh = (config: PullToRefreshConfig) => {
  const { threshold = 80, onRefresh, hapticFeedback = true } = config;

  const controls = useAnimationControls();
  const isRefreshingRef = useRef(false);
  const hasTriggeredRef = useRef(false);

  const handleDrag = useCallback(
    (_: any, info: PanInfo) => {
      const { offset } = info;

      // Only allow pull down at the top of the page
      if (window.scrollY > 0) return;

      if (offset.y > 0) {
        controls.start(
          { y: Math.min(offset.y * 0.5, threshold) },
          { duration: SPRING_DURATION, easing: SPRING_EASING }
        );

        // Trigger haptic at threshold
        if (offset.y > threshold && !hasTriggeredRef.current) {
          if (hapticFeedback) triggerHaptic('success');
          hasTriggeredRef.current = true;
        }
      }
    },
    [controls, threshold, hapticFeedback]
  );

  const handleDragEnd = useCallback(
    async (_: any, info: PanInfo) => {
      const { offset } = info;

      if (offset.y > threshold && !isRefreshingRef.current) {
        isRefreshingRef.current = true;

        // Show loading state
        controls.start(
          { y: threshold * 0.6 },
          { duration: SPRING_DURATION, easing: SPRING_EASING }
        );

        // Execute refresh
        await onRefresh();

        // Reset
        controls.start(
          { y: 0 },
          { duration: SPRING_DURATION, easing: SPRING_EASING }
        );

        isRefreshingRef.current = false;
        hasTriggeredRef.current = false;
      } else {
        // Snap back
        controls.start(
          { y: 0 },
          { duration: SPRING_DURATION, easing: SPRING_EASING }
        );
        hasTriggeredRef.current = false;
      }
    },
    [controls, threshold, onRefresh]
  );

  return {
    drag: 'y' as const,
    dragConstraints: { top: 0, bottom: threshold },
    dragElastic: 0.3,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
    controlsRef: controls.ref,
    controls,
  };
};

// ============================================================================
// PINCH TO ZOOM
// ============================================================================

export interface PinchToZoomConfig {
  minZoom?: number;
  maxZoom?: number;
  onZoomChange?: (zoom: number) => void;
  hapticFeedback?: boolean;
}

export const usePinchToZoom = (config: PinchToZoomConfig) => {
  const {
    minZoom = 0.5,
    maxZoom = 3,
    onZoomChange,
    hapticFeedback = true,
  } = config;

  const zoomRef = useRef(1);
  const initialDistanceRef = useRef(0);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        initialDistanceRef.current = distance;

        if (hapticFeedback) triggerHaptic('selection');
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        const scale = distance / initialDistanceRef.current;
        const newZoom = Math.max(minZoom, Math.min(maxZoom, zoomRef.current * scale));

        zoomRef.current = newZoom;
        if (onZoomChange) {
          onZoomChange(newZoom);
        }
      }
    };

    const handleTouchEnd = () => {
      initialDistanceRef.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [minZoom, maxZoom, onZoomChange, hapticFeedback]);

  return { zoom: zoomRef.current };
};

// ============================================================================
// SWIPE BACK NAVIGATION (iOS-style)
// ============================================================================

export interface SwipeBackConfig {
  onSwipeBack: () => void;
  threshold?: number;
  hapticFeedback?: boolean;
}

export const useSwipeBack = (config: SwipeBackConfig) => {
  const { onSwipeBack, threshold = 100, hapticFeedback = true } = config;

  const controls = useAnimationControls();
  const hasTriggeredRef = useRef(false);

  const handleDrag = useCallback(
    (_: any, info: PanInfo) => {
      const { offset } = info;

      // Only allow swipe from left edge
      if (offset.x > 0 && offset.x < 300) {
        controls.set({ x: offset.x, opacity: 1 - offset.x / 300 });

        if (offset.x > threshold && !hasTriggeredRef.current) {
          if (hapticFeedback) triggerHaptic('light');
          hasTriggeredRef.current = true;
        }
      }
    },
    [controls, threshold, hapticFeedback]
  );

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const { offset, velocity } = info;

      if (offset.x > threshold || velocity.x > 0.5) {
        // Complete the swipe back
        controls.start(
          { x: 300, opacity: 0 },
          { duration: SPRING_DURATION, easing: SPRING_EASING }
        );

        setTimeout(() => {
          onSwipeBack();
        }, 200);
      } else {
        // Snap back
        controls.start(
          { x: 0, opacity: 1 },
          { duration: SPRING_DURATION, easing: SPRING_EASING }
        );
      }

      hasTriggeredRef.current = false;
    },
    [controls, threshold, onSwipeBack]
  );

  return {
    drag: 'x' as const,
    dragConstraints: { left: 0, right: 300 },
    dragElastic: 0.2,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
    controlsRef: controls.ref,
    controls,
  };
};

// ============================================================================
// DOUBLE TAP
// ============================================================================

export interface DoubleTapConfig {
  delay?: number;
  onDoubleTap: () => void;
  onSingleTap?: () => void;
  hapticFeedback?: boolean;
}

export const useDoubleTap = (config: DoubleTapConfig) => {
  const {
    delay = 300,
    onDoubleTap,
    onSingleTap,
    hapticFeedback = true,
  } = config;

  const lastTapRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < delay && timeSinceLastTap > 0) {
      // Double tap
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (hapticFeedback) triggerHaptic('medium');
      onDoubleTap();
      lastTapRef.current = 0;
    } else {
      // Single tap (wait to see if double tap follows)
      lastTapRef.current = now;
      if (onSingleTap) {
        timerRef.current = setTimeout(() => {
          if (hapticFeedback) triggerHaptic('selection');
          onSingleTap();
        }, delay);
      }
    }
  }, [delay, onDoubleTap, onSingleTap, hapticFeedback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { onClick: handleTap };
};

export default {
  useSwipeGesture,
  useLongPress,
  usePullToRefresh,
  usePinchToZoom,
  useSwipeBack,
  useDoubleTap,
  triggerHaptic,
};

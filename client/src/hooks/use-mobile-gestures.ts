import { useEffect, useRef, useState } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventScroll?: boolean;
}

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
  enabled?: boolean;
}

/**
 * Hook for detecting swipe gestures on mobile
 */
export function useSwipeGesture(options: SwipeOptions) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    preventScroll = false,
  } = options;

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchEnd = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!touchStart.current) return;
    
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };

    if (preventScroll) {
      const deltaX = Math.abs(touchEnd.current.x - touchStart.current.x);
      const deltaY = Math.abs(touchEnd.current.y - touchStart.current.y);
      
      // If horizontal swipe is dominant, prevent vertical scroll
      if (deltaX > deltaY) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;

    const deltaX = touchStart.current.x - touchEnd.current.x;
    const deltaY = touchStart.current.y - touchEnd.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine if swipe is horizontal or vertical
    if (absDeltaX > absDeltaY) {
      // Horizontal swipe
      if (absDeltaX > threshold) {
        if (deltaX > 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }
    } else {
      // Vertical swipe
      if (absDeltaY > threshold) {
        if (deltaY > 0) {
          onSwipeUp?.();
        } else {
          onSwipeDown?.();
        }
      }
    }

    touchStart.current = null;
    touchEnd.current = null;
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}

/**
 * Hook for pull-to-refresh functionality
 */
export function usePullToRefresh(options: PullToRefreshOptions) {
  const {
    onRefresh,
    threshold = 80,
    resistance = 2.5,
    enabled = true,
  } = options;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let rafId: number;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const scrollableParent = findScrollableParent(target);
      
      // Only start pull if at top of scroll
      if (scrollableParent && scrollableParent.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      if (distance > 0) {
        // Apply resistance to pull distance
        const pull = Math.min(distance / resistance, threshold * 1.5);
        setPullDistance(pull);

        // Prevent overscroll on some browsers
        if (pull > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isDragging.current) return;

      isDragging.current = false;

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold);

        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        // Animate back to 0
        const animate = () => {
          setPullDistance((prev) => {
            const next = prev * 0.9;
            if (next < 0.5) {
              return 0;
            }
            rafId = requestAnimationFrame(animate);
            return next;
          });
        };
        rafId = requestAnimationFrame(animate);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [enabled, threshold, resistance, onRefresh, isRefreshing, pullDistance]);

  return { isRefreshing, pullDistance };
}

/**
 * Hook for swipe-to-close panels/modals
 */
export function useSwipeToClose(onClose: () => void, options?: { threshold?: number; enabled?: boolean }) {
  const { threshold = 100, enabled = true } = options || {};
  const [offset, setOffset] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      startY.current = e.touches[0].clientY;
      currentY.current = startY.current;
      isDragging.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      // Only allow downward swipe
      if (distance > 0) {
        setOffset(distance);
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging.current) return;

      isDragging.current = false;

      if (offset >= threshold) {
        onClose();
      } else {
        // Animate back to 0
        setOffset(0);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, threshold, offset, onClose]);

  return { offset, setOffset };
}

/**
 * Helper function to find scrollable parent
 */
function findScrollableParent(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;

  const isScrollable = (el: HTMLElement) => {
    const style = window.getComputedStyle(el);
    return (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight
    );
  };

  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    if (isScrollable(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

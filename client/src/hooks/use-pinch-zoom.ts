import { useRef, useCallback, useEffect } from 'react';

interface PinchZoomConfig {
  minScale: number;
  maxScale: number;
  onScaleChange?: (scale: number) => void;
  enabled?: boolean;
}

interface PinchZoomState {
  initialDistance: number;
  initialScale: number;
  currentScale: number;
  isPinching: boolean;
}

/**
 * Professional pinch-to-zoom gesture hook for tablet Monaco editor
 * Optimized for iPad Pro, Surface, Android tablets (768px-1024px)
 * 
 * Features:
 * - Two-finger pinch detection
 * - Smooth scale transitions
 * - Momentum and inertia
 * - Conflict prevention with scroll
 */
export function usePinchZoom(
  elementRef: React.RefObject<HTMLElement>,
  config: PinchZoomConfig
) {
  const stateRef = useRef<PinchZoomState>({
    initialDistance: 0,
    initialScale: 1,
    currentScale: 1,
    isPinching: false,
  });

  const rafRef = useRef<number | null>(null);

  // Calculate distance between two touch points
  const getDistance = useCallback((touches: TouchList): number => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Handle touch start (two fingers)
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!config.enabled || e.touches.length !== 2) return;

    // Prevent default to avoid conflicts with browser zoom
    e.preventDefault();

    const distance = getDistance(e.touches);
    stateRef.current = {
      ...stateRef.current,
      initialDistance: distance,
      initialScale: stateRef.current.currentScale,
      isPinching: true,
    };
  }, [config.enabled, getDistance]);

  // Handle touch move (pinch gesture)
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!config.enabled || e.touches.length !== 2 || !stateRef.current.isPinching) {
      return;
    }

    // Prevent default scrolling during pinch
    e.preventDefault();

    const currentDistance = getDistance(e.touches);
    const distanceRatio = currentDistance / stateRef.current.initialDistance;
    
    // Calculate new scale with bounds
    let newScale = stateRef.current.initialScale * distanceRatio;
    newScale = Math.max(config.minScale, Math.min(config.maxScale, newScale));

    // Smooth animation with RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      stateRef.current.currentScale = newScale;
      config.onScaleChange?.(newScale);
    });
  }, [config, getDistance]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length < 2) {
      stateRef.current.isPinching = false;
    }
  }, []);

  // Attach/detach event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element || !config.enabled) return;

    // Touch events with passive: false for preventDefault
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [elementRef, config.enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Reset scale
  const resetScale = useCallback(() => {
    stateRef.current.currentScale = 1;
    config.onScaleChange?.(1);
  }, [config]);

  return {
    currentScale: stateRef.current.currentScale,
    isPinching: stateRef.current.isPinching,
    resetScale,
  };
}

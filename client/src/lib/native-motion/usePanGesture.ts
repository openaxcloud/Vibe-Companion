/**
 * usePanGesture - Native replacement for framer-motion's PanInfo gestures
 * 
 * Fortune 500-grade gesture handling that:
 * - Uses Pointer Events for unified touch/mouse support
 * - Calculates velocity for inertial scrolling
 * - Supports configurable thresholds and callbacks
 * - Zero framer-motion dependency
 */

import { useRef, useCallback, useEffect } from 'react';

export interface PanInfo {
  point: { x: number; y: number };
  delta: { x: number; y: number };
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
}

interface PanGestureConfig {
  onPanStart?: (event: PointerEvent, info: PanInfo) => void;
  onPan?: (event: PointerEvent, info: PanInfo) => void;
  onPanEnd?: (event: PointerEvent, info: PanInfo) => void;
  axis?: 'x' | 'y' | 'both';
  threshold?: number;
}

export function usePanGesture(
  ref: React.RefObject<HTMLElement>,
  config: PanGestureConfig
) {
  const {
    onPanStart,
    onPan,
    onPanEnd,
    axis = 'both',
    threshold = 3
  } = config;

  const startPointRef = useRef({ x: 0, y: 0 });
  const lastPointRef = useRef({ x: 0, y: 0 });
  const lastTimeRef = useRef(0);
  const velocityRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const hasExceededThresholdRef = useRef(false);

  const calculateVelocity = useCallback((
    current: { x: number; y: number },
    previous: { x: number; y: number },
    timeDelta: number
  ) => {
    // Returns velocity in px/ms (framer-motion compatible units)
    // timeDelta is already in milliseconds from performance.now()
    if (timeDelta <= 0) return { x: 0, y: 0 };
    return {
      x: (current.x - previous.x) / timeDelta,
      y: (current.y - previous.y) / timeDelta
    };
  }, []);

  const createPanInfo = useCallback((
    event: PointerEvent,
    isStart = false
  ): PanInfo => {
    const point = { x: event.clientX, y: event.clientY };
    const offset = {
      x: point.x - startPointRef.current.x,
      y: point.y - startPointRef.current.y
    };
    const delta = isStart ? { x: 0, y: 0 } : {
      x: point.x - lastPointRef.current.x,
      y: point.y - lastPointRef.current.y
    };

    return {
      point,
      delta,
      offset,
      velocity: velocityRef.current
    };
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent) => {
    const element = ref.current;
    if (!element) return;

    element.setPointerCapture(event.pointerId);
    
    startPointRef.current = { x: event.clientX, y: event.clientY };
    lastPointRef.current = { x: event.clientX, y: event.clientY };
    lastTimeRef.current = performance.now();
    velocityRef.current = { x: 0, y: 0 };
    isPanningRef.current = true;
    hasExceededThresholdRef.current = false;
  }, [ref]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!isPanningRef.current) return;

    const currentPoint = { x: event.clientX, y: event.clientY };
    const now = performance.now();
    const timeDelta = now - lastTimeRef.current;

    velocityRef.current = calculateVelocity(
      currentPoint,
      lastPointRef.current,
      timeDelta
    );

    const offset = {
      x: currentPoint.x - startPointRef.current.x,
      y: currentPoint.y - startPointRef.current.y
    };

    const exceedsThreshold = 
      (axis === 'x' && Math.abs(offset.x) > threshold) ||
      (axis === 'y' && Math.abs(offset.y) > threshold) ||
      (axis === 'both' && (Math.abs(offset.x) > threshold || Math.abs(offset.y) > threshold));

    if (!hasExceededThresholdRef.current && exceedsThreshold) {
      hasExceededThresholdRef.current = true;
      onPanStart?.(event, createPanInfo(event, true));
    }

    if (hasExceededThresholdRef.current) {
      onPan?.(event, createPanInfo(event));
    }

    lastPointRef.current = currentPoint;
    lastTimeRef.current = now;
  }, [axis, threshold, calculateVelocity, createPanInfo, onPanStart, onPan]);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (!isPanningRef.current) return;

    const element = ref.current;
    if (element) {
      element.releasePointerCapture(event.pointerId);
    }

    if (hasExceededThresholdRef.current) {
      onPanEnd?.(event, createPanInfo(event));
    }

    isPanningRef.current = false;
    hasExceededThresholdRef.current = false;
  }, [ref, createPanInfo, onPanEnd]);

  const handlePointerCancel = useCallback((event: PointerEvent) => {
    handlePointerUp(event);
  }, [handlePointerUp]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [ref, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel]);
}

export function createPanHandlers(config: {
  onStart?: (info: PanInfo) => void;
  onMove?: (info: PanInfo) => void;
  onEnd?: (info: PanInfo) => void;
  axis?: 'x' | 'y' | 'both';
  threshold?: number;
}) {
  const { axis = 'both', threshold = 3 } = config;
  
  let startPoint = { x: 0, y: 0 };
  let lastPoint = { x: 0, y: 0 };
  let lastTime = 0;
  let velocity = { x: 0, y: 0 };
  let hasStarted = false;

  const createInfo = (clientX: number, clientY: number): PanInfo => ({
    point: { x: clientX, y: clientY },
    delta: { x: clientX - lastPoint.x, y: clientY - lastPoint.y },
    offset: { x: clientX - startPoint.x, y: clientY - startPoint.y },
    velocity
  });

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      startPoint = { x: touch.clientX, y: touch.clientY };
      lastPoint = { x: touch.clientX, y: touch.clientY };
      lastTime = performance.now();
      velocity = { x: 0, y: 0 };
      hasStarted = false;
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const now = performance.now();
      const timeDelta = now - lastTime;

      if (timeDelta > 0) {
        // Velocity in px/ms (framer-motion compatible units)
        velocity = {
          x: (touch.clientX - lastPoint.x) / timeDelta,
          y: (touch.clientY - lastPoint.y) / timeDelta
        };
      }

      const offset = {
        x: touch.clientX - startPoint.x,
        y: touch.clientY - startPoint.y
      };

      const exceedsThreshold = 
        (axis === 'x' && Math.abs(offset.x) > threshold) ||
        (axis === 'y' && Math.abs(offset.y) > threshold) ||
        (axis === 'both' && (Math.abs(offset.x) > threshold || Math.abs(offset.y) > threshold));

      if (!hasStarted && exceedsThreshold) {
        hasStarted = true;
        config.onStart?.(createInfo(touch.clientX, touch.clientY));
      }

      if (hasStarted) {
        config.onMove?.(createInfo(touch.clientX, touch.clientY));
      }

      lastPoint = { x: touch.clientX, y: touch.clientY };
      lastTime = now;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (hasStarted) {
        const touch = e.changedTouches[0];
        config.onEnd?.(createInfo(touch.clientX, touch.clientY));
      }
      hasStarted = false;
    }
  };
}

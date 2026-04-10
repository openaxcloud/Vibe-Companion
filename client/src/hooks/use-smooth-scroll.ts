import { useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';

interface SmoothScrollConfig {
  friction?: number;
  threshold?: number;
  enabled?: boolean;
  editorInstanceRef?: React.RefObject<EditorView | null>;
}

/**
 * Enhanced two-finger scroll optimization for tablet CodeMirror 6 editor
 * Provides momentum scrolling and smooth deceleration
 * 
 * Features:
 * - Momentum-based scrolling using CM6's scrollDOM API (via ref)
 * - Smooth deceleration (physics-based friction)
 * - Touch-friendly gesture detection
 * - Prevents conflicts with pinch-to-zoom
 */
export function useSmoothScroll(
  elementRef: React.RefObject<HTMLElement>,
  config: SmoothScrollConfig = {}
) {
  const {
    friction = 0.92, // Deceleration factor (0-1, higher = slower decay)
    threshold = 0.5, // Minimum velocity to maintain scroll
    enabled = true,
    editorInstanceRef,
  } = config;

  const velocityRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef({ x: 0, y: 0, time: 0 });
  const rafRef = useRef<number | null>(null);
  const scrollingRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    let wasTwoFingerScroll = false; // Track if we started with two fingers

    const handleTouchStart = (e: TouchEvent) => {
      // Track initial touch for two-finger scroll
      if (e.touches.length === 2) {
        wasTwoFingerScroll = true; // Mark as two-finger gesture
        const avgX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        lastTouchRef.current = {
          x: avgX,
          y: avgY,
          time: Date.now(),
        };
        
        velocityRef.current = { x: 0, y: 0 };
        scrollingRef.current = false;
        
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      
      const avgX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const now = Date.now();
      
      // Calculate velocity
      const deltaX = avgX - lastTouchRef.current.x;
      const deltaY = avgY - lastTouchRef.current.y;
      const deltaTime = now - lastTouchRef.current.time;
      
      if (deltaTime > 0) {
        velocityRef.current = {
          x: deltaX / deltaTime,
          y: deltaY / deltaTime,
        };
      }
      
      lastTouchRef.current = { x: avgX, y: avgY, time: now };
      scrollingRef.current = true;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // If all fingers lifted after two-finger scroll, apply momentum
      if (wasTwoFingerScroll && e.touches.length === 0 && scrollingRef.current) {
        startMomentumScroll();
      }
      
      // Reset flag when all fingers lifted
      if (e.touches.length === 0) {
        wasTwoFingerScroll = false;
      }
    };

    const startMomentumScroll = () => {
      const animate = () => {
        const vx = velocityRef.current.x;
        const vy = velocityRef.current.y;
        
        // Check if velocity is below threshold
        if (Math.abs(vx) < threshold && Math.abs(vy) < threshold) {
          scrollingRef.current = false;
          return;
        }
        
        // Apply friction
        velocityRef.current.x *= friction;
        velocityRef.current.y *= friction;
        
        // Scroll using CM6's scrollDOM API if available (access ref.current for live instance)
        const editor = editorInstanceRef?.current;
        if (editor) {
          const currentScroll = editor.scrollDOM.scrollTop;
          editor.scrollDOM.scrollTo({ top: currentScroll - vy * 20, behavior: 'auto' });
        } else if (element.scrollTop !== undefined) {
          element.scrollTop -= vy * 20; // Fallback for non-CM6 elements
        }
        if (element.scrollLeft !== undefined) {
          element.scrollLeft -= vx * 20;
        }
        
        rafRef.current = requestAnimationFrame(animate);
      };
      
      rafRef.current = requestAnimationFrame(animate);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [elementRef, enabled, friction, threshold, editorInstanceRef]);
}

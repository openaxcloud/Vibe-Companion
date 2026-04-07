/**
 * useAnimationControls - Native replacement for framer-motion's useAnimation
 * 
 * Fortune 500-grade imperative animation control that:
 * - Uses Web Animations API (WAAPI) for GPU-accelerated animations
 * - Supports keyframe-based animations
 * - Respects prefers-reduced-motion
 * - Zero framer-motion dependency
 */

import { useRef, useCallback, useEffect } from 'react';

type AnimationTarget = Record<string, string | number>;

interface AnimationConfig {
  duration?: number;
  delay?: number;
  easing?: string;
  fill?: FillMode;
}

interface AnimationControls {
  start: (target: AnimationTarget | string, config?: AnimationConfig) => Promise<void>;
  stop: () => void;
  set: (target: AnimationTarget) => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function buildTransformString(target: AnimationTarget): string {
  const transforms: string[] = [];
  
  if ('x' in target) {
    const value = target.x;
    transforms.push(`translateX(${typeof value === 'number' ? `${value}px` : value})`);
  }
  if ('y' in target) {
    const value = target.y;
    transforms.push(`translateY(${typeof value === 'number' ? `${value}px` : value})`);
  }
  if ('scale' in target) {
    transforms.push(`scale(${target.scale})`);
  }
  if ('scaleX' in target) {
    transforms.push(`scaleX(${target.scaleX})`);
  }
  if ('scaleY' in target) {
    transforms.push(`scaleY(${target.scaleY})`);
  }
  if ('rotate' in target) {
    const value = target.rotate;
    transforms.push(`rotate(${typeof value === 'number' ? `${value}deg` : value})`);
  }
  if ('skewX' in target) {
    const value = target.skewX;
    transforms.push(`skewX(${typeof value === 'number' ? `${value}deg` : value})`);
  }
  if ('skewY' in target) {
    const value = target.skewY;
    transforms.push(`skewY(${typeof value === 'number' ? `${value}deg` : value})`);
  }
  
  return transforms.join(' ');
}

const TRANSFORM_KEYS = new Set(['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate', 'skewX', 'skewY']);

function targetToKeyframes(target: AnimationTarget): Keyframe[] {
  const keyframe: Keyframe = {};
  
  const transformString = buildTransformString(target);
  if (transformString) {
    keyframe.transform = transformString;
  }
  
  for (const [key, value] of Object.entries(target)) {
    if (TRANSFORM_KEYS.has(key)) continue;
    
    if (key === 'opacity') {
      keyframe.opacity = String(value);
    } else {
      (keyframe as Record<string, string>)[key] = String(value);
    }
  }
  
  return [keyframe];
}

function applyStyles(element: HTMLElement, target: AnimationTarget) {
  const transformString = buildTransformString(target);
  if (transformString) {
    element.style.transform = transformString;
  }
  
  for (const [key, value] of Object.entries(target)) {
    if (TRANSFORM_KEYS.has(key)) continue;
    
    if (key === 'opacity') {
      element.style.opacity = String(value);
    } else {
      (element.style as unknown as Record<string, string>)[key] = String(value);
    }
  }
}

export function useAnimationControls(): AnimationControls & { ref: React.RefObject<HTMLElement> } {
  const elementRef = useRef<HTMLElement>(null);
  const animationsRef = useRef<Animation[]>([]);
  const variantsRef = useRef<Record<string, AnimationTarget>>({});

  const stop = useCallback(() => {
    animationsRef.current.forEach(animation => {
      animation.cancel();
    });
    animationsRef.current = [];
  }, []);

  const set = useCallback((target: AnimationTarget) => {
    const element = elementRef.current;
    if (!element) return;
    applyStyles(element, target);
  }, []);

  const start = useCallback(async (
    target: AnimationTarget | string,
    config: AnimationConfig = {}
  ): Promise<void> => {
    const element = elementRef.current;
    if (!element) return;

    const resolvedTarget = typeof target === 'string' 
      ? variantsRef.current[target] || {}
      : target;

    if (prefersReducedMotion()) {
      applyStyles(element, resolvedTarget);
      return;
    }

    const {
      duration = 300,
      delay = 0,
      easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill = 'forwards'
    } = config;

    stop();

    const keyframes = targetToKeyframes(resolvedTarget);
    
    try {
      const animation = element.animate(keyframes, {
        duration,
        delay,
        easing,
        fill
      });

      animationsRef.current.push(animation);

      await animation.finished;
    } catch {
      applyStyles(element, resolvedTarget);
    }
  }, [stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    ref: elementRef as React.RefObject<HTMLElement>,
    start,
    stop,
    set
  };
}

export function createAnimationControls(
  variants?: Record<string, AnimationTarget>
): AnimationControls & { 
  mount: (element: HTMLElement) => void;
  unmount: () => void;
} {
  let element: HTMLElement | null = null;
  let animations: Animation[] = [];
  const storedVariants = variants || {};

  const stop = () => {
    animations.forEach(a => a.cancel());
    animations = [];
  };

  const set = (target: AnimationTarget) => {
    if (!element) return;
    applyStyles(element, target);
  };

  const start = async (
    target: AnimationTarget | string,
    config: AnimationConfig = {}
  ): Promise<void> => {
    if (!element) return;

    const resolvedTarget = typeof target === 'string'
      ? storedVariants[target] || {}
      : target;

    if (prefersReducedMotion()) {
      applyStyles(element, resolvedTarget);
      return;
    }

    const { duration = 300, delay = 0, easing = 'cubic-bezier(0.4, 0, 0.2, 1)', fill = 'forwards' } = config;

    stop();

    try {
      const animation = element.animate(targetToKeyframes(resolvedTarget), {
        duration,
        delay,
        easing,
        fill
      });
      animations.push(animation);
      await animation.finished;
    } catch {
      applyStyles(element, resolvedTarget);
    }
  };

  return {
    start,
    stop,
    set,
    mount: (el: HTMLElement) => { element = el; },
    unmount: () => { stop(); element = null; }
  };
}

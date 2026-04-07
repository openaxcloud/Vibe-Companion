import { useState, useEffect } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getInitialState(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialState);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(QUERY);
    
    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', listener);
    } else {
      mediaQueryList.addListener(listener);
    }

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', listener);
      } else {
        mediaQueryList.removeListener(listener);
      }
    };
  }, []);

  return prefersReducedMotion;
}

export const SPRING_CONFIG = {
  default: { type: 'spring' as const, stiffness: 400, damping: 30 },
  gentle: { type: 'spring' as const, stiffness: 300, damping: 25 },
  snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
  bouncy: { type: 'spring' as const, stiffness: 400, damping: 20 },
} as const;

export const DURATION_CONFIG = {
  fast: 0.15,
  normal: 0.2,
  medium: 0.3,
  slow: 0.4,
} as const;

export function getReducedMotionTransition(
  prefersReducedMotion: boolean,
  springConfig: typeof SPRING_CONFIG[keyof typeof SPRING_CONFIG] = SPRING_CONFIG.default
) {
  if (prefersReducedMotion) {
    return { duration: 0.01 };
  }
  return springConfig;
}

export function getReducedMotionVariants(
  prefersReducedMotion: boolean,
  normalVariants: {
    initial: Record<string, unknown>;
    animate: Record<string, unknown>;
    exit?: Record<string, unknown>;
  }
) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  return normalVariants;
}

import { useEffect, useState } from 'react';

// Spring configuration for smooth animations
export const SPRING_CONFIG = {
  default: { type: 'spring', stiffness: 300, damping: 30 },
  gentle: { type: 'spring', stiffness: 100, damping: 30 },
  wobbly: { type: 'spring', stiffness: 180, damping: 12 },
};

/**
 * Hook to detect if user prefers reduced motion
 * Returns true if user has set prefers-reduced-motion: reduce
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check initial preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Get transition config that respects prefers-reduced-motion
 */
export function getReducedMotionTransition(
  normalTransition: any = { duration: 0.3 }
): any {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return { duration: 0.01 };
  }

  return normalTransition;
}

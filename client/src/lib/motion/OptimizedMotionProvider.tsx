/**
 * OptimizedMotionProvider - Fortune 500-Grade Animation Provider
 * 
 * CRITICAL FIX: No Suspense blocking - renders children immediately
 * LazyMotion loads in background without blocking initial render.
 * 
 * Replit Preview Detection: Disables animations in Replit preview iframe
 * to prevent performance issues in embedded environments.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LazyMotion, domAnimation } from 'framer-motion';

interface MotionContextType {
  isReady: boolean;
  isReducedMotion: boolean;
  isReplitPreview: boolean;
  shouldAnimate: boolean;
}

const MotionContext = createContext<MotionContextType>({
  isReady: true,
  isReducedMotion: false,
  isReplitPreview: false,
  shouldAnimate: true
});

export function useMotionReady() {
  return useContext(MotionContext);
}

function detectReplitPreview(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname.includes('replit') ||
    window.location.hostname.includes('.repl.co') ||
    window.parent !== window
  );
}

interface OptimizedMotionProviderProps {
  children: ReactNode;
}

export function OptimizedMotionProvider({ children }: OptimizedMotionProviderProps) {
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isReplitPreview] = useState(() => detectReplitPreview());

  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') {
      return;
    }
    
    const mediaQuery = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  const shouldAnimate = !isReplitPreview && !isReducedMotion;

  if (!shouldAnimate) {
    return (
      <MotionContext.Provider value={{ isReady: true, isReducedMotion, isReplitPreview, shouldAnimate: false }}>
        {children}
      </MotionContext.Provider>
    );
  }

  return (
    <MotionContext.Provider value={{ isReady: true, isReducedMotion, isReplitPreview, shouldAnimate: true }}>
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </MotionContext.Provider>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseDeferredRenderOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  delay?: number;
}

export function useDeferredRender(options: UseDeferredRenderOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '100px',
    triggerOnce = true,
    delay = 0
  } = options;

  const [shouldRender, setShouldRender] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShouldRender(true);
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsInView(true);
          
          if (triggerOnce && hasTriggered.current) return;
          hasTriggered.current = true;

          if (delay > 0) {
            setTimeout(() => setShouldRender(true), delay);
          } else {
            setShouldRender(true);
          }

          if (triggerOnce) {
            observer.disconnect();
          }
        } else if (!triggerOnce) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce, delay]);

  return { ref: elementRef, shouldRender, isInView };
}

export function useIdleCallback(callback: () => void, timeout = 2000) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;

    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(
        () => {
          hasRun.current = true;
          callback();
        },
        { timeout }
      );
      return () => (window as any).cancelIdleCallback(id);
    } else {
      const id = setTimeout(() => {
        hasRun.current = true;
        callback();
      }, 100);
      return () => clearTimeout(id);
    }
  }, [callback, timeout]);
}

export function useCriticalRender() {
  const [isCriticalDone, setIsCriticalDone] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => setIsCriticalDone(true), { timeout: 1000 });
    } else {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsCriticalDone(true));
      });
    }
  }, []);

  return isCriticalDone;
}

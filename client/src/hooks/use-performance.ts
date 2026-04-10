import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebounce } from './use-debounce';

// Hook for debounced search inputs with 300ms delay
export function useDebouncedSearch(initialValue = '', delay = 300) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const debouncedValue = useDebounce(searchTerm, delay);
  
  return {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm: debouncedValue,
    clearSearch: useCallback(() => setSearchTerm(''), [])
  };
}

// Hook for optimistic state updates
export function useOptimisticUpdate<T>(
  initialValue: T,
  updateFn?: (newValue: T) => Promise<T>
) {
  const [value, setValue] = useState(initialValue);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const previousValueRef = useRef<T>(initialValue);

  const updateOptimistically = useCallback(async (newValue: T) => {
    previousValueRef.current = value;
    setValue(newValue); // Optimistic update
    setIsPending(true);
    setError(null);

    try {
      if (updateFn) {
        const result = await updateFn(newValue);
        setValue(result); // Update with server response
      }
    } catch (err) {
      setValue(previousValueRef.current); // Rollback on error
      setError(err instanceof Error ? err : new Error('Update failed'));
    } finally {
      setIsPending(false);
    }
  }, [value, updateFn]);

  const rollback = useCallback(() => {
    setValue(previousValueRef.current);
  }, []);

  return {
    value,
    updateOptimistically,
    rollback,
    isPending,
    error
  };
}

// Hook for intersection observer (lazy loading)
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  {
    threshold = 0.1,
    root = null,
    rootMargin = '100px',
    freezeOnceVisible = false
  }: IntersectionObserverInit & { freezeOnceVisible?: boolean } = {}
) {
  const [entry, setEntry] = useState<IntersectionObserverEntry>();
  const frozen = useRef(false);

  const updateEntry = ([entry]: IntersectionObserverEntry[]): void => {
    setEntry(entry);
  };

  useEffect(() => {
    const node = elementRef?.current;
    const hasIOSupport = !!window.IntersectionObserver;

    if (!hasIOSupport || frozen.current || !node) return;

    const observerParams = { threshold, root, rootMargin };
    const observer = new IntersectionObserver(updateEntry, observerParams);

    observer.observe(node);

    return () => observer.disconnect();
  }, [elementRef, threshold, root, rootMargin]);

  useEffect(() => {
    const isVisible = entry?.isIntersecting;
    if (isVisible && freezeOnceVisible) {
      frozen.current = true;
    }
  }, [entry, freezeOnceVisible]);

  return entry;
}

// Hook for prefetching on hover
export function usePrefetchOnHover(
  prefetchFn: () => Promise<void>,
  { delay = 100 } = {}
) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const onMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      prefetchFn().catch(console.error);
    }, delay);
  }, [prefetchFn, delay]);

  const onMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { onMouseEnter, onMouseLeave };
}

// Hook for memoized expensive computations
export function useMemoizedList<T>(
  items: T[],
  sortFn?: (a: T, b: T) => number,
  filterFn?: (item: T) => boolean,
  deps: any[] = []
) {
  return useMemo(() => {
    let result = [...items];
    
    if (filterFn) {
      result = result.filter(filterFn);
    }
    
    if (sortFn) {
      result.sort(sortFn);
    }
    
    return result;
  }, [items, ...deps]);
}

// Hook for auto-saving with debounce
export function useAutoSave(
  value: any,
  saveFn: (value: any) => Promise<void>,
  { delay = 2000, enabled = true } = {}
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debouncedValue = useDebounce(value, delay);

  useEffect(() => {
    if (!enabled || !debouncedValue) return;

    const save = async () => {
      setIsSaving(true);
      try {
        await saveFn(debouncedValue);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    };

    save();
  }, [debouncedValue, saveFn, enabled]);

  return { isSaving, lastSaved };
}

// Hook for animation performance monitoring
export function useAnimationPerformance() {
  const [fps, setFps] = useState(60);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    let animationId: number;
    
    const measureFps = () => {
      frameCountRef.current++;
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      
      if (delta >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
      animationId = requestAnimationFrame(measureFps);
    };
    
    animationId = requestAnimationFrame(measureFps);
    
    return () => cancelAnimationFrame(animationId);
  }, []);

  return { fps, isSmooth: fps >= 30 };
}
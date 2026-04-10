// @ts-nocheck
import { memo, useMemo, useCallback, useRef, useEffect, useState, ComponentType, ReactElement, ReactNode } from 'react';
import { useDebounce } from '@/hooks/use-debounce';

// Performance optimization utility functions and components

// Enhanced memo with custom comparison
export function optimizedMemo<P extends object>(
  Component: ComponentType<P>,
  propsAreEqual?: (prevProps: P, nextProps: P) => boolean
): ComponentType<P> {
  const displayName = Component.displayName || Component.name || 'Component';
  
  const MemoizedComponent = memo(Component, propsAreEqual || shallowEqual);
  MemoizedComponent.displayName = `Memo(${displayName})`;
  
  return MemoizedComponent;
}

// Shallow comparison function
function shallowEqual<T extends object>(prevProps: T, nextProps: T): boolean {
  const prevKeys = Object.keys(prevProps) as Array<keyof T>;
  const nextKeys = Object.keys(nextProps) as Array<keyof T>;
  
  if (prevKeys.length !== nextKeys.length) {
    return false;
  }
  
  for (const key of prevKeys) {
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }
  
  return true;
}

// Deep comparison for complex objects
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return false;
  
  if (a.constructor !== b.constructor) return false;
  
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    
    return true;
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a);
    
    if (keys.length !== Object.keys(b).length) {
      return false;
    }
    
    for (const key of keys) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }
  
  return false;
}

// Optimized callback hook that prevents unnecessary re-renders
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const callbackRef = useRef<T>(callback);
  const depsRef = useRef<React.DependencyList>(deps);
  
  // Update callback if deps changed
  if (!shallowEqual(depsRef.current as any, deps as any)) {
    callbackRef.current = callback;
    depsRef.current = deps;
  }
  
  // Return stable reference
  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
}

// Virtual scrolling component for large lists
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  containerHeight: number;
  overscan?: number;
  className?: string;
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  containerHeight,
  overscan = 3,
  className = '',
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, i) => ({
      item,
      index: startIndex + i,
    }));
  }, [items, startIndex, endIndex]);
  
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map(({ item, index }) => (
            <div key={index} style={{ height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Lazy loading wrapper with error boundary
interface LazyComponentProps {
  loader: () => Promise<{ default: ComponentType<any> }>;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  delay?: number;
  [key: string]: any;
}

export function LazyComponent({
  loader,
  fallback = <div className="flex items-center justify-center h-full text-muted-foreground text-[13px]">Loading...</div>,
  errorFallback = <div className="flex items-center justify-center h-full text-destructive text-[13px]">Failed to load component</div>,
  delay = 300,
  ...props
}: LazyComponentProps) {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    let timeoutId: number;
    
    // Show fallback after delay
    timeoutId = window.setTimeout(() => {
      if (mounted && !Component) {
        setShowFallback(true);
      }
    }, delay);
    
    // Load component
    loader()
      .then((module) => {
        if (mounted) {
          setComponent(() => module.default);
          setShowFallback(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setShowFallback(false);
        }
      });
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [loader, delay]);
  
  if (error) {
    return <>{errorFallback}</>;
  }
  
  if (!Component) {
    return showFallback ? <>{fallback}</> : null;
  }
  
  return <Component {...props} />;
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );
    
    observer.observe(element);
    
    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, [elementRef, options]);
  
  return isIntersecting;
}

// Lazy image component
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  placeholder?: string;
  errorSrc?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const LazyImage = memo(function LazyImage({
  src,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23e5e7eb"/%3E%3C/svg%3E',
  errorSrc = placeholder,
  onLoad,
  onError,
  className = '',
  alt = '',
  ...props
}: LazyImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [loading, setLoading] = useState(true);
  const isIntersecting = useIntersectionObserver(imgRef);
  
  useEffect(() => {
    if (!isIntersecting || imageSrc !== placeholder) return;
    
    const img = new Image();
    
    img.onload = () => {
      setImageSrc(src);
      setLoading(false);
      onLoad?.();
    };
    
    img.onerror = () => {
      setImageSrc(errorSrc);
      setLoading(false);
      onError?.();
    };
    
    img.src = src;
  }, [isIntersecting, src, placeholder, errorSrc, imageSrc, onLoad, onError]);
  
  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'} ${className}`}
      {...props}
    />
  );
});

// Debounced input component
interface DebouncedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onValueChange: (value: string) => void;
  delay?: number;
}

export const DebouncedInput = memo(function DebouncedInput({
  value: initialValue,
  onValueChange,
  delay = 300,
  ...props
}: DebouncedInputProps) {
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebounce(value, delay);
  
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  
  useEffect(() => {
    if (debouncedValue !== initialValue) {
      onValueChange(debouncedValue);
    }
  }, [debouncedValue, initialValue, onValueChange]);
  
  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
});

// Progressive enhancement wrapper
interface ProgressiveEnhancementProps {
  children: ReactNode;
  fallback?: ReactNode;
  enhanced?: boolean;
}

export function ProgressiveEnhancement({
  children,
  fallback,
  enhanced = true,
}: ProgressiveEnhancementProps) {
  const [isEnhanced, setIsEnhanced] = useState(false);
  
  useEffect(() => {
    // Check if JavaScript is enabled and running
    setIsEnhanced(enhanced);
  }, [enhanced]);
  
  if (!isEnhanced && fallback) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Batch update hook for reducing re-renders
export function useBatchUpdate<T extends object>(initialState: T) {
  const [state, setState] = useState(initialState);
  const pendingUpdates = useRef<Partial<T>>({});
  const updateTimerRef = useRef<number>();
  
  const batchUpdate = useCallback((updates: Partial<T>) => {
    pendingUpdates.current = { ...pendingUpdates.current, ...updates };
    
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }
    
    updateTimerRef.current = window.setTimeout(() => {
      setState((prevState) => ({
        ...prevState,
        ...pendingUpdates.current,
      }));
      pendingUpdates.current = {};
    }, 0);
  }, []);
  
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);
  
  return [state, batchUpdate] as const;
}

// Request animation frame hook
export function useAnimationFrame(callback: (deltaTime: number) => void) {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        callbackRef.current(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);
}

// Export all utilities
export default {
  optimizedMemo,
  shallowEqual,
  deepEqual,
  useOptimizedCallback,
  VirtualList,
  LazyComponent,
  useIntersectionObserver,
  LazyImage,
  DebouncedInput,
  ProgressiveEnhancement,
  useBatchUpdate,
  useAnimationFrame,
};
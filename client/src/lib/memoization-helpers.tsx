// @ts-nocheck
import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { shallowEqual } from './performance';

// Enhanced memo with custom comparison
export function optimizedMemo<T extends React.ComponentType<any>>(
  Component: T,
  propsAreEqual?: (prevProps: any, nextProps: any) => boolean
): T {
  return memo(Component, propsAreEqual || shallowEqual) as T;
}

// Stable callback hook with dependency tracking
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const callbackRef = useRef<T>(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  });
  
  return useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    deps
  );
}

// Memoized value with custom comparison
export function useMemoCompare<T>(
  factory: () => T,
  deps: React.DependencyList,
  compare: (prev: T | undefined, next: T) => boolean
): T {
  const ref = useRef<T>();
  const prevDeps = useRef<React.DependencyList>();
  
  if (!prevDeps.current || !deps.every((dep, i) => dep === prevDeps.current![i])) {
    const next = factory();
    if (!compare(ref.current, next)) {
      ref.current = next;
    }
    prevDeps.current = deps;
  }
  
  return ref.current as T;
}

// Heavy computation memoization with cache
export function useMemoizedComputation<T>(
  computation: () => T,
  deps: React.DependencyList,
  cacheSize: number = 10
): T {
  const cache = useRef<Map<string, T>>(new Map());
  const key = JSON.stringify(deps);
  
  return useMemo(() => {
    if (cache.current.has(key)) {
      return cache.current.get(key)!;
    }
    
    const result = computation();
    cache.current.set(key, result);
    
    // Maintain cache size
    if (cache.current.size > cacheSize) {
      const firstKey = cache.current.keys().next().value;
      cache.current.delete(firstKey);
    }
    
    return result;
  }, deps);
}

// Batched state updates
export function useBatchedState<T extends Record<string, any>>(
  initialState: T
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = useState(initialState);
  const pendingUpdates = useRef<Partial<T>>({});
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const batchedSetState = useCallback((updates: Partial<T>) => {
    pendingUpdates.current = { ...pendingUpdates.current, ...updates };
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, ...pendingUpdates.current }));
      pendingUpdates.current = {};
    }, 0);
  }, []);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return [state, batchedSetState];
}

// Context optimization wrapper
export function createOptimizedContext<T>() {
  const Context = React.createContext<T | undefined>(undefined);
  
  const Provider = memo(({ children, value }: { children: React.ReactNode; value: T }) => {
    const memoizedValue = useMemo(() => value, [JSON.stringify(value)]);
    
    return (
      <Context.Provider value={memoizedValue}>
        {children}
      </Context.Provider>
    );
  });
  
  const useContext = () => {
    const context = React.useContext(Context);
    if (context === undefined) {
      throw new Error('useContext must be used within Provider');
    }
    return context;
  };
  
  return { Provider, useContext };
}

// List virtualization helper component
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

export const VirtualList = memo(function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = ''
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return (
    <div
      ref={scrollRef}
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
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
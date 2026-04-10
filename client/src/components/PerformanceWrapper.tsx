import React, { memo, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

// Higher-order component for memoization with custom comparison
export function withMemo<P extends object>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean
) {
  return memo(Component, propsAreEqual);
}

// Wrapper for expensive components with built-in optimizations
interface PerformanceWrapperProps {
  children: React.ReactNode;
  className?: string;
  enableContainment?: boolean;
  enableHardwareAcceleration?: boolean;
  enableLazyRendering?: boolean;
  threshold?: number;
}

export const PerformanceWrapper = memo(({
  children,
  className,
  enableContainment = true,
  enableHardwareAcceleration = true,
  enableLazyRendering = false,
  threshold = 0.1
}: PerformanceWrapperProps) => {
  const containerClasses = cn(
    className,
    enableContainment && 'contain-all',
    enableHardwareAcceleration && 'hardware-accelerated',
    'stable-layout'
  );

  if (enableLazyRendering) {
    return (
      <div className={containerClasses} data-lazy-render="true">
        {children}
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {children}
    </div>
  );
});

PerformanceWrapper.displayName = 'PerformanceWrapper';

// Optimized list component with virtualization support
interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  className?: string;
  enableVirtualization?: boolean;
  itemHeight?: number;
  overscan?: number;
}

export function OptimizedList<T>({
  items,
  renderItem,
  keyExtractor,
  className,
  enableVirtualization = false,
  itemHeight = 100,
  overscan = 3
}: OptimizedListProps<T>) {
  const memoizedItems = useMemo(() => items, [items]);
  
  const memoizedRenderItem = useCallback(
    (item: T, index: number) => (
      <PerformanceWrapper
        key={keyExtractor(item, index)}
        className="performance-card"
        enableContainment={true}
      >
        {renderItem(item, index)}
      </PerformanceWrapper>
    ),
    [renderItem, keyExtractor]
  );

  if (enableVirtualization && items.length > 50) {
    // For large lists, use content-visibility for better performance
    return (
      <div className={cn('virtual-list', className)}>
        {memoizedItems.map(memoizedRenderItem)}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {memoizedItems.map(memoizedRenderItem)}
    </div>
  );
}

// Memoized event handler creator
export function useMemoizedHandlers<T extends Record<string, (...args: any[]) => any>>(
  handlers: T,
  deps: React.DependencyList
): T {
  return useMemo(() => {
    const memoized: Partial<T> = {};
    for (const key in handlers) {
      memoized[key] = handlers[key];
    }
    return memoized as T;
  }, deps);
}

// Animation wrapper with performance optimizations
interface AnimationWrapperProps {
  children: React.ReactNode;
  animationType?: 'slide' | 'fade' | 'scale' | 'none';
  duration?: number;
  delay?: number;
  className?: string;
}

export const AnimationWrapper = memo(({
  children,
  animationType = 'fade',
  duration = 300,
  delay = 0,
  className
}: AnimationWrapperProps) => {
  const animationClass = {
    slide: 'transform transition-transform',
    fade: 'transition-opacity',
    scale: 'transform transition-transform',
    none: ''
  }[animationType];

  const style = {
    transitionDuration: `${duration}ms`,
    transitionDelay: `${delay}ms`,
    transform: 'translateZ(0)', // Force hardware acceleration
    willChange: animationType === 'none' ? 'auto' : 'transform, opacity'
  };

  return (
    <div 
      className={cn(animationClass, 'gpu-accelerated', className)}
      style={style}
    >
      {children}
    </div>
  );
});

AnimationWrapper.displayName = 'AnimationWrapper';

// Export utility for checking if motion is preferred
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
import { lazy, type ComponentType } from 'react';

export function instrumentedLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  name: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const start = performance.now();
    try {
      const module = await factory();
      const duration = performance.now() - start;
      if (duration > 1000) {
        console.warn(`[LazyLoad] ${name} took ${duration.toFixed(0)}ms to load`);
      }
      return module;
    } catch (error) {
      console.error(`[LazyLoad] Failed to load ${name}:`, error);
      throw error;
    }
  });
}

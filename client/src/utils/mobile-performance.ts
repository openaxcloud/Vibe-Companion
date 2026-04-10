// Mobile Performance Optimization Utilities

import { isMobile, getNetworkType } from './mobile-detection';

// Image lazy loading with blur-up technique
export const lazyLoadImage = (
  src: string,
  placeholder?: string,
  onLoad?: () => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      onLoad?.();
      resolve(src);
    };
    
    img.onerror = reject;
    
    // Load placeholder first if provided
    if (placeholder) {
      const placeholderImg = new Image();
      placeholderImg.src = placeholder;
      placeholderImg.onload = () => {
        // Start loading the full image
        img.src = src;
      };
    } else {
      img.src = src;
    }
  });
};

// Debounce function for search inputs
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

// Throttle function for scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};

// Request Idle Callback wrapper
export const whenIdle = (callback: () => void): number => {
  if ('requestIdleCallback' in window) {
    return (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(callback);
  }
  return setTimeout(callback, 1) as unknown as number;
};

// Cancel idle callback
export const cancelWhenIdle = (id: number): void => {
  if ('cancelIdleCallback' in window) {
    (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

// Intersection Observer for lazy loading
export const observeElement = (
  element: Element,
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
): IntersectionObserver => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(callback);
  }, {
    rootMargin: '50px',
    threshold: 0.01,
    ...options,
  });
  
  observer.observe(element);
  return observer;
};

// Virtual scrolling helper
export interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  items: any[];
  overscan?: number;
}

export const calculateVirtualScroll = (
  scrollTop: number,
  options: VirtualScrollOptions
) => {
  const { itemHeight, containerHeight, items, overscan = 3 } = options;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;
  
  return {
    visibleItems,
    startIndex,
    endIndex,
    offsetY,
    totalHeight,
  };
};

// Preload critical resources
export const preloadResource = (url: string, type: 'image' | 'script' | 'style' | 'font') => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  
  switch (type) {
    case 'image':
      link.as = 'image';
      break;
    case 'script':
      link.as = 'script';
      break;
    case 'style':
      link.as = 'style';
      break;
    case 'font':
      link.as = 'font';
      link.crossOrigin = 'anonymous';
      break;
  }
  
  document.head.appendChild(link);
};

// Cache manager for localStorage
export class CacheManager {
  private prefix: string;
  private maxAge: number;
  private maxSize: number;

  constructor(prefix = 'app_cache', maxAge = 3600000, maxSize = 5242880) {
    this.prefix = prefix;
    this.maxAge = maxAge; // 1 hour default
    this.maxSize = maxSize; // 5MB default
  }

  set(key: string, data: any, customMaxAge?: number): void {
    const cacheKey = `${this.prefix}_${key}`;
    const cacheData = {
      data,
      timestamp: Date.now(),
      maxAge: customMaxAge || this.maxAge,
    };

    try {
      const serialized = JSON.stringify(cacheData);
      
      // Check size
      if (serialized.length > this.maxSize) {
        console.warn(`Cache data for ${key} exceeds max size`);
        return;
      }
      
      localStorage.setItem(cacheKey, serialized);
      
      // Clean old entries if storage is getting full
      this.cleanIfNeeded();
    } catch (error) {
      console.error('Failed to cache data:', error);
      // Clear some space and retry
      this.clearOldest();
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (retryError) {
        console.error('Failed to cache after cleanup:', retryError);
      }
    }
  }

  get(key: string): any | null {
    const cacheKey = `${this.prefix}_${key}`;
    
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const { data, timestamp, maxAge } = JSON.parse(cached);
      
      // Check if expired
      if (Date.now() - timestamp > maxAge) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  remove(key: string): void {
    localStorage.removeItem(`${this.prefix}_${key}`);
  }

  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  private cleanIfNeeded(): void {
    try {
      const used = new Blob(Object.values(localStorage)).size;
      const estimatedMax = 5 * 1024 * 1024; // 5MB estimate
      
      if (used > estimatedMax * 0.8) {
        this.clearOldest();
      }
    } catch (error) {
      // Blob constructor might not be available
    }
  }

  private clearOldest(): void {
    const items: Array<{ key: string; timestamp: number }> = [];
    
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.prefix)) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          items.push({ key, timestamp: data.timestamp || 0 });
        } catch (error) {
          // Invalid item, remove it
          localStorage.removeItem(key);
        }
      }
    });
    
    // Sort by timestamp and remove oldest 20%
    items.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = Math.ceil(items.length * 0.2);
    
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(items[i].key);
    }
  }
}

// Adaptive quality based on network
export const getAdaptiveQuality = async (): Promise<'low' | 'medium' | 'high'> => {
  const networkType = await getNetworkType();
  
  switch (networkType) {
    case 'slow-2g':
    case '2g':
      return 'low';
    case '3g':
      return 'medium';
    case '4g':
    case 'wifi':
      return 'high';
    default:
      return isMobile() ? 'medium' : 'high';
  }
};

// Frame rate monitor
export class FrameRateMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;
  private callback?: (fps: number) => void;
  private rafId?: number;

  start(callback?: (fps: number) => void): void {
    this.callback = callback;
    this.measure();
  }

  stop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }

  private measure = (): void => {
    this.frameCount++;
    const currentTime = performance.now();
    
    if (currentTime >= this.lastTime + 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
      this.frameCount = 0;
      this.lastTime = currentTime;
      this.callback?.(this.fps);
    }
    
    this.rafId = requestAnimationFrame(this.measure);
  };

  getFPS(): number {
    return this.fps;
  }
}

// Memory usage monitor (if available)
export const getMemoryUsage = (): number | null => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return memory.usedJSHeapSize / memory.jsHeapSizeLimit;
  }
  return null;
};

// Batch DOM updates
export class DOMBatcher {
  private queue: Array<() => void> = [];
  private rafId?: number;

  add(operation: () => void): void {
    this.queue.push(operation);
    
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  flush(): void {
    const operations = [...this.queue];
    this.queue = [];
    this.rafId = undefined;
    
    operations.forEach(op => op());
  }

  clear(): void {
    this.queue = [];
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
  }
}
/**
 * iPad Pro Performance Optimizations
 * 
 * Provides specific optimizations for iPad Pro devices:
 * - High-resolution display handling
 * - ProMotion 120Hz display optimization
 * - Memory management for large screens
 * - Touch latency reduction
 */

interface iPadProConfig {
  isIPadPro: boolean;
  screenSize: 'small' | 'large' | 'xlarge';
  hasProMotion: boolean;
  devicePixelRatio: number;
}

/**
 * Detect iPad Pro specific features
 */
export function detectIPadPro(): iPadProConfig {
  if (typeof window === 'undefined') {
    return {
      isIPadPro: false,
      screenSize: 'small',
      hasProMotion: false,
      devicePixelRatio: 1,
    };
  }

  const userAgent = navigator.userAgent;
  const isIPad = /iPad|Macintosh/.test(userAgent) && 'ontouchend' in document;
  const width = window.screen.width;
  const height = window.screen.height;
  const dpr = window.devicePixelRatio || 1;

  // iPad Pro screen sizes:
  // - 11": 834x1194 (landscape), 1194x834 (portrait)
  // - 12.9": 1024x1366 (landscape), 1366x1024 (portrait)
  const maxDimension = Math.max(width, height);
  const minDimension = Math.min(width, height);

  let screenSize: 'small' | 'large' | 'xlarge' = 'small';
  let isIPadPro = false;

  // 12.9" iPad Pro
  if (isIPad && maxDimension >= 1366 && minDimension >= 1024) {
    isIPadPro = true;
    screenSize = 'xlarge';
  }
  // 11" iPad Pro
  else if (isIPad && maxDimension >= 1194 && minDimension >= 834) {
    isIPadPro = true;
    screenSize = 'large';
  }
  // Regular iPad
  else if (isIPad && maxDimension >= 1024 && minDimension >= 768) {
    screenSize = 'small';
  }

  // ProMotion detection (120Hz refresh rate)
  // iPad Pro models from 2017 onward support ProMotion
  const hasProMotion = isIPadPro && dpr === 2;

  return {
    isIPadPro,
    screenSize,
    hasProMotion,
    devicePixelRatio: dpr,
  };
}

/**
 * Get optimized Monaco editor config for iPad Pro
 */
export function getIPadProMonacoConfig() {
  const config = detectIPadPro();

  if (!config.isIPadPro) {
    return {};
  }

  return {
    // Higher font size for larger screens
    fontSize: config.screenSize === 'xlarge' ? 16 : 14,
    lineHeight: config.screenSize === 'xlarge' ? 24 : 22,
    
    // Enable minimap on iPad Pro (enough screen real estate)
    minimap: {
      enabled: true,
      maxColumn: 80,
      renderCharacters: false, // Performance optimization
      showSlider: 'always' as const,
    },

    // Smooth scrolling for ProMotion displays
    smoothScrolling: config.hasProMotion,
    
    // Higher scroll sensitivity for large touchscreens
    scrollbar: {
      verticalScrollbarSize: 12,
      horizontalScrollbarSize: 12,
      useShadows: true,
    },

    // Performance optimizations for high-DPR displays
    renderWhitespace: 'selection' as const, // Less rendering overhead
    renderLineHighlight: 'line' as const,
    
    // Better touch interaction
    mouseWheelScrollSensitivity: 1.5,
    fastScrollSensitivity: 5,
  };
}

/**
 * Optimize canvas rendering for high-DPR displays
 */
export function optimizeCanvasForIPadPro(canvas: HTMLCanvasElement) {
  const config = detectIPadPro();
  
  if (!config.isIPadPro || config.devicePixelRatio === 1) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas internal resolution to match device pixel ratio
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * config.devicePixelRatio;
  canvas.height = rect.height * config.devicePixelRatio;
  
  // Scale context to maintain correct visual size
  ctx.scale(config.devicePixelRatio, config.devicePixelRatio);
  
  // Use crisp rendering for text
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = 'high';
}

/**
 * Request idle callback with fallback for better performance
 */
export function requestIdleCallback(callback: () => void, options?: { timeout?: number }) {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  } else {
    // Fallback for browsers without requestIdleCallback
    return setTimeout(callback, options?.timeout || 1);
  }
}

/**
 * Cancel idle callback with fallback
 */
export function cancelIdleCallback(handle: number) {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}

/**
 * Optimize touch event handling for low latency
 */
export function optimizeTouchEvents(element: HTMLElement) {
  const config = detectIPadPro();
  
  if (!config.isIPadPro) {
    return () => {};
  }

  // Use passive listeners for better scroll performance
  const passiveOptions = { passive: true };
  
  const touchStartHandler = (e: TouchEvent) => {
    // Reduce touch latency by handling in the next frame
    requestAnimationFrame(() => {
      // Touch handling logic
    });
  };

  element.addEventListener('touchstart', touchStartHandler, passiveOptions);
  element.addEventListener('touchmove', touchStartHandler, passiveOptions);
  element.addEventListener('touchend', touchStartHandler, passiveOptions);

  // Return cleanup function
  return () => {
    element.removeEventListener('touchstart', touchStartHandler);
    element.removeEventListener('touchmove', touchStartHandler);
    element.removeEventListener('touchend', touchStartHandler);
  };
}

/**
 * Enable hardware acceleration for animations
 */
export function enableHardwareAcceleration(element: HTMLElement) {
  element.style.willChange = 'transform, opacity';
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
}

/**
 * Disable hardware acceleration (cleanup)
 */
export function disableHardwareAcceleration(element: HTMLElement) {
  element.style.willChange = 'auto';
  element.style.transform = '';
  element.style.backfaceVisibility = '';
  element.style.perspective = '';
}

/**
 * Prefetch resources for faster tablet navigation
 */
export function prefetchTabletResources() {
  const config = detectIPadPro();
  
  if (!config.isIPadPro) {
    return;
  }

  // Use requestIdleCallback to prefetch during idle time
  requestIdleCallback(() => {
    // Prefetch Monaco editor worker
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = '/monaco-editor/esm/vs/editor/editor.worker.js';
    document.head.appendChild(link);

    // Prefetch common assets
    const assets = [
      '/monaco-editor/esm/vs/language/typescript/ts.worker.js',
      '/monaco-editor/esm/vs/language/json/json.worker.js',
    ];

    assets.forEach(asset => {
      const assetLink = document.createElement('link');
      assetLink.rel = 'prefetch';
      assetLink.href = asset;
      document.head.appendChild(assetLink);
    });
  }, { timeout: 2000 });
}

/**
 * Tablet-Specific Detection Utilities
 * Enhanced detection for iPad, Surface, and Android tablets
 * @module tablet-detection
 */

export interface TabletInfo {
  isTablet: boolean;
  isIPad: boolean;
  isIPadPro: boolean;
  isIPadMini: boolean;
  isIPadAir: boolean;
  isSurface: boolean;
  isAndroidTablet: boolean;
  hasApplePencil: boolean;
  hasKeyboard: boolean;
  screenSize: 'small' | 'medium' | 'large'; // 7-9", 9-11", 11"+
  orientation: 'portrait' | 'landscape';
  pixelRatio: number;
}

export function detectTablet(): TabletInfo {
  // SSR guard
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isTablet: false,
      isIPad: false,
      isIPadPro: false,
      isIPadMini: false,
      isIPadAir: false,
      isSurface: false,
      isAndroidTablet: false,
      hasApplePencil: false,
      hasKeyboard: true,
      screenSize: 'medium',
      orientation: 'landscape',
      pixelRatio: 1,
    };
  }
  
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ua = navigator.userAgent;
  const pixelRatio = window.devicePixelRatio || 1;
  
  // iPad detection (including iPad OS 13+ that reports as MacOS)
  const isIPad = /iPad/.test(ua) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Tablet UA detection
  const hasTabletUA = /iPad|Android|Tablet|PlayBook|Silk/i.test(ua);
  const isMobileUA = /Mobile/i.test(ua);
  
  // Touch and pointer detection for hardware validation
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  
  // Tablet detection: TRUE if:
  // 1. iPad (always, regardless of width for multitasking support)
  // 2. Tablet UA without Mobile flag (Android tablets, Surface, etc.)
  // 3. In tablet width range WITHOUT Mobile flag AND has touch/coarse pointer (prevents desktop resize false positives)
  const isInTabletRange = width >= 768 && width <= 1024;
  const isTablet = isIPad || 
                   (hasTabletUA && !isMobileUA) || 
                   (isInTabletRange && !isMobileUA && (hasTouch || hasCoarsePointer));
  
  // iPad model detection by screen dimensions
  const screenWidth = window.screen.width * pixelRatio;
  const screenHeight = window.screen.height * pixelRatio;
  
  // iPad Pro detection (11" and 12.9")
  const isIPadPro11 = (screenWidth === 1668 && screenHeight === 2388) || // 11" 2018+
                       (screenWidth === 2388 && screenHeight === 1668);
  const isIPadPro129 = (screenWidth === 2048 && screenHeight === 2732) || // 12.9" 2015+
                        (screenWidth === 2732 && screenHeight === 2048);
  const isIPadPro = isIPadPro11 || isIPadPro129;
  
  // iPad Mini detection (7.9")
  const isIPadMini = (screenWidth === 1536 && screenHeight === 2048) || // Mini 5/6
                      (screenWidth === 2048 && screenHeight === 1536);
  
  // iPad Air detection (10.9")
  const isIPadAir = (screenWidth === 1640 && screenHeight === 2360) || // Air 4/5
                     (screenWidth === 2360 && screenHeight === 1640);
  
  // Surface detection
  const isSurface = /Surface/i.test(ua);
  
  // Android tablet detection
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
  
  // Apple Pencil support detection (iPad only)
  const hasApplePencil = isIPad && (
    isIPadPro || isIPadAir || 
    (screenWidth >= 1536 && screenHeight >= 2048) // iPad Mini 5+ and iPad 9th gen+
  );
  
  // Physical keyboard detection using pointer media query (fine = mouse/trackpad, coarse = touch)
  // This is more reliable than maxTouchPoints which doesn't distinguish keyboard presence
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  const hasKeyboard = hasFinePointer || width >= 1024; // Fine pointer OR landscape desktop size
  
  // Screen size category
  let screenSize: 'small' | 'medium' | 'large' = 'medium';
  const diagonal = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
  if (diagonal < 900) screenSize = 'small';       // 7-9" tablets
  else if (diagonal >= 1200) screenSize = 'large'; // 11"+ tablets
  
  // Orientation
  const orientation = width > height ? 'landscape' : 'portrait';
  
  return {
    isTablet,
    isIPad,
    isIPadPro,
    isIPadMini,
    isIPadAir,
    isSurface,
    isAndroidTablet,
    hasApplePencil,
    hasKeyboard,
    screenSize,
    orientation,
    pixelRatio,
  };
}

/**
 * Tablet Layout Configuration
 */
export interface TabletLayout {
  canShowSidebar: boolean;        // Can show collapsible sidebar
  canSplitView: boolean;          // Can show editor + preview side-by-side
  canShowDrawer: boolean;         // Can show file drawer
  optimalColumns: 1 | 2 | 3;     // Optimal column count
  optimalEditorWidth: number;     // Optimal editor width in px
  optimalSidebarWidth: number;    // Optimal sidebar width in px
  touchTargetSize: number;        // Minimum touch target size in px
  useMobileKeyboard: boolean;     // Show mobile keyboard toolbar
}

export function getTabletLayout(info: TabletInfo): TabletLayout {
  const { isIPadPro, orientation, screenSize, hasKeyboard } = info;
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
  
  // iPad Pro 12.9" or landscape large tablets can show 3 panels
  const canShowSidebar = orientation === 'landscape' || width >= 900;
  const canSplitView = width >= 768;
  const canShowDrawer = true; // All tablets support drawer
  
  // Column layout
  let optimalColumns: 1 | 2 | 3 = 2;
  if (orientation === 'portrait' && screenSize === 'small') {
    optimalColumns = 1; // Small portrait tablets (iPad Mini portrait)
  } else if (isIPadPro && orientation === 'landscape') {
    optimalColumns = 3; // iPad Pro landscape can handle 3 panels
  }
  
  // Panel widths with min bounds to prevent collapse
  const optimalSidebarWidth = screenSize === 'large' ? 320 : 280;
  
  // Calculate editor width with minimum bounds
  // Reserve space for sidebar, then allocate remaining space between editor and preview
  const reservedSidebarSpace = canShowSidebar ? optimalSidebarWidth : 0;
  const remainingWidth = width - reservedSidebarSpace;
  
  // For split view, divide remaining space 60/40 between editor and preview
  // Otherwise give full remaining width to editor
  const optimalEditorWidth = canSplitView 
    ? Math.max(400, Math.floor(remainingWidth * 0.6)) // Minimum 400px for editor
    : Math.max(300, remainingWidth); // Minimum 300px when no split
  
  // Touch targets (larger than desktop, smaller than mobile)
  const touchTargetSize = 48; // 48px minimum (between mobile's 56px and desktop's 40px)
  
  // Show mobile keyboard toolbar if no physical keyboard
  const useMobileKeyboard = !hasKeyboard;
  
  return {
    canShowSidebar,
    canSplitView,
    canShowDrawer,
    optimalColumns,
    optimalEditorWidth,
    optimalSidebarWidth,
    touchTargetSize,
    useMobileKeyboard,
  };
}

/**
 * Tablet-optimized gesture thresholds
 */
export const TABLET_GESTURES = {
  swipeThreshold: 80,        // px to trigger swipe (vs 100 on mobile)
  tapTimeout: 250,           // ms for tap detection
  longPressTimeout: 500,     // ms for long press
  doubleTapTimeout: 300,     // ms between taps
  pinchThreshold: 1.2,       // scale change to trigger pinch
  velocityThreshold: 0.3,    // velocity for momentum scrolling
} as const;

/**
 * iPad-specific safe area adjustments
 */
export function getIPadSafeArea(): { top: number; right: number; bottom: number; left: number } {
  if (typeof window === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
  
  const style = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0'),
    right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0'),
    bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
    left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0'),
  };
}

/**
 * Check if running in iPad Split View or Slide Over
 */
export function isIPadMultitasking(): boolean {
  if (typeof window === 'undefined') return false;
  
  const { isIPad } = detectTablet();
  if (!isIPad) return false;
  
  // In Split View or Slide Over, window width is reduced
  const width = window.innerWidth;
  const screenWidth = window.screen.width;
  
  // If window is significantly smaller than screen, likely in multitasking mode
  return width < screenWidth * 0.8;
}

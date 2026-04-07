// Mobile Device Detection Utilities

export const isMobile = (): boolean => {
  return window.innerWidth < 768 || 
         /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i.test(navigator.userAgent);
};

export const isTablet = (): boolean => {
  return window.innerWidth >= 768 && window.innerWidth < 1024 &&
         /iPad|Android/i.test(navigator.userAgent);
};

export const isIOS = (): boolean => {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const isAndroid = (): boolean => {
  return /Android/.test(navigator.userAgent);
};

export const hasNotch = (): boolean => {
  const ratio = window.devicePixelRatio || 1;
  const screen = window.screen;
  
  // iPhone X/XS/11 Pro
  const isIPhoneX = screen.height === 812 && screen.width === 375 && ratio === 3;
  // iPhone XS Max/11 Pro Max
  const isIPhoneXSMax = screen.height === 896 && screen.width === 414 && ratio === 3;
  // iPhone 12/13/14 Pro
  const isIPhone12Pro = screen.height === 844 && screen.width === 390 && ratio === 3;
  // iPhone 12/13/14 Pro Max
  const isIPhone12ProMax = screen.height === 926 && screen.width === 428 && ratio === 3;
  // iPhone 12/13 mini
  const isIPhoneMini = screen.height === 780 && screen.width === 360 && ratio === 3;
  // iPhone 14 Pro / 15 Pro (Dynamic Island)
  const isIPhone14Pro = screen.height === 852 && screen.width === 393 && ratio === 3;
  // iPhone 14 Pro Max / 15 Pro Max (Dynamic Island)
  const isIPhone14ProMax = screen.height === 932 && screen.width === 430 && ratio === 3;
  
  return isIPhoneX || isIPhoneXSMax || isIPhone12Pro || isIPhone12ProMax || 
         isIPhoneMini || isIPhone14Pro || isIPhone14ProMax;
};

export const supportsTouch = (): boolean => {
  return 'ontouchstart' in window ||
         navigator.maxTouchPoints > 0 ||
         ('msMaxTouchPoints' in navigator && (navigator as any).msMaxTouchPoints > 0);
};

export const supportsHaptic = (): boolean => {
  return 'vibrate' in navigator;
};

export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (isMobile()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
};

export const getOrientation = (): 'portrait' | 'landscape' => {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
};

export const isStandalone = (): boolean => {
  // Check if app is installed as PWA
  return (window.matchMedia('(display-mode: standalone)').matches) ||
         ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
         document.referrer.includes('android-app://');
};

export const getSafeAreaInsets = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--sat') || '0'),
    right: parseInt(style.getPropertyValue('--sar') || '0'),
    bottom: parseInt(style.getPropertyValue('--sab') || '0'),
    left: parseInt(style.getPropertyValue('--sal') || '0'),
  };
};

export const isSafari = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  const isSafariBrowser = ua.includes('safari') && !ua.includes('chrome');
  return isSafariBrowser;
};

export const isChrome = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('chrome') && !ua.includes('edg');
};

export const getIOSVersion = (): number | null => {
  if (!isIOS()) return null;
  
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
};

export const getAndroidVersion = (): number | null => {
  if (!isAndroid()) return null;
  
  const match = navigator.userAgent.match(/Android\s([0-9.]+)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
};

// Utility to detect if device supports advanced features
export const deviceCapabilities = () => {
  return {
    touch: supportsTouch(),
    haptic: supportsHaptic(),
    webgl: (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && 
                 (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      } catch (e) {
        return false;
      }
    })(),
    geolocation: 'geolocation' in navigator,
    camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    speechRecognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
    notification: 'Notification' in window,
    bluetooth: 'bluetooth' in navigator,
    nfc: 'NDEFReader' in window,
    accelerometer: 'Accelerometer' in window,
    gyroscope: 'Gyroscope' in window,
  };
};

// Network detection
export const getNetworkType = async (): Promise<string> => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return connection.effectiveType || 'unknown';
  }
  return 'unknown';
};

export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Viewport utilities
export const getViewportSize = () => {
  return {
    width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
    height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0),
  };
};

export const getScreenSize = () => {
  return {
    width: window.screen.width,
    height: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    pixelRatio: window.devicePixelRatio || 1,
  };
};
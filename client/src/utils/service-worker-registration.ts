/**
 * Service Worker Registration
 * Enables offline mode and PWA capabilities
 */

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return undefined;
  }

  if (import.meta.env.DEV) {
    console.log('[SW] Skipping in development mode');
    return undefined;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[SW] Service worker registered:', registration.scope);

    // Check for updates every hour
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker installed, show update notification
          showUpdateNotification();
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    return undefined;
  }
}

// Unregister service worker
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const success = await registration.unregister();
      console.log('[SW] Service worker unregistered:', success);
      return success;
    }
    return false;
  } catch (error) {
    console.error('[SW] Unregistration failed:', error);
    return false;
  }
}

// Show update notification
function showUpdateNotification() {
  // Create custom event for update notification
  const event = new CustomEvent('sw-update-available', {
    detail: {
      message: 'A new version is available!',
      action: 'reload',
    },
  });
  window.dispatchEvent(event);

  // Also show native notification if permission granted
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('E-Code Update Available', {
      body: 'A new version of E-Code is available. Refresh to update.',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'app-update',
      requireInteraction: true,
    });
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('[Notifications] Not supported');
    return 'denied';
  }

  if (Notification.permission !== 'default') {
    return Notification.permission;
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('[Notifications] Permission:', permission);
    return permission;
  } catch (error) {
    console.error('[Notifications] Permission request failed:', error);
    return 'denied';
  }
}

// Check if app is running in standalone mode (installed PWA)
export function isStandalone(): boolean {
  // Check for iOS standalone mode
  const isIOSStandalone = (window.navigator as any).standalone === true;

  // Check for Android/Desktop standalone mode
  const isMediaStandalone = window.matchMedia('(display-mode: standalone)').matches;

  return isIOSStandalone || isMediaStandalone;
}

// Check if app is installed
export function isInstalled(): boolean {
  return isStandalone();
}

// Show install prompt (PWA)
let deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent default browser install prompt
  e.preventDefault();
  deferredPrompt = e;

  // Dispatch custom event to show install banner
  const event = new CustomEvent('pwa-installable', {
    detail: { prompt: e },
  });
  window.dispatchEvent(event);
});

export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) {
    console.log('[PWA] Install prompt not available');
    return false;
  }

  try {
    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user choice
    const choiceResult = await deferredPrompt.userChoice;

    console.log('[PWA] User choice:', choiceResult.outcome);

    // Clear the prompt
    deferredPrompt = null;

    return choiceResult.outcome === 'accepted';
  } catch (error) {
    console.error('[PWA] Install prompt failed:', error);
    return false;
  }
}

// Track app installation
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed successfully');
  deferredPrompt = null;

  // Track installation analytics
  if (typeof (window as any).gtag !== 'undefined') {
    (window as any).gtag('event', 'pwa_install', {
      event_category: 'engagement',
      event_label: 'PWA Installed',
    });
  }
});

// Service Worker Registration and Management

interface ServiceWorkerConfig {
  enableInDevelopment: boolean;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private config: ServiceWorkerConfig;

  constructor(config?: Partial<ServiceWorkerConfig>) {
    this.config = {
      enableInDevelopment: false,
      ...config,
    };
  }

  public async register(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Check environment
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '[::1]' ||
      window.location.hostname.match(
        /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
      )
    );

    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment && !this.config.enableInDevelopment && isLocalhost) {
      return;
    }

    try {
      const swUrl = '/sw.js';
      
      this.registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/',
      });

      // Check for updates
      this.registration.addEventListener('updatefound', () => {
        const installingWorker = this.registration!.installing;
        
        if (installingWorker) {
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New update available
                this.updateAvailable = true;
                
                if (this.config.onUpdate) {
                  this.config.onUpdate(this.registration!);
                }
                
                // Show update notification to user
                this.notifyUpdate();
              } else {
                // Content cached for offline use
                
                if (this.config.onSuccess) {
                  this.config.onSuccess(this.registration!);
                }
              }
            }
          });
        }
      });

      // Check for updates periodically (every hour)
      setInterval(() => {
        this.checkForUpdates();
      }, 60 * 60 * 1000);

      // Check on visibility change
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.checkForUpdates();
        }
      });

    } catch (error) {
      console.error('[SW] Registration failed:', error);
      
      if (this.config.onError && error instanceof Error) {
        this.config.onError(error);
      }
    }
  }

  public async unregister(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    
    for (const registration of registrations) {
      await registration.unregister();
    }
    
    return true;
  }

  public async checkForUpdates(): Promise<void> {
    if (this.registration) {
      try {
        await this.registration.update();
      } catch (error) {
        console.error('[SW] Update check failed:', error);
      }
    }
  }

  public skipWaiting(): void {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  public async clearCache(): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }
    
    // Also clear browser caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }
  }

  public async cacheUrls(urls: string[]): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_URLS',
        urls,
      });
    }
  }

  private notifyUpdate(): void {
    // You can implement a custom notification UI here
    // For now, using a simple confirm dialog
    const shouldUpdate = window.confirm(
      'New version available! Would you like to update now?'
    );
    
    if (shouldUpdate) {
      this.skipWaiting();
    }
  }

  public isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  public getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }
}

// Create singleton instance
const serviceWorkerManager = new ServiceWorkerManager({
  enableInDevelopment: false,
  onSuccess: (registration) => {
    // Service worker registered successfully
  },
  onUpdate: (registration) => {
    // Update available
  },
  onError: (error) => {
    console.error('[SW] Error:', error);
  },
});

// Export functions
export const registerServiceWorker = () => serviceWorkerManager.register();
export const unregisterServiceWorker = () => serviceWorkerManager.unregister();
export const checkForServiceWorkerUpdates = () => serviceWorkerManager.checkForUpdates();
export const clearServiceWorkerCache = () => serviceWorkerManager.clearCache();
export const skipWaitingServiceWorker = () => serviceWorkerManager.skipWaiting();
export const cacheUrls = (urls: string[]) => serviceWorkerManager.cacheUrls(urls);

export default serviceWorkerManager;
/**
 * Fortune 500 Grade Cache Reconciliation Layer
 * Coordinates Service Worker cache with TanStack Query state
 * 
 * IMPORTANT: This layer only handles BACKGROUND sync events, not foreground fetches.
 * Regular API calls are cached by SW but do NOT trigger query invalidation to avoid loops.
 */

import { queryClient } from './queryClient';

interface SWMessage {
  type: 'BACKGROUND_SYNC_COMPLETE' | 'OFFLINE_SYNC_COMPLETE' | 'CACHE_INVALIDATED';
  url?: string;
  urls?: string[];
  timestamp?: number;
  isBackgroundSync?: boolean;
}

const DEBOUNCE_MS = 2000;
const recentlyProcessed = new Map<string, number>();

class CacheReconciliationService {
  private initialized = false;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private isOnline = navigator.onLine;
  private wasOffline = false;

  init(): void {
    if (this.initialized) return;
    
    this.setupServiceWorkerListener();
    this.setupNetworkListeners();
    this.initialized = true;
  }

  private setupServiceWorkerListener(): void {
    if (!('serviceWorker' in navigator)) return;

    this.messageHandler = (event: MessageEvent<SWMessage>) => {
      if (!event.data?.type) return;

      switch (event.data.type) {
        case 'BACKGROUND_SYNC_COMPLETE':
          if (event.data.isBackgroundSync) {
            this.handleBackgroundSyncComplete(event.data);
          }
          break;
        case 'OFFLINE_SYNC_COMPLETE':
          this.handleOfflineSyncComplete(event.data);
          break;
        case 'CACHE_INVALIDATED':
          this.handleCacheInvalidated(event.data);
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', this.messageHandler);
  }

  private setupNetworkListeners(): void {
    this.onlineHandler = () => {
      this.isOnline = true;
      if (this.wasOffline) {
        this.wasOffline = false;
        this.refreshStaleQueries();
      }
    };

    this.offlineHandler = () => {
      this.isOnline = false;
      this.wasOffline = true;
    };

    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  private shouldProcess(url: string): boolean {
    const now = Date.now();
    const lastProcessed = recentlyProcessed.get(url);
    
    if (lastProcessed && now - lastProcessed < DEBOUNCE_MS) {
      return false;
    }
    
    recentlyProcessed.set(url, now);
    
    if (recentlyProcessed.size > 100) {
      const cutoff = now - DEBOUNCE_MS * 2;
      for (const [key, time] of recentlyProcessed.entries()) {
        if (time < cutoff) recentlyProcessed.delete(key);
      }
    }
    
    return true;
  }

  private handleBackgroundSyncComplete(data: SWMessage): void {
    if (!data.url || !this.shouldProcess(data.url)) return;

    const queryKey = this.urlToQueryKey(data.url);
    if (queryKey) {
      queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
    }
  }

  private handleOfflineSyncComplete(data: SWMessage): void {
    if (data.urls?.length) {
      data.urls.forEach(url => {
        const queryKey = this.urlToQueryKey(url);
        if (queryKey) {
          queryClient.invalidateQueries({ queryKey });
        }
      });
    }
    
    queryClient.invalidateQueries();
  }

  private handleCacheInvalidated(data: SWMessage): void {
    if (data.url) {
      const queryKey = this.urlToQueryKey(data.url);
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
    }
  }

  private urlToQueryKey(url: string): string[] | null {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      const pathname = parsedUrl.pathname;
      
      if (!pathname.startsWith('/api/')) return null;
      
      return [pathname];
    } catch {
      if (url.startsWith('/api/')) {
        return [url];
      }
      return null;
    }
  }

  private async refreshStaleQueries(): Promise<void> {
    await queryClient.refetchQueries({
      stale: true,
      type: 'active',
    });
  }

  notifyServiceWorker(type: string, data?: Record<string, unknown>): void {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type,
      ...data,
      timestamp: Date.now(),
    });
  }

  async clearAllCaches(): Promise<void> {
    queryClient.clear();
    
    this.notifyServiceWorker('CLEAR_ALL_CACHES');
  }

  destroy(): void {
    if (this.messageHandler && 'serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', this.messageHandler);
    }
    
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }
    
    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
    }

    this.initialized = false;
  }

  getStatus(): { initialized: boolean; isOnline: boolean } {
    return {
      initialized: this.initialized,
      isOnline: this.isOnline,
    };
  }
}

export const cacheReconciliation = new CacheReconciliationService();

// @ts-nocheck
/**
 * Offline Sync Service
 * Handles synchronization between offline IndexedDB and online API
 */

import { offlineStorage } from './offline-storage';

interface SyncResult {
  success: boolean;
  syncedProjects: number;
  syncedFiles: number;
  failedOperations: number;
  conflicts: Array<{ type: string; id: number; message: string }>;
}

class OfflineSyncService {
  private syncInProgress = false;
  private syncInterval: number | null = null;
  private onlineStatusHandler: (() => void) | null = null;

  /**
   * Initialize sync service
   */
  init(): void {
    // Listen for online/offline events
    this.onlineStatusHandler = () => {
      if (navigator.onLine) {
        this.syncAll();
      }
    };

    window.addEventListener('online', this.onlineStatusHandler);
    window.addEventListener('offline', this.onlineStatusHandler);

    // Auto-sync every 5 minutes when online
    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        this.syncAll();
      }
    }, 5 * 60 * 1000);

    // Initial sync if online
    if (navigator.onLine) {
      this.syncAll();
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.onlineStatusHandler) {
      window.removeEventListener('online', this.onlineStatusHandler);
      window.removeEventListener('offline', this.onlineStatusHandler);
      this.onlineStatusHandler = null;
    }
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Sync all pending operations
   */
  async syncAll(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        syncedProjects: 0,
        syncedFiles: 0,
        failedOperations: 0,
        conflicts: [],
      };
    }

    if (!this.isOnline()) {
      return {
        success: false,
        syncedProjects: 0,
        syncedFiles: 0,
        failedOperations: 0,
        conflicts: [],
      };
    }

    this.syncInProgress = true;

    const result: SyncResult = {
      success: true,
      syncedProjects: 0,
      syncedFiles: 0,
      failedOperations: 0,
      conflicts: [],
    };

    try {
      // Get all pending operations
      const operations = await offlineStorage.getPendingOperations();

      // Process each operation
      for (const op of operations) {
        try {
          await this.processPendingOperation(op);

          if (op.resourceType === 'project') {
            result.syncedProjects++;
          } else if (op.resourceType === 'file') {
            result.syncedFiles++;
          }

          // Remove from queue
          await offlineStorage.removePendingOperation(op.id);
        } catch (error) {

          // Check if it's a conflict (409)
          if ((error as any).status === 409) {
            result.conflicts.push({
              type: op.resourceType,
              id: op.resourceId,
              message: 'Resource modified on server',
            });
          }

          result.failedOperations++;

          // Increment retry count
          await offlineStorage.incrementOperationRetries(op.id);

          // Remove operation if too many retries (max 5)
          if (op.retries >= 5) {
            await offlineStorage.removePendingOperation(op.id);
          }
        }
      }

      // Sync projects and files status
      await this.syncPendingResources();
    } catch (error) {
      result.success = false;
    } finally {
      this.syncInProgress = false;
    }

    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent('offline-sync-completed', { detail: result }));

    return result;
  }

  /**
   * Process a single pending operation
   */
  private async processPendingOperation(op: any): Promise<void> {
    const apiUrl = import.meta.env.VITE_API_URL || '';

    switch (op.type) {
      case 'create':
        if (op.resourceType === 'project') {
          await fetch(`${apiUrl}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.data),
            credentials: 'include',
          }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          });
        } else if (op.resourceType === 'file') {
          await fetch(`${apiUrl}/api/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.data),
            credentials: 'include',
          }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          });
        }
        break;

      case 'update':
        if (op.resourceType === 'project') {
          await fetch(`${apiUrl}/api/projects/${op.resourceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.data),
            credentials: 'include',
          }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          });
        } else if (op.resourceType === 'file') {
          await fetch(`${apiUrl}/api/files/${op.resourceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.data),
            credentials: 'include',
          }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          });
        }
        break;

      case 'delete':
        if (op.resourceType === 'project') {
          await fetch(`${apiUrl}/api/projects/${op.resourceId}`, {
            method: 'DELETE',
            credentials: 'include',
          }).then((res) => {
            if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
          });
        } else if (op.resourceType === 'file') {
          await fetch(`${apiUrl}/api/files/${op.resourceId}`, {
            method: 'DELETE',
            credentials: 'include',
          }).then((res) => {
            if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
          });
        }
        break;
    }
  }

  /**
   * Sync pending projects and files
   */
  private async syncPendingResources(): Promise<void> {
    const [pendingProjects, pendingFiles] = await Promise.all([
      offlineStorage.getProjectsByStatus('pending'),
      offlineStorage.getFilesByStatus('pending'),
    ]);

    // Mark all as synced if operations completed successfully
    for (const project of pendingProjects) {
      await offlineStorage.saveProject({ ...project, syncStatus: 'synced' });
    }

    for (const file of pendingFiles) {
      await offlineStorage.saveFile({ ...file, syncStatus: 'synced' });
    }
  }

  /**
   * Force sync now (manual trigger)
   */
  async forceSyncNow(): Promise<SyncResult> {
    return this.syncAll();
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    online: boolean;
    syncing: boolean;
    pendingOperations: number;
    storageUsage: { used: number; quota: number; percentage: number };
  }> {
    const operations = await offlineStorage.getPendingOperations();
    const storageUsage = await offlineStorage.getStorageUsage();

    return {
      online: this.isOnline(),
      syncing: this.syncInProgress,
      pendingOperations: operations.length,
      storageUsage,
    };
  }

  /**
   * Register Service Worker for background sync
   */
  async registerBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('offline-sync');
      } catch (error) {
      }
    }
  }
}

// Export singleton instance
export const offlineSyncService = new OfflineSyncService();

// Auto-initialize
offlineSyncService.init();

// Register background sync
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(() => {
    offlineSyncService.registerBackgroundSync();
  });
}

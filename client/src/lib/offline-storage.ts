/**
 * Offline Storage with IndexedDB
 * Provides local storage for files, projects, and pending sync operations
 */

interface Project {
  id: number;
  name: string;
  description: string;
  lastModified: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

interface File {
  id: number;
  projectId: number;
  name: string;
  path: string;
  content: string;
  lastModified: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  resourceType: 'project' | 'file';
  resourceId: number;
  data: any;
  timestamp: number;
  retries: number;
}

const DB_NAME = 'ecode-offline';
const DB_VERSION = 1;

class OfflineStorageManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('lastModified', 'lastModified', { unique: false });
          projectStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Files store
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('projectId', 'projectId', { unique: false });
          fileStore.createIndex('path', 'path', { unique: false });
          fileStore.createIndex('lastModified', 'lastModified', { unique: false });
          fileStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Pending operations store (for sync queue)
        if (!db.objectStoreNames.contains('pendingOperations')) {
          const opStore = db.createObjectStore('pendingOperations', { keyPath: 'id' });
          opStore.createIndex('timestamp', 'timestamp', { unique: false });
          opStore.createIndex('resourceType', 'resourceType', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Helper to execute a transaction
   */
  private async transaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = callback(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================================
  // PROJECTS
  // ============================================================

  async saveProject(project: Project): Promise<void> {
    await this.transaction('projects', 'readwrite', (store) =>
      store.put({ ...project, lastModified: Date.now() })
    );
  }

  async getProject(id: number): Promise<Project | null> {
    const project = await this.transaction<Project>('projects', 'readonly', (store) =>
      store.get(id)
    );
    return project || null;
  }

  async getAllProjects(): Promise<Project[]> {
    return this.transaction<Project[]>('projects', 'readonly', (store) => store.getAll());
  }

  async deleteProject(id: number): Promise<void> {
    await this.transaction('projects', 'readwrite', (store) => store.delete(id));
    // Also delete all files in this project
    await this.deleteFilesByProject(id);
  }

  async getProjectsByStatus(status: 'synced' | 'pending' | 'conflict'): Promise<Project[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('projects', 'readonly');
      const store = transaction.objectStore('projects');
      const index = store.index('syncStatus');
      const request = index.getAll(status);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================================
  // FILES
  // ============================================================

  async saveFile(file: File): Promise<void> {
    await this.transaction('files', 'readwrite', (store) =>
      store.put({ ...file, lastModified: Date.now() })
    );
  }

  async getFile(id: number): Promise<File | null> {
    const file = await this.transaction<File>('files', 'readonly', (store) => store.get(id));
    return file || null;
  }

  async getFilesByProject(projectId: number): Promise<File[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('files', 'readonly');
      const store = transaction.objectStore('files');
      const index = store.index('projectId');
      const request = index.getAll(projectId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(id: number): Promise<void> {
    await this.transaction('files', 'readwrite', (store) => store.delete(id));
  }

  async deleteFilesByProject(projectId: number): Promise<void> {
    const files = await this.getFilesByProject(projectId);
    for (const file of files) {
      await this.deleteFile(file.id);
    }
  }

  async getFilesByStatus(status: 'synced' | 'pending' | 'conflict'): Promise<File[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('files', 'readonly');
      const store = transaction.objectStore('files');
      const index = store.index('syncStatus');
      const request = index.getAll(status);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================================
  // PENDING OPERATIONS (Sync Queue)
  // ============================================================

  async addPendingOperation(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const op: PendingOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
    };

    await this.transaction('pendingOperations', 'readwrite', (store) => store.put(op));
  }

  async getPendingOperations(): Promise<PendingOperation[]> {
    return this.transaction<PendingOperation[]>('pendingOperations', 'readonly', (store) =>
      store.getAll()
    );
  }

  async removePendingOperation(id: string): Promise<void> {
    await this.transaction('pendingOperations', 'readwrite', (store) => store.delete(id));
  }

  async incrementOperationRetries(id: string): Promise<void> {
    const op = await this.transaction<PendingOperation>(
      'pendingOperations',
      'readonly',
      (store) => store.get(id)
    );

    if (op) {
      op.retries += 1;
      await this.transaction('pendingOperations', 'readwrite', (store) => store.put(op));
    }
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  async getStorageUsage(): Promise<{ used: number; quota: number; percentage: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota > 0 ? (used / quota) * 100 : 0;

      return { used, quota, percentage };
    }

    return { used: 0, quota: 0, percentage: 0 };
  }

  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) return;

    const stores = ['projects', 'files', 'pendingOperations'];
    for (const storeName of stores) {
      await this.transaction(storeName, 'readwrite', (store) => store.clear());
    }
  }

  /**
   * Export all data (for backup/debugging)
   */
  async exportAll(): Promise<{ projects: Project[]; files: File[]; operations: PendingOperation[] }> {
    const [projects, files, operations] = await Promise.all([
      this.getAllProjects(),
      this.transaction<File[]>('files', 'readonly', (store) => store.getAll()),
      this.getPendingOperations(),
    ]);

    return { projects, files, operations };
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorageManager();

// Auto-initialize on import
offlineStorage.init().catch(() => {});

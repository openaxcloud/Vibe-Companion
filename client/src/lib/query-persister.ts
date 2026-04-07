/**
 * Fortune 500 Grade TanStack Query Persistence Layer
 * Integrates IndexedDB for offline-first cache with automatic hydration
 * Falls back to no-op persister when storage APIs are unavailable
 */

import { get, set, del, createStore } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const CACHE_KEY = 'ecode-tanstack-query-cache';
const CACHE_VERSION = 2;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

let queryStore: ReturnType<typeof createStore> | null = null;
let storageAvailable = false;

function initializeStorage(): void {
  try {
    if (typeof window === 'undefined') return;
    if (!window.indexedDB) return;
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    queryStore = createStore('ecode-query-cache', 'tanstack-queries');
    storageAvailable = true;
  } catch {
    storageAvailable = false;
    queryStore = null;
  }
}

initializeStorage();

interface CacheMetadata {
  version: number;
  timestamp: number;
  deviceId: string;
}

function getDeviceId(): string {
  if (!storageAvailable) return 'anonymous';
  try {
    let deviceId = localStorage.getItem('ecode-device-id');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('ecode-device-id', deviceId);
    }
    return deviceId;
  } catch {
    return 'anonymous';
  }
}

function createNoOpPersister(): Persister {
  return {
    persistClient: async () => {},
    restoreClient: async () => undefined,
    removeClient: async () => {},
  };
}

export function createIDBPersister(): Persister {
  if (!storageAvailable || !queryStore) {
    console.log('[QueryPersister] Storage unavailable, using no-op persister');
    return createNoOpPersister();
  }

  return {
    persistClient: async (client: PersistedClient) => {
      if (!queryStore) return;
      try {
        const metadata: CacheMetadata = {
          version: CACHE_VERSION,
          timestamp: Date.now(),
          deviceId: getDeviceId(),
        };
        
        await set(CACHE_KEY, { client, metadata }, queryStore);
      } catch {
        // Silently fail - IndexedDB may be corrupted after cache clear
        // This is non-critical functionality
      }
    },
    
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      if (!queryStore) return undefined;
      try {
        const data = await get<{ client: PersistedClient; metadata: CacheMetadata }>(
          CACHE_KEY,
          queryStore
        );
        
        if (!data) {
          return undefined;
        }
        
        const { client, metadata } = data;
        
        if (metadata.version !== CACHE_VERSION) {
          await del(CACHE_KEY, queryStore).catch(() => {});
          return undefined;
        }
        
        const age = Date.now() - metadata.timestamp;
        if (age > MAX_AGE_MS) {
          await del(CACHE_KEY, queryStore).catch(() => {});
          return undefined;
        }
        
        return client;
      } catch {
        // Silently fail - IndexedDB may be corrupted after cache clear
        return undefined;
      }
    },
    
    removeClient: async () => {
      if (!queryStore) return;
      try {
        await del(CACHE_KEY, queryStore);
      } catch {
        // Silently fail
      }
    },
  };
}

export async function clearQueryCache(): Promise<void> {
  if (queryStore) {
    await del(CACHE_KEY, queryStore);
  }
}

export async function getQueryCacheStats(): Promise<{
  exists: boolean;
  age?: number;
  version?: number;
  deviceId?: string;
}> {
  if (!queryStore) {
    return { exists: false };
  }
  try {
    const data = await get<{ client: PersistedClient; metadata: CacheMetadata }>(
      CACHE_KEY,
      queryStore
    );
    
    if (!data) {
      return { exists: false };
    }
    
    return {
      exists: true,
      age: Date.now() - data.metadata.timestamp,
      version: data.metadata.version,
      deviceId: data.metadata.deviceId,
    };
  } catch {
    return { exists: false };
  }
}

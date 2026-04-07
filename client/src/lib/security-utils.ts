/**
 * Client-side Security Utilities - Fortune 500 Grade
 * 
 * Provides safe wrappers for common operations that can fail:
 * - localStorage access (private browsing, quota exceeded)
 * - JSON parsing (malformed data)
 * - sessionStorage access
 */

/**
 * Safely parses JSON with a fallback value
 * Prevents crashes from malformed JSON in WebSocket messages, API responses, etc.
 * 
 * @param json - The JSON string to parse
 * @param fallback - The value to return if parsing fails
 * @returns The parsed object or the fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    if (import.meta.env.DEV) {
      console.debug('[Security] JSON parse failed for:', json.substring(0, 100));
    }
    return fallback;
  }
}

/**
 * Checks if localStorage is available
 * Returns false in private browsing mode or when storage is disabled
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if sessionStorage is available
 */
function isSessionStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    sessionStorage.setItem(testKey, testKey);
    sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// Cache availability checks (they won't change during page lifecycle)
let localStorageAvailable: boolean | null = null;
let sessionStorageAvailable: boolean | null = null;

/**
 * Safe localStorage wrapper
 * Handles private browsing mode, quota exceeded, and other storage errors gracefully
 */
export const safeLocalStorage = {
  get isAvailable(): boolean {
    if (localStorageAvailable === null) {
      localStorageAvailable = isLocalStorageAvailable();
    }
    return localStorageAvailable;
  },
  
  getItem(key: string): string | null {
    if (!this.isAvailable) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  
  setItem(key: string, value: string): boolean {
    if (!this.isAvailable) return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      // Quota exceeded or other error
      if (import.meta.env.DEV) {
        console.warn('[Security] localStorage.setItem failed:', e);
      }
      return false;
    }
  },
  
  removeItem(key: string): boolean {
    if (!this.isAvailable) return false;
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  
  clear(): boolean {
    if (!this.isAvailable) return false;
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
  
  /**
   * Gets an item and parses it as JSON
   * Returns fallback if item doesn't exist or parsing fails
   */
  getJson<T>(key: string, fallback: T): T {
    const value = this.getItem(key);
    if (value === null) return fallback;
    return safeJsonParse(value, fallback);
  },
  
  /**
   * Stores an object as JSON
   */
  setJson(key: string, value: unknown): boolean {
    try {
      return this.setItem(key, JSON.stringify(value));
    } catch {
      return false;
    }
  }
};

/**
 * Safe sessionStorage wrapper
 */
export const safeSessionStorage = {
  get isAvailable(): boolean {
    if (sessionStorageAvailable === null) {
      sessionStorageAvailable = isSessionStorageAvailable();
    }
    return sessionStorageAvailable;
  },
  
  getItem(key: string): string | null {
    if (!this.isAvailable) return null;
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  
  setItem(key: string, value: string): boolean {
    if (!this.isAvailable) return false;
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  
  removeItem(key: string): boolean {
    if (!this.isAvailable) return false;
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  
  clear(): boolean {
    if (!this.isAvailable) return false;
    try {
      sessionStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
  
  getJson<T>(key: string, fallback: T): T {
    const value = this.getItem(key);
    if (value === null) return fallback;
    return safeJsonParse(value, fallback);
  },
  
  setJson(key: string, value: unknown): boolean {
    try {
      return this.setItem(key, JSON.stringify(value));
    } catch {
      return false;
    }
  }
};

/**
 * Conditional logger that only logs in development
 * Prevents sensitive debug info from appearing in production
 */
export const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log('[DEBUG]', ...args);
  },
  info: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.info('[INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
  }
};

/**
 * Sanitizes user input for display (prevents XSS in innerHTML contexts)
 */
export function sanitizeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Validates that a URL is safe to navigate to
 * Prevents javascript: and data: protocol attacks
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    // Only allow http, https, and relative URLs
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // Invalid URL - could be a relative path which is fine
    return !url.startsWith('javascript:') && !url.startsWith('data:');
  }
}

/**
 * Creates a safe href that won't execute JavaScript
 */
export function safeHref(url: string): string {
  return isSafeUrl(url) ? url : '#';
}

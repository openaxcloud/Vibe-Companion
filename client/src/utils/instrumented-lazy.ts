/**
 * Instrumented Lazy Loader
 * Wraps React.lazy to log module paths and catch empty errors
 * Includes retry mechanism for transient Vite HMR failures
 * With full page reload fallback for mobile devices with WebSocket issues
 */

import { lazy, ComponentType } from 'react';

const MAX_RETRIES = 3;
// Fortune 500 optimization: Fast initial retry, exponential backoff only on repeated failures
const RETRY_DELAY = 200; // Fast first retry (was 1000ms)
const RELOAD_KEY = 'lazy-load-reload-attempted';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Detect if we're on a mobile device or in the Replit app
function isMobileOrReplitApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|android|mobile/i.test(ua) || /replit/i.test(ua);
}

export function instrumentedLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  modulePath?: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const path = modulePath || 'Unknown module';
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const module = await factory();
        if (attempt > 1) {
          console.log(`[LAZY] Successfully loaded module on attempt ${attempt}: ${path}`);
        }
        // Clear reload flag on success
        sessionStorage.removeItem(RELOAD_KEY);
        return module;
      } catch (error) {
        lastError = error;
        
        // Log the attempt failure
        if (attempt < MAX_RETRIES) {
          console.warn(`[LAZY] Attempt ${attempt}/${MAX_RETRIES} failed for module: ${path}`, {
            errorMessage: error instanceof Error ? error.message : String(error),
            isEmptyObject: typeof error === 'object' && Object.keys(error || {}).length === 0
          });
          // Exponential backoff: 200ms, 400ms, 600ms (faster than old 1s, 2s, 3s)
          await sleep(RETRY_DELAY * attempt);
        }
      }
    }
    
    // All retries exhausted - check if we should try a full page reload
    // This helps with mobile devices where Vite HMR WebSocket fails
    const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
    
    if (!alreadyReloaded && isMobileOrReplitApp()) {
      console.log(`[LAZY] Attempting full page reload to recover from module load failure: ${path}`);
      sessionStorage.setItem(RELOAD_KEY, 'true');
      window.location.reload();
      // Return a never-resolving promise to prevent error boundary from showing
      return new Promise(() => {});
    }
    
    // Clear reload flag so user can retry later
    sessionStorage.removeItem(RELOAD_KEY);
    
    // All retries exhausted - log and throw
    console.error(`[LAZY] Failed to load module after ${MAX_RETRIES} attempts: ${path}`, {
      error: lastError,
      errorType: typeof lastError,
      errorConstructor: (lastError as any)?.constructor?.name,
      errorMessage: lastError instanceof Error ? lastError.message : String(lastError),
      isEmptyObject: typeof lastError === 'object' && Object.keys(lastError || {}).length === 0
    });
    
    // Convert empty objects to proper Error instances
    if (typeof lastError === 'object' && lastError !== null && Object.keys(lastError).length === 0) {
      throw new Error(`Empty error thrown while loading module: ${path}`);
    }
    
    // Re-throw as proper Error if it's not already
    if (!(lastError instanceof Error)) {
      throw new Error(`Module load failed (${path}): ${String(lastError)}`);
    }
    
    throw lastError;
  });
}

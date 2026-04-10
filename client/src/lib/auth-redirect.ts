/**
 * Centralized 401 Authentication Redirect Handler
 * 
 * Provides silent redirect to login page when unauthenticated requests occur,
 * preventing console errors and improving UX.
 */

let redirectPending = false;
let lastRedirectTime = 0;
const REDIRECT_DEBOUNCE_MS = 1000;

const AUTH_PAGES = ['/login', '/register', '/auth', '/forgot-password', '/reset-password', '/verify-email'];

/**
 * Check if current path is an authentication page
 */
function isAuthPage(path: string): boolean {
  return AUTH_PAGES.some(authPath => path.startsWith(authPath));
}

/**
 * Check if current URL has a bootstrap token (for anonymous workspace access)
 */
function hasBootstrapToken(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('bootstrap') && params.get('bootstrap')!.length > 0;
}

/**
 * Handle 401 Unauthorized responses by redirecting to login
 * 
 * Features:
 * - Debounced to prevent multiple redirects
 * - Preserves current URL as "next" parameter for post-login redirect
 * - Skips redirect if already on auth pages
 * - Skips redirect if URL has bootstrap token (anonymous workspace sessions)
 * - Silent operation - no console errors
 * 
 * @param originUrl - The URL that triggered the 401 (for debugging)
 * @returns true if redirect was triggered, false if skipped
 */
export function handleUnauthorized(originUrl?: string): boolean {
  const now = Date.now();
  const currentPath = window.location.pathname + window.location.search;
  
  // Skip if already on an auth page
  if (isAuthPage(currentPath)) {
    return false;
  }
  
  // ✅ FIX (Nov 30, 2025): Skip redirect for bootstrap token sessions
  // Bootstrap tokens allow anonymous users to access workspaces without authentication
  // The server validates the token separately - client-side redirect would break this flow
  if (hasBootstrapToken()) {
    console.debug('[Auth] Skipping 401 redirect - bootstrap token present in URL');
    return false;
  }
  
  // Skip if redirect already pending or too recent
  if (redirectPending || (now - lastRedirectTime) < REDIRECT_DEBOUNCE_MS) {
    return false;
  }
  
  const nonCriticalEndpoints = [
    '/api/workspace/stats',
    '/api/notifications',
    '/api/activity',
    '/api/autonomy',
  ];
  if (originUrl && nonCriticalEndpoints.some(ep => originUrl.includes(ep))) {
    return false;
  }
  
  redirectPending = true;
  lastRedirectTime = now;
  
  // Store the intended destination for post-login redirect
  const nextUrl = currentPath !== '/' ? currentPath : '';
  sessionStorage.setItem('auth_redirect_next', nextUrl);
  
  // Build login URL with next parameter
  const loginUrl = nextUrl 
    ? `/login?next=${encodeURIComponent(nextUrl)}`
    : '/login';
  
  // Use setTimeout to allow current execution to complete
  setTimeout(() => {
    window.location.assign(loginUrl);
  }, 0);
  
  return true;
}

/**
 * Validate that a redirect URL is safe (same-origin relative path)
 */
function isValidRedirectUrl(url: string | null): boolean {
  if (!url) return false;
  // Must start with / and not contain protocol or host
  if (!url.startsWith('/')) return false;
  // Prevent protocol-relative URLs like //evil.com
  if (url.startsWith('//')) return false;
  // Prevent javascript: or data: URLs
  if (url.includes(':')) return false;
  return true;
}

/**
 * Get the stored post-login redirect URL
 * Call this after successful login to redirect user back
 * Returns validated same-origin path or null
 */
export function getPostLoginRedirect(): string | null {
  let next = sessionStorage.getItem('auth_redirect_next');
  if (next) {
    sessionStorage.removeItem('auth_redirect_next');
    if (isValidRedirectUrl(next)) {
      return next;
    }
  }
  
  // Also check URL parameter
  const params = new URLSearchParams(window.location.search);
  next = params.get('next');
  
  if (isValidRedirectUrl(next)) {
    return next;
  }
  
  return null;
}

/**
 * Clear any pending redirect state
 * Call this on successful authentication
 */
export function clearRedirectState(): void {
  redirectPending = false;
  sessionStorage.removeItem('auth_redirect_next');
}

/**
 * Create an error with status code attached
 * Useful for downstream error handlers
 */
export function createAuthError(status: number, message: string): Error {
  const error = new Error(message);
  (error as any).status = status;
  return error;
}

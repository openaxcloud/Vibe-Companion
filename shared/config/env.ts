/**
 * Replit Environment Configuration
 * Auto-detects Replit environment and sets correct URLs
 */

// Detect if running on Replit
export const isReplit = process.env.REPLIT === 'true' || !!process.env.REPL_SLUG;

// Get Replit URL
export function getReplitUrl(): string {
  if (!isReplit) {
    return 'http://localhost:3000';
  }

  const replSlug = process.env.REPL_SLUG || 'e-code';
  const replOwner = process.env.REPL_OWNER || process.env.USER || 'username';

  return `https://${replSlug}.${replOwner}.repl.co`;
}

// Get API base URL
export function getApiUrl(): string {
  // Priority: env var > Replit auto-detect > localhost
  if (process.env.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL;
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  return getReplitUrl();
}

// Get WebSocket URL
export function getWsUrl(): string {
  // Priority: env var > Replit auto-detect > localhost
  if (process.env.VITE_WS_URL) {
    return process.env.VITE_WS_URL;
  }

  if (process.env.EXPO_PUBLIC_WS_URL) {
    return process.env.EXPO_PUBLIC_WS_URL;
  }

  const apiUrl = getReplitUrl();
  return apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
}

// Environment configuration
export const env = {
  isReplit,
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  apiUrl: getApiUrl(),
  wsUrl: getWsUrl(),
  replitUrl: getReplitUrl(),
};

console.log('[Env] Configuration:', env);

/**
 * Shared API Configuration for E-Code Platform
 * 
 * This configuration is used by both the CLI and JavaScript SDK to ensure
 * consistent API and WebSocket endpoint URLs across all tooling.
 * 
 * Environment: development | staging | production
 * - Development: localhost endpoints for local testing
 * - Staging: staging.e-code.ai for pre-production testing
 * - Production: e-code.ai (authoritative production domain)
 */

export type Environment = 'development' | 'staging' | 'production';

export interface APIEndpoints {
  api: string;
  web: string;
  ws: string;
}

/**
 * Get the current environment from environment variables
 */
export function getEnvironment(): Environment {
  const env = process.env.ECODE_ENV || process.env.NODE_ENV || 'production';
  
  if (env === 'development' || env === 'dev') {
    return 'development';
  }
  if (env === 'staging' || env === 'stage') {
    return 'staging';
  }
  return 'production';
}

/**
 * Environment-specific endpoint configurations
 */
const ENDPOINTS: Record<Environment, APIEndpoints> = {
  development: {
    api: 'http://localhost:5000/api',
    web: 'http://localhost:5000',
    ws: 'ws://localhost:5000'
  },
  staging: {
    api: 'https://staging.e-code.ai/api',
    web: 'https://staging.e-code.ai',
    ws: 'wss://staging.e-code.ai'
  },
  production: {
    api: 'https://e-code.ai/api',
    web: 'https://e-code.ai',
    ws: 'wss://e-code.ai'
  }
};

/**
 * Get endpoints for the current environment
 * Can be overridden with environment variables:
 * - ECODE_API_URL: Override API endpoint
 * - ECODE_WEB_URL: Override web endpoint
 * - ECODE_WS_URL: Override WebSocket endpoint
 */
export function getEndpoints(env?: Environment): APIEndpoints {
  const currentEnv = env || getEnvironment();
  const defaults = ENDPOINTS[currentEnv];
  
  return {
    api: process.env.ECODE_API_URL || defaults.api,
    web: process.env.ECODE_WEB_URL || defaults.web,
    ws: process.env.ECODE_WS_URL || defaults.ws
  };
}

/**
 * Get API base URL (without /api suffix)
 * This is used by the SDK which appends /api automatically
 */
export function getAPIBaseURL(env?: Environment): string {
  const endpoints = getEndpoints(env);
  // Remove /api suffix if present
  return endpoints.api.replace(/\/api$/, '');
}

/**
 * Get full API URL (with /api suffix)
 * This is used by the CLI which expects the full URL
 */
export function getAPIURL(env?: Environment): string {
  return getEndpoints(env).api;
}

/**
 * Get WebSocket URL
 */
export function getWebSocketURL(env?: Environment): string {
  return getEndpoints(env).ws;
}

/**
 * Get Web URL
 */
export function getWebURL(env?: Environment): string {
  return getEndpoints(env).web;
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Check if running in staging environment
 */
export function isStaging(): boolean {
  return getEnvironment() === 'staging';
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Validate that endpoints are properly configured
 * Throws error if production endpoints are missing or invalid
 */
export function validateEndpoints(env?: Environment): void {
  const currentEnv = env || getEnvironment();
  const endpoints = getEndpoints(currentEnv);
  
  // Validate API URL
  if (!endpoints.api) {
    throw new Error(`[CONFIG ERROR] API URL is not configured for ${currentEnv} environment`);
  }
  
  // Validate that production doesn't use localhost
  if (currentEnv === 'production') {
    const localhostPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '10.0.2.2'];
    
    for (const pattern of localhostPatterns) {
      if (endpoints.api.toLowerCase().includes(pattern)) {
        throw new Error(
          `[CONFIG ERROR] Production environment cannot use localhost URL. ` +
          `Found: ${endpoints.api}. ` +
          `Please set ECODE_API_URL to a valid production URL.`
        );
      }
      
      if (endpoints.ws.toLowerCase().includes(pattern)) {
        throw new Error(
          `[CONFIG ERROR] Production environment cannot use localhost WebSocket URL. ` +
          `Found: ${endpoints.ws}. ` +
          `Please set ECODE_WS_URL to a valid production URL.`
        );
      }
    }
  }
}

/**
 * Get a health check URL for testing connectivity
 */
export function getHealthCheckURL(env?: Environment): string {
  const apiUrl = getAPIURL(env);
  return `${apiUrl}/health`;
}

/**
 * Default export for convenience
 */
export default {
  getEnvironment,
  getEndpoints,
  getAPIBaseURL,
  getAPIURL,
  getWebSocketURL,
  getWebURL,
  isDevelopment,
  isStaging,
  isProduction,
  validateEndpoints,
  getHealthCheckURL,
  // Constants for backward compatibility
  ENVIRONMENTS: ['development', 'staging', 'production'] as const
};

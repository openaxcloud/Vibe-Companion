/**
 * API Versioning Middleware
 * Fortune 500 Production-Grade - Backward Compatibility Strategy
 * 
 * Supports:
 * - URL-based versioning: /api/v1/users, /api/v2/users
 * - Header-based version negotiation: Accept-Version: v1
 * - Automatic fallback to latest stable version
 */

import { Request, Response, NextFunction } from 'express';

export type ApiVersion = 'v1' | 'v2' | 'v3';

export const CURRENT_API_VERSION: ApiVersion = 'v1';
export const SUPPORTED_VERSIONS: ApiVersion[] = ['v1'];
export const DEFAULT_VERSION: ApiVersion = 'v1';

/**
 * Extract API version from request
 * Priority: URL path > Accept-Version header > Default
 */
export function getApiVersion(req: Request): ApiVersion {
  // ✅ FORTUNE 500 FIX: Use originalUrl which includes full path with /api prefix
  // req.path is stripped by Express when mounted at /api, causing regex to fail
  const fullPath = req.originalUrl || req.path;
  
  // 1. Check URL path: /api/v1/users or /api/v2/users
  const pathMatch = fullPath.match(/^\/api\/(v\d+)\//);
  if (pathMatch) {
    const version = pathMatch[1] as ApiVersion;
    if (SUPPORTED_VERSIONS.includes(version)) {
      return version;
    }
  }
  
  // 2. Check Accept-Version header
  const headerVersion = req.headers['accept-version'] as string;
  if (headerVersion && SUPPORTED_VERSIONS.includes(headerVersion as ApiVersion)) {
    return headerVersion as ApiVersion;
  }
  
  // 3. Default to current stable version
  return DEFAULT_VERSION;
}

/**
 * Middleware to parse and attach API version to request
 */
export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction) {
  const version = getApiVersion(req);
  
  // Attach version to request object for use in controllers
  (req as any).apiVersion = version;
  
  // Add version header to response
  res.setHeader('X-API-Version', version);
  
  next();
}

/**
 * Middleware to reject unsupported API versions
 */
/**
 * Middleware to reject unsupported API versions
 * ✅ FORTUNE 500 FIX: Complete edge case validation
 */
export function rejectUnsupportedVersions(req: Request, res: Response, next: NextFunction) {
  // ✅ FORTUNE 500 FIX: Use originalUrl which includes full path with /api prefix
  const fullPath = (req.originalUrl || req.path).split('?')[0]; // Remove query string
  
  // ✅ FIX: Handle /api root requests (no version specified)
  // These are allowed and default to current version
  if (fullPath === '/api' || fullPath === '/api/') {
    return next();
  }
  
  // ✅ FIX: Extract version from URL path
  const pathMatch = fullPath.match(/^\/api\/(v\d+)(\/|$)/);
  if (pathMatch) {
    const requestedVersion = pathMatch[1] as ApiVersion;
    
    // ✅ FIX: Reject unsupported versions (including /api/v9, /api/v2, etc.)
    if (!SUPPORTED_VERSIONS.includes(requestedVersion)) {
      return res.status(400).json({
        error: 'Unsupported API version',
        requestedVersion,
        supportedVersions: SUPPORTED_VERSIONS,
        currentVersion: CURRENT_API_VERSION,
        message: `API version ${requestedVersion} is not supported. Please use one of: ${SUPPORTED_VERSIONS.join(', ')}`
      });
    }
  }
  
  // ✅ FIX: For non-versioned routes, check Accept-Version header
  if (!pathMatch) {
    const headerVersion = req.headers['accept-version'] as string;
    if (headerVersion && !SUPPORTED_VERSIONS.includes(headerVersion as ApiVersion)) {
      return res.status(400).json({
        error: 'Unsupported API version in Accept-Version header',
        requestedVersion: headerVersion,
        supportedVersions: SUPPORTED_VERSIONS,
        currentVersion: CURRENT_API_VERSION,
        message: `API version ${headerVersion} is not supported. Please use one of: ${SUPPORTED_VERSIONS.join(', ')}`
      });
    }
  }
  
  next();
}

/**
 * Create version-specific router wrapper
 * Usage:
 *   const v1Router = createVersionedRouter('v1');
 *   v1Router.get('/users', getUsersV1);
 * 
 *   const v2Router = createVersionedRouter('v2');
 *   v2Router.get('/users', getUsersV2);
 */
import { Router } from 'express';

export function createVersionedRouter(version: ApiVersion): Router {
  const router = Router();
  
  // Attach version to all routes in this router
  router.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).routerVersion = version;
    next();
  });
  
  return router;
}

/**
 * Helper to check if request is for specific version
 */
export function isVersion(req: Request, version: ApiVersion): boolean {
  return getApiVersion(req) === version;
}

/**
 * Deprecation warning middleware
 * Use for routes being phased out
 */
export function deprecationWarning(version: ApiVersion, sunsetDate: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate);
    res.setHeader('X-API-Warn', `API version ${version} is deprecated and will be removed on ${sunsetDate}`);
    next();
  };
}

/**
 * Fortune 500 Migration Strategy Documentation
 * 
 * PHASE 1: Infrastructure (COMPLETED)
 * - API versioning middleware
 * - Version detection and negotiation
 * - Error handling for unsupported versions
 * 
 * PHASE 2: Route Migration (FUTURE)
 * 1. Create /api/v1/* routes mirroring existing /api/* routes
 * 2. Update clients to use versioned endpoints
 * 3. Add deprecation warnings to old routes
 * 4. Set sunset dates
 * 5. Monitor usage metrics
 * 6. Remove deprecated routes after grace period
 * 
 * PHASE 3: Breaking Changes (FUTURE)
 * 1. Introduce v2 with breaking changes
 * 2. Run v1 and v2 in parallel
 * 3. Migrate clients gradually
 * 4. Sunset v1 after migration complete
 * 
 * CURRENT STATUS: Phase 1 Complete
 * - Infrastructure ready for versioned routes
 * - Existing /api/* routes continue to work
 * - New routes can be versioned as /api/v1/*
 * - No breaking changes to existing clients
 */

import { Request, Response, NextFunction } from 'express';
import { persistenceEngine, createTenantContext, TenantContext } from '../services/persistence-engine';

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
      tenantId?: number | null;
    }
  }
}

export async function tenantContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req.user as any)?.id;
    
    if (!userId) {
      req.tenantContext = undefined;
      req.tenantId = null;
      return next();
    }

    let tenantId: number | null = null;

    const headerTenantId = req.headers['x-tenant-id'];
    if (headerTenantId && typeof headerTenantId === 'string') {
      const parsed = parseInt(headerTenantId, 10);
      if (!isNaN(parsed)) {
        tenantId = parsed;
      }
    }

    if (!tenantId) {
      const queryTenantId = req.query.tenantId;
      if (queryTenantId && typeof queryTenantId === 'string') {
        const parsed = parseInt(queryTenantId, 10);
        if (!isNaN(parsed)) {
          tenantId = parsed;
        }
      }
    }

    if (tenantId !== null) {
      const accessCheck = await persistenceEngine.verifyTenantAccess(tenantId, userId);
      
      if (!accessCheck.hasAccess) {
        res.status(403).json({
          error: 'Tenant access denied',
          code: 'TENANT_ACCESS_DENIED'
        });
        return;
      }
    }

    const sessionId = req.sessionID || undefined;
    req.tenantContext = createTenantContext(userId, tenantId, sessionId);
    req.tenantId = tenantId;

    next();
  } catch (error) {
    console.error('[TenantContext] Middleware error:', error);
    next(error);
  }
}

export function requireTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenantContext) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  if (req.tenantContext.tenantId === null) {
    res.status(400).json({
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED'
    });
    return;
  }

  next();
}

export function optionalTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  next();
}

export function getTenantContext(req: Request): TenantContext | undefined {
  return req.tenantContext;
}

export function getTenantId(req: Request): number | null {
  return req.tenantId ?? null;
}

export function getUserIdFromRequest(req: Request): number | undefined {
  return req.tenantContext?.userId;
}

/**
 * Request Context Manager using AsyncLocalStorage
 * Fortune 500 Standard: Request tracing across async operations
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  userId?: number;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  path?: string;
  method?: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function createRequestContext(partial: Partial<RequestContext> = {}): RequestContext {
  const requestId = randomUUID();
  return {
    requestId,
    correlationId: partial.correlationId || requestId,
    userId: partial.userId,
    sessionId: partial.sessionId,
    userAgent: partial.userAgent,
    ip: partial.ip,
    path: partial.path,
    method: partial.method,
    startTime: Date.now(),
  };
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}

export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

export function enrichContext(updates: Partial<RequestContext>): void {
  const current = asyncLocalStorage.getStore();
  if (current) {
    Object.assign(current, updates);
  }
}

export { asyncLocalStorage };

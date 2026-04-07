import type { Request } from "express";

const userLimits = new Map<string, { count: number; resetAt: number }>();
const ipLimits = new Map<string, { count: number; resetAt: number }>();
const executionSlots = new Map<string, boolean>();

function pruneExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of userLimits) {
    if (now > entry.resetAt) userLimits.delete(key);
  }
  for (const [key, entry] of ipLimits) {
    if (now > entry.resetAt) ipLimits.delete(key);
  }
}

const PRUNE_INTERVAL = setInterval(pruneExpiredEntries, 60_000);
PRUNE_INTERVAL.unref();

export function checkUserRateLimit(userId: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = userLimits.get(userId);
  if (!entry || now > entry.resetAt) {
    userLimits.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export function checkIpRateLimit(ip: string, limit: number = 200, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = ipLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export function acquireExecutionSlot(projectId: string): boolean {
  if (executionSlots.get(projectId)) return false;
  executionSlots.set(projectId, true);
  return true;
}

export function releaseExecutionSlot(projectId: string): void {
  executionSlots.delete(projectId);
}

export function recordExecution(projectId: string, duration: number): void {}

export function getExecutionMetrics(projectId: string): { totalExecutions: number; avgDuration: number } {
  return { totalExecutions: 0, avgDuration: 0 };
}

export function getSystemMetrics(): { activeSlots: number; totalRequests: number } {
  return { activeSlots: executionSlots.size, totalRequests: 0 };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

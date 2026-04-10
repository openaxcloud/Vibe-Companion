import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60_000;

interface TimestampedCount {
  timestamp: number;
  count: number;
}

const routeCounts: Map<string, number> = new Map();
let totalApiRequests = 0;
const recentWindows: TimestampedCount[] = [];
let currentWindowStart = Date.now();
let currentWindowCount = 0;

function rotateWindow() {
  const now = Date.now();
  if (now - currentWindowStart >= WINDOW_MS) {
    recentWindows.push({ timestamp: currentWindowStart, count: currentWindowCount });
    currentWindowStart = now;
    currentWindowCount = 0;
    while (recentWindows.length > 5) recentWindows.shift();
  }
}

export function requestCounterMiddleware(req: Request, _res: Response, next: NextFunction) {
  if ((req as any)._skipHeavyMiddleware) return next();
  if (!req.path.startsWith('/api/')) return next();
  totalApiRequests++;
  currentWindowCount++;
  rotateWindow();
  const segments = req.path.split('/');
  const group = segments.length >= 3 ? `/api/${segments[2]}` : '/api';
  routeCounts.set(group, (routeCounts.get(group) || 0) + 1);
  next();
}

export function getTotalRequestCount(): number {
  return totalApiRequests;
}

export function getRequestCountLastMinute(): number {
  rotateWindow();
  const cutoff = Date.now() - WINDOW_MS;
  let sum = currentWindowCount;
  for (const w of recentWindows) {
    if (w.timestamp + WINDOW_MS > cutoff) sum += w.count;
  }
  return sum;
}

export function getRequestCountsByRoute(): Record<string, number> {
  return Object.fromEntries(routeCounts);
}

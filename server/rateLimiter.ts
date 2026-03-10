interface ExecutionMetrics {
  count: number;
  failures: number;
  totalDuration: number;
  windowStart: number;
}

interface QueueEntry {
  resolve: () => void;
  reject: (err: Error) => void;
  timestamp: number;
}

const WINDOW_MS = 60 * 1000;
const MAX_EXECUTIONS_PER_MINUTE = 10;
const MAX_CONCURRENT_PER_USER = 3;
const QUEUE_TIMEOUT_MS = 30 * 1000;
const IP_WINDOW_MS = 60 * 1000;
const MAX_EXECUTIONS_PER_IP = 20;

const userMetrics = new Map<string, ExecutionMetrics>();
const userConcurrent = new Map<string, number>();
const userQueues = new Map<string, QueueEntry[]>();
const ipExecutionCounts = new Map<string, { count: number; windowStart: number }>();

function cleanupWindow<T extends { windowStart: number }>(map: Map<string, T>, windowMs: number) {
  const now = Date.now();
  const keys = Array.from(map.keys());
  for (const key of keys) {
    const val = map.get(key)!;
    if (now - val.windowStart > windowMs * 2) {
      map.delete(key);
    }
  }
}

setInterval(() => {
  cleanupWindow(userMetrics, WINDOW_MS);
  cleanupWindow(ipExecutionCounts, IP_WINDOW_MS);
}, 5 * 60 * 1000);

function getUserMetrics(userId: string): ExecutionMetrics {
  const now = Date.now();
  let metrics = userMetrics.get(userId);
  if (!metrics || now - metrics.windowStart > WINDOW_MS) {
    metrics = { count: 0, failures: 0, totalDuration: 0, windowStart: now };
    userMetrics.set(userId, metrics);
  }
  return metrics;
}

function getIpCount(ip: string): { count: number; windowStart: number } {
  const now = Date.now();
  let entry = ipExecutionCounts.get(ip);
  if (!entry || now - entry.windowStart > IP_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    ipExecutionCounts.set(ip, entry);
  }
  return entry;
}

export function checkUserRateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
  const metrics = getUserMetrics(userId);
  if (metrics.count >= MAX_EXECUTIONS_PER_MINUTE) {
    const retryAfterMs = WINDOW_MS - (Date.now() - metrics.windowStart);
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }
  return { allowed: true };
}

export function checkIpRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const entry = getIpCount(ip);
  if (entry.count >= MAX_EXECUTIONS_PER_IP) {
    const retryAfterMs = IP_WINDOW_MS - (Date.now() - entry.windowStart);
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }
  return { allowed: true };
}

export async function acquireExecutionSlot(userId: string): Promise<void> {
  const current = userConcurrent.get(userId) || 0;
  if (current < MAX_CONCURRENT_PER_USER) {
    userConcurrent.set(userId, current + 1);
    return;
  }

  return new Promise<void>((resolve, reject) => {
    const entry: QueueEntry = { resolve, reject, timestamp: Date.now() };
    const queue = userQueues.get(userId) || [];
    queue.push(entry);
    userQueues.set(userId, queue);

    setTimeout(() => {
      const q = userQueues.get(userId);
      if (q) {
        const idx = q.indexOf(entry);
        if (idx !== -1) {
          q.splice(idx, 1);
          reject(new Error("Execution queue timeout - too many concurrent executions"));
        }
      }
    }, QUEUE_TIMEOUT_MS);
  });
}

export function releaseExecutionSlot(userId: string): void {
  const current = userConcurrent.get(userId) || 0;
  const queue = userQueues.get(userId);

  if (queue && queue.length > 0) {
    const next = queue.shift()!;
    next.resolve();
  } else {
    userConcurrent.set(userId, Math.max(0, current - 1));
  }
}

export function recordExecution(userId: string, ip: string, durationMs: number, failed: boolean): void {
  const metrics = getUserMetrics(userId);
  metrics.count++;
  metrics.totalDuration += durationMs;
  if (failed) {
    metrics.failures++;
  }

  const ipEntry = getIpCount(ip);
  ipEntry.count++;
}

export function getExecutionMetrics(userId: string): {
  executionsInWindow: number;
  failuresInWindow: number;
  avgDurationMs: number;
  concurrentExecutions: number;
  queuedExecutions: number;
} {
  const metrics = getUserMetrics(userId);
  const concurrent = userConcurrent.get(userId) || 0;
  const queued = (userQueues.get(userId) || []).length;
  return {
    executionsInWindow: metrics.count,
    failuresInWindow: metrics.failures,
    avgDurationMs: metrics.count > 0 ? Math.round(metrics.totalDuration / metrics.count) : 0,
    concurrentExecutions: concurrent,
    queuedExecutions: queued,
  };
}

export function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

import * as os from "os";
import { log } from "./index";

let requestCount = 0;
let errorCount = 0;
let totalResponseTimeMs = 0;
let responseTimeCount = 0;
let prevCpuUsage = process.cpuUsage();
let prevCpuTime = Date.now();

const uptimeTracker = new Map<string, { checks: number; successes: number; startedAt: number }>();

const projectRequestCounts = new Map<string, number>();
const projectErrorCounts = new Map<string, number>();
const projectResponseTimes = new Map<string, { total: number; count: number }>();

export function incrementRequests(projectId?: string) {
  requestCount++;
  if (projectId) {
    projectRequestCounts.set(projectId, (projectRequestCounts.get(projectId) || 0) + 1);
  }
}

export function incrementErrors(projectId?: string) {
  errorCount++;
  if (projectId) {
    projectErrorCounts.set(projectId, (projectErrorCounts.get(projectId) || 0) + 1);
  }
}

export function recordResponseTime(ms: number, projectId?: string) {
  totalResponseTimeMs += ms;
  responseTimeCount++;
  if (projectId) {
    const existing = projectResponseTimes.get(projectId) || { total: 0, count: 0 };
    existing.total += ms;
    existing.count++;
    projectResponseTimes.set(projectId, existing);
  }
}

export function getAndResetCounters(projectId?: string) {
  if (projectId) {
    const reqs = projectRequestCounts.get(projectId) || 0;
    const errs = projectErrorCounts.get(projectId) || 0;
    const rt = projectResponseTimes.get(projectId) || { total: 0, count: 0 };
    const avgMs = rt.count > 0 ? Math.round(rt.total / rt.count) : 0;
    projectRequestCounts.delete(projectId);
    projectErrorCounts.delete(projectId);
    projectResponseTimes.delete(projectId);
    return { requests: reqs, errors: errs, avgResponseMs: avgMs };
  }
  const reqs = requestCount;
  const errs = errorCount;
  const avgMs = responseTimeCount > 0 ? Math.round(totalResponseTimeMs / responseTimeCount) : 0;
  requestCount = 0;
  errorCount = 0;
  totalResponseTimeMs = 0;
  responseTimeCount = 0;
  return { requests: reqs, errors: errs, avgResponseMs: avgMs };
}

export function getCpuPercent(): number {
  const now = Date.now();
  const elapsed = now - prevCpuTime;
  if (elapsed < 1) return 0;
  const currentUsage = process.cpuUsage(prevCpuUsage);
  const totalCpuMicros = currentUsage.user + currentUsage.system;
  const cpuCount = os.cpus().length || 1;
  const percent = (totalCpuMicros / 1000 / elapsed / cpuCount) * 100;
  prevCpuUsage = process.cpuUsage();
  prevCpuTime = now;
  return Math.round(Math.min(percent, 100) * 10) / 10;
}

export function getMemoryMb(): number {
  const mem = process.memoryUsage();
  return Math.round(mem.rss / 1024 / 1024);
}

export function getHeapMb(): number {
  const mem = process.memoryUsage();
  return Math.round(mem.heapUsed / 1024 / 1024);
}

export function getSystemMemory() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    totalMb: Math.round(totalMem / 1024 / 1024),
    freeMb: Math.round(freeMem / 1024 / 1024),
    usedMb: Math.round((totalMem - freeMem) / 1024 / 1024),
    usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100 * 10) / 10,
  };
}

export function getLoadAverage() {
  const [load1, load5, load15] = os.loadavg();
  return {
    load1: Math.round(load1 * 100) / 100,
    load5: Math.round(load5 * 100) / 100,
    load15: Math.round(load15 * 100) / 100,
  };
}

export function getRealMetrics() {
  return {
    cpuPercent: getCpuPercent(),
    memoryMb: getMemoryMb(),
    heapMb: getHeapMb(),
    uptimeSeconds: Math.round(process.uptime()),
    systemMemory: getSystemMemory(),
    loadAverage: getLoadAverage(),
  };
}

export function recordHealthCheck(projectId: string, healthy: boolean) {
  let tracker = uptimeTracker.get(projectId);
  if (!tracker) {
    tracker = { checks: 0, successes: 0, startedAt: Date.now() };
    uptimeTracker.set(projectId, tracker);
  }
  tracker.checks++;
  if (healthy) tracker.successes++;
}

export function getUptimePercent(projectId: string): number {
  const tracker = uptimeTracker.get(projectId);
  if (!tracker || tracker.checks === 0) return 100;
  return Math.round((tracker.successes / tracker.checks) * 10000) / 100;
}

export function resetUptimeTracker(projectId: string) {
  uptimeTracker.delete(projectId);
}

let autoCollectorInterval: NodeJS.Timeout | null = null;
let resourceSnapshotInterval: NodeJS.Timeout | null = null;

export function startAutoMetricsCollector(
  getActiveProjectIds: () => string[],
  recordMetric: (projectId: string, metricType: string, value: number, metadata?: Record<string, any>) => Promise<any>,
  performHealthCheck: (projectId: string) => Promise<{ healthy: boolean; status: string }>,
  intervalMs = 60000,
) {
  if (autoCollectorInterval) {
    clearInterval(autoCollectorInterval);
  }

  autoCollectorInterval = setInterval(async () => {
    const projectIds = getActiveProjectIds();
    if (projectIds.length === 0) return;

    const realMetrics = getRealMetrics();
    const counters = getAndResetCounters();

    for (const projectId of projectIds) {
      try {
        const healthResult = await performHealthCheck(projectId);
        recordHealthCheck(projectId, healthResult.healthy);
        const uptime = getUptimePercent(projectId);
        const projectCounters = getAndResetCounters(projectId);

        await Promise.all([
          recordMetric(projectId, "cpu_usage", realMetrics.cpuPercent),
          recordMetric(projectId, "memory_usage", realMetrics.memoryMb),
          recordMetric(projectId, "request_count", projectCounters.requests),
          recordMetric(projectId, "response_time", projectCounters.avgResponseMs),
          recordMetric(projectId, "uptime", uptime),
          recordMetric(projectId, "system_memory_percent", realMetrics.systemMemory.usedPercent),
          recordMetric(projectId, "load_avg_1m", realMetrics.loadAverage.load1),
          ...(projectCounters.errors > 0 ? [recordMetric(projectId, "error_count", projectCounters.errors)] : []),
        ]);
      } catch (err: any) {
        log(`[metrics-collector] Failed to record metrics for project ${projectId}: ${err.message}`, "metrics");
      }
    }
  }, intervalMs);

  log(`[metrics-collector] Auto-collection started (interval: ${intervalMs}ms)`, "metrics");
}

export function startResourceSnapshotCollector(
  getActiveProjectIds: () => string[],
  recordSnapshot: (projectId: string, cpuPercent: number, memoryMb: number, heapMb: number) => Promise<any>,
  intervalMs = 30000,
) {
  if (resourceSnapshotInterval) {
    clearInterval(resourceSnapshotInterval);
  }

  resourceSnapshotInterval = setInterval(async () => {
    const projectIds = getActiveProjectIds();
    if (projectIds.length === 0) return;

    const realMetrics = getRealMetrics();
    for (const projectId of projectIds) {
      try {
        await recordSnapshot(
          projectId,
          Math.round(realMetrics.cpuPercent),
          realMetrics.memoryMb,
          realMetrics.heapMb,
        );
      } catch (err: any) {
        log(`[metrics-collector] Failed to record resource snapshot for ${projectId}: ${err.message}`, "metrics");
      }
    }
  }, intervalMs);

  log(`[metrics-collector] Resource snapshot collection started (interval: ${intervalMs}ms)`, "metrics");
}

export function stopAutoMetricsCollector() {
  if (autoCollectorInterval) {
    clearInterval(autoCollectorInterval);
    autoCollectorInterval = null;
    log("[metrics-collector] Auto-collection stopped", "metrics");
  }
  if (resourceSnapshotInterval) {
    clearInterval(resourceSnapshotInterval);
    resourceSnapshotInterval = null;
    log("[metrics-collector] Resource snapshot collection stopped", "metrics");
  }
}

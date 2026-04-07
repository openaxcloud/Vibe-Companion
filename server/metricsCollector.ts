let metricsInterval: NodeJS.Timeout | null = null;
let resourceInterval: NodeJS.Timeout | null = null;

export function startAutoMetricsCollector(
  getProjectIds: () => string[],
  recordMetric: (projectId: string, metricType: string, value: number, metadata?: any) => Promise<any>,
  healthCheck: (projectId: string) => Promise<{ healthy: boolean; status: string }>,
  intervalMs: number = 60000,
) {
  if (metricsInterval) clearInterval(metricsInterval);

  console.log(`[metrics-collector] Auto-collection started (interval: ${intervalMs}ms)`);

  metricsInterval = setInterval(async () => {
    const projectIds = getProjectIds();
    for (const pid of projectIds) {
      try {
        const mem = process.memoryUsage();
        await recordMetric(pid, "memory_usage", Math.round(mem.heapUsed / 1024 / 1024), {
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          rss: Math.round(mem.rss / 1024 / 1024),
        });

        const health = await healthCheck(pid);
        await recordMetric(pid, "health_check", health.healthy ? 1 : 0, { status: health.status });
      } catch (err: any) {
        console.warn(`[metrics-collector] Failed for ${pid}:`, err?.message);
      }
    }
  }, intervalMs);
}

export function startResourceSnapshotCollector(
  getProjectIds: () => string[],
  createSnapshot: (projectId: string, cpuPercent: number, memoryMb: number, heapMb: number) => Promise<any>,
  intervalMs: number = 30000,
) {
  if (resourceInterval) clearInterval(resourceInterval);

  console.log(`[metrics-collector] Resource snapshot collection started (interval: ${intervalMs}ms)`);

  resourceInterval = setInterval(async () => {
    const projectIds = getProjectIds();
    for (const pid of projectIds) {
      try {
        const mem = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000;
        await createSnapshot(
          pid,
          Math.round(cpuPercent * 100) / 100,
          Math.round(mem.rss / 1024 / 1024),
          Math.round(mem.heapUsed / 1024 / 1024),
        );
      } catch (err: any) {
        console.warn(`[metrics-collector] Snapshot failed for ${pid}:`, err?.message);
      }
    }
  }, intervalMs);
}

export function stopAutoMetricsCollector() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  if (resourceInterval) {
    clearInterval(resourceInterval);
    resourceInterval = null;
  }
}

const counters = { requests: 0, errors: 0, totalResponseTime: 0, count: 0 };

export function incrementRequests() { counters.requests++; }
export function incrementErrors() { counters.errors++; }
export function recordResponseTime(ms: number) { counters.totalResponseTime += ms; counters.count++; }
export function getAndResetCounters() {
  const result = { ...counters, avgResponseTime: counters.count > 0 ? counters.totalResponseTime / counters.count : 0 };
  counters.requests = 0; counters.errors = 0; counters.totalResponseTime = 0; counters.count = 0;
  return result;
}
export function getRealMetrics() {
  const mem = process.memoryUsage();
  return {
    memory: { heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, rss: mem.rss },
    uptime: process.uptime(),
    counters: { ...counters },
  };
}

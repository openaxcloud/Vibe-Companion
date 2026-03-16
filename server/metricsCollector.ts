import * as os from "os";

let requestCount = 0;
let errorCount = 0;
let totalResponseTimeMs = 0;
let responseTimeCount = 0;
let prevCpuUsage = process.cpuUsage();
let prevCpuTime = Date.now();

export function incrementRequests() {
  requestCount++;
}

export function incrementErrors() {
  errorCount++;
}

export function recordResponseTime(ms: number) {
  totalResponseTimeMs += ms;
  responseTimeCount++;
}

export function getAndResetCounters() {
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

export function getRealMetrics() {
  return {
    cpuPercent: getCpuPercent(),
    memoryMb: getMemoryMb(),
    heapMb: getHeapMb(),
    uptimeSeconds: Math.round(process.uptime()),
  };
}

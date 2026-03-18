import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Reset rate limiter state between tests by reimporting
let checkUserRateLimit: typeof import("../server/rateLimiter").checkUserRateLimit;
let checkIpRateLimit: typeof import("../server/rateLimiter").checkIpRateLimit;
let acquireExecutionSlot: typeof import("../server/rateLimiter").acquireExecutionSlot;
let releaseExecutionSlot: typeof import("../server/rateLimiter").releaseExecutionSlot;
let recordExecution: typeof import("../server/rateLimiter").recordExecution;
let getExecutionMetrics: typeof import("../server/rateLimiter").getExecutionMetrics;
let getSystemMetrics: typeof import("../server/rateLimiter").getSystemMetrics;
let getClientIp: typeof import("../server/rateLimiter").getClientIp;

describe("rateLimiter", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const mod = await import("../server/rateLimiter");
    checkUserRateLimit = mod.checkUserRateLimit;
    checkIpRateLimit = mod.checkIpRateLimit;
    acquireExecutionSlot = mod.acquireExecutionSlot;
    releaseExecutionSlot = mod.releaseExecutionSlot;
    recordExecution = mod.recordExecution;
    getExecutionMetrics = mod.getExecutionMetrics;
    getSystemMetrics = mod.getSystemMetrics;
    getClientIp = mod.getClientIp;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkUserRateLimit", () => {
    it("allows first request", () => {
      const result = checkUserRateLimit("user-1");
      expect(result.allowed).toBe(true);
    });

    it("blocks after max executions per minute", () => {
      for (let i = 0; i < 10; i++) {
        recordExecution("user-rate", "1.2.3.4", 100, false);
      }
      const result = checkUserRateLimit("user-rate");
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("resets window after timeout", () => {
      for (let i = 0; i < 10; i++) {
        recordExecution("user-reset", "1.2.3.4", 100, false);
      }
      expect(checkUserRateLimit("user-reset").allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(61000);
      expect(checkUserRateLimit("user-reset").allowed).toBe(true);
    });
  });

  describe("checkIpRateLimit", () => {
    it("allows first request from an IP", () => {
      const result = checkIpRateLimit("192.168.1.1");
      expect(result.allowed).toBe(true);
    });

    it("blocks after max executions per IP", () => {
      for (let i = 0; i < 20; i++) {
        recordExecution("user-ip", "10.0.0.1", 100, false);
      }
      const result = checkIpRateLimit("10.0.0.1");
      expect(result.allowed).toBe(false);
    });
  });

  describe("acquireExecutionSlot / releaseExecutionSlot", () => {
    it("acquires a slot for a new user", async () => {
      const result = await acquireExecutionSlot("slot-user");
      expect(result).toBeDefined();
      releaseExecutionSlot("slot-user");
    });

    it("tracks concurrent executions correctly", async () => {
      await acquireExecutionSlot("concurrent-user");
      await acquireExecutionSlot("concurrent-user");
      const metrics = getExecutionMetrics("concurrent-user");
      expect(metrics.concurrentExecutions).toBe(2);

      releaseExecutionSlot("concurrent-user");
      const after = getExecutionMetrics("concurrent-user");
      expect(after.concurrentExecutions).toBe(1);

      releaseExecutionSlot("concurrent-user");
    });

    it("does not go below zero concurrent", () => {
      releaseExecutionSlot("nonexistent-user");
      const metrics = getExecutionMetrics("nonexistent-user");
      expect(metrics.concurrentExecutions).toBe(0);
    });
  });

  describe("recordExecution", () => {
    it("tracks execution count and duration", () => {
      recordExecution("metrics-user", "1.1.1.1", 500, false);
      recordExecution("metrics-user", "1.1.1.1", 300, false);

      const metrics = getExecutionMetrics("metrics-user");
      expect(metrics.executionsInWindow).toBe(2);
      expect(metrics.avgDurationMs).toBe(400);
      expect(metrics.failuresInWindow).toBe(0);
    });

    it("tracks failures", () => {
      recordExecution("fail-user", "1.1.1.1", 100, true);
      recordExecution("fail-user", "1.1.1.1", 100, false);

      const metrics = getExecutionMetrics("fail-user");
      expect(metrics.failuresInWindow).toBe(1);
      expect(metrics.executionsInWindow).toBe(2);
    });
  });

  describe("getSystemMetrics", () => {
    it("returns system-level metrics", () => {
      const metrics = getSystemMetrics();
      expect(metrics).toHaveProperty("globalConcurrent");
      expect(metrics).toHaveProperty("globalQueueLength");
      expect(metrics).toHaveProperty("maxConcurrent");
      expect(metrics).toHaveProperty("maxQueue");
      expect(metrics).toHaveProperty("totalActiveUsers");
      expect(metrics.maxConcurrent).toBe(5);
      expect(metrics.maxQueue).toBe(20);
    });
  });

  describe("getClientIp", () => {
    it("extracts IP from X-Forwarded-For header", () => {
      const ip = getClientIp({
        ip: "127.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
      });
      expect(ip).toBe("203.0.113.50");
    });

    it("falls back to req.ip when no forwarded header", () => {
      const ip = getClientIp({
        ip: "192.168.1.100",
        headers: {},
      });
      expect(ip).toBe("192.168.1.100");
    });

    it("returns 'unknown' when no IP available", () => {
      const ip = getClientIp({ headers: {} });
      expect(ip).toBe("unknown");
    });
  });
});

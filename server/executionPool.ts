import { executeCode, ExecutionResult } from "./executor";
import { log } from "./index";
import { randomUUID } from "crypto";

interface ExecutionJob {
  id: string;
  userId: string;
  projectId: string;
  code: string;
  language: string;
  envVars?: Record<string, string>;
  onLog?: (message: string, type: "info" | "error" | "success") => void;
  resolve: (result: ExecutionResult) => void;
  reject: (error: Error) => void;
  queuedAt: number;
  startedAt?: number;
  abortController?: AbortController;
}

interface PoolMetrics {
  totalExecutions: number;
  activeJobs: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgDurationMs: number;
  rejectedJobs: number;
}

interface UserRateState {
  windowStart: number;
  count: number;
  concurrentCount: number;
}

const MAX_CONCURRENT_EXECUTIONS = 8;
const MAX_QUEUE_SIZE = 50;
const MAX_QUEUE_WAIT_MS = 30000;
const USER_RATE_WINDOW_MS = 60000;
const USER_MAX_PER_WINDOW = 20;
const USER_MAX_CONCURRENT = 3;
const CLEANUP_INTERVAL_MS = 60000;

class ExecutionPool {
  private queue: ExecutionJob[] = [];
  private activeJobs = new Map<string, ExecutionJob>();
  private userRates = new Map<string, UserRateState>();
  private metrics: PoolMetrics = {
    totalExecutions: 0,
    activeJobs: 0,
    queuedJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    avgDurationMs: 0,
    rejectedJobs: 0,
  };
  private durationSamples: number[] = [];
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    log("Execution pool initialized", "pool");
  }

  private checkUserRate(userId: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    let state = this.userRates.get(userId);
    if (!state || now - state.windowStart > USER_RATE_WINDOW_MS) {
      state = { windowStart: now, count: 0, concurrentCount: 0 };
      this.userRates.set(userId, state);
    }

    if (state.count >= USER_MAX_PER_WINDOW) {
      return { allowed: false, reason: `Rate limit: max ${USER_MAX_PER_WINDOW} executions per minute` };
    }
    if (state.concurrentCount >= USER_MAX_CONCURRENT) {
      return { allowed: false, reason: `Concurrent limit: max ${USER_MAX_CONCURRENT} simultaneous executions` };
    }
    return { allowed: true };
  }

  private incrementUserRate(userId: string) {
    const state = this.userRates.get(userId);
    if (state) {
      state.count++;
      state.concurrentCount++;
    }
  }

  private decrementUserConcurrent(userId: string) {
    const state = this.userRates.get(userId);
    if (state && state.concurrentCount > 0) {
      state.concurrentCount--;
    }
  }

  async submit(
    userId: string,
    projectId: string,
    code: string,
    language: string,
    onLog?: (message: string, type: "info" | "error" | "success") => void,
    envVars?: Record<string, string>,
  ): Promise<ExecutionResult> {
    const rateCheck = this.checkUserRate(userId);
    if (!rateCheck.allowed) {
      this.metrics.rejectedJobs++;
      onLog?.(rateCheck.reason!, "error");
      return { stdout: "", stderr: rateCheck.reason!, exitCode: 1 };
    }

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.metrics.rejectedJobs++;
      const msg = "Execution queue is full. Please try again in a moment.";
      onLog?.(msg, "error");
      return { stdout: "", stderr: msg, exitCode: 1 };
    }

    return new Promise<ExecutionResult>((resolve, reject) => {
      const job: ExecutionJob = {
        id: randomUUID(),
        userId,
        projectId,
        code,
        language,
        envVars,
        onLog,
        resolve,
        reject,
        queuedAt: Date.now(),
      };

      this.queue.push(job);
      this.metrics.queuedJobs = this.queue.length;
      this.metrics.totalExecutions++;

      log(`Job ${job.id.slice(0, 8)} queued (user=${userId.slice(0, 8)}, lang=${language}, queue=${this.queue.length}, active=${this.activeJobs.size})`, "pool");

      if (this.queue.length > 1) {
        onLog?.(`Queued (position ${this.queue.length})...`, "info");
      }

      this.processQueue();
    });
  }

  private async processQueue() {
    while (this.activeJobs.size < MAX_CONCURRENT_EXECUTIONS && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.metrics.queuedJobs = this.queue.length;

      if (Date.now() - job.queuedAt > MAX_QUEUE_WAIT_MS) {
        const msg = "Execution timed out waiting in queue";
        job.onLog?.(msg, "error");
        job.resolve({ stdout: "", stderr: msg, exitCode: 1 });
        this.metrics.failedJobs++;
        continue;
      }

      this.activeJobs.set(job.id, job);
      this.metrics.activeJobs = this.activeJobs.size;
      this.incrementUserRate(job.userId);
      job.startedAt = Date.now();

      this.executeJob(job);
    }
  }

  private async executeJob(job: ExecutionJob) {
    try {
      log(`Job ${job.id.slice(0, 8)} executing (lang=${job.language})`, "pool");

      const abortController = new AbortController();
      job.abortController = abortController;

      const result = await executeCode(
        job.code,
        job.language,
        job.onLog,
        undefined,
        undefined,
        job.envVars,
        abortController.signal,
      );

      const duration = Date.now() - (job.startedAt || job.queuedAt);
      this.durationSamples.push(duration);
      if (this.durationSamples.length > 100) this.durationSamples.shift();
      this.metrics.avgDurationMs = Math.round(
        this.durationSamples.reduce((a, b) => a + b, 0) / this.durationSamples.length
      );

      if (result.exitCode === 0) {
        this.metrics.completedJobs++;
      } else {
        this.metrics.failedJobs++;
      }

      job.resolve(result);
    } catch (err: any) {
      this.metrics.failedJobs++;
      job.resolve({ stdout: "", stderr: err.message || "Execution failed", exitCode: 1 });
    } finally {
      this.activeJobs.delete(job.id);
      this.metrics.activeJobs = this.activeJobs.size;
      this.decrementUserConcurrent(job.userId);
      this.processQueue();
    }
  }

  cancelProjectExecution(projectId: string): boolean {
    const entries = Array.from(this.activeJobs.entries());
    for (const [_id, job] of entries) {
      if (job.projectId === projectId) {
        if (job.abortController) {
          job.abortController.abort();
        }
        log(`Job ${_id.slice(0, 8)} cancelled for project ${projectId.slice(0, 8)}`, "pool");
        return true;
      }
    }
    const queueIdx = this.queue.findIndex(j => j.projectId === projectId);
    if (queueIdx >= 0) {
      const job = this.queue.splice(queueIdx, 1)[0];
      this.metrics.queuedJobs = this.queue.length;
      job.onLog?.("Execution cancelled", "error");
      job.resolve({ stdout: "", stderr: "Execution cancelled", exitCode: 130 });
      this.metrics.failedJobs++;
      return true;
    }
    return false;
  }

  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  getStatus() {
    return {
      active: this.activeJobs.size,
      queued: this.queue.length,
      maxConcurrent: MAX_CONCURRENT_EXECUTIONS,
      maxQueue: MAX_QUEUE_SIZE,
      metrics: this.getMetrics(),
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [userId, state] of this.userRates) {
      if (now - state.windowStart > USER_RATE_WINDOW_MS * 2) {
        this.userRates.delete(userId);
      }
    }
  }

  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const job of this.queue) {
      job.resolve({ stdout: "", stderr: "Server shutting down", exitCode: 1 });
    }
    this.queue = [];
    log("Execution pool shut down", "pool");
  }
}

export const executionPool = new ExecutionPool();

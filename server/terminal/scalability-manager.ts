/**
 * Terminal Scalability Manager - Fortune 500 Grade
 * Handles concurrent session limits, queue management, and backpressure
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('terminal-scalability');

// Fortune 500 Limits
const MAX_CONCURRENT_SESSIONS = 100; // Maximum concurrent terminal sessions
const MAX_QUEUE_SIZE = 1000; // Maximum queued commands per session
const COMMAND_TIMEOUT_MS = 30000; // 30s timeout for command execution
const BACKPRESSURE_THRESHOLD = 0.8; // Start backpressure at 80% capacity

interface QueuedCommand {
  command: string;
  executor: () => Promise<void>;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

interface SessionMetrics {
  commandsExecuted: number;
  commandsQueued: number;
  commandsFailed: number;
  lastActivity: number;
  createdAt: number;
}

export class TerminalScalabilityManager {
  private activeSessions: Set<string> = new Set();
  private sessionQueues: Map<string, QueuedCommand[]> = new Map();
  private sessionMetrics: Map<string, SessionMetrics> = new Map();
  private processingQueues: Map<string, boolean> = new Map();

  /**
   * Check if a new session can be created
   */
  canCreateSession(): boolean {
    const currentSessions = this.activeSessions.size;
    const canCreate = currentSessions < MAX_CONCURRENT_SESSIONS;

    if (!canCreate) {
      logger.warn(`Session limit reached: ${currentSessions}/${MAX_CONCURRENT_SESSIONS}`);
    }

    return canCreate;
  }

  /**
   * Check if system is under backpressure
   */
  isUnderBackpressure(): boolean {
    const currentLoad = this.activeSessions.size / MAX_CONCURRENT_SESSIONS;
    return currentLoad >= BACKPRESSURE_THRESHOLD;
  }

  /**
   * Register a new terminal session
   */
  registerSession(sessionId: string): boolean {
    if (!this.canCreateSession()) {
      logger.error(`Cannot register session ${sessionId}: limit reached`);
      return false;
    }

    this.activeSessions.add(sessionId);
    this.sessionQueues.set(sessionId, []);
    this.sessionMetrics.set(sessionId, {
      commandsExecuted: 0,
      commandsQueued: 0,
      commandsFailed: 0,
      lastActivity: Date.now(),
      createdAt: Date.now()
    });
    this.processingQueues.set(sessionId, false);

    logger.info(`Session registered: ${sessionId} (${this.activeSessions.size}/${MAX_CONCURRENT_SESSIONS})`);

    return true;
  }

  /**
   * Unregister a terminal session
   */
  unregisterSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    
    // Clear queue
    const queue = this.sessionQueues.get(sessionId);
    if (queue) {
      queue.forEach(cmd => {
        cmd.reject(new Error('Session closed'));
      });
    }
    
    this.sessionQueues.delete(sessionId);
    this.sessionMetrics.delete(sessionId);
    this.processingQueues.delete(sessionId);

    logger.info(`Session unregistered: ${sessionId} (${this.activeSessions.size}/${MAX_CONCURRENT_SESSIONS})`);
  }

  /**
   * Queue a command for execution with backpressure
   */
  async queueCommand(
    sessionId: string,
    command: string,
    executor: () => Promise<void>
  ): Promise<void> {
    const queue = this.sessionQueues.get(sessionId);
    const metrics = this.sessionMetrics.get(sessionId);

    if (!queue || !metrics) {
      throw new Error(`Session ${sessionId} not registered`);
    }

    // Check queue size limit
    if (queue.length >= MAX_QUEUE_SIZE) {
      metrics.commandsFailed++;
      throw new Error('Command queue full - please wait for pending commands to complete');
    }

    // Update metrics
    metrics.commandsQueued++;
    metrics.lastActivity = Date.now();

    // Create promise for queued command
    return new Promise((resolve, reject) => {
      const queuedCommand: QueuedCommand = {
        command,
        executor,
        timestamp: Date.now(),
        resolve,
        reject
      };

      queue.push(queuedCommand);

      // Process queue if not already processing
      this.processQueue(sessionId);
    });
  }

  /**
   * Process queued commands one at a time (prevents concurrent execution within session)
   */
  private async processQueue(sessionId: string): Promise<void> {
    // Check if already processing
    if (this.processingQueues.get(sessionId)) {
      return; // Queue is already being processed
    }

    const queue = this.sessionQueues.get(sessionId);
    const metrics = this.sessionMetrics.get(sessionId);

    if (!queue || !metrics || queue.length === 0) {
      return;
    }

    // Mark as processing
    this.processingQueues.set(sessionId, true);

    try {
      while (queue.length > 0) {
        const queuedCommand = queue.shift()!;

        try {
          // Check timeout
          const age = Date.now() - queuedCommand.timestamp;
          if (age > COMMAND_TIMEOUT_MS) {
            throw new Error(`Command timeout after ${age}ms`);
          }

          // Execute command with its own executor
          await queuedCommand.executor();

          // Update metrics
          metrics.commandsExecuted++;
          metrics.commandsQueued = Math.max(0, metrics.commandsQueued - 1);

          // Resolve promise
          queuedCommand.resolve(undefined);

        } catch (error) {
          metrics.commandsFailed++;
          metrics.commandsQueued = Math.max(0, metrics.commandsQueued - 1);
          queuedCommand.reject(error as Error);
        }
      }
    } finally {
      // Mark as not processing
      this.processingQueues.set(sessionId, false);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): {
    totalSessions: number;
    maxSessions: number;
    utilizationPercent: number;
    underBackpressure: boolean;
    sessions: Array<{
      sessionId: string;
      commandsExecuted: number;
      commandsQueued: number;
      commandsFailed: number;
      age: number;
    }>;
  } {
    const sessions = Array.from(this.sessionMetrics.entries()).map(([sessionId, metrics]) => ({
      sessionId,
      commandsExecuted: metrics.commandsExecuted,
      commandsQueued: metrics.commandsQueued,
      commandsFailed: metrics.commandsFailed,
      age: Date.now() - metrics.createdAt
    }));

    return {
      totalSessions: this.activeSessions.size,
      maxSessions: MAX_CONCURRENT_SESSIONS,
      utilizationPercent: (this.activeSessions.size / MAX_CONCURRENT_SESSIONS) * 100,
      underBackpressure: this.isUnderBackpressure(),
      sessions
    };
  }

  /**
   * Clean up stale sessions (idle for > 1 hour)
   */
  cleanupStaleSessions(): void {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();

    for (const [sessionId, metrics] of this.sessionMetrics.entries()) {
      if (now - metrics.lastActivity > ONE_HOUR_MS) {
        logger.info(`Cleaning up stale session: ${sessionId}`);
        this.unregisterSession(sessionId);
      }
    }
  }
}

// Singleton instance
export const terminalScalabilityManager = new TerminalScalabilityManager();

// Periodic cleanup (every 10 minutes)
setInterval(() => {
  terminalScalabilityManager.cleanupStaleSessions();
}, 10 * 60 * 1000);

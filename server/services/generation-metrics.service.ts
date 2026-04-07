/**
 * Generation Metrics Service
 * 
 * Tracks performance metrics for the app generation pipeline.
 * Captures per-phase timing to identify bottlenecks and measure optimization impact.
 * 
 * Phases tracked:
 * - Request validation
 * - Project creation
 * - AI plan generation (with provider racing metrics)
 * - File scaffold generation
 * - Parallel file execution
 * - Total end-to-end time
 * 
 * @author E-Code Platform
 * @version 1.0.0
 * @since December 2025
 */

import { createLogger } from '../utils/logger';
import { providerRacing } from '../ai/provider-racing';

const logger = createLogger('generation-metrics');

export interface PhaseMetrics {
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export interface GenerationSession {
  sessionId: string;
  projectId: string;
  userId: string;
  prompt: string;
  startTime: number;
  endTime?: number;
  phases: Map<string, PhaseMetrics>;
  success: boolean;
  error?: string;
  totalDurationMs?: number;
}

export interface AggregateMetrics {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  successRate: number;
  avgTotalDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  avgPhaseDurationsMs: Record<string, number>;
  providerRacingMetrics: ReturnType<typeof providerRacing.getMetrics>;
  lastUpdated: Date;
}

class GenerationMetricsService {
  private activeSessions: Map<string, GenerationSession> = new Map();
  private completedSessions: GenerationSession[] = [];
  private maxCompletedSessions = 1000; // Rolling window

  /**
   * Start a new generation session
   */
  startSession(
    sessionId: string,
    projectId: string,
    userId: string,
    prompt: string
  ): void {
    const session: GenerationSession = {
      sessionId,
      projectId,
      userId,
      prompt: prompt.substring(0, 100), // Truncate for storage
      startTime: Date.now(),
      phases: new Map(),
      success: false
    };

    this.activeSessions.set(sessionId, session);
    logger.info(`[Metrics] Session started: ${sessionId}`, { projectId, userId });
  }

  /**
   * Start a phase within a session
   */
  startPhase(sessionId: string, phaseName: string, metadata?: Record<string, any>): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`[Metrics] Session not found: ${sessionId}`);
      return;
    }

    const phase: PhaseMetrics = {
      name: phaseName,
      startTime: Date.now(),
      metadata
    };

    session.phases.set(phaseName, phase);
    logger.debug(`[Metrics] Phase started: ${phaseName}`, { sessionId });
  }

  /**
   * End a phase within a session
   */
  endPhase(sessionId: string, phaseName: string, metadata?: Record<string, any>): number {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`[Metrics] Session not found: ${sessionId}`);
      return 0;
    }

    const phase = session.phases.get(phaseName);
    if (!phase) {
      logger.warn(`[Metrics] Phase not found: ${phaseName}`);
      return 0;
    }

    phase.endTime = Date.now();
    phase.durationMs = phase.endTime - phase.startTime;
    
    if (metadata) {
      phase.metadata = { ...phase.metadata, ...metadata };
    }

    logger.info(`[Metrics] Phase completed: ${phaseName} in ${phase.durationMs}ms`, {
      sessionId,
      ...phase.metadata
    });

    return phase.durationMs;
  }

  /**
   * Complete a generation session
   */
  completeSession(sessionId: string, success: boolean, error?: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`[Metrics] Session not found: ${sessionId}`);
      return;
    }

    session.endTime = Date.now();
    session.totalDurationMs = session.endTime - session.startTime;
    session.success = success;
    session.error = error;

    // Move to completed
    this.activeSessions.delete(sessionId);
    this.completedSessions.push(session);

    // Trim old sessions
    if (this.completedSessions.length > this.maxCompletedSessions) {
      this.completedSessions = this.completedSessions.slice(-this.maxCompletedSessions);
    }

    logger.info(`[Metrics] Session completed: ${sessionId}`, {
      success,
      totalDurationMs: session.totalDurationMs,
      phases: this.summarizePhases(session)
    });
  }

  /**
   * Get aggregate metrics
   */
  getAggregateMetrics(): AggregateMetrics {
    const sessions = this.completedSessions;
    const successful = sessions.filter(s => s.success);
    const failed = sessions.filter(s => !s.success);

    // Calculate duration percentiles
    const durations = successful
      .map(s => s.totalDurationMs || 0)
      .filter(d => d > 0)
      .sort((a, b) => a - b);

    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const avg = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Calculate average phase durations
    const phaseTotals: Record<string, { sum: number; count: number }> = {};
    
    for (const session of successful) {
      for (const [name, phase] of session.phases) {
        if (phase.durationMs) {
          if (!phaseTotals[name]) {
            phaseTotals[name] = { sum: 0, count: 0 };
          }
          phaseTotals[name].sum += phase.durationMs;
          phaseTotals[name].count++;
        }
      }
    }

    const avgPhaseDurationsMs: Record<string, number> = {};
    for (const [name, { sum, count }] of Object.entries(phaseTotals)) {
      avgPhaseDurationsMs[name] = Math.round(sum / count);
    }

    return {
      totalGenerations: sessions.length,
      successfulGenerations: successful.length,
      failedGenerations: failed.length,
      successRate: sessions.length > 0 ? successful.length / sessions.length : 0,
      avgTotalDurationMs: avg,
      p50DurationMs: p50,
      p95DurationMs: p95,
      avgPhaseDurationsMs,
      providerRacingMetrics: providerRacing.getMetrics(),
      lastUpdated: new Date()
    };
  }

  /**
   * Get session details by ID
   */
  getSession(sessionId: string): GenerationSession | undefined {
    return this.activeSessions.get(sessionId) || 
           this.completedSessions.find(s => s.sessionId === sessionId);
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Record plan generation phase completion
   * Helper method that combines startPhase and endPhase
   */
  recordPlanGeneration(sessionId: string, durationMs: number, taskCount: number): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`[Metrics] Session not found for plan generation: ${sessionId}`);
      return;
    }

    const phase: PhaseMetrics = {
      name: 'plan_generation',
      startTime: Date.now() - durationMs,
      endTime: Date.now(),
      durationMs,
      metadata: { taskCount }
    };

    session.phases.set('plan_generation', phase);
    logger.info(`[Metrics] Plan generation recorded: ${durationMs}ms, ${taskCount} tasks`, { sessionId });
  }

  /**
   * Record workflow execution phase completion
   * Helper method that combines startPhase and endPhase
   */
  recordWorkflowExecution(sessionId: string, durationMs: number, stepCount: number): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`[Metrics] Session not found for workflow execution: ${sessionId}`);
      return;
    }

    const phase: PhaseMetrics = {
      name: 'workflow_execution',
      startTime: Date.now() - durationMs,
      endTime: Date.now(),
      durationMs,
      metadata: { stepCount }
    };

    session.phases.set('workflow_execution', phase);
    logger.info(`[Metrics] Workflow execution recorded: ${durationMs}ms, ${stepCount} steps`, { sessionId });
  }

  /**
   * Record file creation phase
   */
  recordFileCreation(sessionId: string, durationMs: number, fileCount: number): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`[Metrics] Session not found for file creation: ${sessionId}`);
      return;
    }

    const phase: PhaseMetrics = {
      name: 'file_creation',
      startTime: Date.now() - durationMs,
      endTime: Date.now(),
      durationMs,
      metadata: { fileCount }
    };

    session.phases.set('file_creation', phase);
    logger.info(`[Metrics] File creation recorded: ${durationMs}ms, ${fileCount} files`, { sessionId });
  }

  /**
   * Helper to summarize phases for logging
   */
  private summarizePhases(session: GenerationSession): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const [name, phase] of session.phases) {
      summary[name] = phase.durationMs || 0;
    }
    return summary;
  }

  /**
   * Get recent session history
   */
  getRecentSessions(limit: number = 10): Array<{
    sessionId: string;
    projectId: string;
    success: boolean;
    totalDurationMs: number;
    timestamp: Date;
  }> {
    return this.completedSessions
      .slice(-limit)
      .reverse()
      .map(s => ({
        sessionId: s.sessionId,
        projectId: s.projectId,
        success: s.success,
        totalDurationMs: s.totalDurationMs || 0,
        timestamp: new Date(s.startTime)
      }));
  }
}

export const generationMetrics = new GenerationMetricsService();

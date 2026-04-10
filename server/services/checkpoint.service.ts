/**
 * Checkpoint Service
 * Manages Replit-style automatic checkpoint system for project versioning
 * 
 * Provides functionality for creating, retrieving, and managing checkpoints
 * that capture project state at specific points in time.
 */

import { db } from '../db';
import { 
  autoCheckpoints, 
  autoCheckpointFiles, 
  checkpointRestores,
  type AutoCheckpoint,
  type InsertAutoCheckpoint,
  type AutoCheckpointFile,
  type CheckpointRestore
} from '../../shared/schema';
import { eq, desc, lt, and, sql, inArray } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = createLogger('checkpoint-service');

export interface CheckpointWithFiles extends AutoCheckpoint {
  files?: AutoCheckpointFile[];
}

export interface CreateCheckpointOptions {
  type?: 'auto' | 'manual' | 'milestone';
  triggerSource?: string;
  includesDatabase?: boolean;
  aiSummary?: string;
  filesSnapshot?: Record<string, { hash: string; size: number }>;
  conversationSnapshot?: Array<{ role: string; content: string; timestamp?: string }>;
  createdBy?: number;
}

export interface RestoreOptions {
  includedDatabase?: boolean;
  status: string;
}

export class CheckpointService extends EventEmitter {
  private lastCheckpointTime: Map<number, number> = new Map();
  private static MIN_CHECKPOINT_INTERVAL_MS = 30000; // 30 seconds minimum between auto-checkpoints

  constructor() {
    super();
  }

  /**
   * Create a new checkpoint for a project
   * Rate-limited for 'auto' type checkpoints to prevent spam (minimum 30 seconds between auto-checkpoints)
   */
  async createCheckpoint(
    projectId: number, 
    options: CreateCheckpointOptions = {}
  ): Promise<AutoCheckpoint> {
    const {
      type = 'auto',
      triggerSource,
      includesDatabase = false,
      aiSummary,
      filesSnapshot = {},
      conversationSnapshot,
      createdBy
    } = options;

    // Rate-limit auto checkpoints to prevent spam (only for 'auto' type, not manual or milestone)
    const isRateLimited = type === 'auto' && (() => {
      const lastTime = this.lastCheckpointTime.get(projectId);
      const now = Date.now();
      return lastTime && (now - lastTime) < CheckpointService.MIN_CHECKPOINT_INTERVAL_MS;
    })();

    if (isRateLimited) {
      logger.info(`[CheckpointService] Rate-limited auto-checkpoint for project ${projectId} - skipping silently`);
      // Throw a specific error that callers can catch and handle gracefully
      const error = new Error('CHECKPOINT_RATE_LIMITED');
      (error as any).code = 'RATE_LIMITED';
      (error as any).projectId = projectId;
      throw error;
    }

    const insertData: InsertAutoCheckpoint = {
      projectId,
      type,
      triggerSource,
      status: 'complete',
      aiSummary,
      includesDatabase,
      filesSnapshot,
      conversationSnapshot,
      createdBy
    };

    const [checkpoint] = await db
      .insert(autoCheckpoints)
      .values(insertData)
      .returning();

    // Only update last checkpoint time AFTER successful insert
    if (type === 'auto') {
      this.lastCheckpointTime.set(projectId, Date.now());
    }

    this.emit('checkpointCreated', { projectId, checkpoint });
    logger.info(`[CheckpointService] Created checkpoint ${checkpoint.id} for project ${projectId}`);

    return checkpoint;
  }

  /**
   * Get all checkpoints for a project, ordered by creation date (newest first)
   */
  async getCheckpoints(projectId: number, limit: number = 50): Promise<AutoCheckpoint[]> {
    const checkpoints = await db
      .select()
      .from(autoCheckpoints)
      .where(eq(autoCheckpoints.projectId, projectId))
      .orderBy(desc(autoCheckpoints.createdAt))
      .limit(limit);

    return checkpoints;
  }

  /**
   * Get a single checkpoint by ID
   */
  async getCheckpoint(id: number): Promise<AutoCheckpoint | null> {
    const [checkpoint] = await db
      .select()
      .from(autoCheckpoints)
      .where(eq(autoCheckpoints.id, id))
      .limit(1);

    return checkpoint || null;
  }

  /**
   * Get a checkpoint with its associated files
   */
  async getCheckpointWithFiles(id: number): Promise<CheckpointWithFiles | null> {
    const checkpoint = await this.getCheckpoint(id);
    if (!checkpoint) {
      return null;
    }

    const files = await db
      .select()
      .from(autoCheckpointFiles)
      .where(eq(autoCheckpointFiles.checkpointId, id));

    return {
      ...checkpoint,
      files
    };
  }

  /**
   * Add files to a checkpoint
   */
  async addCheckpointFiles(
    checkpointId: number,
    files: Array<{
      filePath: string;
      fileHash?: string;
      fileContent?: string;
      diffFromPrevious?: string;
    }>
  ): Promise<AutoCheckpointFile[]> {
    if (files.length === 0) {
      return [];
    }

    const insertData = files.map(file => ({
      checkpointId,
      filePath: file.filePath,
      fileHash: file.fileHash,
      fileContent: file.fileContent,
      diffFromPrevious: file.diffFromPrevious
    }));

    const insertedFiles = await db
      .insert(autoCheckpointFiles)
      .values(insertData)
      .returning();

    return insertedFiles;
  }

  /**
   * Delete old checkpoints for retention management
   * Keeps the most recent `keepCount` checkpoints and deletes the rest
   * Returns the number of checkpoints deleted
   */
  async pruneOldCheckpoints(projectId: number, keepCount: number): Promise<number> {
    const allCheckpoints = await db
      .select({ id: autoCheckpoints.id })
      .from(autoCheckpoints)
      .where(eq(autoCheckpoints.projectId, projectId))
      .orderBy(desc(autoCheckpoints.createdAt));

    if (allCheckpoints.length <= keepCount) {
      return 0;
    }

    const checkpointsToDelete = allCheckpoints.slice(keepCount);
    const idsToDelete = checkpointsToDelete.map(c => c.id);

    await db
      .delete(autoCheckpoints)
      .where(inArray(autoCheckpoints.id, idsToDelete));

    this.emit('checkpointsPruned', { projectId, count: idsToDelete.length });
    logger.info(`[CheckpointService] Pruned ${idsToDelete.length} old checkpoints for project ${projectId}`);

    return idsToDelete.length;
  }

  /**
   * Delete a specific checkpoint by ID
   */
  async deleteCheckpoint(id: number): Promise<boolean> {
    const result = await db
      .delete(autoCheckpoints)
      .where(eq(autoCheckpoints.id, id))
      .returning({ id: autoCheckpoints.id });

    if (result.length > 0) {
      this.emit('checkpointDeleted', { checkpointId: id });
      logger.info(`[CheckpointService] Deleted checkpoint ${id}`);
      return true;
    }

    return false;
  }

  /**
   * Log a restore action for audit purposes
   */
  async logRestore(
    checkpointId: number, 
    projectId: number, 
    userId: number, 
    options: RestoreOptions
  ): Promise<CheckpointRestore> {
    const { includedDatabase = false, status } = options;

    const [restoreLog] = await db
      .insert(checkpointRestores)
      .values({
        checkpointId,
        projectId,
        restoredBy: userId,
        includedDatabase,
        status
      })
      .returning();

    this.emit('checkpointRestored', { checkpointId, projectId, userId, status });
    logger.info(`[CheckpointService] Logged restore of checkpoint ${checkpointId} by user ${userId}`);

    return restoreLog;
  }

  /**
   * Get restore history for a project
   */
  async getRestoreHistory(projectId: number, limit: number = 20): Promise<CheckpointRestore[]> {
    const history = await db
      .select()
      .from(checkpointRestores)
      .where(eq(checkpointRestores.projectId, projectId))
      .orderBy(desc(checkpointRestores.restoredAt))
      .limit(limit);

    return history;
  }

  /**
   * Update checkpoint status
   */
  async updateCheckpointStatus(
    id: number, 
    status: 'pending' | 'creating' | 'complete' | 'failed'
  ): Promise<AutoCheckpoint | null> {
    const [updated] = await db
      .update(autoCheckpoints)
      .set({ status })
      .where(eq(autoCheckpoints.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Update checkpoint with database and conversation snapshot
   * 
   * Note: dbSnapshotPath is stored in filesSnapshot under reserved key '__db_snapshot__'
   * to persist the path location for restore operations without schema changes.
   */
  async updateCheckpointData(
    id: number,
    data: {
      includesDatabase?: boolean;
      conversationSnapshot?: Array<{ role: string; content: string; timestamp?: string }>;
      aiSummary?: string;
      dbSnapshotPath?: string;
      conversationId?: number;
    }
  ): Promise<AutoCheckpoint | null> {
    // Build update data
    const updatePayload: Record<string, any> = {};
    
    if (data.includesDatabase !== undefined) {
      updatePayload.includesDatabase = data.includesDatabase;
    }
    if (data.conversationSnapshot !== undefined) {
      updatePayload.conversationSnapshot = data.conversationSnapshot;
    }
    if (data.aiSummary !== undefined) {
      updatePayload.aiSummary = data.aiSummary;
    }
    
    // If dbSnapshotPath or conversationId provided, merge into filesSnapshot
    // Using reserved keys to store metadata without schema changes
    if (data.dbSnapshotPath || data.conversationId) {
      const [existing] = await db
        .select({ filesSnapshot: autoCheckpoints.filesSnapshot })
        .from(autoCheckpoints)
        .where(eq(autoCheckpoints.id, id))
        .limit(1);
      
      const currentSnapshot = (existing?.filesSnapshot as Record<string, any>) || {};
      
      // Store metadata under reserved keys
      if (data.dbSnapshotPath) {
        currentSnapshot['__db_snapshot__'] = { 
          path: data.dbSnapshotPath,
          hash: 'db_dump',
          size: 0 
        };
      }
      if (data.conversationId) {
        currentSnapshot['__conversation_id__'] = {
          id: data.conversationId,
          hash: 'conv_meta',
          size: 0
        };
      }
      
      updatePayload.filesSnapshot = currentSnapshot;
    }
    
    if (Object.keys(updatePayload).length === 0) {
      return this.getCheckpoint(id);
    }
    
    const [updated] = await db
      .update(autoCheckpoints)
      .set(updatePayload)
      .where(eq(autoCheckpoints.id, id))
      .returning();

    if (updated) {
      logger.info(`[CheckpointService] Updated checkpoint ${id} with database=${data.includesDatabase}, conversation=${!!data.conversationSnapshot}, dbPath=${!!data.dbSnapshotPath}`);
    }

    return updated || null;
  }

  /**
   * Get database snapshot path from checkpoint metadata
   * Returns the stored path or computes default path if not stored
   */
  getDbSnapshotPath(checkpoint: AutoCheckpoint): string {
    const filesSnapshot = checkpoint.filesSnapshot as Record<string, any> | undefined;
    const dbMeta = filesSnapshot?.['__db_snapshot__'];
    
    if (dbMeta?.path) {
      return dbMeta.path;
    }
    
    // Fallback to default computed path for backwards compatibility
    return `${process.cwd()}/.checkpoints/${checkpoint.id}/database.sql`;
  }

  /**
   * Get conversation ID from checkpoint metadata (if stored)
   */
  getCheckpointConversationId(checkpoint: AutoCheckpoint): number | undefined {
    const filesSnapshot = checkpoint.filesSnapshot as Record<string, any> | undefined;
    const convMeta = filesSnapshot?.['__conversation_id__'];
    return convMeta?.id;
  }

  /**
   * Get the latest checkpoint for a project
   */
  async getLatestCheckpoint(projectId: number): Promise<AutoCheckpoint | null> {
    const [checkpoint] = await db
      .select()
      .from(autoCheckpoints)
      .where(eq(autoCheckpoints.projectId, projectId))
      .orderBy(desc(autoCheckpoints.createdAt))
      .limit(1);

    return checkpoint || null;
  }

  /**
   * Count checkpoints for a project
   */
  async countCheckpoints(projectId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(autoCheckpoints)
      .where(eq(autoCheckpoints.projectId, projectId));

    return result[0]?.count || 0;
  }
}

export const checkpointService = new CheckpointService();

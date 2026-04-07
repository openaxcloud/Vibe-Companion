// @ts-nocheck
import { db } from '../db';
import { checkpoints, projects } from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import { checkpointService } from './checkpoint-service';
import { conversationManagementService } from './conversation-management-service';

const logger = createLogger('rollback-service');

export interface RollbackOptions {
  checkpointId: number;
  projectId: number;
  userId: number;
  direction: 'backward' | 'forward'; // backward = rollback, forward = rollforward
  restoreConversation?: boolean;
  restoreScreenshot?: boolean;
}

export interface RollbackResult {
  success: boolean;
  checkpointId: number;
  newCheckpointId: number; // Checkpoint created after rollback
  direction: 'backward' | 'forward';
  timestamp: Date;
  changedFiles: string[];
  error?: string;
}

export interface CheckpointNode {
  id: number;
  name: string;
  createdAt: Date;
  parentCheckpointId: number | null;
  children: CheckpointNode[];
  depth: number;
}

/**
 * Bidirectional Rollback Service for Replit Agent 3 style checkpoint navigation
 * Allows users to navigate backward (rollback) and forward (rollforward) through checkpoint history
 */
export class RollbackService {
  /**
   * Perform rollback to a specific checkpoint (backward navigation)
   */
  async rollbackToCheckpoint(options: RollbackOptions): Promise<RollbackResult> {
    logger.info(`Rolling back project ${options.projectId} to checkpoint ${options.checkpointId}`);

    try {
      // Get target checkpoint
      const [targetCheckpoint] = await db
        .select()
        .from(checkpoints)
        .where(
          and(
            eq(checkpoints.id, options.checkpointId),
            eq(checkpoints.projectId, options.projectId)
          )
        );

      if (!targetCheckpoint) {
        throw new Error('Target checkpoint not found');
      }

      // 🔥 FIX: Get current checkpoint from projects.currentCheckpointId (not chronological order)
      const currentCheckpointId = await this.getCurrentCheckpointId(options.projectId);
      let currentCheckpoint = null;
      if (currentCheckpointId) {
        [currentCheckpoint] = await db
          .select()
          .from(checkpoints)
          .where(eq(checkpoints.id, currentCheckpointId));
      }

      // 🔥 Create a REAL checkpoint BEFORE rollback (for rollforward capability)
      // This properly saves files/DB/env using CheckpointService
      const beforeRollbackCheckpoint = await checkpointService.createCheckpoint({
        projectId: options.projectId,
        name: `Before rollback to: ${targetCheckpoint.name}`,
        description: `Automatic checkpoint created before rolling back to checkpoint ${options.checkpointId}`,
        type: 'automatic',
        userId: options.userId,
        includeDatabase: true,
        includeEnvironment: true,
        captureScreenshot: false, // Skip screenshot for speed
        parentCheckpointId: currentCheckpoint?.id, // Link to parent for bidirectional navigation
        environment: targetCheckpoint.environment,
        conversationSnapshot: currentCheckpoint?.conversationSnapshot || undefined,
        agentState: {
          rollbackMetadata: {
            targetCheckpointId: options.checkpointId,
            previousCheckpointId: currentCheckpoint?.id,
            rollbackTimestamp: new Date().toISOString(),
          },
        },
      });

      // Restore files from target checkpoint
      const changedFiles = await this.restoreFilesFromCheckpoint(targetCheckpoint);

      // Optionally restore conversation history
      if (options.restoreConversation && targetCheckpoint.conversationSnapshot) {
        await this.restoreConversationHistory(
          options.projectId,
          targetCheckpoint.conversationSnapshot
        );
      }

      // Update rollback count
      await db
        .update(checkpoints)
        .set({
          rollbackCount: (targetCheckpoint.rollbackCount || 0) + 1,
        })
        .where(eq(checkpoints.id, options.checkpointId));

      // 🔥 REPLIT AGENT 3: Set target checkpoint as current active checkpoint
      await db.update(projects)
        .set({ currentCheckpointId: options.checkpointId })
        .where(eq(projects.id, options.projectId));

      logger.info(`Successfully rolled back project ${options.projectId} to checkpoint ${options.checkpointId} (now current)`);

      return {
        success: true,
        checkpointId: options.checkpointId,
        newCheckpointId: beforeRollbackCheckpoint.id,
        direction: 'backward',
        timestamp: new Date(),
        changedFiles,
      };
    } catch (error) {
      logger.error('Rollback failed:', error);
      return {
        success: false,
        checkpointId: options.checkpointId,
        newCheckpointId: -1,
        direction: 'backward',
        timestamp: new Date(),
        changedFiles: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Perform rollforward to a child checkpoint (forward navigation)
   */
  async rollforwardToCheckpoint(options: RollbackOptions): Promise<RollbackResult> {
    logger.info(`Rolling forward project ${options.projectId} to checkpoint ${options.checkpointId}`);

    try {
      // Get target checkpoint
      const [targetCheckpoint] = await db
        .select()
        .from(checkpoints)
        .where(
          and(
            eq(checkpoints.id, options.checkpointId),
            eq(checkpoints.projectId, options.projectId)
          )
        );

      if (!targetCheckpoint) {
        throw new Error('Target checkpoint not found');
      }

      // Verify this is a valid forward checkpoint (child of current)
      const currentCheckpointId = await this.getCurrentCheckpointId(options.projectId);
      const isValidForward = await this.isValidForwardCheckpoint(
        currentCheckpointId,
        options.checkpointId
      );

      if (!isValidForward) {
        throw new Error('Target checkpoint is not a valid forward checkpoint');
      }

      // Restore files from target checkpoint
      const changedFiles = await this.restoreFilesFromCheckpoint(targetCheckpoint);

      // Optionally restore conversation history
      if (options.restoreConversation && targetCheckpoint.conversationSnapshot) {
        await this.restoreConversationHistory(
          options.projectId,
          targetCheckpoint.conversationSnapshot
        );
      }

      // 🔥 REPLIT AGENT 3: Set target checkpoint as current active checkpoint
      await db.update(projects)
        .set({ currentCheckpointId: options.checkpointId })
        .where(eq(projects.id, options.projectId));

      logger.info(`Successfully rolled forward project ${options.projectId} to checkpoint ${options.checkpointId} (now current)`);

      return {
        success: true,
        checkpointId: options.checkpointId,
        newCheckpointId: options.checkpointId,
        direction: 'forward',
        timestamp: new Date(),
        changedFiles,
      };
    } catch (error) {
      logger.error('Rollforward failed:', error);
      return {
        success: false,
        checkpointId: options.checkpointId,
        newCheckpointId: -1,
        direction: 'forward',
        timestamp: new Date(),
        changedFiles: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get checkpoint tree structure for visualization
   */
  async getCheckpointTree(projectId: number): Promise<CheckpointNode[]> {
    const allCheckpoints = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.projectId, projectId))
      .orderBy(asc(checkpoints.createdAt));

    // Build tree structure
    const checkpointMap = new Map<number, CheckpointNode>();
    const roots: CheckpointNode[] = [];

    // First pass: Create nodes
    for (const cp of allCheckpoints) {
      checkpointMap.set(cp.id, {
        id: cp.id,
        name: cp.name,
        createdAt: cp.createdAt,
        parentCheckpointId: cp.parentCheckpointId,
        children: [],
        depth: 0,
      });
    }

    // Second pass: Build parent-child relationships
    for (const cp of allCheckpoints) {
      const node = checkpointMap.get(cp.id)!;

      if (cp.parentCheckpointId) {
        const parent = checkpointMap.get(cp.parentCheckpointId);
        if (parent) {
          parent.children.push(node);
          node.depth = parent.depth + 1;
        } else {
          // Parent not found, treat as root
          roots.push(node);
        }
      } else {
        // No parent, this is a root node
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Get navigation options from current checkpoint
   */
  async getNavigationOptions(projectId: number) {
    const currentCheckpointId = await this.getCurrentCheckpointId(projectId);
    
    if (!currentCheckpointId) {
      return { canRollback: false, canRollforward: false, backward: [], forward: [] };
    }

    const [currentCheckpoint] = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.id, currentCheckpointId));

    if (!currentCheckpoint) {
      return { canRollback: false, canRollforward: false, backward: [], forward: [] };
    }

    // Get backward options (parent and ancestors)
    const backwardOptions = await this.getBackwardCheckpoints(currentCheckpointId, projectId);

    // Get forward options (children)
    const forwardOptions = await db
      .select()
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.projectId, projectId),
          eq(checkpoints.parentCheckpointId, currentCheckpointId)
        )
      )
      .orderBy(desc(checkpoints.createdAt));

    return {
      canRollback: backwardOptions.length > 0,
      canRollforward: forwardOptions.length > 0,
      backward: backwardOptions.map(cp => ({
        id: cp.id,
        name: cp.name,
        createdAt: cp.createdAt,
        changedFiles: cp.changedFiles || [],
      })),
      forward: forwardOptions.map(cp => ({
        id: cp.id,
        name: cp.name,
        createdAt: cp.createdAt,
        changedFiles: cp.changedFiles || [],
      })),
    };
  }

  // Private helper methods

  private async getCurrentCheckpointId(projectId: number): Promise<number | null> {
    // 🔥 REPLIT AGENT 3: Read current checkpoint from projects.currentCheckpointId
    // This decouples "active" state from chronological order
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    return project?.currentCheckpointId || null;
  }

  private async getBackwardCheckpoints(currentCheckpointId: number, projectId: number) {
    const backward: any[] = [];
    let currentId: number | null = currentCheckpointId;

    // Walk up the parent chain
    while (currentId) {
      const [checkpoint] = await db
        .select()
        .from(checkpoints)
        .where(eq(checkpoints.id, currentId));

      if (!checkpoint || !checkpoint.parentCheckpointId) break;

      const [parent] = await db
        .select()
        .from(checkpoints)
        .where(eq(checkpoints.id, checkpoint.parentCheckpointId));

      if (parent) {
        backward.push(parent);
        currentId = parent.id;
      } else {
        break;
      }
    }

    return backward;
  }

  private async isValidForwardCheckpoint(
    currentCheckpointId: number | null,
    targetCheckpointId: number
  ): Promise<boolean> {
    if (!currentCheckpointId) return false;

    const [targetCheckpoint] = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.id, targetCheckpointId));

    if (!targetCheckpoint) return false;

    // Check if target is a child of current
    return targetCheckpoint.parentCheckpointId === currentCheckpointId;
  }

  private async restoreFilesFromCheckpoint(checkpoint: any): Promise<string[]> {
    // 🔥 DELEGATE to CheckpointService for actual file restoration
    try {
      // Check if database snapshot exists (either Neon branch OR pg_dump snapshot)
      const hasDatabaseSnapshot = 
        checkpoint.databaseBranchId || 
        checkpoint.metadata?.databaseSnapshot || 
        checkpoint.metadata?.databaseIncluded;

      await checkpointService.restoreCheckpoint({
        checkpointId: checkpoint.id,
        userId: checkpoint.createdBy,
        restoreFiles: true,
        restoreDatabase: hasDatabaseSnapshot,
        restoreEnvironment: checkpoint.metadata?.environmentIncluded || true,
      });

      logger.info(`Successfully restored checkpoint ${checkpoint.id} (DB: ${hasDatabaseSnapshot})`);
      return checkpoint.changedFiles || [];
    } catch (error) {
      logger.error('Failed to restore files from checkpoint:', error);
      throw error;
    }
  }

  private async restoreConversationHistory(
    projectId: number,
    conversationSnapshot: any
  ): Promise<void> {
    try {
      if (!conversationSnapshot || !Array.isArray(conversationSnapshot)) {
        logger.info(`No conversation snapshot to restore for project ${projectId}`);
        return;
      }

      logger.info(`Restoring conversation history for project ${projectId} with ${conversationSnapshot.length} messages`);

      // Get existing conversations for this project to archive them
      const existingConversations = await conversationManagementService.getProjectConversations(projectId, {
        status: 'active'
      });

      // Archive existing active conversations before restoring
      for (const conv of existingConversations) {
        try {
          await conversationManagementService.archiveConversation(conv.id);
          logger.debug(`Archived existing conversation ${conv.id} before rollback`);
        } catch (archiveError) {
          logger.warn(`Failed to archive conversation ${conv.id}:`, archiveError);
        }
      }

      // Create a new conversation from the snapshot
      if (conversationSnapshot.length > 0) {
        const restoredConversation = await conversationManagementService.createConversation({
          projectId,
          userId: conversationSnapshot[0]?.userId || 0,
          title: `Restored conversation (rollback ${new Date().toISOString().split('T')[0]})`,
          context: {
            currentFile: conversationSnapshot[0]?.context?.currentFile,
            selectedCode: null,
            recentFiles: conversationSnapshot[0]?.context?.recentFiles || [],
            projectContext: conversationSnapshot[0]?.context?.projectContext
          }
        });

        // Add messages from snapshot
        for (const msg of conversationSnapshot) {
          if (msg.role && msg.content) {
            await conversationManagementService.addMessage(restoredConversation.id, {
              role: msg.role,
              content: msg.content,
              metadata: {
                ...msg.metadata,
                restoredFromRollback: true,
                originalTimestamp: msg.timestamp
              }
            });
          }
        }

        logger.info(`Successfully restored conversation ${restoredConversation.id} with ${conversationSnapshot.length} messages`);
      }
    } catch (error) {
      logger.error('Failed to restore conversation history:', error);
      // Don't throw - conversation restore failure shouldn't block file rollback
    }
  }
}

export const rollbackService = new RollbackService();

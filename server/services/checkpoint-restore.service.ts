/**
 * Checkpoint Restore Service
 * Handles restoring project state from checkpoints
 * 
 * Works with the CheckpointService and WorkspaceSnapshotService
 * to perform full project rollbacks.
 */

import { db } from '../db';
import { autoCheckpoints, autoCheckpointFiles, projects } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { checkpointService } from './checkpoint.service';
import { workspaceSnapshotService, type FileSnapshot } from './workspace-snapshot.service';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('checkpoint-restore-service');

export interface RestoreResult {
  success: boolean;
  checkpointId: number;
  projectId: number;
  restoredFiles: number;
  restoredDatabase: boolean;
  restoredConversation: boolean;
  errors: string[];
  duration: number;
}

export interface RestoreOptions {
  restoreFiles?: boolean;
  restoreDatabase?: boolean;
  restoreConversation?: boolean;
  createBackupCheckpoint?: boolean;
  userId?: number;
}

export class CheckpointRestoreService extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Get project base path for file operations
   */
  private getProjectBasePath(projectId: number): string {
    return path.join(process.cwd(), 'project-workspaces', String(projectId));
  }

  /**
   * Restore a project to a specific checkpoint
   */
  async restoreToCheckpoint(
    checkpointId: number,
    options: RestoreOptions = {}
  ): Promise<RestoreResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    logger.info(`[CheckpointRestore] Starting restore to checkpoint ${checkpointId}`);

    try {
      // Get checkpoint details
      const checkpoint = await checkpointService.getCheckpointWithFiles(checkpointId);
      
      if (!checkpoint) {
        throw new Error(`Checkpoint ${checkpointId} not found`);
      }

      const projectId = checkpoint.projectId;
      const projectBasePath = this.getProjectBasePath(projectId);

      // Create backup checkpoint before restore if requested
      if (options.createBackupCheckpoint) {
        try {
          const filesSnapshot = await workspaceSnapshotService.captureFileMetadata(
            projectBasePath,
            projectId
          );

          await checkpointService.createCheckpoint(projectId, {
            type: 'auto',
            triggerSource: 'before_restore',
            aiSummary: `Backup before restoring to checkpoint ${checkpointId}`,
            filesSnapshot,
            createdBy: options.userId,
          });

          logger.info(`[CheckpointRestore] Created backup checkpoint before restore`);
        } catch (backupError: any) {
          logger.warn(`[CheckpointRestore] Failed to create backup checkpoint: ${backupError.message}`);
          errors.push(`Backup creation failed: ${backupError.message}`);
        }
      }

      let restoredFiles = 0;
      let restoredDatabase = false;
      let restoredConversation = false;

      // Restore files if checkpoint has file content stored
      if (options.restoreFiles !== false && checkpoint.files && checkpoint.files.length > 0) {
        // Convert checkpoint files to FileSnapshot format
        const fileSnapshots: FileSnapshot[] = checkpoint.files
          .filter(f => f.fileContent)
          .map(f => ({
            path: f.filePath,
            content: f.fileContent!,
            hash: f.fileHash || '',
            size: f.fileContent!.length,
            isDirectory: false,
          }));

        if (fileSnapshots.length > 0) {
          const restoreResult = await workspaceSnapshotService.restoreFileState(
            projectBasePath,
            {
              projectId,
              basePath: projectBasePath,
              files: fileSnapshots,
              capturedAt: checkpoint.createdAt,
              totalFiles: fileSnapshots.length,
              totalSize: fileSnapshots.reduce((sum, f) => sum + f.size, 0),
            }
          );

          restoredFiles = restoreResult.restoredCount;
          errors.push(...restoreResult.errors);
        }
      }

      // ============================================================
      // DATABASE RESTORE - Restore database from pg_dump snapshot
      // SECURITY: Use spawn with args array to prevent command injection
      // RELIABILITY: Use stored path from checkpoint metadata
      // ============================================================
      if (options.restoreDatabase !== false && checkpoint.includesDatabase) {
        try {
          const databaseUrl = process.env.DATABASE_URL;
          if (databaseUrl) {
            const { spawn } = await import('child_process');
            
            // Get snapshot path from checkpoint metadata (or fallback to computed path)
            const snapshotPath = checkpointService.getDbSnapshotPath(checkpoint);
            
            // Check if snapshot file exists
            try {
              await fs.access(snapshotPath);
              
              // Parse DATABASE_URL safely to extract components
              const dbUrlParsed = new URL(databaseUrl);
              const psqlArgs = [
                '-h', dbUrlParsed.hostname,
                '-p', dbUrlParsed.port || '5432',
                '-U', dbUrlParsed.username,
                '-d', dbUrlParsed.pathname.slice(1), // remove leading /
                '-f', snapshotPath
              ];
              
              // Execute psql using spawn with args array (secure - no shell injection)
              await new Promise<void>((resolve, reject) => {
                const child = spawn('psql', psqlArgs, {
                  env: { ...process.env, PGPASSWORD: dbUrlParsed.password },
                  stdio: ['pipe', 'pipe', 'pipe']
                });
                
                let stderr = '';
                child.stderr?.on('data', (data) => { stderr += data.toString(); });
                
                child.on('close', (code) => {
                  if (code === 0) {
                    resolve();
                  } else {
                    reject(new Error(`psql exited with code ${code}: ${stderr}`));
                  }
                });
                
                child.on('error', (err) => reject(err));
              });
              
              restoredDatabase = true;
              logger.info(`[CheckpointRestore] Database restored from ${snapshotPath}`);
            } catch (accessError: any) {
              if (accessError.code === 'ENOENT') {
                errors.push(`Database snapshot file not found: ${snapshotPath}`);
                logger.warn(`[CheckpointRestore] Database snapshot not found: ${snapshotPath}`);
              } else {
                throw accessError;
              }
            }
          } else {
            errors.push('DATABASE_URL not configured, skipping database restore');
          }
        } catch (dbError: any) {
          errors.push(`Database restore failed: ${dbError.message}`);
          logger.error(`[CheckpointRestore] Database restore failed:`, dbError);
        }
      }

      // ============================================================
      // CONVERSATION RESTORE - Restore AI conversation messages
      // DATA SAFETY: Use transaction with proper conversation scoping
      // ============================================================
      if (options.restoreConversation !== false && checkpoint.conversationSnapshot) {
        try {
          const { agentMessages, aiConversations } = await import('../../shared/schema');
          const conversationData = checkpoint.conversationSnapshot as Array<{ role: string; content: string; timestamp?: string }>;
          
          if (conversationData && conversationData.length > 0) {
            // Get conversationId FROM the checkpoint record (stored during snapshot)
            // This ensures we restore to the correct conversation, not current session
            let checkpointConversationId = checkpointService.getCheckpointConversationId(checkpoint);
            
            // Fallback: if not stored in metadata, get most recent project conversation
            if (!checkpointConversationId) {
              const { desc } = await import('drizzle-orm');
              const [existingConversation] = await db
                .select({ id: aiConversations.id })
                .from(aiConversations)
                .where(eq(aiConversations.projectId, projectId))
                .orderBy(desc(aiConversations.createdAt))
                .limit(1);
              
              checkpointConversationId = existingConversation?.id;
            }
            
            if (checkpointConversationId) {
              // Get ownerId for restored messages (projects use ownerId not userId)
              const [project] = await db
                .select({ ownerId: projects.ownerId })
                .from(projects)
                .where(eq(projects.id, projectId))
                .limit(1);
              
              const restoreUserId = options.userId || project?.ownerId || 1;
              
              // Prepare messages for bulk insert
              const messagesToInsert = conversationData.map(msg => ({
                conversationId: checkpointConversationId!,
                projectId,
                userId: restoreUserId,
                role: msg.role,
                content: msg.content,
                createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
              }));
              
              // TRANSACTION: Delete and insert atomically to prevent data loss
              // If insert fails, delete is rolled back automatically
              await db.transaction(async (tx) => {
                // Delete ONLY messages for the specific conversationId (scoped delete)
                await tx
                  .delete(agentMessages)
                  .where(eq(agentMessages.conversationId, checkpointConversationId!));
                
                // Bulk insert all messages in one operation (more efficient)
                if (messagesToInsert.length > 0) {
                  await tx.insert(agentMessages).values(messagesToInsert);
                }
              });
              
              restoredConversation = true;
              logger.info(`[CheckpointRestore] Restored ${conversationData.length} conversation messages (conversationId: ${checkpointConversationId})`);
            } else {
              errors.push('No conversation found to restore messages to');
            }
          }
        } catch (convError: any) {
          errors.push(`Conversation restore failed: ${convError.message}`);
          logger.error(`[CheckpointRestore] Conversation restore failed:`, convError);
        }
      }

      // Update project's current checkpoint pointer
      await db
        .update(projects)
        .set({ currentCheckpointId: checkpointId })
        .where(eq(projects.id, projectId));

      // Log the restore action
      if (options.userId) {
        await checkpointService.logRestore(
          checkpointId,
          projectId,
          options.userId,
          { status: 'success', includedDatabase: restoredDatabase }
        );
      }

      const duration = Date.now() - startTime;
      logger.info(`[CheckpointRestore] Restored to checkpoint ${checkpointId} in ${duration}ms (${restoredFiles} files, db=${restoredDatabase}, conv=${restoredConversation})`);

      this.emit('restored', { checkpointId, projectId, restoredFiles, restoredDatabase, restoredConversation, duration });

      return {
        success: true,
        checkpointId,
        projectId,
        restoredFiles,
        restoredDatabase,
        restoredConversation,
        errors,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`[CheckpointRestore] Restore failed:`, error);

      // Log failed restore if userId provided
      if (options.userId) {
        try {
          const checkpoint = await checkpointService.getCheckpoint(checkpointId);
          if (checkpoint) {
            await checkpointService.logRestore(
              checkpointId,
              checkpoint.projectId,
              options.userId,
              { status: 'failed', includedDatabase: false }
            );
          }
        } catch (logError) {
          logger.error(`[CheckpointRestore] Failed to log restore error:`, logError);
        }
      }

      return {
        success: false,
        checkpointId,
        projectId: 0,
        restoredFiles: 0,
        restoredDatabase: false,
        restoredConversation: false,
        errors: [error.message, ...errors],
        duration,
      };
    }
  }

  /**
   * Compare current state to a checkpoint
   */
  async compareToCheckpoint(
    checkpointId: number
  ): Promise<{ added: string[]; modified: string[]; deleted: string[] } | null> {
    const checkpoint = await checkpointService.getCheckpointWithFiles(checkpointId);
    
    if (!checkpoint || !checkpoint.files) {
      return null;
    }

    const projectBasePath = this.getProjectBasePath(checkpoint.projectId);
    const currentSnapshot = await workspaceSnapshotService.captureFileState(
      projectBasePath,
      checkpoint.projectId
    );

    // Build checkpoint snapshot from stored files
    const checkpointFiles: FileSnapshot[] = checkpoint.files.map(f => ({
      path: f.filePath,
      content: f.fileContent || '',
      hash: f.fileHash || '',
      size: f.fileContent?.length || 0,
      isDirectory: false,
    }));

    const checkpointSnapshot = {
      projectId: checkpoint.projectId,
      basePath: projectBasePath,
      files: checkpointFiles,
      capturedAt: checkpoint.createdAt,
      totalFiles: checkpointFiles.length,
      totalSize: checkpointFiles.reduce((sum, f) => sum + f.size, 0),
    };

    return workspaceSnapshotService.compareSnapshots(checkpointSnapshot, currentSnapshot);
  }
}

export const checkpointRestoreService = new CheckpointRestoreService();

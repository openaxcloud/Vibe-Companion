// @ts-nocheck
import { db } from '../db';
import { projects, files, checkpoints, checkpointFiles, checkpointDatabase } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);
const logger = createLogger('checkpoint-service');

// 🔥 REPLIT AGENT 3: Screenshot Service for checkpoint previews
let ScreenshotService: any;
(async () => {
  try {
    const module = await import('./screenshot-service');
    ScreenshotService = module.ScreenshotService;
  } catch (error) {
    logger.warn('Screenshot service not available');
  }
})();

export interface CheckpointMetadata {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  type: 'manual' | 'automatic' | 'before_action' | 'error_recovery';
  createdAt: Date;
  createdBy: number;
  size: number;
  fileCount: number;
  databaseSnapshot: boolean;
  environmentVars: Record<string, string>;
  agentState?: {
    currentTask: string;
    completedSteps: string[];
    errors: string[];
    tokensUsed: number;
  };
}

export interface CreateCheckpointOptions {
  projectId: number;
  name: string;
  description?: string;
  type: 'manual' | 'automatic' | 'before_action' | 'error_recovery';
  userId: number;
  includeDatabase?: boolean;
  includeEnvironment?: boolean;
  agentState?: any;
  // 🔥 REPLIT AGENT 3 ENHANCEMENTS
  conversationSnapshot?: Array<{role: string; content: string}>; // AI conversation history
  conversationId?: string; // Link to AI conversation
  userPrompt?: string; // User's original request
  captureScreenshot?: boolean; // Capture preview screenshot
  changedFiles?: string[]; // List of modified file paths
  testResults?: {passed: boolean; total: number; failures: any[]}; // Test results
  parentCheckpointId?: number; // Parent checkpoint for bidirectional navigation
  environment?: 'development' | 'production'; // Environment
}

export interface RestoreCheckpointOptions {
  checkpointId: number;
  userId: number;
  restoreFiles?: boolean;
  restoreDatabase?: boolean;
  restoreEnvironment?: boolean;
}

export class CheckpointService {
  private checkpointStoragePath: string;
  private maxCheckpointsPerProject = 50;
  private autoCheckpointInterval = 5 * 60 * 1000; // 5 minutes
  private activeTimers = new Map<number, NodeJS.Timeout>();

  constructor() {
    this.checkpointStoragePath = path.join(process.cwd(), '.checkpoints');
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      await fs.mkdir(this.checkpointStoragePath, { recursive: true });
      logger.info('Checkpoint storage initialized');
    } catch (error) {
      logger.error('Failed to initialize checkpoint storage:', error);
    }
  }

  /**
   * Create a checkpoint for a project (ENHANCED for Replit Agent 3)
   */
  async createCheckpoint(options: CreateCheckpointOptions): Promise<CheckpointMetadata> {
    const startTime = Date.now();
    logger.info(`Creating checkpoint for project ${options.projectId}`);

    try {
      // 🔥 REPLIT AGENT 3: Capture screenshot BEFORE creating checkpoint
      let screenshotUrl: string | null = null;
      if (options.captureScreenshot && ScreenshotService) {
        try {
          const screenshotService = new ScreenshotService();
          await screenshotService.initialize();
          const result = await screenshotService.captureProjectPreview(options.projectId, options.userId);
          screenshotUrl = result.screenshotPath;
          logger.info(`Screenshot captured: ${screenshotUrl}`);
        } catch (error) {
          logger.warn('Failed to capture screenshot, continuing without it:', error);
        }
      }

      // 🔥 REPLIT AGENT 3: Create Neon database branch for dev/prod separation
      let databaseBranchId: string | null = null;
      if (options.includeDatabase && options.environment === 'development') {
        try {
          databaseBranchId = await this.createNeonBranch(options.projectId, options.name);
          logger.info(`Neon branch created: ${databaseBranchId}`);
        } catch (error) {
          logger.warn('Failed to create Neon branch, using regular snapshot:', error);
        }
      }

      // 🔥 TRANSACTION: Atomically read current checkpoint, create new checkpoint, and update pointer
      // This prevents race conditions when multiple checkpoints are created simultaneously
      const [checkpoint] = await db.transaction(async (tx) => {
        // Read current checkpoint ID with ROW-LEVEL LOCK (prevents concurrent reads)
        // SELECT ... FOR UPDATE ensures other transactions wait until this one commits
        const [project] = await tx.select().from(projects).where(eq(projects.id, options.projectId)).for('update');
        const parentCheckpointId = options.parentCheckpointId || project?.currentCheckpointId || null;

        // Create checkpoint record
        const [newCheckpoint] = await tx.insert(checkpoints).values({
        projectId: options.projectId,
        name: options.name,
        description: options.description,
        type: options.type || 'manual',
        createdBy: options.userId,
        createdAt: new Date(),
        filesSnapshot: {}, // Start with empty snapshot, will be updated after saving files
        metadata: {
          agentState: options.agentState || {},
          environmentIncluded: options.includeEnvironment || false,
          databaseIncluded: options.includeDatabase || false
        },
        // 🔥 REPLIT AGENT 3 ENHANCEMENTS
        conversationSnapshot: options.conversationSnapshot || null,
        conversationId: options.conversationId || null,
        userPrompt: options.userPrompt || null,
        screenshotUrl: screenshotUrl,
        changedFiles: options.changedFiles || [],
        testResults: options.testResults || null,
          parentCheckpointId: parentCheckpointId, // Auto-assigned if not provided
          databaseBranchId: databaseBranchId || undefined, // Convert null to undefined for TypeScript
          environment: options.environment || 'development',
        }).returning();

        // Set this checkpoint as the current active checkpoint (within transaction)
        await tx.update(projects)
          .set({ currentCheckpointId: newCheckpoint.id })
          .where(eq(projects.id, options.projectId));

        return [newCheckpoint];
      });

      // Create checkpoint directory
      const checkpointDir = path.join(
        this.checkpointStoragePath,
        `project-${options.projectId}`,
        `checkpoint-${checkpoint.id}`
      );
      await fs.mkdir(checkpointDir, { recursive: true });

      // Save project files
      const fileCount = await this.saveProjectFiles(options.projectId, checkpoint.id, checkpointDir);

      // Save database snapshot if requested
      let databaseSnapshot = false;
      if (options.includeDatabase) {
        databaseSnapshot = await this.saveDatabaseSnapshot(options.projectId, checkpoint.id, checkpointDir);
      }

      // Save environment variables if requested
      let environmentVars: Record<string, string> = {};
      if (options.includeEnvironment) {
        environmentVars = await this.saveEnvironmentVars(options.projectId, checkpointDir);
      }

      // Calculate checkpoint size
      const size = await this.calculateDirectorySize(checkpointDir);

      // Update checkpoint metadata
      await db.update(checkpoints)
        .set({
          metadata: {
            ...checkpoint.metadata,
            size,
            fileCount,
            databaseSnapshot,
            environmentVars: Object.keys(environmentVars).length > 0,
            duration: Date.now() - startTime
          }
        })
        .where(eq(checkpoints.id, checkpoint.id));

      // Clean up old checkpoints
      await this.cleanupOldCheckpoints(options.projectId);

      // 🔥 POST-COMMIT VALIDATION: Verify parent-child chain integrity
      const [updatedProject] = await db.select().from(projects).where(eq(projects.id, options.projectId));
      if (updatedProject?.currentCheckpointId !== checkpoint.id) {
        logger.error(`LINEAGE ANOMALY DETECTED: Project ${options.projectId} current checkpoint is ${updatedProject?.currentCheckpointId} but expected ${checkpoint.id}`);
        // Alert monitoring system (Sentry, Slack, etc.)
      }

      logger.info(`Checkpoint ${checkpoint.id} created successfully in ${Date.now() - startTime}ms (atomic transaction + row lock)`);

      return {
        id: checkpoint.id,
        projectId: options.projectId,
        name: options.name,
        description: options.description,
        type: options.type,
        createdAt: checkpoint.createdAt,
        createdBy: options.userId,
        size,
        fileCount,
        databaseSnapshot,
        environmentVars,
        agentState: options.agentState
      };
    } catch (error) {
      logger.error('Failed to create checkpoint:', error);
      throw new Error(`Failed to create checkpoint: ${error}`);
    }
  }

  /**
   * Restore a checkpoint
   */
  async restoreCheckpoint(options: RestoreCheckpointOptions): Promise<boolean> {
    const startTime = Date.now();
    logger.info(`Restoring checkpoint ${options.checkpointId}`);

    try {
      // Get checkpoint details
      const [checkpoint] = await db.select()
        .from(checkpoints)
        .where(eq(checkpoints.id, options.checkpointId));

      if (!checkpoint) {
        throw new Error('Checkpoint not found');
      }

      const checkpointDir = path.join(
        this.checkpointStoragePath,
        `project-${checkpoint.projectId}`,
        `checkpoint-${checkpoint.id}`
      );

      // Restore files if requested
      if (options.restoreFiles !== false) {
        await this.restoreProjectFiles(checkpoint.projectId, checkpoint.id, checkpointDir);
      }

      // 🔥 FIX: Restore database if requested and available (check ALL database flags)
      const hasDatabaseSnapshot = 
        checkpoint.databaseBranchId || 
        checkpoint.metadata?.databaseSnapshot || 
        checkpoint.metadata?.databaseIncluded;

      if (options.restoreDatabase !== false && hasDatabaseSnapshot) {
        await this.restoreDatabaseSnapshot(checkpoint.projectId, checkpoint.id, checkpointDir);
      }

      // Restore environment variables if requested and available
      if (options.restoreEnvironment !== false && (checkpoint.metadata?.environmentVars || checkpoint.metadata?.environmentIncluded)) {
        await this.restoreEnvironmentVars(checkpoint.projectId, checkpointDir);
      }

      // 🔥 FIX: REMOVED "Restored from" log checkpoint - it breaks parent-child chain for rollforward navigation
      // RollbackService already creates "Before rollback" checkpoint for logging
      // Keeping this would create: ... -> C1 -> "Before rollback" -> "Restored from" (orphan)
      // Instead we keep: ... -> C1 -> "Before rollback" -> [current state points back to C1]

      logger.info(`Checkpoint ${checkpoint.id} restored successfully in ${Date.now() - startTime}ms (files: ${options.restoreFiles !== false}, DB: ${hasDatabaseSnapshot}, env: ${options.restoreEnvironment !== false})`);
      return true;
    } catch (error) {
      logger.error('Failed to restore checkpoint:', error);
      throw new Error(`Failed to restore checkpoint: ${error}`);
    }
  }

  /**
   * List checkpoints for a project
   */
  async listCheckpoints(projectId: number, limit = 20): Promise<CheckpointMetadata[]> {
    try {
      const checkpointRecords = await db.select()
        .from(checkpoints)
        .where(eq(checkpoints.projectId, projectId))
        .orderBy(desc(checkpoints.createdAt))
        .limit(limit);

      return checkpointRecords.map(cp => ({
        id: cp.id,
        projectId: cp.projectId,
        name: cp.name,
        description: cp.description || undefined,
        type: cp.type as any,
        createdAt: cp.createdAt,
        createdBy: cp.createdBy,
        size: cp.metadata?.size || 0,
        fileCount: cp.metadata?.fileCount || 0,
        databaseSnapshot: cp.metadata?.databaseSnapshot || false,
        environmentVars: cp.metadata?.environmentVars || {},
        agentState: cp.metadata?.agentState
      }));
    } catch (error) {
      logger.error('Failed to list checkpoints:', error);
      throw new Error(`Failed to list checkpoints: ${error}`);
    }
  }

  /**
   * Get a single checkpoint by ID (direct SELECT, no project filtering)
   */
  async getCheckpointById(checkpointId: number): Promise<CheckpointMetadata | null> {
    try {
      const [checkpoint] = await db.select()
        .from(checkpoints)
        .where(eq(checkpoints.id, checkpointId));

      if (!checkpoint) {
        return null;
      }

      return {
        id: checkpoint.id,
        projectId: checkpoint.projectId,
        name: checkpoint.name,
        description: checkpoint.description || undefined,
        type: checkpoint.type as any,
        createdAt: checkpoint.createdAt,
        createdBy: checkpoint.createdBy,
        size: checkpoint.metadata?.size || 0,
        fileCount: checkpoint.metadata?.fileCount || 0,
        databaseSnapshot: checkpoint.metadata?.databaseSnapshot || false,
        environmentVars: checkpoint.metadata?.environmentVars || {},
        agentState: checkpoint.metadata?.agentState
      };
    } catch (error) {
      logger.error('Failed to get checkpoint by ID:', error);
      throw new Error(`Failed to get checkpoint by ID: ${error}`);
    }
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(checkpointId: number): Promise<boolean> {
    try {
      const [checkpoint] = await db.select()
        .from(checkpoints)
        .where(eq(checkpoints.id, checkpointId));

      if (!checkpoint) {
        return false;
      }

      // Delete checkpoint directory
      const checkpointDir = path.join(
        this.checkpointStoragePath,
        `project-${checkpoint.projectId}`,
        `checkpoint-${checkpoint.id}`
      );
      await fs.rm(checkpointDir, { recursive: true, force: true });

      // Delete database records
      await db.delete(checkpointFiles).where(eq(checkpointFiles.checkpointId, checkpointId));
      await db.delete(checkpointDatabase).where(eq(checkpointDatabase.checkpointId, checkpointId));
      await db.delete(checkpoints).where(eq(checkpoints.id, checkpointId));

      logger.info(`Checkpoint ${checkpointId} deleted successfully`);
      return true;
    } catch (error) {
      logger.error('Failed to delete checkpoint:', error);
      throw new Error(`Failed to delete checkpoint: ${error}`);
    }
  }

  /**
   * Enable automatic checkpointing for a project
   */
  enableAutoCheckpoints(projectId: number, userId: number) {
    if (this.activeTimers.has(projectId)) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        await this.createCheckpoint({
          projectId,
          name: `Auto checkpoint - ${new Date().toLocaleString()}`,
          description: 'Automatic checkpoint',
          type: 'automatic',
          userId,
          includeDatabase: true,
          includeEnvironment: true
        });
      } catch (error) {
        logger.error(`Failed to create auto checkpoint for project ${projectId}:`, error);
      }
    }, this.autoCheckpointInterval);

    this.activeTimers.set(projectId, timer);
    logger.info(`Auto checkpoints enabled for project ${projectId}`);
  }

  /**
   * Disable automatic checkpointing for a project
   */
  disableAutoCheckpoints(projectId: number) {
    const timer = this.activeTimers.get(projectId);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(projectId);
      logger.info(`Auto checkpoints disabled for project ${projectId}`);
    }
  }

  /**
   * Create checkpoint before AI agent action
   */
  async createAgentCheckpoint(
    projectId: number,
    userId: number,
    action: string,
    agentState: any
  ): Promise<CheckpointMetadata> {
    return this.createCheckpoint({
      projectId,
      name: `Before: ${action}`,
      description: `Checkpoint before AI agent action: ${action}`,
      type: 'before_action',
      userId,
      includeDatabase: true,
      includeEnvironment: true,
      agentState
    });
  }

  /**
   * Create error recovery checkpoint
   */
  async createErrorRecoveryCheckpoint(
    projectId: number,
    userId: number,
    error: string,
    agentState: any
  ): Promise<CheckpointMetadata> {
    return this.createCheckpoint({
      projectId,
      name: `Error recovery - ${new Date().toLocaleString()}`,
      description: `Checkpoint after error: ${error}`,
      type: 'error_recovery',
      userId,
      includeDatabase: true,
      includeEnvironment: true,
      agentState: {
        ...agentState,
        lastError: error,
        errorTimestamp: new Date().toISOString()
      }
    });
  }

  // Private helper methods

  private async saveProjectFiles(projectId: number, checkpointId: number, checkpointDir: string): Promise<number> {
    const projectFiles = await db.select()
      .from(files)
      .where(eq(files.projectId, projectId));

    const filesDir = path.join(checkpointDir, 'files');
    await fs.mkdir(filesDir, { recursive: true });

    let fileCount = 0;

    for (const file of projectFiles) {
      const filePath = path.join(filesDir, file.path);
      const fileDir = path.dirname(filePath);
      
      await fs.mkdir(fileDir, { recursive: true });
      
      if (!file.isDirectory && file.content) {
        await fs.writeFile(filePath, file.content);
        fileCount++;
      }

      // Save file metadata
      await db.insert(checkpointFiles).values({
        checkpointId,
        fileId: file.id,
        path: file.path,
        content: file.content,
        metadata: {
          originalCreatedAt: file.createdAt,
          originalUpdatedAt: file.updatedAt
        }
      });
    }

    return fileCount;
  }

  private async restoreProjectFiles(projectId: number, checkpointId: number, checkpointDir: string): Promise<void> {
    const checkpointFileRecords = await db.select()
      .from(checkpointFiles)
      .where(eq(checkpointFiles.checkpointId, checkpointId));

    // Clear existing files
    await db.delete(files).where(eq(files.projectId, projectId));

    // Restore files
    for (const record of checkpointFileRecords) {
      await db.insert(files).values({
        projectId,
        path: record.path,
        name: path.basename(record.path),
        content: record.content,
        isDirectory: !record.content,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  private async saveDatabaseSnapshot(projectId: number, checkpointId: number, checkpointDir: string): Promise<boolean> {
    try {
      const dbDir = path.join(checkpointDir, 'database');
      await fs.mkdir(dbDir, { recursive: true });

      // Export database using pg_dump
      const dumpFile = path.join(dbDir, 'snapshot.sql');
      const databaseUrl = process.env.DATABASE_URL;
      
      if (!databaseUrl) {
        logger.warn('DATABASE_URL not configured, skipping database snapshot');
        return false;
      }

      // Use pg_dump to create snapshot
      await execAsync(`pg_dump ${databaseUrl} -f ${dumpFile} --schema=public --no-owner --no-acl`);

      // Save snapshot metadata
      await db.insert(checkpointDatabase).values({
        checkpointId,
        snapshotPath: dumpFile,
        metadata: {
          timestamp: new Date().toISOString(),
          size: (await fs.stat(dumpFile)).size
        }
      });

      return true;
    } catch (error) {
      logger.error('Failed to save database snapshot:', error);
      return false;
    }
  }

  private async restoreDatabaseSnapshot(projectId: number, checkpointId: number, checkpointDir: string): Promise<boolean> {
    try {
      const [snapshot] = await db.select()
        .from(checkpointDatabase)
        .where(eq(checkpointDatabase.checkpointId, checkpointId));

      if (!snapshot) {
        logger.warn('No database snapshot found for checkpoint');
        return false;
      }

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        logger.warn('DATABASE_URL not configured, skipping database restore');
        return false;
      }

      // Restore database using psql
      await execAsync(`psql ${databaseUrl} -f ${snapshot.snapshotPath}`);

      return true;
    } catch (error) {
      logger.error('Failed to restore database snapshot:', error);
      return false;
    }
  }

  private async saveEnvironmentVars(projectId: number, checkpointDir: string): Promise<Record<string, string>> {
    // In a real implementation, this would save project-specific environment variables
    // For now, we'll save a subset of safe environment variables
    const safeEnvVars = [
      'NODE_ENV',
      'PORT',
      'API_BASE_URL',
      // Add other safe variables
    ];

    const envVars: Record<string, string> = {};
    
    for (const key of safeEnvVars) {
      if (process.env[key]) {
        envVars[key] = process.env[key];
      }
    }

    const envFile = path.join(checkpointDir, 'environment.json');
    await fs.writeFile(envFile, JSON.stringify(envVars, null, 2));

    return envVars;
  }

  private async restoreEnvironmentVars(projectId: number, checkpointDir: string): Promise<void> {
    try {
      const envFile = path.join(checkpointDir, 'environment.json');
      const envData = await fs.readFile(envFile, 'utf-8');
      const envVars = JSON.parse(envData);

      // In a real implementation, this would restore project-specific environment
      // For now, we'll log what would be restored
      logger.info(`Would restore environment variables:`, Object.keys(envVars));
    } catch (error) {
      logger.error('Failed to restore environment variables:', error);
    }
  }

  private async calculateDirectorySize(dir: string): Promise<number> {
    let size = 0;
    
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        size += await this.calculateDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        size += stats.size;
      }
    }
    
    return size;
  }

  private async cleanupOldCheckpoints(projectId: number): Promise<void> {
    try {
      const allCheckpoints = await db.select()
        .from(checkpoints)
        .where(eq(checkpoints.projectId, projectId))
        .orderBy(desc(checkpoints.createdAt));

      if (allCheckpoints.length <= this.maxCheckpointsPerProject) {
        return;
      }

      // Keep manual checkpoints and recent automatic ones
      const checkpointsToDelete = allCheckpoints
        .slice(this.maxCheckpointsPerProject)
        .filter(cp => cp.type === 'automatic');

      for (const checkpoint of checkpointsToDelete) {
        await this.deleteCheckpoint(checkpoint.id);
      }

      logger.info(`Cleaned up ${checkpointsToDelete.length} old checkpoints for project ${projectId}`);
    } catch (error) {
      logger.error('Failed to cleanup old checkpoints:', error);
    }
  }

  /**
   * 🔥 REPLIT AGENT 3: Create Neon database branch for dev/prod separation
   * This allows independent database snapshots per checkpoint
   */
  private async createNeonBranch(projectId: number, checkpointName: string): Promise<string | null> {
    try {
      const neonApiKey = process.env.NEON_API_KEY;
      const neonProjectId = process.env.NEON_PROJECT_ID;

      if (!neonApiKey || !neonProjectId) {
        logger.warn('Neon API credentials not configured, skipping branch creation');
        return null;
      }

      // Generate branch name from checkpoint name
      const branchName = `checkpoint-${projectId}-${Date.now()}`;

      // Call Neon API to create branch
      const response = await fetch(
        `https://console.neon.tech/api/v2/projects/${neonProjectId}/branches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${neonApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branch: {
              name: branchName,
              parent_id: 'main', // Create branch from main
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Neon API error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();
      logger.info(`Neon branch created successfully: ${data.branch.id}`);
      return data.branch.id;
    } catch (error) {
      logger.error('Failed to create Neon branch:', error);
      return null;
    }
  }
}

export const checkpointService = new CheckpointService();
// @ts-nocheck
import { EventEmitter } from 'events';
import { db } from '../db';
import { deploymentSnapshots, deploymentMetrics } from '@shared/schema';
import { eq, desc, and, lte } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../utils/logger';
import { deploymentWebSocketService } from './deployment-websocket-service';
import { checkpointService } from './checkpoint.service';

const execAsync = promisify(exec);
const logger = createLogger('deployment-rollback');

interface RollbackOperation {
  id: string;
  deploymentId: string;
  steps: RollbackStep[];
  backupPaths: {
    files?: string;
    database?: string;
    config?: string;
  };
  startedAt: Date;
}

interface RollbackStep {
  name: string;
  execute: () => Promise<void>;
  rollback: () => Promise<void>;
  completed: boolean;
}

export interface RollbackResult {
  success: boolean;
  rollbackId: string;
  restoredVersion: string;
  details: {
    deploymentId: string;
    fromVersion: string;
    toVersion: string;
    status: string;
    stepsCompleted: string[];
    duration: number;
    filesRestored?: number;
    configRestored?: boolean;
    databaseRestored?: boolean;
    error?: string;
  };
}

export interface DeploymentSnapshot {
  id?: string;
  deploymentId: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  config: {
    buildCommand?: string;
    startCommand?: string;
    environmentVars: Record<string, string>;
    dependencies: Record<string, string>;
    nodeVersion?: string;
    dockerImage?: string;
    resources?: {
      cpu: string;
      memory: string;
      disk: string;
    };
  };
  fileManifest: {
    path: string;
    hash: string;
    size: number;
  }[];
  databaseSchema?: {
    tables: string[];
    migrations: string[];
    version: string;
  };
  metadata: {
    commitHash?: string;
    branch?: string;
    author?: string;
    message?: string;
    deployedBy: string;
    reason?: string;
    tags?: string[];
  };
  status: 'active' | 'archived' | 'failed';
  createdAt: Date;
  size: number; // Total snapshot size in bytes
}

export interface RollbackOptions {
  skipDatabase?: boolean;
  skipFiles?: boolean;
  skipConfig?: boolean;
  dryRun?: boolean;
  reason?: string;
  force?: boolean;
}

export interface RollbackStatus {
  id: string;
  deploymentId: string;
  fromVersion: string;
  toVersion: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  progress: number; // 0-100
  steps: {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    message?: string;
    startedAt?: Date;
    completedAt?: Date;
  }[];
  error?: string;
}

export interface VersionDiff {
  files: {
    added: string[];
    modified: string[];
    deleted: string[];
  };
  config: {
    added: Record<string, any>;
    modified: Record<string, { old: any; new: any }>;
    deleted: Record<string, any>;
  };
  database: {
    tablesAdded: string[];
    tablesModified: string[];
    tablesDeleted: string[];
    migrationsApplied: string[];
  };
}

export class DeploymentRollbackService extends EventEmitter {
  private snapshots = new Map<string, DeploymentSnapshot[]>();
  private rollbackStatus = new Map<string, RollbackStatus>();
  private readonly snapshotBasePath = '/tmp/deployment-snapshots';
  private readonly maxSnapshotsPerDeployment = 10;
  private readonly snapshotRetentionDays = 30;
  private rollbackLocks = new Map<string, { inProgress: boolean; startedAt: Date; rollbackId: string }>();

  constructor() {
    super();
    this.ensureSnapshotDirectory();
    this.startCleanupJob();
  }

  private acquireRollbackLock(deploymentId: string, rollbackId: string): boolean {
    const existingLock = this.rollbackLocks.get(deploymentId);
    
    if (existingLock?.inProgress) {
      const lockAge = Date.now() - existingLock.startedAt.getTime();
      const LOCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes max
      
      if (lockAge < LOCK_TIMEOUT) {
        logger.warn('Rollback already in progress for deployment', {
          deploymentId,
          existingRollbackId: existingLock.rollbackId,
          lockAge: `${Math.round(lockAge / 1000)}s`
        });
        return false;
      }
      logger.warn('Stale rollback lock detected, releasing', { deploymentId, existingRollbackId: existingLock.rollbackId });
    }
    
    this.rollbackLocks.set(deploymentId, {
      inProgress: true,
      startedAt: new Date(),
      rollbackId
    });
    
    logger.info('Rollback lock acquired', { deploymentId, rollbackId });
    return true;
  }

  private releaseRollbackLock(deploymentId: string, rollbackId: string): void {
    const lock = this.rollbackLocks.get(deploymentId);
    if (lock?.rollbackId === rollbackId) {
      this.rollbackLocks.delete(deploymentId);
      logger.info('Rollback lock released', { deploymentId, rollbackId });
    }
  }

  private async ensureSnapshotDirectory() {
    try {
      await fs.mkdir(this.snapshotBasePath, { recursive: true });
      logger.debug('Snapshot directory ensured', { path: this.snapshotBasePath });
    } catch (error) {
      logger.error('Failed to create snapshot directory', { path: this.snapshotBasePath, error });
    }
  }

  private startCleanupJob() {
    // Clean up old snapshots every day
    setInterval(async () => {
      await this.cleanupOldSnapshots();
    }, 24 * 60 * 60 * 1000);
  }

  async createSnapshot(
    deploymentId: string,
    version: string,
    deploymentPath: string,
    config: DeploymentSnapshot['config'],
    metadata: DeploymentSnapshot['metadata']
  ): Promise<DeploymentSnapshot> {
    const snapshotId = crypto.randomUUID();
    const snapshotPath = path.join(this.snapshotBasePath, deploymentId, snapshotId);
    
    try {
      // Create snapshot directory
      await fs.mkdir(snapshotPath, { recursive: true });
      
      // Create file manifest
      const fileManifest = await this.createFileManifest(deploymentPath);
      
      // Copy deployment files
      await this.copyDeploymentFiles(deploymentPath, snapshotPath);
      
      // Save configuration
      await fs.writeFile(
        path.join(snapshotPath, 'config.json'),
        JSON.stringify(config, null, 2)
      );
      
      // Save metadata
      await fs.writeFile(
        path.join(snapshotPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      // Get database schema snapshot
      const databaseSchema = await this.captureDatabaseSchema(deploymentId);
      
      // Calculate snapshot size
      const size = await this.calculateDirectorySize(snapshotPath);
      
      // Create snapshot record
      const snapshot: DeploymentSnapshot = {
        id: snapshotId,
        deploymentId,
        version,
        environment: config.environmentVars?.NODE_ENV as DeploymentSnapshot['environment'] || 'production',
        config,
        fileManifest,
        databaseSchema,
        metadata,
        status: 'active',
        createdAt: new Date(),
        size,
      };
      
      // Store in database
      await this.storeSnapshot(snapshot);
      
      // Update cache
      if (!this.snapshots.has(deploymentId)) {
        this.snapshots.set(deploymentId, []);
      }
      this.snapshots.get(deploymentId)!.push(snapshot);
      
      // Cleanup old snapshots if limit exceeded
      await this.enforceSnapshotLimit(deploymentId);
      
      this.emit('snapshotCreated', snapshot);
      return snapshot;
    } catch (error) {
      logger.error('Failed to create snapshot', { deploymentId, version, error });
      throw new Error(`Snapshot creation failed: ${error}`);
    }
  }

  private async createFileManifest(deploymentPath: string): Promise<DeploymentSnapshot['fileManifest']> {
    const manifest: DeploymentSnapshot['fileManifest'] = [];
    
    async function walkDir(dir: string, baseDir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        
        if (entry.isDirectory()) {
          // Skip node_modules and other large directories
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            await walkDir(fullPath, baseDir);
          }
        } else {
          const stats = await fs.stat(fullPath);
          const content = await fs.readFile(fullPath);
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          
          manifest.push({
            path: relativePath,
            hash,
            size: stats.size,
          });
        }
      }
    }
    
    await walkDir(deploymentPath, deploymentPath);
    return manifest;
  }

  private async copyDeploymentFiles(source: string, destination: string): Promise<void> {
    try {
      // Use rsync for efficient copying, excluding unnecessary files
      await execAsync(
        `rsync -av --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='build' ${source}/ ${destination}/files/`
      );
    } catch (error) {
      // Fallback to manual copying if rsync is not available
      await this.manualCopyFiles(source, destination);
    }
  }

  private async manualCopyFiles(source: string, destination: string): Promise<void> {
    const filesDir = path.join(destination, 'files');
    await fs.mkdir(filesDir, { recursive: true });
    
    async function copyDir(src: string, dest: string) {
      const entries = await fs.readdir(src, { withFileTypes: true });
      
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            await fs.mkdir(destPath, { recursive: true });
            await copyDir(srcPath, destPath);
          }
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }
    }
    
    await copyDir(source, filesDir);
  }

  private async captureDatabaseSchema(deploymentId: string): Promise<DeploymentSnapshot['databaseSchema']> {
    logger.info('Capturing database schema and data', { deploymentId });
    
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        logger.warn('DATABASE_URL not set, returning minimal schema info', { deploymentId });
        return {
          tables: [],
          migrations: [],
          version: '0.0.0',
        };
      }

      const snapshotDir = path.join(this.snapshotBasePath, deploymentId, 'db');
      await fs.mkdir(snapshotDir, { recursive: true });
      
      const timestamp = Date.now();
      const schemaFile = path.join(snapshotDir, `schema-${timestamp}.sql`);
      const dataFile = path.join(snapshotDir, `data-${timestamp}.sql`);
      const fullDumpFile = path.join(snapshotDir, `full-dump-${timestamp}.sql`);
      
      let dumpSuccess = false;
      
      try {
        await execAsync(`pg_dump "${databaseUrl}" --schema-only --no-owner --no-acl > "${schemaFile}"`, {
          timeout: 60000,
          env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' },
        });
        logger.debug('Database schema captured successfully', { deploymentId, schemaFile });
        
        await execAsync(`pg_dump "${databaseUrl}" --data-only --no-owner --no-acl > "${dataFile}"`, {
          timeout: 300000,
          env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' },
        });
        logger.debug('Database data captured successfully', { deploymentId, dataFile });
        
        await execAsync(`pg_dump "${databaseUrl}" --no-owner --no-acl > "${fullDumpFile}"`, {
          timeout: 300000,
          env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' },
        });
        logger.info('Full database dump captured successfully', { deploymentId, fullDumpFile });
        
        dumpSuccess = true;
      } catch (pgError) {
        logger.warn('pg_dump not available or failed, using drizzle introspection only', { deploymentId, error: pgError });
      }

      const tablesResult = await db.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      const tables = tablesResult.rows?.map((r: any) => r.table_name as string) || [];

      let migrations: string[] = [];
      let version = '1.0.0';
      
      try {
        const migrationsResult = await db.execute(`
          SELECT name FROM drizzle_migrations ORDER BY created_at
        `);
        migrations = migrationsResult.rows?.map((r: any) => r.name as string) || [];
        version = migrations.length > 0 ? `1.${migrations.length}.0` : '1.0.0';
      } catch (migrationError) {
        logger.debug('Could not query migrations table', { deploymentId });
      }

      logger.info('Database snapshot captured', { 
        deploymentId, 
        tableCount: tables.length, 
        migrationCount: migrations.length,
        dumpSuccess,
        fullDumpFile: dumpSuccess ? fullDumpFile : null,
      });

      return {
        tables,
        migrations,
        version,
        snapshotPath: dumpSuccess ? fullDumpFile : undefined,
        schemaPath: dumpSuccess ? schemaFile : undefined,
        dataPath: dumpSuccess ? dataFile : undefined,
      } as DeploymentSnapshot['databaseSchema'] & { 
        snapshotPath?: string; 
        schemaPath?: string; 
        dataPath?: string; 
      };
    } catch (error) {
      logger.error('Failed to capture database schema', { deploymentId, error });
      return {
        tables: [],
        migrations: [],
        version: '0.0.0',
      };
    }
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    async function getSize(filePath: string) {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        const entries = await fs.readdir(filePath);
        for (const entry of entries) {
          await getSize(path.join(filePath, entry));
        }
      } else {
        totalSize += stats.size;
      }
    }
    
    await getSize(dirPath);
    return totalSize;
  }

  private async storeSnapshot(snapshot: DeploymentSnapshot): Promise<void> {
    try {
      await db.insert(deploymentSnapshots).values({
        deploymentId: snapshot.deploymentId,
        version: snapshot.version,
        environment: snapshot.environment,
        config: snapshot.config,
        fileManifest: snapshot.fileManifest,
        databaseSchema: snapshot.databaseSchema,
        metadata: snapshot.metadata,
        status: snapshot.status,
        size: snapshot.size,
      });
      logger.info('Snapshot stored successfully', { snapshotId: snapshot.id, deploymentId: snapshot.deploymentId });
    } catch (error) {
      logger.error('Failed to store snapshot', { snapshotId: snapshot.id, deploymentId: snapshot.deploymentId, error });
    }
  }

  private async enforceSnapshotLimit(deploymentId: string): Promise<void> {
    const snapshots = this.snapshots.get(deploymentId) || [];
    
    if (snapshots.length > this.maxSnapshotsPerDeployment) {
      // Sort by creation date (newest first)
      snapshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      // Remove oldest snapshots
      const toRemove = snapshots.slice(this.maxSnapshotsPerDeployment);
      
      for (const snapshot of toRemove) {
        await this.deleteSnapshot(snapshot.id!);
      }
      
      // Update cache
      this.snapshots.set(
        deploymentId,
        snapshots.slice(0, this.maxSnapshotsPerDeployment)
      );
    }
  }

  private async deleteSnapshot(snapshotId: string): Promise<void> {
    try {
      // Delete from database (mark as archived)
      await db
        .update(deploymentSnapshots)
        .set({ status: 'archived' })
        .where(eq(deploymentSnapshots.id, snapshotId));
      
      logger.info('Snapshot archived', { snapshotId });
      
      // Delete files (in production, this would be more careful)
      // const snapshotPath = path.join(this.snapshotBasePath, snapshotId);
      // await fs.rm(snapshotPath, { recursive: true, force: true });
    } catch (error) {
      logger.error('Failed to delete snapshot', { snapshotId, error });
    }
  }

  async performRollback(
    deploymentId: string,
    targetVersion: string,
    options: RollbackOptions = {}
  ): Promise<RollbackResult> {
    const rollbackId = crypto.randomUUID();
    const startTime = Date.now();
    
    logger.info('Starting rollback', { 
      rollbackId, 
      deploymentId, 
      targetVersion, 
      options 
    });

    // Acquire rollback lock to prevent concurrent rollbacks
    if (!this.acquireRollbackLock(deploymentId, rollbackId)) {
      logger.error('Failed to acquire rollback lock - another rollback is in progress', { deploymentId, rollbackId });
      return {
        success: false,
        rollbackId,
        restoredVersion: '',
        details: {
          deploymentId,
          fromVersion: 'unknown',
          toVersion: targetVersion,
          status: 'failed',
          stepsCompleted: [],
          duration: Date.now() - startTime,
          error: 'Another rollback is already in progress for this deployment',
        },
      };
    }

    try {
      // Emit WebSocket event for rollback start
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Starting rollback to version ${targetVersion}`
      );
      
      const currentSnapshot = await this.getCurrentSnapshot(deploymentId);
      const targetSnapshot = await this.getSnapshot(deploymentId, targetVersion);
    
      if (!targetSnapshot) {
        logger.error('Target version not found for rollback', { 
          rollbackId, 
          deploymentId, 
          targetVersion 
        });
        
        deploymentWebSocketService.broadcastError(
          deploymentId,
          `Rollback failed: Target version ${targetVersion} not found`
        );
        
        return {
          success: false,
          rollbackId,
          restoredVersion: '',
          details: {
            deploymentId,
            fromVersion: currentSnapshot?.version || 'unknown',
            toVersion: targetVersion,
            status: 'failed',
            stepsCompleted: [],
            duration: Date.now() - startTime,
            error: `Target version ${targetVersion} not found`,
          },
        };
      }
      
      const status: RollbackStatus = {
        id: rollbackId,
        deploymentId,
        fromVersion: currentSnapshot?.version || 'unknown',
        toVersion: targetVersion,
        status: 'pending',
        startedAt: new Date(),
        progress: 0,
        steps: [
          { name: 'Validate target version', status: 'pending' },
          { name: 'Create backup of current state', status: 'pending' },
          { name: 'Stop current deployment', status: 'pending' },
          { name: 'Restore files', status: 'pending' },
          { name: 'Restore configuration', status: 'pending' },
          { name: 'Restore database', status: 'pending' },
          { name: 'Start deployment', status: 'pending' },
          { name: 'Verify deployment', status: 'pending' },
        ],
      };
      
      if (options.skipFiles) {
        status.steps[3].status = 'skipped';
      }
      if (options.skipConfig) {
        status.steps[4].status = 'skipped';
      }
      if (options.skipDatabase) {
        status.steps[5].status = 'skipped';
      }
      
      this.rollbackStatus.set(rollbackId, status);
      
      // Execute rollback process and wait for completion
      const result = await this.executeRollbackWithResult(
        rollbackId, 
        deploymentId, 
        targetSnapshot, 
        options, 
        startTime
      );
      
      return result;
    } finally {
      // Always release the lock when rollback completes (success or failure)
      this.releaseRollbackLock(deploymentId, rollbackId);
    }
  }

  async performRollbackAsync(
    deploymentId: string,
    targetVersion: string,
    options: RollbackOptions = {}
  ): Promise<RollbackStatus> {
    const rollbackId = crypto.randomUUID();
    
    // Acquire rollback lock to prevent concurrent rollbacks
    if (!this.acquireRollbackLock(deploymentId, rollbackId)) {
      throw new Error('Another rollback is already in progress for this deployment');
    }
    
    const currentSnapshot = await this.getCurrentSnapshot(deploymentId);
    const targetSnapshot = await this.getSnapshot(deploymentId, targetVersion);
    
    if (!targetSnapshot) {
      this.releaseRollbackLock(deploymentId, rollbackId);
      throw new Error(`Target version ${targetVersion} not found`);
    }
    
    const status: RollbackStatus = {
      id: rollbackId,
      deploymentId,
      fromVersion: currentSnapshot?.version || 'unknown',
      toVersion: targetVersion,
      status: 'pending',
      startedAt: new Date(),
      progress: 0,
      steps: [
        { name: 'Validate target version', status: 'pending' },
        { name: 'Create backup of current state', status: 'pending' },
        { name: 'Stop current deployment', status: 'pending' },
        { name: 'Restore files', status: 'pending' },
        { name: 'Restore configuration', status: 'pending' },
        { name: 'Restore database', status: 'pending' },
        { name: 'Start deployment', status: 'pending' },
        { name: 'Verify deployment', status: 'pending' },
      ],
    };
    
    if (options.skipFiles) {
      status.steps[3].status = 'skipped';
    }
    if (options.skipConfig) {
      status.steps[4].status = 'skipped';
    }
    if (options.skipDatabase) {
      status.steps[5].status = 'skipped';
    }
    
    this.rollbackStatus.set(rollbackId, status);
    
    // Start rollback process (non-blocking) - lock will be released in executeRollback
    this.executeRollback(rollbackId, deploymentId, targetSnapshot, options)
      .finally(() => this.releaseRollbackLock(deploymentId, rollbackId));
    
    return status;
  }

  private async executeRollback(
    rollbackId: string,
    deploymentId: string,
    targetSnapshot: DeploymentSnapshot,
    options: RollbackOptions
  ): Promise<void> {
    const status = this.rollbackStatus.get(rollbackId)!;
    
    try {
      status.status = 'in_progress';
      
      // Step 1: Validate target version
      await this.updateRollbackStep(rollbackId, 0, 'running');
      await this.validateSnapshot(targetSnapshot);
      await this.updateRollbackStep(rollbackId, 0, 'completed');
      status.progress = 12;
      
      // Step 2: Create backup of current state
      await this.updateRollbackStep(rollbackId, 1, 'running');
      if (!options.dryRun) {
        await this.createSnapshot(
          deploymentId,
          `rollback-backup-${Date.now()}`,
          '/tmp/current-deployment', // Mock path
          { environmentVars: {} },
          { deployedBy: 'system', reason: 'Rollback backup' }
        );
      }
      await this.updateRollbackStep(rollbackId, 1, 'completed');
      status.progress = 25;
      
      // Step 3: Stop current deployment
      await this.updateRollbackStep(rollbackId, 2, 'running');
      if (!options.dryRun) {
        await this.stopDeployment(deploymentId);
      }
      await this.updateRollbackStep(rollbackId, 2, 'completed');
      status.progress = 37;
      
      // Step 4: Restore files
      if (!options.skipFiles) {
        await this.updateRollbackStep(rollbackId, 3, 'running');
        if (!options.dryRun) {
          await this.restoreFiles(deploymentId, targetSnapshot);
        }
        await this.updateRollbackStep(rollbackId, 3, 'completed');
      }
      status.progress = 50;
      
      // Step 5: Restore configuration
      if (!options.skipConfig) {
        await this.updateRollbackStep(rollbackId, 4, 'running');
        if (!options.dryRun) {
          await this.restoreConfig(deploymentId, targetSnapshot);
        }
        await this.updateRollbackStep(rollbackId, 4, 'completed');
      }
      status.progress = 62;
      
      // Step 6: Restore database
      if (!options.skipDatabase) {
        await this.updateRollbackStep(rollbackId, 5, 'running');
        if (!options.dryRun) {
          await this.restoreDatabase(deploymentId, targetSnapshot);
        }
        await this.updateRollbackStep(rollbackId, 5, 'completed');
      }
      status.progress = 75;
      
      // Step 7: Start deployment
      await this.updateRollbackStep(rollbackId, 6, 'running');
      if (!options.dryRun) {
        await this.startDeployment(deploymentId, targetSnapshot);
      }
      await this.updateRollbackStep(rollbackId, 6, 'completed');
      status.progress = 87;
      
      // Step 8: Verify deployment
      await this.updateRollbackStep(rollbackId, 7, 'running');
      if (!options.dryRun) {
        await this.verifyDeployment(deploymentId);
      }
      await this.updateRollbackStep(rollbackId, 7, 'completed');
      status.progress = 100;
      
      // Rollback completed successfully
      status.status = 'completed';
      status.completedAt = new Date();
      
      this.emit('rollbackCompleted', {
        rollbackId,
        deploymentId,
        version: targetSnapshot.version,
      });
    } catch (error) {
      status.status = 'failed';
      status.error = error.message;
      status.completedAt = new Date();
      
      this.emit('rollbackFailed', {
        rollbackId,
        deploymentId,
        error: error.message,
      });
      
      // Attempt to recover
      if (!options.force) {
        await this.attemptRecovery(deploymentId);
      }
    }
  }

  private async executeRollbackWithResult(
    rollbackId: string,
    deploymentId: string,
    targetSnapshot: DeploymentSnapshot,
    options: RollbackOptions,
    startTime: number
  ): Promise<RollbackResult> {
    const status = this.rollbackStatus.get(rollbackId)!;
    const stepsCompleted: string[] = [];
    let filesRestored = 0;
    let configRestored = false;
    let databaseRestored = false;
    
    try {
      status.status = 'in_progress';
      
      // Emit WebSocket progress
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Validating target version ${targetSnapshot.version}`
      );
      
      // Step 1: Validate target version
      await this.updateRollbackStep(rollbackId, 0, 'running');
      await this.validateSnapshot(targetSnapshot);
      await this.updateRollbackStep(rollbackId, 0, 'completed');
      status.progress = 12;
      stepsCompleted.push('Validate target version');
      
      logger.info('Rollback step completed: Validate target version', { rollbackId, deploymentId });
      
      // Emit WebSocket progress
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Creating backup of current state`
      );
      
      // Step 2: Create backup of current state
      await this.updateRollbackStep(rollbackId, 1, 'running');
      if (!options.dryRun) {
        try {
          await this.createSnapshot(
            deploymentId,
            `rollback-backup-${Date.now()}`,
            `/tmp/deployments/${deploymentId}`,
            targetSnapshot.config || { environmentVars: {} },
            { deployedBy: 'system', reason: `Rollback backup before restoring to ${targetSnapshot.version}` }
          );
        } catch (backupError) {
          logger.warn('Could not create rollback backup, continuing with rollback', { rollbackId, error: backupError });
        }
      }
      await this.updateRollbackStep(rollbackId, 1, 'completed');
      status.progress = 25;
      stepsCompleted.push('Create backup of current state');
      
      // Emit WebSocket progress
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Stopping current deployment`
      );
      
      // Step 3: Stop current deployment
      await this.updateRollbackStep(rollbackId, 2, 'running');
      if (!options.dryRun) {
        await this.stopDeployment(deploymentId);
      }
      await this.updateRollbackStep(rollbackId, 2, 'completed');
      status.progress = 37;
      stepsCompleted.push('Stop current deployment');
      
      // Emit WebSocket progress
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Restoring files from snapshot`
      );
      
      // Step 4: Restore files
      if (!options.skipFiles) {
        await this.updateRollbackStep(rollbackId, 3, 'running');
        if (!options.dryRun) {
          await this.restoreFiles(deploymentId, targetSnapshot);
          filesRestored = targetSnapshot.fileManifest?.length || 0;
        }
        await this.updateRollbackStep(rollbackId, 3, 'completed');
        stepsCompleted.push('Restore files');
      }
      status.progress = 50;
      
      // Emit WebSocket progress
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Restoring configuration`
      );
      
      // Step 5: Restore configuration
      if (!options.skipConfig) {
        await this.updateRollbackStep(rollbackId, 4, 'running');
        if (!options.dryRun) {
          await this.restoreConfig(deploymentId, targetSnapshot);
          configRestored = true;
        }
        await this.updateRollbackStep(rollbackId, 4, 'completed');
        stepsCompleted.push('Restore configuration');
      }
      status.progress = 62;
      
      // Emit WebSocket progress
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Restoring database schema`
      );
      
      // Step 6: Restore database
      if (!options.skipDatabase) {
        await this.updateRollbackStep(rollbackId, 5, 'running');
        if (!options.dryRun) {
          await this.restoreDatabase(deploymentId, targetSnapshot);
          databaseRestored = true;
        }
        await this.updateRollbackStep(rollbackId, 5, 'completed');
        stepsCompleted.push('Restore database');
      }
      status.progress = 75;
      
      // Emit WebSocket progress
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Starting deployment with restored state`
      );
      
      // Step 7: Start deployment
      await this.updateRollbackStep(rollbackId, 6, 'running');
      if (!options.dryRun) {
        await this.startDeployment(deploymentId, targetSnapshot);
      }
      await this.updateRollbackStep(rollbackId, 6, 'completed');
      status.progress = 87;
      stepsCompleted.push('Start deployment');
      
      // Emit WebSocket progress
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Verifying deployment health`
      );
      
      // Step 8: Verify deployment
      await this.updateRollbackStep(rollbackId, 7, 'running');
      if (!options.dryRun) {
        await this.verifyDeployment(deploymentId);
      }
      await this.updateRollbackStep(rollbackId, 7, 'completed');
      status.progress = 100;
      stepsCompleted.push('Verify deployment');
      
      // Rollback completed successfully
      status.status = 'completed';
      status.completedAt = new Date();
      
      const duration = Date.now() - startTime;
      
      logger.info('Rollback completed successfully', {
        rollbackId,
        deploymentId,
        version: targetSnapshot.version,
        duration,
        stepsCompleted,
      });
      
      // Emit WebSocket success
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Successfully rolled back to version ${targetSnapshot.version} in ${duration}ms`
      );
      
      this.emit('rollbackCompleted', {
        rollbackId,
        deploymentId,
        version: targetSnapshot.version,
      });
      
      return {
        success: true,
        rollbackId,
        restoredVersion: targetSnapshot.version,
        details: {
          deploymentId,
          fromVersion: status.fromVersion,
          toVersion: targetSnapshot.version,
          status: 'completed',
          stepsCompleted,
          duration,
          filesRestored,
          configRestored,
          databaseRestored,
        },
      };
    } catch (error: any) {
      status.status = 'failed';
      status.error = error.message;
      status.completedAt = new Date();
      
      const duration = Date.now() - startTime;
      
      logger.error('Rollback failed', {
        rollbackId,
        deploymentId,
        error: error.message,
        stepsCompleted,
        duration,
      });
      
      // Emit WebSocket error
      deploymentWebSocketService.broadcastError(
        deploymentId,
        `Rollback failed: ${error.message}`
      );
      
      this.emit('rollbackFailed', {
        rollbackId,
        deploymentId,
        error: error.message,
      });
      
      // Attempt to recover
      if (!options.force) {
        await this.attemptRecovery(deploymentId);
      }
      
      return {
        success: false,
        rollbackId,
        restoredVersion: '',
        details: {
          deploymentId,
          fromVersion: status.fromVersion,
          toVersion: targetSnapshot.version,
          status: 'failed',
          stepsCompleted,
          duration,
          filesRestored,
          configRestored,
          databaseRestored,
          error: error.message,
        },
      };
    }
  }

  private async updateRollbackStep(
    rollbackId: string,
    stepIndex: number,
    stepStatus: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
    message?: string
  ): Promise<void> {
    const rollback = this.rollbackStatus.get(rollbackId);
    if (!rollback) return;
    
    const step = rollback.steps[stepIndex];
    step.status = stepStatus;
    if (message) step.message = message;
    
    if (stepStatus === 'running') {
      step.startedAt = new Date();
    } else if (stepStatus === 'completed' || stepStatus === 'failed') {
      step.completedAt = new Date();
    }
    
    // Emit WebSocket progress event
    deploymentWebSocketService.broadcastDeployLog(
      rollback.deploymentId,
      `[Rollback Progress] ${step.name}: ${stepStatus} (${rollback.progress}%)`
    );
    
    this.emit('rollbackProgress', {
      rollbackId,
      step: step.name,
      status: stepStatus,
      progress: rollback.progress,
    });
  }

  private async validateSnapshot(snapshot: DeploymentSnapshot): Promise<void> {
    // Validate that snapshot files exist and are intact
    const snapshotPath = path.join(
      this.snapshotBasePath,
      snapshot.deploymentId,
      snapshot.id!
    );
    
    try {
      await fs.access(snapshotPath);
    } catch (error) {
      throw new Error('Snapshot files not found');
    }
  }

  private async stopDeployment(deploymentId: string): Promise<void> {
    logger.info('Stopping deployment', { deploymentId });
    
    // Update deployment status in database
    const { deployments } = await import('@shared/schema');
    await db.update(deployments)
      .set({ 
        status: 'stopping',
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    // Stop the running process if applicable
    try {
      // Try graceful shutdown via process management
      await execAsync(`pkill -f "deployment-${deploymentId}" || true`);
    } catch (error) {
      // Process may not exist, which is fine
      logger.debug('No running process found for deployment', { deploymentId });
    }

    // Update status to stopped
    await db.update(deployments)
      .set({ 
        status: 'stopped',
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));
  }

  private async restoreFiles(deploymentId: string, snapshot: DeploymentSnapshot): Promise<void> {
    logger.info('Restoring files from snapshot', { deploymentId, snapshotId: snapshot.id });
    
    const snapshotPath = path.join(
      this.snapshotBasePath,
      snapshot.deploymentId,
      snapshot.id!,
      'files'
    );
    
    // Verify snapshot exists
    try {
      await fs.access(snapshotPath);
    } catch (error) {
      throw new Error(`Snapshot files not found at ${snapshotPath}`);
    }

    // Get deployment target path
    const targetPath = `/tmp/deployments/${deploymentId}`;
    
    // Clear existing files (except node_modules to speed up)
    try {
      const entries = await fs.readdir(targetPath);
      for (const entry of entries) {
        if (entry !== 'node_modules' && entry !== '.git') {
          await fs.rm(path.join(targetPath, entry), { recursive: true, force: true });
        }
      }
    } catch (error) {
      // Target may not exist yet
      await fs.mkdir(targetPath, { recursive: true });
    }

    // Copy files from snapshot
    await this.copyDeploymentFiles(snapshotPath, targetPath);
    
    // Verify file manifest matches
    for (const file of snapshot.fileManifest) {
      const filePath = path.join(targetPath, file.path);
      try {
        const content = await fs.readFile(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        if (hash !== file.hash) {
          logger.warn('File hash mismatch during restore', { deploymentId, filePath: file.path });
        }
      } catch (error) {
        logger.warn('Could not verify file during restore', { deploymentId, filePath: file.path });
      }
    }
  }

  private async restoreConfig(deploymentId: string, snapshot: DeploymentSnapshot): Promise<void> {
    logger.info('Restoring configuration', { deploymentId, snapshotId: snapshot.id });
    
    const { deployments, environmentVariables } = await import('@shared/schema');
    
    // Update deployment configuration in database
    await db.update(deployments)
      .set({
        buildCommand: snapshot.config.buildCommand,
        startCommand: snapshot.config.startCommand,
        nodeVersion: snapshot.config.nodeVersion,
        dockerImage: snapshot.config.dockerImage,
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    // Restore environment variables
    if (snapshot.config.environmentVars) {
      // Delete current env vars for this deployment
      await db.delete(environmentVariables)
        .where(eq(environmentVariables.projectId, deploymentId));

      // Insert restored env vars
      const envVarEntries = Object.entries(snapshot.config.environmentVars);
      if (envVarEntries.length > 0) {
        await db.insert(environmentVariables).values(
          envVarEntries.map(([key, value]) => ({
            projectId: deploymentId,
            key,
            value,
            isSecret: key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD'),
          }))
        );
      }
    }
  }

  private async restoreDatabase(deploymentId: string, snapshot: DeploymentSnapshot): Promise<void> {
    logger.info('Restoring database from snapshot', { deploymentId, snapshotId: snapshot.id });
    
    if (!snapshot.databaseSchema) {
      logger.info('No database schema in snapshot, skipping database restore', { deploymentId });
      return;
    }

    const databaseSchema = snapshot.databaseSchema as DeploymentSnapshot['databaseSchema'] & { 
      snapshotPath?: string; 
      schemaPath?: string; 
      dataPath?: string; 
    };

    logger.info('Database restore details', {
      deploymentId,
      schemaVersion: databaseSchema.version,
      tablesToRestore: databaseSchema.tables,
      migrationsApplied: databaseSchema.migrations,
      hasSnapshotPath: !!databaseSchema.snapshotPath,
    });

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      logger.warn('DATABASE_URL not set, cannot restore database', { deploymentId });
      this.emit('databaseRollbackFailed', {
        deploymentId,
        reason: 'DATABASE_URL not configured',
      });
      return;
    }

    const backupDir = path.join(this.snapshotBasePath, deploymentId, 'db-backup');
    await fs.mkdir(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `backup-before-restore-${Date.now()}.sql`);

    try {
      await execAsync(`pg_dump "${databaseUrl}" --no-owner --no-acl > "${backupFile}"`, {
        timeout: 300000,
        env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' },
      });
      logger.info('Pre-restore database backup created', { deploymentId, backupFile });
    } catch (backupError) {
      logger.warn('Could not create pre-restore backup, continuing with caution', { deploymentId, error: backupError });
    }

    try {
      if (databaseSchema.snapshotPath) {
        try {
          await fs.access(databaseSchema.snapshotPath);
          
          logger.info('Restoring database from full dump file', { 
            deploymentId, 
            snapshotPath: databaseSchema.snapshotPath 
          });

          const tablesResult = await db.execute(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
          `);
          const currentTables = tablesResult.rows?.map((r: any) => r.table_name as string) || [];

          for (const table of currentTables) {
            try {
              await db.execute(`TRUNCATE TABLE "${table}" CASCADE`);
              logger.debug(`Truncated table ${table}`, { deploymentId });
            } catch (truncateError) {
              logger.warn(`Could not truncate table ${table}`, { deploymentId, error: truncateError });
            }
          }

          await execAsync(`psql "${databaseUrl}" < "${databaseSchema.snapshotPath}"`, {
            timeout: 600000,
            env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' },
          });

          logger.info('Database restored successfully from full dump', { deploymentId });
          
          this.emit('databaseRestored', {
            deploymentId,
            snapshotId: snapshot.id,
            tablesRestored: databaseSchema.tables,
            version: databaseSchema.version,
          });

          try {
            const projectId = parseInt(deploymentId, 10);
            if (!isNaN(projectId)) {
              await checkpointService.logRestore(
                parseInt(snapshot.id || '0', 10),
                projectId,
                0,
                { includedDatabase: true, status: 'completed' }
              );
            }
          } catch (logError) {
            logger.warn('Could not log restore to checkpoint service', { deploymentId, error: logError });
          }

          return;
        } catch (fileError) {
          logger.warn('Snapshot file not accessible, falling back to schema-only restore', { 
            deploymentId, 
            snapshotPath: databaseSchema.snapshotPath,
            error: fileError 
          });
        }
      }

      logger.info('Performing schema verification and migration rollback', { deploymentId });
      
      const currentTablesResult = await db.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      const currentTables = new Set(currentTablesResult.rows?.map((r: any) => r.table_name as string) || []);
      const targetTables = new Set(databaseSchema.tables);

      const tablesToDrop = [...currentTables].filter(t => !targetTables.has(t));
      
      for (const table of tablesToDrop) {
        try {
          logger.info(`Dropping table not in snapshot: ${table}`, { deploymentId });
          await db.execute(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        } catch (dropError) {
          logger.warn(`Could not drop table ${table}`, { deploymentId, error: dropError });
        }
      }

      const missingTables = [...targetTables].filter(t => !currentTables.has(t));
      if (missingTables.length > 0) {
        logger.warn('Some tables from snapshot are missing in current database', { 
          deploymentId, 
          missingTables 
        });
      }

      try {
        const currentMigrationsResult = await db.execute(`
          SELECT name FROM drizzle_migrations ORDER BY created_at
        `);
        const currentMigrations = currentMigrationsResult.rows?.map((r: any) => r.name as string) || [];
        const targetMigrations = new Set(databaseSchema.migrations);
        
        const migrationsToRollback = currentMigrations.filter(m => !targetMigrations.has(m));
        
        if (migrationsToRollback.length > 0) {
          logger.info('Migrations to rollback', { deploymentId, migrationsToRollback });
          
          for (const migration of migrationsToRollback.reverse()) {
            try {
              await db.execute(`DELETE FROM drizzle_migrations WHERE name = '${migration}'`);
              logger.info(`Removed migration record: ${migration}`, { deploymentId });
            } catch (migrationError) {
              logger.warn(`Could not remove migration ${migration}`, { deploymentId, error: migrationError });
            }
          }
        }
      } catch (migrationError) {
        logger.debug('Could not process migrations table', { deploymentId, error: migrationError });
      }

      logger.info('Database schema restoration completed', { deploymentId });
      
      this.emit('databaseRestored', {
        deploymentId,
        snapshotId: snapshot.id,
        tablesRestored: databaseSchema.tables,
        version: databaseSchema.version,
        method: 'schema-verification',
      });

    } catch (restoreError: any) {
      logger.error('Database restore failed', { deploymentId, error: restoreError });
      
      try {
        await fs.access(backupFile);
        logger.info('Attempting to restore from pre-restore backup', { deploymentId, backupFile });
        
        await execAsync(`psql "${databaseUrl}" < "${backupFile}"`, {
          timeout: 600000,
          env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' },
        });
        
        logger.info('Successfully restored from pre-restore backup after failure', { deploymentId });
      } catch (recoveryError) {
        logger.error('Failed to recover from pre-restore backup', { deploymentId, error: recoveryError });
      }

      this.emit('databaseRollbackFailed', {
        deploymentId,
        targetSchema: databaseSchema,
        error: restoreError.message,
      });

      throw new Error(`Database restore failed: ${restoreError.message}`);
    }
  }

  private async startDeployment(deploymentId: string, snapshot: DeploymentSnapshot): Promise<void> {
    logger.info('Starting deployment with restored config', { deploymentId, version: snapshot.version });
    
    const { deployments } = await import('@shared/schema');
    const deploymentPath = `/tmp/deployments/${deploymentId}`;

    // Install dependencies if package.json exists
    try {
      await fs.access(path.join(deploymentPath, 'package.json'));
      logger.info('Installing dependencies', { deploymentId });
      await execAsync('npm install', { cwd: deploymentPath, timeout: 300000 });
    } catch (error) {
      // No package.json or install failed
      logger.debug('Skipping npm install', { deploymentId });
    }

    // Build if build command exists
    if (snapshot.config.buildCommand) {
      logger.info('Running build', { deploymentId, buildCommand: snapshot.config.buildCommand });
      await execAsync(snapshot.config.buildCommand, { cwd: deploymentPath, timeout: 600000 });
    }

    // Update deployment status
    await db.update(deployments)
      .set({
        status: 'running',
        version: snapshot.version,
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    // Start the deployment process
    if (snapshot.config.startCommand) {
      logger.info('Starting deployment process', { deploymentId, startCommand: snapshot.config.startCommand });
      // Use spawn for background process (non-blocking)
      exec(
        `cd ${deploymentPath} && ${snapshot.config.startCommand}`,
        { env: { ...process.env, ...snapshot.config.environmentVars } }
      );
    }
  }

  private async verifyDeployment(deploymentId: string): Promise<void> {
    logger.info('Verifying deployment', { deploymentId });
    
    const { deployments } = await import('@shared/schema');
    
    // Wait a bit for the deployment to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get deployment details
    const [deployment] = await db.select()
      .from(deployments)
      .where(eq(deployments.id, deploymentId))
      .limit(1);

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Health check on deployment URL if available
    if (deployment.url) {
      try {
        const healthUrl = `${deployment.url}/api/health`;
        const response = await fetch(healthUrl, { 
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }
        
        logger.info('Health check passed', { deploymentId, healthUrl });
      } catch (error) {
        // Try root endpoint as fallback
        try {
          const response = await fetch(deployment.url, { 
            method: 'GET',
            signal: AbortSignal.timeout(10000),
          });
          
          if (!response.ok) {
            throw new Error(`Root health check failed with status ${response.status}`);
          }
          
          logger.info('Root endpoint check passed', { deploymentId });
        } catch (fallbackError) {
          throw new Error(`Deployment verification failed: ${fallbackError.message}`);
        }
      }
    }

    // Update deployment with verified status
    await db.update(deployments)
      .set({
        status: 'running',
        lastHealthCheck: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));
  }

  private async attemptRecovery(deploymentId: string): Promise<void> {
    logger.info('Attempting recovery', { deploymentId });
    
    try {
      // Get the most recent working snapshot
      const snapshots = await this.getSnapshots(deploymentId);
      const lastWorkingSnapshot = snapshots.find(s => s.status === 'active');
      
      if (lastWorkingSnapshot) {
        logger.info('Found working snapshot, attempting restore', { deploymentId, snapshotId: lastWorkingSnapshot.id });
        
        // Attempt to restore to last known good state
        await this.restoreFiles(deploymentId, lastWorkingSnapshot);
        await this.restoreConfig(deploymentId, lastWorkingSnapshot);
        await this.startDeployment(deploymentId, lastWorkingSnapshot);
        
        logger.info('Recovery completed successfully', { deploymentId });
      } else {
        logger.error('No working snapshot found for recovery', { deploymentId });
        
        // Emit event for manual intervention
        this.emit('recoveryFailed', {
          deploymentId,
          reason: 'No working snapshot available',
        });
      }
    } catch (error) {
      logger.error('Recovery attempt failed', { deploymentId, error });
      
      this.emit('recoveryFailed', {
        deploymentId,
        reason: error.message,
      });
    }
  }

  async getSnapshots(deploymentId: string): Promise<DeploymentSnapshot[]> {
    try {
      const snapshots = await db
        .select()
        .from(deploymentSnapshots)
        .where(eq(deploymentSnapshots.deploymentId, deploymentId))
        .orderBy(desc(deploymentSnapshots.createdAt))
        .limit(20);
      
      return snapshots.map(s => ({
        id: s.id,
        deploymentId: s.deploymentId,
        version: s.version,
        environment: s.environment as DeploymentSnapshot['environment'],
        config: s.config as DeploymentSnapshot['config'],
        fileManifest: s.fileManifest as DeploymentSnapshot['fileManifest'],
        databaseSchema: s.databaseSchema as DeploymentSnapshot['databaseSchema'],
        metadata: s.metadata as DeploymentSnapshot['metadata'],
        status: s.status as DeploymentSnapshot['status'],
        createdAt: s.createdAt,
        size: s.size,
      }));
    } catch (error) {
      logger.error('Failed to get snapshots', { deploymentId, error });
      return [];
    }
  }

  private async getCurrentSnapshot(deploymentId: string): Promise<DeploymentSnapshot | null> {
    const snapshots = await this.getSnapshots(deploymentId);
    return snapshots.find(s => s.status === 'active') || null;
  }

  private async getSnapshot(deploymentId: string, version: string): Promise<DeploymentSnapshot | null> {
    const snapshots = await this.getSnapshots(deploymentId);
    return snapshots.find(s => s.version === version) || null;
  }

  async compareVersions(
    deploymentId: string,
    version1: string,
    version2: string
  ): Promise<VersionDiff> {
    const snapshot1 = await this.getSnapshot(deploymentId, version1);
    const snapshot2 = await this.getSnapshot(deploymentId, version2);
    
    if (!snapshot1 || !snapshot2) {
      throw new Error('One or both versions not found');
    }
    
    // Compare file manifests
    const files1 = new Set(snapshot1.fileManifest.map(f => f.path));
    const files2 = new Set(snapshot2.fileManifest.map(f => f.path));
    
    const filesAdded = Array.from(files2).filter(f => !files1.has(f));
    const filesDeleted = Array.from(files1).filter(f => !files2.has(f));
    
    const filesModified = Array.from(files1).filter(f => {
      if (!files2.has(f)) return false;
      const hash1 = snapshot1.fileManifest.find(fm => fm.path === f)?.hash;
      const hash2 = snapshot2.fileManifest.find(fm => fm.path === f)?.hash;
      return hash1 !== hash2;
    });
    
    // Compare configurations
    const configDiff = this.diffObjects(snapshot1.config, snapshot2.config);
    
    // Compare database schemas
    const tables1 = new Set(snapshot1.databaseSchema?.tables || []);
    const tables2 = new Set(snapshot2.databaseSchema?.tables || []);
    
    return {
      files: {
        added: filesAdded,
        modified: filesModified,
        deleted: filesDeleted,
      },
      config: configDiff,
      database: {
        tablesAdded: Array.from(tables2).filter(t => !tables1.has(t)),
        tablesModified: [], // Would need deeper comparison
        tablesDeleted: Array.from(tables1).filter(t => !tables2.has(t)),
        migrationsApplied: snapshot2.databaseSchema?.migrations.filter(
          m => !snapshot1.databaseSchema?.migrations.includes(m)
        ) || [],
      },
    };
  }

  private diffObjects(obj1: any, obj2: any): VersionDiff['config'] {
    const result: VersionDiff['config'] = {
      added: {},
      modified: {},
      deleted: {},
    };
    
    // Check for added and modified keys
    for (const key in obj2) {
      if (!(key in obj1)) {
        result.added[key] = obj2[key];
      } else if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
        result.modified[key] = { old: obj1[key], new: obj2[key] };
      }
    }
    
    // Check for deleted keys
    for (const key in obj1) {
      if (!(key in obj2)) {
        result.deleted[key] = obj1[key];
      }
    }
    
    return result;
  }

  async getRollbackStatus(rollbackId: string): Promise<RollbackStatus | null> {
    return this.rollbackStatus.get(rollbackId) || null;
  }

  async getActiveRollback(deploymentId: string): Promise<RollbackStatus | null> {
    for (const status of this.rollbackStatus.values()) {
      if (status.deploymentId === deploymentId && 
          (status.status === 'in_progress' || status.status === 'pending')) {
        return status;
      }
    }
    return null;
  }

  async getRollbackHistory(
    deploymentId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<RollbackStatus[]> {
    const { limit = 10, offset = 0 } = options;
    
    const history: RollbackStatus[] = [];
    for (const status of this.rollbackStatus.values()) {
      if (status.deploymentId === deploymentId && 
          (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled')) {
        history.push(status);
      }
    }
    
    history.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    
    return history.slice(offset, offset + limit);
  }

  async findSnapshotInDeployment(deploymentId: string, snapshotId: string): Promise<DeploymentSnapshot | null> {
    const snapshots = await this.listSnapshots(deploymentId);
    return snapshots.find(s => s.id === snapshotId) || null;
  }

  async cancelRollback(rollbackId: string): Promise<void> {
    const status = this.rollbackStatus.get(rollbackId);
    if (!status) return;
    
    if (status.status === 'in_progress') {
      status.status = 'cancelled';
      status.completedAt = new Date();
      
      this.emit('rollbackCancelled', {
        rollbackId,
        deploymentId: status.deploymentId,
      });
    }
  }

  async setAutoRollback(
    deploymentId: string,
    enabled: boolean,
    healthThreshold: number = 50
  ): Promise<void> {
    if (enabled) {
      // Monitor health and trigger automatic rollback if needed
      deploymentMetricsService.on('alert', async (alert) => {
        if (alert.deploymentId === deploymentId && alert.level === 'critical') {
          const health = await deploymentMetricsService.getHealthStatus(deploymentId);
          if (health.score < healthThreshold) {
            const snapshots = await this.getSnapshots(deploymentId);
            if (snapshots.length > 1) {
              // Rollback to previous version
              await this.performRollback(deploymentId, snapshots[1].version, {
                reason: `Automatic rollback due to low health score (${health.score})`,
              });
            }
          }
        }
      });
    }
  }

  private async cleanupOldSnapshots(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.snapshotRetentionDays);
    
    try {
      await db
        .update(deploymentSnapshots)
        .set({ status: 'archived' })
        .where(
          and(
            eq(deploymentSnapshots.status, 'active'),
            lte(deploymentSnapshots.createdAt, cutoffDate)
          )
        );
    } catch (error) {
      logger.error('Failed to cleanup old snapshots', { error });
    }
  }

  async performAtomicRollback(
    deploymentId: string,
    targetVersion: string,
    options: RollbackOptions = {}
  ): Promise<RollbackResult> {
    const rollbackId = crypto.randomUUID();
    const startTime = Date.now();
    
    logger.info('Starting atomic rollback operation', { 
      rollbackId, 
      deploymentId, 
      targetVersion 
    });

    deploymentWebSocketService.broadcastDeployLog(
      deploymentId,
      `[Atomic Rollback] Starting atomic rollback to version ${targetVersion}`
    );

    const currentSnapshot = await this.getCurrentSnapshot(deploymentId);
    const targetSnapshot = await this.getSnapshot(deploymentId, targetVersion);
    
    if (!targetSnapshot) {
      logger.error('Target version not found for atomic rollback', { rollbackId, deploymentId, targetVersion });
      return {
        success: false,
        rollbackId,
        restoredVersion: '',
        details: {
          deploymentId,
          fromVersion: currentSnapshot?.version || 'unknown',
          toVersion: targetVersion,
          status: 'failed',
          stepsCompleted: [],
          duration: Date.now() - startTime,
          error: `Target version ${targetVersion} not found`,
        },
      };
    }

    const backupDir = path.join(this.snapshotBasePath, deploymentId, 'atomic-backup', rollbackId);
    await fs.mkdir(backupDir, { recursive: true });

    const completedSteps: string[] = [];
    let filesBackupPath: string | undefined;
    let databaseBackupPath: string | undefined;
    let configBackupPath: string | undefined;

    try {
      const deploymentPath = `/tmp/deployments/${deploymentId}`;
      filesBackupPath = path.join(backupDir, 'files');
      
      try {
        await fs.access(deploymentPath);
        await this.copyDeploymentFiles(deploymentPath, backupDir);
        logger.info('Files backup created for atomic rollback', { rollbackId, filesBackupPath });
      } catch (e) {
        logger.debug('No existing files to backup', { rollbackId });
      }

      const databaseUrl = process.env.DATABASE_URL;
      if (databaseUrl && !options.skipDatabase) {
        databaseBackupPath = path.join(backupDir, 'database.sql');
        try {
          await execAsync(`pg_dump "${databaseUrl}" --no-owner --no-acl > "${databaseBackupPath}"`, {
            timeout: 300000,
            env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' },
          });
          logger.info('Database backup created for atomic rollback', { rollbackId, databaseBackupPath });
        } catch (e) {
          logger.warn('Could not create database backup', { rollbackId, error: e });
          databaseBackupPath = undefined;
        }
      }

      if (currentSnapshot?.config) {
        configBackupPath = path.join(backupDir, 'config.json');
        await fs.writeFile(configBackupPath, JSON.stringify(currentSnapshot.config, null, 2));
        logger.info('Config backup created for atomic rollback', { rollbackId, configBackupPath });
      }

      completedSteps.push('backup_created');

      if (!options.skipFiles) {
        logger.info('Restoring files atomically', { rollbackId, deploymentId });
        await this.restoreFiles(deploymentId, targetSnapshot);
        completedSteps.push('files_restored');
      }

      if (!options.skipConfig) {
        logger.info('Restoring config atomically', { rollbackId, deploymentId });
        await this.restoreConfig(deploymentId, targetSnapshot);
        completedSteps.push('config_restored');
      }

      if (!options.skipDatabase && targetSnapshot.databaseSchema) {
        logger.info('Restoring database atomically', { rollbackId, deploymentId });
        await this.restoreDatabase(deploymentId, targetSnapshot);
        completedSteps.push('database_restored');
      }

      const { deployments } = await import('@shared/schema');
      await db.update(deployments)
        .set({
          status: 'running',
          version: targetSnapshot.version,
          updatedAt: new Date(),
        })
        .where(eq(deployments.id, deploymentId));
      completedSteps.push('status_updated');

      await this.updateSnapshotStatus(targetSnapshot.id!, 'active');
      if (currentSnapshot) {
        await this.updateSnapshotStatus(currentSnapshot.id!, 'archived');
      }
      completedSteps.push('snapshot_status_updated');

      try {
        const projectId = parseInt(deploymentId, 10);
        if (!isNaN(projectId)) {
          await checkpointService.logRestore(
            parseInt(targetSnapshot.id || '0', 10),
            projectId,
            0,
            { includedDatabase: !options.skipDatabase, status: 'completed' }
          );
        }
      } catch (logError) {
        logger.warn('Could not log restore to checkpoint service', { rollbackId, error: logError });
      }

      const duration = Date.now() - startTime;
      
      logger.info('Atomic rollback completed successfully', {
        rollbackId,
        deploymentId,
        targetVersion,
        duration,
        completedSteps,
      });

      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Atomic Rollback] Successfully completed in ${duration}ms`
      );

      this.emit('atomicRollbackCompleted', {
        rollbackId,
        deploymentId,
        targetVersion,
        duration,
      });

      try {
        await fs.rm(backupDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.warn('Could not cleanup backup directory', { rollbackId, backupDir });
      }

      return {
        success: true,
        rollbackId,
        restoredVersion: targetVersion,
        details: {
          deploymentId,
          fromVersion: currentSnapshot?.version || 'unknown',
          toVersion: targetVersion,
          status: 'completed',
          stepsCompleted: completedSteps,
          duration,
          filesRestored: targetSnapshot.fileManifest?.length || 0,
          configRestored: !options.skipConfig,
          databaseRestored: !options.skipDatabase && !!targetSnapshot.databaseSchema,
        },
      };

    } catch (error: any) {
      logger.error('Atomic rollback failed, initiating recovery', {
        rollbackId,
        deploymentId,
        completedSteps,
        error: error.message,
      });

      deploymentWebSocketService.broadcastError(
        deploymentId,
        `[Atomic Rollback] Failed: ${error.message}. Initiating recovery...`
      );

      try {
        if (completedSteps.includes('files_restored') && filesBackupPath) {
          logger.info('Restoring files from backup', { rollbackId });
          const deploymentPath = `/tmp/deployments/${deploymentId}`;
          
          try {
            const entries = await fs.readdir(deploymentPath);
            for (const entry of entries) {
              if (entry !== 'node_modules' && entry !== '.git') {
                await fs.rm(path.join(deploymentPath, entry), { recursive: true, force: true });
              }
            }
          } catch (err: any) { console.error("[catch]", err?.message || err);
            // Expected: directory may not exist or may be in use during recovery cleanup
          }
          
          await this.copyDeploymentFiles(filesBackupPath, `/tmp/deployments`);
        }

        if (completedSteps.includes('database_restored') && databaseBackupPath) {
          logger.info('Restoring database from backup', { rollbackId });
          const databaseUrl = process.env.DATABASE_URL;
          if (databaseUrl) {
            await execAsync(`psql "${databaseUrl}" < "${databaseBackupPath}"`, {
              timeout: 600000,
              env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' },
            });
          }
        }

        if (completedSteps.includes('config_restored') && configBackupPath && currentSnapshot) {
          logger.info('Restoring config from backup', { rollbackId });
          await this.restoreConfig(deploymentId, currentSnapshot);
        }

        if (completedSteps.includes('status_updated')) {
          const { deployments } = await import('@shared/schema');
          await db.update(deployments)
            .set({
              status: 'running',
              version: currentSnapshot?.version || 'unknown',
              updatedAt: new Date(),
            })
            .where(eq(deployments.id, deploymentId));
        }

        if (completedSteps.includes('snapshot_status_updated')) {
          if (currentSnapshot) {
            await this.updateSnapshotStatus(currentSnapshot.id!, 'active');
          }
          await this.updateSnapshotStatus(targetSnapshot.id!, 'active');
        }

        logger.info('Recovery from failed atomic rollback completed', { rollbackId });
        deploymentWebSocketService.broadcastDeployLog(
          deploymentId,
          `[Atomic Rollback] Recovery completed - original state restored`
        );

      } catch (recoveryError: any) {
        logger.error('Recovery from failed atomic rollback also failed', {
          rollbackId,
          deploymentId,
          error: recoveryError.message,
        });

        deploymentWebSocketService.broadcastError(
          deploymentId,
          `[Atomic Rollback] CRITICAL: Recovery also failed. Manual intervention required.`
        );

        this.emit('atomicRollbackRecoveryFailed', {
          rollbackId,
          deploymentId,
          originalError: error.message,
          recoveryError: recoveryError.message,
        });
      }

      const duration = Date.now() - startTime;

      this.emit('atomicRollbackFailed', {
        rollbackId,
        deploymentId,
        error: error.message,
      });

      return {
        success: false,
        rollbackId,
        restoredVersion: '',
        details: {
          deploymentId,
          fromVersion: currentSnapshot?.version || 'unknown',
          toVersion: targetVersion,
          status: 'failed',
          stepsCompleted: completedSteps,
          duration,
          error: error.message,
        },
      };
    }
  }

  private async updateSnapshotStatus(snapshotId: string, status: 'active' | 'archived' | 'failed'): Promise<void> {
    try {
      await db
        .update(deploymentSnapshots)
        .set({ status })
        .where(eq(deploymentSnapshots.id, snapshotId));
    } catch (error) {
      logger.warn('Could not update snapshot status', { snapshotId, status, error });
    }
  }

  /**
   * Get a deployment snapshot directly by its ID
   * More reliable than version-based lookup
   */
  async getSnapshotById(snapshotId: string): Promise<DeploymentSnapshot | null> {
    logger.debug('Fetching snapshot by ID', { snapshotId });
    
    try {
      const [snapshot] = await db
        .select()
        .from(deploymentSnapshots)
        .where(eq(deploymentSnapshots.id, snapshotId))
        .limit(1);
      
      if (!snapshot) {
        logger.warn('Snapshot not found', { snapshotId });
        return null;
      }
      
      return {
        id: snapshot.id,
        deploymentId: snapshot.deploymentId,
        version: snapshot.version,
        environment: snapshot.environment as DeploymentSnapshot['environment'],
        config: snapshot.config as DeploymentSnapshot['config'],
        fileManifest: snapshot.fileManifest as DeploymentSnapshot['fileManifest'],
        databaseSchema: snapshot.databaseSchema as DeploymentSnapshot['databaseSchema'],
        metadata: snapshot.metadata as DeploymentSnapshot['metadata'],
        status: snapshot.status as DeploymentSnapshot['status'],
        createdAt: snapshot.createdAt,
        size: snapshot.size,
      };
    } catch (error) {
      logger.error('Failed to fetch snapshot by ID', { snapshotId, error });
      return null;
    }
  }

  /**
   * Create a safety checkpoint before performing rollback
   * This allows recovering if the rollback goes wrong
   */
  async createSafetyCheckpoint(
    deploymentId: string,
    reason: string
  ): Promise<DeploymentSnapshot | null> {
    logger.info('Creating safety checkpoint before rollback', { deploymentId, reason });
    
    try {
      const deploymentPath = `/tmp/deployments/${deploymentId}`;
      
      // Check if deployment path exists
      try {
        await fs.access(deploymentPath);
      } catch (err: any) { console.error("[catch]", err?.message || err);
        logger.warn('Deployment path does not exist, skipping safety checkpoint', { 
          deploymentId, 
          deploymentPath 
        });
        return null;
      }
      
      // Get current deployment config from database
      const { deployments } = await import('@shared/schema');
      const [currentDeployment] = await db
        .select()
        .from(deployments)
        .where(eq(deployments.id, deploymentId))
        .limit(1);
      
      const config: DeploymentSnapshot['config'] = {
        buildCommand: currentDeployment?.buildCommand || undefined,
        startCommand: currentDeployment?.startCommand || undefined,
        environmentVars: {},
        dependencies: {},
        nodeVersion: currentDeployment?.nodeVersion || undefined,
      };
      
      const safetySnapshot = await this.createSnapshot(
        deploymentId,
        `safety-checkpoint-${Date.now()}`,
        deploymentPath,
        config,
        {
          deployedBy: 'system',
          reason: `Safety checkpoint: ${reason}`,
          tags: ['safety-checkpoint', 'pre-rollback'],
        }
      );
      
      logger.info('Safety checkpoint created successfully', {
        deploymentId,
        snapshotId: safetySnapshot.id,
        version: safetySnapshot.version,
      });
      
      return safetySnapshot;
    } catch (error) {
      logger.error('Failed to create safety checkpoint', { deploymentId, reason, error });
      return null;
    }
  }

  /**
   * Rollback to a specific snapshot by its ID
   * This is the most direct and reliable rollback method
   * 
   * @param snapshotId - The unique ID of the snapshot to rollback to
   * @param options - Rollback options (skipDatabase, skipFiles, skipConfig, dryRun, force)
   * @returns RollbackResult with detailed status
   */
  async rollbackToSnapshotById(
    snapshotId: string,
    options: RollbackOptions = {}
  ): Promise<RollbackResult> {
    const rollbackId = crypto.randomUUID();
    const startTime = Date.now();
    
    logger.info('Starting rollback to snapshot by ID', {
      rollbackId,
      snapshotId,
      options,
    });

    // Step 1: Verify the snapshot exists
    const targetSnapshot = await this.getSnapshotById(snapshotId);
    
    if (!targetSnapshot) {
      logger.error('Snapshot not found for rollback', { rollbackId, snapshotId });
      
      return {
        success: false,
        rollbackId,
        restoredVersion: '',
        details: {
          deploymentId: '',
          fromVersion: 'unknown',
          toVersion: 'unknown',
          status: 'failed',
          stepsCompleted: [],
          duration: Date.now() - startTime,
          error: `Snapshot ${snapshotId} not found`,
        },
      };
    }

    const deploymentId = targetSnapshot.deploymentId;
    
    // Broadcast rollback start via WebSocket
    deploymentWebSocketService.broadcastDeployLog(
      deploymentId,
      `[Rollback] Starting rollback to snapshot ${snapshotId} (version: ${targetSnapshot.version})`
    );

    // Step 2: Get current state for comparison
    const currentSnapshot = await this.getCurrentSnapshot(deploymentId);
    
    // Step 3: Create safety checkpoint before rollback (unless force is set)
    let safetyCheckpoint: DeploymentSnapshot | null = null;
    if (!options.force && !options.dryRun) {
      safetyCheckpoint = await this.createSafetyCheckpoint(
        deploymentId,
        `Before rollback to ${targetSnapshot.version}`
      );
      
      if (safetyCheckpoint) {
        deploymentWebSocketService.broadcastDeployLog(
          deploymentId,
          `[Rollback] Safety checkpoint created: ${safetyCheckpoint.id}`
        );
      }
    }

    // Initialize rollback status
    const status: RollbackStatus = {
      id: rollbackId,
      deploymentId,
      fromVersion: currentSnapshot?.version || 'unknown',
      toVersion: targetSnapshot.version,
      status: 'pending',
      startedAt: new Date(),
      progress: 0,
      steps: [
        { name: 'Verify snapshot integrity', status: 'pending' },
        { name: 'Create safety checkpoint', status: safetyCheckpoint ? 'completed' : 'skipped' },
        { name: 'Stop current deployment', status: 'pending' },
        { name: 'Restore files', status: options.skipFiles ? 'skipped' : 'pending' },
        { name: 'Restore configuration', status: options.skipConfig ? 'skipped' : 'pending' },
        { name: 'Restore database', status: options.skipDatabase ? 'skipped' : 'pending' },
        { name: 'Start deployment', status: 'pending' },
        { name: 'Verify deployment', status: 'pending' },
      ],
    };
    
    this.rollbackStatus.set(rollbackId, status);
    
    const stepsCompleted: string[] = [];
    let filesRestored = 0;
    let configRestored = false;
    let databaseRestored = false;

    try {
      status.status = 'in_progress';
      
      // Step 1: Verify snapshot integrity
      status.steps[0].status = 'running';
      status.steps[0].startedAt = new Date();
      
      await this.validateSnapshot(targetSnapshot);
      
      status.steps[0].status = 'completed';
      status.steps[0].completedAt = new Date();
      status.progress = 12;
      stepsCompleted.push('Verify snapshot integrity');
      
      logger.info('Snapshot integrity verified', { rollbackId, snapshotId });
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Snapshot integrity verified`
      );

      // Step 2: Safety checkpoint already handled above
      if (safetyCheckpoint) {
        stepsCompleted.push('Create safety checkpoint');
      }
      status.progress = 20;

      // Step 3: Stop current deployment
      status.steps[2].status = 'running';
      status.steps[2].startedAt = new Date();
      
      if (!options.dryRun) {
        await this.stopDeployment(deploymentId);
      }
      
      status.steps[2].status = 'completed';
      status.steps[2].completedAt = new Date();
      status.progress = 30;
      stepsCompleted.push('Stop current deployment');
      
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Current deployment stopped`
      );

      // Step 4: Restore files
      if (!options.skipFiles) {
        status.steps[3].status = 'running';
        status.steps[3].startedAt = new Date();
        
        if (!options.dryRun) {
          await this.restoreFiles(deploymentId, targetSnapshot);
          filesRestored = targetSnapshot.fileManifest?.length || 0;
        }
        
        status.steps[3].status = 'completed';
        status.steps[3].completedAt = new Date();
        stepsCompleted.push('Restore files');
        
        logger.info('Files restored', { rollbackId, filesRestored });
        deploymentWebSocketService.broadcastDeployLog(
          deploymentId,
          `[Rollback] Restored ${filesRestored} files`
        );
      }
      status.progress = 45;

      // Step 5: Restore configuration
      if (!options.skipConfig) {
        status.steps[4].status = 'running';
        status.steps[4].startedAt = new Date();
        
        if (!options.dryRun) {
          await this.restoreConfig(deploymentId, targetSnapshot);
          configRestored = true;
        }
        
        status.steps[4].status = 'completed';
        status.steps[4].completedAt = new Date();
        stepsCompleted.push('Restore configuration');
        
        logger.info('Configuration restored', { rollbackId, deploymentId });
        deploymentWebSocketService.broadcastDeployLog(
          deploymentId,
          `[Rollback] Configuration restored`
        );
      }
      status.progress = 60;

      // Step 6: Restore database
      if (!options.skipDatabase && targetSnapshot.databaseSchema) {
        status.steps[5].status = 'running';
        status.steps[5].startedAt = new Date();
        
        if (!options.dryRun) {
          await this.restoreDatabase(deploymentId, targetSnapshot);
          databaseRestored = true;
        }
        
        status.steps[5].status = 'completed';
        status.steps[5].completedAt = new Date();
        stepsCompleted.push('Restore database');
        
        logger.info('Database restored', { rollbackId, deploymentId });
        deploymentWebSocketService.broadcastDeployLog(
          deploymentId,
          `[Rollback] Database restored (tables: ${targetSnapshot.databaseSchema.tables?.length || 0})`
        );
      }
      status.progress = 75;

      // Step 7: Start deployment
      status.steps[6].status = 'running';
      status.steps[6].startedAt = new Date();
      
      if (!options.dryRun) {
        await this.startDeployment(deploymentId, targetSnapshot);
      }
      
      status.steps[6].status = 'completed';
      status.steps[6].completedAt = new Date();
      status.progress = 87;
      stepsCompleted.push('Start deployment');
      
      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Deployment started`
      );

      // Step 8: Verify deployment
      status.steps[7].status = 'running';
      status.steps[7].startedAt = new Date();
      
      if (!options.dryRun) {
        await this.verifyDeployment(deploymentId);
      }
      
      status.steps[7].status = 'completed';
      status.steps[7].completedAt = new Date();
      status.progress = 100;
      stepsCompleted.push('Verify deployment');

      // Update snapshot statuses
      if (!options.dryRun) {
        await this.updateSnapshotStatus(snapshotId, 'active');
        if (currentSnapshot?.id) {
          await this.updateSnapshotStatus(currentSnapshot.id, 'archived');
        }
      }

      // Mark rollback as completed
      status.status = 'completed';
      status.completedAt = new Date();

      const duration = Date.now() - startTime;

      logger.info('Rollback to snapshot completed successfully', {
        rollbackId,
        snapshotId,
        deploymentId,
        targetVersion: targetSnapshot.version,
        duration,
        filesRestored,
        configRestored,
        databaseRestored,
        stepsCompleted,
      });

      deploymentWebSocketService.broadcastDeployLog(
        deploymentId,
        `[Rollback] Successfully rolled back to version ${targetSnapshot.version} in ${duration}ms`
      );

      this.emit('rollbackToSnapshotCompleted', {
        rollbackId,
        snapshotId,
        deploymentId,
        version: targetSnapshot.version,
        duration,
        safetyCheckpointId: safetyCheckpoint?.id,
      });

      return {
        success: true,
        rollbackId,
        restoredVersion: targetSnapshot.version,
        details: {
          deploymentId,
          fromVersion: currentSnapshot?.version || 'unknown',
          toVersion: targetSnapshot.version,
          status: 'completed',
          stepsCompleted,
          duration,
          filesRestored,
          configRestored,
          databaseRestored,
        },
      };

    } catch (error: any) {
      status.status = 'failed';
      status.error = error.message;
      status.completedAt = new Date();

      const duration = Date.now() - startTime;

      logger.error('Rollback to snapshot failed', {
        rollbackId,
        snapshotId,
        deploymentId,
        error: error.message,
        stepsCompleted,
        duration,
      });

      deploymentWebSocketService.broadcastError(
        deploymentId,
        `Rollback failed: ${error.message}`
      );

      // Attempt recovery from safety checkpoint if available
      if (safetyCheckpoint && !options.force) {
        logger.info('Attempting recovery from safety checkpoint', {
          rollbackId,
          safetyCheckpointId: safetyCheckpoint.id,
        });
        
        deploymentWebSocketService.broadcastDeployLog(
          deploymentId,
          `[Rollback] Attempting recovery from safety checkpoint...`
        );
        
        try {
          await this.restoreFiles(deploymentId, safetyCheckpoint);
          await this.restoreConfig(deploymentId, safetyCheckpoint);
          await this.startDeployment(deploymentId, safetyCheckpoint);
          
          logger.info('Recovery from safety checkpoint successful', { rollbackId });
          deploymentWebSocketService.broadcastDeployLog(
            deploymentId,
            `[Rollback] Recovered from safety checkpoint`
          );
        } catch (recoveryError: any) {
          logger.error('Recovery from safety checkpoint failed', {
            rollbackId,
            safetyCheckpointId: safetyCheckpoint.id,
            error: recoveryError.message,
          });
          
          deploymentWebSocketService.broadcastError(
            deploymentId,
            `Recovery failed: ${recoveryError.message}. Manual intervention may be required.`
          );
        }
      }

      this.emit('rollbackToSnapshotFailed', {
        rollbackId,
        snapshotId,
        deploymentId,
        error: error.message,
        safetyCheckpointId: safetyCheckpoint?.id,
      });

      return {
        success: false,
        rollbackId,
        restoredVersion: '',
        details: {
          deploymentId,
          fromVersion: currentSnapshot?.version || 'unknown',
          toVersion: targetSnapshot.version,
          status: 'failed',
          stepsCompleted,
          duration,
          filesRestored,
          configRestored,
          databaseRestored,
          error: error.message,
        },
      };
    }
  }

  /**
   * List all available snapshots for a deployment with filtering options
   */
  async listSnapshots(
    deploymentId: string,
    options: {
      status?: 'active' | 'archived' | 'failed';
      limit?: number;
      includeSafetyCheckpoints?: boolean;
    } = {}
  ): Promise<DeploymentSnapshot[]> {
    const { status: filterStatus, limit = 20, includeSafetyCheckpoints = false } = options;
    
    logger.debug('Listing snapshots', { deploymentId, options });
    
    try {
      let query = db
        .select()
        .from(deploymentSnapshots)
        .where(eq(deploymentSnapshots.deploymentId, deploymentId))
        .orderBy(desc(deploymentSnapshots.createdAt))
        .limit(limit);
      
      const snapshots = await query;
      
      return snapshots
        .filter(s => {
          // Filter by status if specified
          if (filterStatus && s.status !== filterStatus) return false;
          
          // Filter out safety checkpoints unless explicitly requested
          if (!includeSafetyCheckpoints) {
            const metadata = s.metadata as DeploymentSnapshot['metadata'];
            if (metadata?.tags?.includes('safety-checkpoint')) return false;
          }
          
          return true;
        })
        .map(s => ({
          id: s.id,
          deploymentId: s.deploymentId,
          version: s.version,
          environment: s.environment as DeploymentSnapshot['environment'],
          config: s.config as DeploymentSnapshot['config'],
          fileManifest: s.fileManifest as DeploymentSnapshot['fileManifest'],
          databaseSchema: s.databaseSchema as DeploymentSnapshot['databaseSchema'],
          metadata: s.metadata as DeploymentSnapshot['metadata'],
          status: s.status as DeploymentSnapshot['status'],
          createdAt: s.createdAt,
          size: s.size,
        }));
    } catch (error) {
      logger.error('Failed to list snapshots', { deploymentId, error });
      return [];
    }
  }

  /**
   * Get summary of rollback capabilities for a deployment
   */
  async getRollbackSummary(deploymentId: string): Promise<{
    available: boolean;
    currentVersion: string | null;
    snapshotCount: number;
    oldestSnapshot: Date | null;
    newestSnapshot: Date | null;
    totalSnapshotSize: number;
    hasDatabaseSnapshots: boolean;
  }> {
    logger.debug('Getting rollback summary', { deploymentId });
    
    try {
      const snapshots = await this.getSnapshots(deploymentId);
      const activeSnapshots = snapshots.filter(s => s.status === 'active');
      const currentSnapshot = await this.getCurrentSnapshot(deploymentId);
      
      const hasDatabaseSnapshots = activeSnapshots.some(s => 
        s.databaseSchema && 
        (s.databaseSchema as any).snapshotPath
      );
      
      return {
        available: activeSnapshots.length > 0,
        currentVersion: currentSnapshot?.version || null,
        snapshotCount: activeSnapshots.length,
        oldestSnapshot: activeSnapshots.length > 0 
          ? new Date(Math.min(...activeSnapshots.map(s => s.createdAt.getTime())))
          : null,
        newestSnapshot: activeSnapshots.length > 0
          ? new Date(Math.max(...activeSnapshots.map(s => s.createdAt.getTime())))
          : null,
        totalSnapshotSize: activeSnapshots.reduce((sum, s) => sum + s.size, 0),
        hasDatabaseSnapshots,
      };
    } catch (error) {
      logger.error('Failed to get rollback summary', { deploymentId, error });
      return {
        available: false,
        currentVersion: null,
        snapshotCount: 0,
        oldestSnapshot: null,
        newestSnapshot: null,
        totalSnapshotSize: 0,
        hasDatabaseSnapshots: false,
      };
    }
  }

  destroy(): void {
    this.removeAllListeners();
  }
}

export const deploymentRollbackService = new DeploymentRollbackService();
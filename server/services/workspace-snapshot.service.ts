/**
 * Workspace Snapshot Service
 * Captures and restores file system state for checkpoints
 * 
 * Provides functionality to snapshot project files and restore them
 * to a previous state during checkpoint operations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = createLogger('workspace-snapshot-service');

export interface FileSnapshot {
  path: string;
  content: string;
  hash: string;
  size: number;
  isDirectory: boolean;
}

export interface WorkspaceSnapshot {
  projectId: number;
  basePath: string;
  files: FileSnapshot[];
  capturedAt: Date;
  totalFiles: number;
  totalSize: number;
}

export interface CaptureOptions {
  includeHidden?: boolean;
  maxFileSize?: number;
  excludePatterns?: string[];
}

const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.ecode',
  '.checkpoints',
  'dist',
  'build',
  '.next',
  '.cache',
  'coverage',
  '.turbo',
  '.vercel',
  '.netlify',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'target',
  '.cargo',
];

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file

export class WorkspaceSnapshotService extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Compute SHA-256 hash of file content
   */
  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if a path should be excluded from snapshot
   */
  private shouldExclude(filePath: string, excludePatterns: string[]): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return excludePatterns.some(pattern => {
      if (normalizedPath.includes(`/${pattern}/`) || 
          normalizedPath.endsWith(`/${pattern}`) ||
          normalizedPath.startsWith(`${pattern}/`) ||
          normalizedPath === pattern) {
        return true;
      }
      return false;
    });
  }

  /**
   * Recursively capture all files in a directory
   */
  private async captureDirectory(
    dirPath: string,
    basePath: string,
    options: CaptureOptions
  ): Promise<FileSnapshot[]> {
    const files: FileSnapshot[] = [];
    const excludePatterns = options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS;
    const maxFileSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        // Skip hidden files unless explicitly included
        if (!options.includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        // Skip excluded patterns
        if (this.shouldExclude(relativePath, excludePatterns)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Recursively capture subdirectory
          const subFiles = await this.captureDirectory(fullPath, basePath, options);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            
            // Skip files that are too large
            if (stats.size > maxFileSize) {
              logger.info(`[WorkspaceSnapshot] Skipping large file: ${relativePath} (${stats.size} bytes)`);
              continue;
            }

            // Read file content
            const content = await fs.readFile(fullPath, 'utf-8');
            const hash = this.computeHash(content);

            files.push({
              path: relativePath,
              content,
              hash,
              size: stats.size,
              isDirectory: false,
            });
          } catch (readError: any) {
            // Skip binary files or files that can't be read as UTF-8
            if (readError.code !== 'ERR_ENCODING_INVALID_ENCODED_DATA') {
              logger.warn(`[WorkspaceSnapshot] Could not read file: ${relativePath}`, readError.message);
            }
          }
        }
      }
    } catch (error: any) {
      logger.error(`[WorkspaceSnapshot] Error reading directory ${dirPath}:`, error.message);
    }

    return files;
  }

  /**
   * Capture the current state of a project's files
   */
  async captureFileState(
    projectBasePath: string,
    projectId: number,
    options: CaptureOptions = {}
  ): Promise<WorkspaceSnapshot> {
    logger.info(`[WorkspaceSnapshot] Capturing file state for project ${projectId} at ${projectBasePath}`);
    
    const startTime = Date.now();
    const files = await this.captureDirectory(projectBasePath, projectBasePath, options);
    
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    
    const snapshot: WorkspaceSnapshot = {
      projectId,
      basePath: projectBasePath,
      files,
      capturedAt: new Date(),
      totalFiles: files.length,
      totalSize,
    };

    const duration = Date.now() - startTime;
    logger.info(`[WorkspaceSnapshot] Captured ${files.length} files (${(totalSize / 1024).toFixed(2)} KB) in ${duration}ms`);

    this.emit('snapshotCaptured', { projectId, fileCount: files.length, totalSize, duration });

    return snapshot;
  }

  /**
   * Restore files from a snapshot to the file system
   */
  async restoreFileState(
    projectBasePath: string,
    snapshot: WorkspaceSnapshot
  ): Promise<{ restoredCount: number; errors: string[] }> {
    logger.info(`[WorkspaceSnapshot] Restoring ${snapshot.files.length} files for project ${snapshot.projectId}`);
    
    const startTime = Date.now();
    let restoredCount = 0;
    const errors: string[] = [];

    for (const file of snapshot.files) {
      const fullPath = path.join(projectBasePath, file.path);

      try {
        // Ensure directory exists
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });

        // Write file content
        await fs.writeFile(fullPath, file.content, 'utf-8');
        restoredCount++;
      } catch (error: any) {
        const errorMsg = `Failed to restore ${file.path}: ${error.message}`;
        errors.push(errorMsg);
        logger.error(`[WorkspaceSnapshot] ${errorMsg}`);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[WorkspaceSnapshot] Restored ${restoredCount}/${snapshot.files.length} files in ${duration}ms`);

    this.emit('snapshotRestored', { 
      projectId: snapshot.projectId, 
      restoredCount, 
      totalFiles: snapshot.files.length,
      errors: errors.length,
      duration 
    });

    return { restoredCount, errors };
  }

  /**
   * Compare two snapshots and return the differences
   */
  compareSnapshots(
    oldSnapshot: WorkspaceSnapshot,
    newSnapshot: WorkspaceSnapshot
  ): {
    added: string[];
    modified: string[];
    deleted: string[];
  } {
    const oldFiles = new Map(oldSnapshot.files.map(f => [f.path, f]));
    const newFiles = new Map(newSnapshot.files.map(f => [f.path, f]));

    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    // Check for added and modified files
    for (const [path, newFile] of newFiles) {
      const oldFile = oldFiles.get(path);
      if (!oldFile) {
        added.push(path);
      } else if (oldFile.hash !== newFile.hash) {
        modified.push(path);
      }
    }

    // Check for deleted files
    for (const path of oldFiles.keys()) {
      if (!newFiles.has(path)) {
        deleted.push(path);
      }
    }

    return { added, modified, deleted };
  }

  /**
   * Create a minimal snapshot containing only file metadata (no content)
   * Useful for quick comparisons and checkpoint metadata
   */
  async captureFileMetadata(
    projectBasePath: string,
    projectId: number,
    options: CaptureOptions = {}
  ): Promise<Record<string, { hash: string; size: number }>> {
    const snapshot = await this.captureFileState(projectBasePath, projectId, options);
    
    const metadata: Record<string, { hash: string; size: number }> = {};
    for (const file of snapshot.files) {
      metadata[file.path] = { hash: file.hash, size: file.size };
    }

    return metadata;
  }

  /**
   * Check if a file has changed since a snapshot
   */
  async hasFileChanged(
    filePath: string,
    originalHash: string
  ): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const currentHash = this.computeHash(content);
      return currentHash !== originalHash;
    } catch (error) {
      // File doesn't exist or can't be read - consider it changed
      return true;
    }
  }
}

export const workspaceSnapshotService = new WorkspaceSnapshotService();

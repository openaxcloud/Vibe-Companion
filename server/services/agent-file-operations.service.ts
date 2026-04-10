// @ts-nocheck
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { db } from '../db';
import {
  fileOperations,
  agentSessions,
  agentAuditTrail,
  files,
  type FileOperation,
  type InsertFileOperation,
  type AgentSession
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('file-ops');
import { diff_match_patch } from 'diff-match-patch';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';

// File operation events for real-time streaming
export interface FileOperationEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  operation: string;
  filePath: string;
  sessionId: string;
  details?: any;
  error?: string;
}

export class AgentFileOperationsService extends EventEmitter {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_EXTENSIONS = [
    // JavaScript/TypeScript
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.jsonc',
    // Web
    '.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl',
    // Images and media
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif',
    // Fonts
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    // Frameworks
    '.vue', '.svelte', '.astro',
    // Documentation
    '.md', '.mdx', '.txt', '.rst',
    // Config files
    '.yml', '.yaml', '.toml', '.xml', '.ini', '.cfg', '.conf',
    '.env', '.local', '.development', '.production', '.staging', '.test', '.example',
    '.gitignore', '.gitattributes', '.editorconfig', '.prettierrc', '.eslintrc',
    '.babelrc', '.nvmrc', '.npmrc', '.yarnrc',
    // Backend languages
    '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.sh', '.bash', '.zsh',
    '.sql', '.graphql', '.gql', '.prisma',
    // Other
    '.map', '.lock', '.log', '.csv', '.tsv', '.ejs', '.hbs', '.pug', '.njk',
    '.dockerfile', '.dockerignore', '.makefile', '.cmake'
  ];
  
  // Special files that don't have standard extensions
  private readonly ALLOWED_SPECIAL_FILES = [
    '.env', '.env.local', '.env.development', '.env.production', '.env.staging', '.env.test', '.env.example',
    '.gitignore', '.gitattributes', '.editorconfig', '.prettierrc', '.eslintrc', '.babelrc',
    '.eslintignore', '.prettierignore', '.dockerignore', '.npmignore', '.stylelintignore',
    '.nvmrc', '.npmrc', '.yarnrc', 'Dockerfile', 'Makefile', 'CMakeLists.txt',
    'package.json', 'tsconfig.json', 'tailwind.config.js', 'vite.config.ts',
    'next.config.js', 'next.config.mjs', 'postcss.config.js', 'webpack.config.js'
  ];
  private fileWatcher?: chokidar.FSWatcher;
  private diffTool = new diff_match_patch();

  constructor() {
    super();
  }

  // Initialize file watcher for real-time monitoring
  async initializeWatcher(projectPath: string) {
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }

    this.fileWatcher = chokidar.watch(projectPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });

    this.fileWatcher
      .on('add', path => this.emit('file:added', path))
      .on('change', path => this.emit('file:changed', path))
      .on('unlink', path => this.emit('file:deleted', path));
  }

  // Create or update a file with version control
  async createOrUpdateFile(
    sessionId: string,
    filePath: string,
    content: string,
    userId: string
  ): Promise<FileOperation> {
    try {
      // Validate session
      const session = await this.validateSession(sessionId);
      
      // Security checks
      this.validateFilePath(filePath);
      this.validateFileSize(content);
      
      // Get absolute path
      const absolutePath = this.getAbsolutePath(filePath, session.context?.workingDirectory || '.');
      
      // Check if file exists for versioning
      let previousContent: string | null = null;
      let operationType: 'file_create' | 'file_update' = 'file_create';
      
      try {
        previousContent = await fs.readFile(absolutePath, 'utf-8');
        operationType = 'file_update';
      } catch (err) {
        // File doesn't exist, will create
      }

      // Calculate checksum
      const checksum = this.calculateChecksum(content);
      
      // Create file operation record
      const operation: InsertFileOperation = {
        sessionId,
        operationType,
        filePath,
        content,
        previousContent,
        checksum,
        status: 'in_progress',
        metadata: {
          fileSize: Buffer.byteLength(content),
          mimeType: this.getMimeType(filePath),
          encoding: 'utf-8',
          diff: previousContent ? this.createDiff(previousContent, content) : undefined
        }
      };

      // Start operation
      this.emitProgress(sessionId, 'start', operationType, filePath);
      
      const [fileOp] = await db.insert(fileOperations).values(operation).returning();
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      
      // Write file
      await fs.writeFile(absolutePath, content, 'utf-8');
      
      // ✅ CRITICAL FIX (Dec 1, 2025): Also insert into files table for IDE visibility
      // Get projectId from session context - cast to access additional properties
      const contextWithProject = session.context as { projectId?: number } | undefined;
      const projectId = contextWithProject?.projectId;
      if (projectId) {
        try {
          // Parse file path components
          const fileName = path.basename(filePath);
          // Normalize path: remove leading ./ or / for consistency
          const normalizedPath = filePath.replace(/^\.\//, '').replace(/^\//, '');
          const fileType = this.getFileType(filePath);
          const fileSize = Buffer.byteLength(content);
          
          // Check if file exists in files table (check both formats)
          const existingFiles = await db.select()
            .from(files)
            .where(and(
              eq(files.projectId, projectId),
              sql`(${files.path} = ${normalizedPath} OR ${files.path} = ${'/' + normalizedPath} OR ${files.path} = ${'./' + normalizedPath})`
            ))
            .limit(1);
          
          const existingFile = existingFiles[0];
          
          if (existingFile) {
            // Update existing file record
            await db.update(files)
              .set({
                content,
                size: fileSize,
                updatedAt: new Date()
              })
              .where(eq(files.id, existingFile.id));
            logger.info(`[FileOps] Updated file record in files table: ${normalizedPath}`);
          } else {
            // For nested paths, create parent directory records
            const parentPath = path.dirname(normalizedPath);
            let parentId: number | null = null;
            
            // Only create parent dirs if there's actually a parent (not root level)
            if (parentPath && parentPath !== '.' && parentPath !== '') {
              parentId = await this.ensureParentDirectories(projectId, parentPath);
            }
            
            // Insert new file record - use snake_case column names as per actual DB schema
            await db.insert(files).values({
              name: fileName,
              path: normalizedPath,
              content,
              projectId,
              parentId,
              isDirectory: false,
              type: fileType,
              size: fileSize
            });
            logger.info(`[FileOps] Inserted file record into files table: ${normalizedPath}`);
          }
        } catch (filesTableError: any) {
          // Log but don't fail - files table sync is secondary to actual file creation
          logger.warn(`[FileOps] Failed to sync to files table: ${filesTableError.message}`);
        }
      }
      
      // Update operation status
      await db.update(fileOperations)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          executedAt: new Date()
        })
        .where(eq(fileOperations.id, fileOp.id));

      // Audit trail
      await this.createAuditEntry(sessionId, userId, operationType, filePath);
      
      // Emit completion
      this.emitProgress(sessionId, 'complete', operationType, filePath, {
        checksum,
        size: Buffer.byteLength(content)
      });

      return fileOp;
    } catch (error: any) {
      this.emitProgress(sessionId, 'error', 'file_operation', filePath, null, error.message);
      throw error;
    }
  }

  // Read file with caching
  async readFile(
    sessionId: string,
    filePath: string,
    userId: string
  ): Promise<{ content: string; metadata: any }> {
    try {
      const session = await this.validateSession(sessionId);
      this.validateFilePath(filePath);
      
      const absolutePath = this.getAbsolutePath(filePath, session.context?.workingDirectory || '.');
      
      // Read file
      const content = await fs.readFile(absolutePath, 'utf-8');
      const stats = await fs.stat(absolutePath);
      
      // Log read operation
      await db.insert(fileOperations).values({
        sessionId,
        operationType: 'file_read',
        filePath,
        status: 'completed',
        executedAt: new Date(),
        completedAt: new Date(),
        metadata: {
          fileSize: stats.size,
          mimeType: this.getMimeType(filePath),
          lastModified: stats.mtime
        }
      });

      await this.createAuditEntry(sessionId, userId, 'file_read', filePath);
      
      return {
        content,
        metadata: {
          size: stats.size,
          mimeType: this.getMimeType(filePath),
          lastModified: stats.mtime,
          checksum: this.calculateChecksum(content)
        }
      };
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  // Delete file with backup
  async deleteFile(
    sessionId: string,
    filePath: string,
    userId: string
  ): Promise<FileOperation> {
    try {
      const session = await this.validateSession(sessionId);
      this.validateFilePath(filePath);
      
      const absolutePath = this.getAbsolutePath(filePath, session.context?.workingDirectory || '.');
      
      // Read file for backup
      const previousContent = await fs.readFile(absolutePath, 'utf-8');
      
      // Create operation record
      const [fileOp] = await db.insert(fileOperations).values({
        sessionId,
        operationType: 'file_delete',
        filePath,
        previousContent,
        status: 'in_progress',
        metadata: {
          fileSize: Buffer.byteLength(previousContent),
          mimeType: this.getMimeType(filePath)
        }
      }).returning();

      // Delete file
      await fs.unlink(absolutePath);
      
      // Update operation status
      await db.update(fileOperations)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          executedAt: new Date()
        })
        .where(eq(fileOperations.id, fileOp.id));

      await this.createAuditEntry(sessionId, userId, 'file_delete', filePath);
      
      this.emitProgress(sessionId, 'complete', 'file_delete', filePath);
      
      return fileOp;
    } catch (error: any) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  // Rename or move file
  async renameFile(
    sessionId: string,
    oldPath: string,
    newPath: string,
    userId: string
  ): Promise<FileOperation> {
    try {
      const session = await this.validateSession(sessionId);
      this.validateFilePath(oldPath);
      this.validateFilePath(newPath);
      
      const workingDir = session.context?.workingDirectory || '.';
      const absoluteOldPath = this.getAbsolutePath(oldPath, workingDir);
      const absoluteNewPath = this.getAbsolutePath(newPath, workingDir);
      
      // Read content for backup
      const content = await fs.readFile(absoluteOldPath, 'utf-8');
      
      // Create operation record
      const [fileOp] = await db.insert(fileOperations).values({
        sessionId,
        operationType: 'file_rename',
        filePath: oldPath,
        newPath,
        content,
        status: 'in_progress',
        metadata: {
          fileSize: Buffer.byteLength(content),
          mimeType: this.getMimeType(newPath)
        }
      }).returning();

      // Ensure target directory exists
      await fs.mkdir(path.dirname(absoluteNewPath), { recursive: true });
      
      // Rename/move file
      await fs.rename(absoluteOldPath, absoluteNewPath);
      
      // Update operation status
      await db.update(fileOperations)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          executedAt: new Date()
        })
        .where(eq(fileOperations.id, fileOp.id));

      await this.createAuditEntry(sessionId, userId, 'file_rename', `${oldPath} -> ${newPath}`);
      
      return fileOp;
    } catch (error: any) {
      throw new Error(`Failed to rename file: ${error.message}`);
    }
  }

  // List directory contents
  async listDirectory(
    sessionId: string,
    dirPath: string,
    recursive: boolean = false
  ): Promise<any[]> {
    try {
      const session = await this.validateSession(sessionId);
      const absolutePath = this.getAbsolutePath(dirPath, session.context?.workingDirectory || '.');
      
      const items: any[] = [];
      
      if (recursive) {
        // Recursive directory walk
        const walk = async (dir: string) => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(absolutePath, fullPath);
            
            if (entry.isDirectory()) {
              items.push({
                type: 'directory',
                name: entry.name,
                path: relativePath
              });
              await walk(fullPath);
            } else {
              const stats = await fs.stat(fullPath);
              items.push({
                type: 'file',
                name: entry.name,
                path: relativePath,
                size: stats.size,
                modified: stats.mtime
              });
            }
          }
        };
        
        await walk(absolutePath);
      } else {
        // Non-recursive listing
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(absolutePath, entry.name);
          
          if (entry.isDirectory()) {
            items.push({
              type: 'directory',
              name: entry.name
            });
          } else {
            const stats = await fs.stat(fullPath);
            items.push({
              type: 'file',
              name: entry.name,
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
      }
      
      return items;
    } catch (error: any) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  // Rollback file operation
  async rollbackOperation(
    operationId: string,
    sessionId: string,
    userId: string
  ): Promise<FileOperation> {
    try {
      // Get original operation
      const [originalOp] = await db.select()
        .from(fileOperations)
        .where(eq(fileOperations.id, operationId));
      
      if (!originalOp) {
        throw new Error('Operation not found');
      }
      
      if (!originalOp.previousContent && originalOp.operationType !== 'file_create') {
        throw new Error('Cannot rollback: no previous content available');
      }
      
      const session = await this.validateSession(sessionId);
      const absolutePath = this.getAbsolutePath(
        originalOp.filePath, 
        session.context?.workingDirectory || '.'
      );
      
      // Determine rollback action
      let rollbackOp: InsertFileOperation;
      
      if (originalOp.operationType === 'file_create' || originalOp.operationType === 'file_delete') {
        // For create, we delete; for delete, we recreate
        if (originalOp.operationType === 'file_create') {
          await fs.unlink(absolutePath);
          rollbackOp = {
            sessionId,
            operationType: 'file_delete',
            filePath: originalOp.filePath,
            status: 'completed',
            rollbackOf: operationId
          };
        } else {
          await fs.writeFile(absolutePath, originalOp.previousContent!, 'utf-8');
          rollbackOp = {
            sessionId,
            operationType: 'file_create',
            filePath: originalOp.filePath,
            content: originalOp.previousContent!,
            status: 'completed',
            rollbackOf: operationId
          };
        }
      } else if (originalOp.operationType === 'file_update') {
        // Restore previous content
        await fs.writeFile(absolutePath, originalOp.previousContent!, 'utf-8');
        rollbackOp = {
          sessionId,
          operationType: 'file_update',
          filePath: originalOp.filePath,
          content: originalOp.previousContent!,
          status: 'completed',
          rollbackOf: operationId
        };
      } else if (originalOp.operationType === 'file_rename' || originalOp.operationType === 'file_move') {
        // Reverse the rename/move
        const oldAbsPath = this.getAbsolutePath(
          originalOp.newPath!, 
          session.context?.workingDirectory || '.'
        );
        await fs.rename(oldAbsPath, absolutePath);
        rollbackOp = {
          sessionId,
          operationType: 'file_rename',
          filePath: originalOp.newPath!,
          newPath: originalOp.filePath,
          status: 'completed',
          rollbackOf: operationId
        };
      } else {
        throw new Error(`Cannot rollback operation type: ${originalOp.operationType}`);
      }
      
      const [rolledBack] = await db.insert(fileOperations)
        .values({
          ...rollbackOp,
          executedAt: new Date(),
          completedAt: new Date()
        })
        .returning();
      
      // Update original operation
      await db.update(fileOperations)
        .set({ status: 'rolled_back' })
        .where(eq(fileOperations.id, operationId));
      
      await this.createAuditEntry(sessionId, userId, 'file_rollback', originalOp.filePath);
      
      return rolledBack;
    } catch (error: any) {
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  // Get file operation history
  async getOperationHistory(
    sessionId: string,
    filePath?: string,
    limit: number = 50
  ): Promise<FileOperation[]> {
    let query = db.select()
      .from(fileOperations)
      .where(eq(fileOperations.sessionId, sessionId))
      .orderBy(desc(fileOperations.executedAt))
      .limit(limit);
    
    if (filePath) {
      query = query.where(and(
        eq(fileOperations.sessionId, sessionId),
        eq(fileOperations.filePath, filePath)
      ));
    }
    
    return await query;
  }

  // Private helper methods
  private async validateSession(sessionId: string): Promise<AgentSession> {
    const [session] = await db.select()
      .from(agentSessions)
      .where(and(
        eq(agentSessions.id, sessionId),
        eq(agentSessions.isActive, true)
      ));
    
    if (!session) {
      throw new Error('Invalid or inactive session');
    }
    
    return session;
  }

  private validateFilePath(filePath: string) {
    // Security: prevent directory traversal
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      throw new Error('Invalid file path');
    }
    
    // Get the file name (without directories)
    const fileName = path.basename(filePath).toLowerCase();
    
    // ✅ CRITICAL FIX (Dec 3, 2025): Smart extension handling for dotfiles and compound extensions
    // Check if it's a special file that's always allowed
    if (this.ALLOWED_SPECIAL_FILES.some(f => fileName === f.toLowerCase() || fileName.endsWith(f.toLowerCase()))) {
      return; // Valid
    }
    
    // For dotfiles like .env.local, check if the base is .env
    if (fileName.startsWith('.env')) {
      return; // All .env variants are allowed
    }
    
    // Standard extension check
    const ext = path.extname(filePath).toLowerCase();
    if (ext && !this.ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`File extension not allowed: ${ext}`);
    }
    
    // Handle files with no extension (like Dockerfile, Makefile, etc.)
    if (!ext && !this.ALLOWED_SPECIAL_FILES.includes(fileName)) {
      // Allow common extensionless config files
      const allowedNoExt = ['dockerfile', 'makefile', 'procfile', 'gemfile', 'rakefile', 'readme', 'license', 'changelog'];
      if (!allowedNoExt.includes(fileName)) {
        throw new Error(`File without allowed extension: ${fileName}`);
      }
    }
  }

  private validateFileSize(content: string) {
    const size = Buffer.byteLength(content);
    if (size > this.MAX_FILE_SIZE) {
      throw new Error(`File too large: ${size} bytes (max: ${this.MAX_FILE_SIZE})`);
    }
  }

  private getAbsolutePath(filePath: string, workingDir: string): string {
    // Ensure we stay within project boundaries
    const projectRoot = process.cwd();
    const resolved = path.resolve(projectRoot, workingDir, filePath);
    
    if (!resolved.startsWith(projectRoot)) {
      throw new Error('File path outside project boundaries');
    }
    
    return resolved;
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.jsx': 'application/javascript',
      '.ts': 'application/typescript',
      '.tsx': 'application/typescript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.py': 'text/x-python',
      '.java': 'text/x-java',
      '.cpp': 'text/x-c++',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.rb': 'text/x-ruby',
      '.php': 'text/x-php',
      '.sh': 'text/x-shellscript',
      '.yml': 'text/x-yaml',
      '.yaml': 'text/x-yaml',
      '.xml': 'text/xml',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain'
    };
    
    return mimeTypes[ext] || 'text/plain';
  }

  // ✅ CRITICAL FIX (Dec 1, 2025): Get file type for IDE files table
  private getFileType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase().slice(1); // Remove leading dot
    const typeMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'sh': 'shell',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'svg': 'svg',
      'txt': 'text'
    };
    return typeMap[ext] || 'text';
  }

  // ✅ CRITICAL FIX (Dec 1, 2025): Ensure parent directories exist in files table
  private async ensureParentDirectories(projectId: number, dirPath: string): Promise<number | null> {
    // Normalize and split path
    const normalizedDirPath = dirPath.replace(/^\.\//, '').replace(/^\//, '');
    const parts = normalizedDirPath.split('/').filter(p => p && p !== '.');
    
    if (parts.length === 0) return null;
    
    let currentParentId: number | null = null;
    let currentPath = '';
    
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      // Check if directory exists (check multiple path formats)
      const existingDirs = await db.select()
        .from(files)
        .where(and(
          eq(files.projectId, projectId),
          eq(files.isDirectory, true),
          sql`(${files.path} = ${currentPath} OR ${files.path} = ${'/' + currentPath} OR ${files.name} = ${part})`
        ))
        .limit(1);
      
      const existing = existingDirs[0];
      
      if (existing) {
        currentParentId = existing.id;
      } else {
        // Create directory entry
        const inserted = await db.insert(files).values({
          name: part,
          path: currentPath,
          content: '',
          projectId,
          parentId: currentParentId,
          isDirectory: true,
          type: 'folder',
          size: 0
        }).returning();
        const newDir = inserted[0];
        currentParentId = newDir.id;
        logger.info(`[FileOps] Created directory in files table: ${currentPath}`);
      }
    }
    
    return currentParentId;
  }

  private createDiff(oldContent: string, newContent: string): string {
    const diffs = this.diffTool.diff_main(oldContent, newContent);
    this.diffTool.diff_cleanupSemantic(diffs);
    return this.diffTool.patch_toText(this.diffTool.patch_make(oldContent, diffs));
  }

  private emitProgress(
    sessionId: string,
    type: 'start' | 'progress' | 'complete' | 'error',
    operation: string,
    filePath: string,
    details?: any,
    error?: string
  ) {
    const event: FileOperationEvent = {
      type,
      operation,
      filePath,
      sessionId,
      details,
      error
    };
    
    this.emit('operation:progress', event);
  }

  private async createAuditEntry(
    sessionId: string,
    userId: string,
    action: string,
    resourceId: string
  ) {
    await db.insert(agentAuditTrail).values({
      sessionId,
      userId,
      action,
      resourceType: 'file',
      resourceId,
      severity: 'info',
      details: { timestamp: new Date().toISOString() }
    });
  }

  // Cleanup on service shutdown
  async cleanup() {
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }
  }
}

// Export singleton instance
export const agentFileOperations = new AgentFileOperationsService();
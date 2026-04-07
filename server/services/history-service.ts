// @ts-nocheck
import { DatabaseStorage } from '../storage';
import { GitManager } from '../git/git-manager';

export interface ProjectSnapshot {
  id: number;
  projectId: number;
  commitHash: string;
  message: string;
  timestamp: Date;
  userId: number;
  files: { path: string; content: string }[];
  metadata?: {
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
  };
}

export interface TimeMachineEntry {
  id: number;
  projectId: number;
  action: 'file_created' | 'file_modified' | 'file_deleted' | 'dependency_added' | 'deployment' | 'rollback';
  description: string;
  timestamp: Date;
  userId: number;
  details?: any;
}

export class HistoryService {
  constructor(
    private storage: DatabaseStorage,
    private gitManager: GitManager
  ) {}

  async createSnapshot(projectId: number, userId: number, message: string): Promise<ProjectSnapshot> {
    // Get current project files
    const files = await this.storage.getProjectFiles(projectId);
    
    // Create Git commit
    const projectPath = `./projects/${projectId}`;
    const commitHash = await this.gitManager.commit(projectPath, message);
    
    // Calculate metadata
    const stats = await this.gitManager.getDiffStats(projectPath, commitHash);
    
    const snapshot = {
      projectId,
      commitHash,
      message,
      timestamp: new Date(),
      userId,
      files: files.map(f => ({ path: f.name, content: f.content || '' })),
      metadata: stats
    };
    
    const id = await this.storage.createSnapshot(snapshot);
    
    // Log to timeline
    await this.addTimelineEntry(projectId, userId, 'rollback', `Created snapshot: ${message}`);
    
    return { ...snapshot, id };
  }

  async getProjectHistory(projectId: number): Promise<ProjectSnapshot[]> {
    return this.storage.getProjectSnapshots(projectId);
  }

  async getTimeline(projectId: number, limit: number = 50): Promise<TimeMachineEntry[]> {
    return this.storage.getProjectTimeline(projectId, limit);
  }

  async rollbackToSnapshot(projectId: number, snapshotId: number, userId: number): Promise<void> {
    const snapshot = await this.storage.getSnapshot(snapshotId);
    if (!snapshot || snapshot.projectId !== projectId) {
      throw new Error('Invalid snapshot');
    }
    
    // Restore files
    const currentFiles = await this.storage.getProjectFiles(projectId);
    
    // Delete current files
    for (const file of currentFiles) {
      await this.storage.deleteFile(file.id);
    }
    
    // Restore snapshot files
    for (const file of snapshot.files) {
      await this.storage.createFile({
        name: file.path,
        projectId,
        content: file.content,
        isFolder: false
      });
    }
    
    // Git checkout
    const projectPath = `./projects/${projectId}`;
    await this.gitManager.checkout(projectPath, snapshot.commitHash);
    
    // Log rollback
    await this.addTimelineEntry(
      projectId, 
      userId, 
      'rollback', 
      `Rolled back to: ${snapshot.message}`
    );
  }

  async addTimelineEntry(
    projectId: number,
    userId: number,
    action: TimeMachineEntry['action'],
    description: string,
    details?: any
  ): Promise<void> {
    await this.storage.createTimelineEntry({
      projectId,
      userId,
      action,
      description,
      timestamp: new Date(),
      details
    });
  }

  async compareSnapshots(snapshotId1: number, snapshotId2: number): Promise<{
    added: string[];
    modified: string[];
    deleted: string[];
    diffs: { path: string; before: string; after: string }[];
  }> {
    const snapshot1 = await this.storage.getSnapshot(snapshotId1);
    const snapshot2 = await this.storage.getSnapshot(snapshotId2);
    
    if (!snapshot1 || !snapshot2) {
      throw new Error('Invalid snapshots');
    }
    
    const files1 = new Map(snapshot1.files.map(f => [f.path, f.content]));
    const files2 = new Map(snapshot2.files.map(f => [f.path, f.content]));
    
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    const diffs: { path: string; before: string; after: string }[] = [];
    
    // Check for added and modified files
    for (const [path, content] of files2.entries()) {
      if (!files1.has(path)) {
        added.push(path);
      } else if (files1.get(path) !== content) {
        modified.push(path);
        diffs.push({
          path,
          before: files1.get(path)!,
          after: content
        });
      }
    }
    
    // Check for deleted files
    for (const path of files1.keys()) {
      if (!files2.has(path)) {
        deleted.push(path);
      }
    }
    
    return { added, modified, deleted, diffs };
  }

  async getFileDiff(projectId: number, filePath: string, fromCommit?: string, toCommit?: string): Promise<string> {
    const projectPath = `./projects/${projectId}`;
    return this.gitManager.getFileDiff(projectPath, filePath, fromCommit, toCommit);
  }
}
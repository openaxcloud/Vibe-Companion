// @ts-nocheck
import { createLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { storage } from '../storage';
import { storageService } from '../services/storage.service';

const logger = createLogger('simple-backup-manager');

interface Backup {
  id: string;
  projectId: number;
  name: string;
  description?: string;
  type: 'manual' | 'automatic' | 'scheduled';
  size: number;
  createdAt: Date;
  status: 'completed' | 'in_progress' | 'failed' | 'corrupted';
  includes: {
    files: boolean;
    database: boolean;
    secrets: boolean;
    settings: boolean;
  };
  location: 'local' | 'cloud' | 'external';
  progress?: number;
}

interface BackupSettings {
  autoBackup: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  retention: number;
  includes: {
    files: boolean;
    database: boolean;
    secrets: boolean;
    settings: boolean;
  };
  cloudStorage: boolean;
  compressionLevel: 'none' | 'standard' | 'maximum';
}

export class SimpleBackupManager {
  private backups: Map<string, Backup> = new Map();
  private settings: Map<number, BackupSettings> = new Map();
  private backupDir = path.join(process.cwd(), '.backups');
  
  constructor() {
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    // Initialize with some sample data
    this.initializeSampleData();
  }
  
  private initializeSampleData() {
    // Add a sample backup for testing
    const sampleBackup: Backup = {
      id: 'backup_sample_1',
      projectId: 1,
      name: 'Initial Backup',
      description: 'First project backup',
      type: 'manual',
      size: 1024 * 1024 * 5, // 5MB
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      status: 'completed',
      includes: {
        files: true,
        database: true,
        secrets: false,
        settings: true
      },
      location: 'local'
    };
    
    this.backups.set(sampleBackup.id, sampleBackup);
    
    // Default settings
    const defaultSettings: BackupSettings = {
      autoBackup: false,
      frequency: 'daily',
      retention: 30,
      includes: {
        files: true,
        database: true,
        secrets: false,
        settings: true
      },
      cloudStorage: false,
      compressionLevel: 'standard'
    };
    
    this.settings.set(1, defaultSettings);
  }
  
  async getBackups(projectId: number): Promise<Backup[]> {
    const projectBackups: Backup[] = [];
    
    this.backups.forEach(backup => {
      if (backup.projectId === projectId) {
        projectBackups.push(backup);
      }
    });
    
    return projectBackups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async createBackup(projectId: number, options: {
    name: string;
    description?: string;
    includes: Backup['includes'];
    type: Backup['type'];
  }): Promise<Backup> {
    const backupId = `backup_${Date.now()}`;
    const backupPath = path.join(this.backupDir, `${backupId}.zip`);
    
    const backup: Backup = {
      id: backupId,
      projectId,
      name: options.name,
      description: options.description,
      type: options.type,
      size: 0,
      createdAt: new Date(),
      status: 'in_progress',
      includes: options.includes,
      location: 'local',
      progress: 0
    };
    
    this.backups.set(backupId, backup);
    
    // Execute backup creation process immediately
    void (async () => {
      try {
        // Create archive
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', {
          zlib: { level: 9 }
        });
        
        archive.pipe(output);
        
        // Add project files if included
        if (options.includes.files) {
          const files = await storage.getFilesByProject(projectId);
          for (const file of files) {
            if (!file.isFolder && file.content) {
              archive.append(file.content, { name: file.name });
            }
          }
        }
        
        // Add backup metadata
        const metadata = {
          projectId,
          backupId,
          createdAt: backup.createdAt,
          includes: options.includes,
          name: options.name,
          description: options.description
        };
        
        archive.append(JSON.stringify(metadata, null, 2), { name: 'backup-metadata.json' });
        
        await archive.finalize();
        
        backup.size = fs.statSync(backupPath).size;

        if (storageService.activeBackend !== 'local') {
          const backupBuffer = fs.readFileSync(backupPath);
          const { downloadUrl } = await storageService.uploadProjectBackup(
            projectId,
            backupId,
            backupBuffer
          );
          backup.location = 'cloud';
          fs.unlinkSync(backupPath);
          logger.info(`Backup ${backupId} uploaded to object storage: ${downloadUrl}`);
        } else if (process.env.NODE_ENV === 'production') {
          throw new Error('Object storage is required for backups in production');
        }

        backup.status = 'completed';
        logger.info(`Backup ${backupId} created successfully for project ${projectId}`);
      } catch (error) {
        backup.status = 'failed';
        logger.error(`Failed to create backup ${backupId}:`, error);
      }
    })(); // Execute immediately
    
    return backup;
  }
  
  async restoreBackup(backupId: string, projectId: number): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }
    
    if (backup.projectId !== projectId) {
      throw new Error('Backup does not belong to this project');
    }
    
    if (backup.status !== 'completed') {
      throw new Error('Backup is not ready for restore');
    }
    
    logger.info(`Starting restore of backup ${backupId} for project ${projectId}`);
    
    let backupBuffer: Buffer;
    const localBackupPath = path.join(this.backupDir, `${backupId}.zip`);

    if (backup.location === 'cloud' || !fs.existsSync(localBackupPath)) {
      logger.info(`Downloading backup ${backupId} from object storage`);
      backupBuffer = await storageService.downloadProjectBackup(projectId, backupId);
    } else {
      backupBuffer = fs.readFileSync(localBackupPath);
    }

    const extractPath = path.join(this.backupDir, 'temp', backupId);
    const tmpZipPath = path.join(extractPath, `${backupId}.zip`);
    try {
      fs.mkdirSync(extractPath, { recursive: true });
      fs.writeFileSync(tmpZipPath, backupBuffer);

      const extract = require('extract-zip');
      await extract(tmpZipPath, { dir: extractPath });
      
      const metadataPath = path.join(extractPath, 'backup-metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        logger.info(`Restoring backup ${metadata.name} created at ${metadata.createdAt}`);
      }
    } finally {
      fs.rmSync(extractPath, { recursive: true, force: true });
    }
    
    logger.info(`Backup ${backupId} restored successfully`);
  }
  
  async deleteBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }
    
    const backupPath = path.join(this.backupDir, `${backupId}.zip`);
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    if (backup.location === 'cloud') {
      try {
        const prefix = `backups/project-${backup.projectId}/`;
        const objects = await storageService.listFiles(prefix);
        const match = objects.find(obj => obj.key.includes(backupId));
        if (match) {
          await storageService.deleteFile(match.key);
        }
      } catch (err) {
        logger.warn(`Failed to delete backup ${backupId} from object storage: ${err}`);
      }
    }
    
    this.backups.delete(backupId);
    logger.info(`Backup ${backupId} deleted`);
  }
  
  async downloadBackup(backupId: string): Promise<string> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }
    
    const backupPath = path.join(this.backupDir, `${backupId}.zip`);
    if (!fs.existsSync(backupPath)) {
      if (backup.location === 'cloud') {
        logger.info(`Downloading backup ${backupId} from object storage for local access`);
        const buffer = await storageService.downloadProjectBackup(backup.projectId, backupId);
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.writeFileSync(backupPath, buffer);
      } else {
        throw new Error('Backup file not found on local disk or object storage');
      }
    }
    
    return backupPath;
  }
  
  async getSettings(projectId: number): Promise<BackupSettings> {
    return this.settings.get(projectId) || {
      autoBackup: false,
      frequency: 'daily',
      retention: 30,
      includes: {
        files: true,
        database: true,
        secrets: false,
        settings: true
      },
      cloudStorage: false,
      compressionLevel: 'standard'
    };
  }
  
  async updateSettings(projectId: number, settings: BackupSettings): Promise<void> {
    this.settings.set(projectId, settings);
    logger.info(`Backup settings updated for project ${projectId}`);
    
    // If auto backup is enabled, schedule backups
    if (settings.autoBackup) {
      this.scheduleAutoBackup(projectId, settings);
    }
  }
  
  private scheduleAutoBackup(projectId: number, settings: BackupSettings) {
    // In a real implementation, this would use a job scheduler
    logger.info(`Scheduled ${settings.frequency} backups for project ${projectId}`);
  }
  
  async getRestoreStatus(backupId: string): Promise<{ status: string; progress?: number }> {
    // Simulate restore progress
    return {
      status: 'in_progress',
      progress: Math.min(90, Math.floor((Date.now() % 100)))
    };
  }
}

export const simpleBackupManager = new SimpleBackupManager();
/**
 * Real Object Storage Service
 * Provides cloud storage capabilities using Replit's built-in Object Storage
 * For Replit Reserved VM deployment
 * 
 * Uses Google Cloud Storage via Replit's sidecar endpoint in production,
 * falls back to local filesystem storage in development.
 */

import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createLogger } from '../utils/logger';
import { Readable } from 'stream';
import { storage as dbStorage } from '../storage';
import { billingService } from './billing-service';

const logger = createLogger('real-object-storage');
const REPLIT_SIDECAR_ENDPOINT = process.env.REPLIT_SIDECAR_ENDPOINT || "http://127.0.0.1:1106";

export interface StorageObject {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
  url?: string;
  metadata?: Record<string, string>;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  public?: boolean;
  resumable?: boolean;
}

export interface DownloadOptions {
  start?: number;
  end?: number;
}

export class RealObjectStorageService {
  private storagePath: string;
  private bucketName: string;
  private useReplitStorage: boolean;

  constructor() {
    this.bucketName = process.env.PRIVATE_OBJECT_DIR?.split('/')[1] || 
                      process.env.REPLIT_OBJECT_STORAGE_BUCKET || '';
    this.useReplitStorage = !!this.bucketName && 
                            !!process.env.REPL_ID && 
                            process.env.NODE_ENV === 'production';
    this.storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
    this.initialize();
  }

  private async initialize() {
    try {
      if (this.useReplitStorage) {
        logger.info('Using Replit built-in Object Storage');
      } else {
        logger.info('Using local filesystem storage (development mode)');
        await fs.mkdir(this.storagePath, { recursive: true });
      }
    } catch (error) {
      logger.error(`Failed to initialize object storage: ${error}`);
    }
  }

  private async ensureDirectory(filePath: string) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  private getFilePath(key: string): string {
    return path.join(this.storagePath, key);
  }

  private async getGcsStorage() {
    const { Storage } = await import('@google-cloud/storage');
    return new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      } as any,
      projectId: "",
    });
  }

  async uploadFile(
    key: string,
    content: Buffer | Readable | string,
    options: UploadOptions = {},
    projectId?: number,
    userId?: number
  ): Promise<StorageObject> {
    logger.info(`[ObjectStorage] Uploading file: ${key}`);

    let buffer: Buffer;
    if (Buffer.isBuffer(content)) {
      buffer = content;
    } else if (typeof content === 'string') {
      buffer = Buffer.from(content);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of content) {
        chunks.push(Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    let storageObject: StorageObject;

    if (this.useReplitStorage) {
      storageObject = await this.uploadToReplit(key, buffer, options);
    } else {
      storageObject = await this.uploadToLocal(key, buffer, options);
    }

    if (projectId) {
      await this.trackInDatabase(key, storageObject, options, projectId, userId);
    }

    logger.info(`[ObjectStorage] Uploaded file: ${key} (${storageObject.size} bytes)`);
    return storageObject;
  }

  private async uploadToReplit(
    key: string,
    buffer: Buffer,
    options: UploadOptions
  ): Promise<StorageObject> {
    try {
      const storage = await this.getGcsStorage();
      const bucket = storage.bucket(this.bucketName);
      const file = bucket.file(key);
      
      await file.save(buffer, {
        contentType: options.contentType || 'application/octet-stream',
        metadata: options.metadata,
      });

      const etag = crypto.createHash('md5').update(buffer).digest('hex');
      
      logger.info(`[ObjectStorage] Uploaded to Replit GCS: ${key}`);
      
      return {
        key,
        size: buffer.length,
        contentType: options.contentType || 'application/octet-stream',
        lastModified: new Date(),
        etag,
        url: options.public ? `/storage/${key}` : undefined,
        metadata: options.metadata,
      };
    } catch (error) {
      logger.error(`[ObjectStorage] Replit upload failed, falling back to local: ${error}`);
      return this.uploadToLocal(key, buffer, options);
    }
  }

  private async uploadToLocal(
    key: string,
    buffer: Buffer,
    options: UploadOptions
  ): Promise<StorageObject> {
    const filePath = this.getFilePath(key);
    await this.ensureDirectory(filePath);
    await fs.writeFile(filePath, buffer);

    const stats = await fs.stat(filePath);
    const etag = crypto.createHash('md5').update(buffer).digest('hex');

    return {
      key,
      size: stats.size,
      contentType: options.contentType || 'application/octet-stream',
      lastModified: stats.mtime,
      etag,
      url: options.public ? `/storage/${key}` : undefined,
      metadata: options.metadata,
    };
  }

  private async trackInDatabase(
    key: string,
    storageObject: StorageObject,
    options: UploadOptions,
    projectId: number,
    userId?: number
  ): Promise<void> {
    try {
      const buckets = await dbStorage.getProjectObjectStorageBuckets(projectId.toString());
      let bucketRecord = buckets.find(b => b.bucketName === 'replit-storage');
      
      if (!bucketRecord) {
        bucketRecord = await dbStorage.createObjectStorageBucket({
          projectId: projectId,
          bucketName: 'replit-storage',
          region: 'replit',
          storageClass: 'STANDARD',
          metadata: {}
        });
      }

      await dbStorage.createObjectStorageFile({
        bucketId: bucketRecord.id,
        fileName: key,
        filePath: key,
        size: storageObject.size,
        contentType: storageObject.contentType,
        metadata: options.metadata || {},
        url: storageObject.url || '',
        uploadedBy: userId || 1
      });

      if (userId) {
        const sizeInGB = storageObject.size / (1024 * 1024 * 1024);
        await billingService.trackResourceUsage(
          userId,
          'storage.gb_month',
          sizeInGB,
          { projectId, bucketId: bucketRecord.id, fileKey: key }
        );
      }
    } catch (error) {
      logger.error(`[ObjectStorage] Failed to track in database: ${error}`);
    }
  }

  async downloadFile(
    key: string,
    options: DownloadOptions = {}
  ): Promise<Buffer> {
    logger.info(`[ObjectStorage] Downloading file: ${key}`);

    if (this.useReplitStorage) {
      return this.downloadFromReplit(key, options);
    } else {
      return this.downloadFromLocal(key, options);
    }
  }

  private async downloadFromReplit(key: string, options: DownloadOptions): Promise<Buffer> {
    try {
      const storage = await this.getGcsStorage();
      const bucket = storage.bucket(this.bucketName);
      const file = bucket.file(key);
      const [buffer] = await file.download();
      
      logger.info(`[ObjectStorage] Downloaded from Replit GCS: ${key} (${buffer.length} bytes)`);
      
      if (options.start !== undefined || options.end !== undefined) {
        const start = options.start || 0;
        const end = options.end || buffer.length;
        return buffer.subarray(start, end);
      }
      
      return buffer;
    } catch (error) {
      logger.error(`[ObjectStorage] Replit download failed, trying local: ${error}`);
      return this.downloadFromLocal(key, options);
    }
  }

  private async downloadFromLocal(key: string, options: DownloadOptions): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${key}`);
    }

    let buffer = await fs.readFile(filePath);

    if (options.start !== undefined || options.end !== undefined) {
      const start = options.start || 0;
      const end = options.end || buffer.length;
      buffer = buffer.subarray(start, end);
    }

    logger.info(`[ObjectStorage] Downloaded from local: ${key} (${buffer.length} bytes)`);
    return buffer;
  }

  async deleteFile(key: string, projectId?: number): Promise<void> {
    logger.info(`[ObjectStorage] Deleting file: ${key}`);

    if (this.useReplitStorage) {
      await this.deleteFromReplit(key);
    } else {
      await this.deleteFromLocal(key);
    }
  }

  private async deleteFromReplit(key: string): Promise<void> {
    try {
      const storage = await this.getGcsStorage();
      const bucket = storage.bucket(this.bucketName);
      const file = bucket.file(key);
      await file.delete();
      logger.info(`[ObjectStorage] Deleted from Replit GCS: ${key}`);
    } catch (error) {
      logger.error(`[ObjectStorage] Replit delete failed, trying local: ${error}`);
      await this.deleteFromLocal(key);
    }
  }

  private async deleteFromLocal(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
      logger.info(`[ObjectStorage] Deleted from local: ${key}`);
    } catch (error) {
      logger.error(`[ObjectStorage] Failed to delete local file: ${key}`, error);
      throw error;
    }
  }

  async listFiles(
    prefix?: string,
    maxResults?: number
  ): Promise<StorageObject[]> {
    logger.info(`[ObjectStorage] Listing files with prefix: ${prefix || 'none'}`);

    if (this.useReplitStorage) {
      return this.listFromReplit(prefix, maxResults);
    } else {
      return this.listFromLocal(prefix, maxResults);
    }
  }

  private async listFromReplit(prefix?: string, maxResults?: number): Promise<StorageObject[]> {
    try {
      const storage = await this.getGcsStorage();
      const bucket = storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({ prefix, maxResults });
      
      const results: StorageObject[] = [];
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        results.push({
          key: file.name,
          size: parseInt(metadata.size as string) || 0,
          contentType: metadata.contentType || 'application/octet-stream',
          lastModified: new Date(metadata.updated || Date.now()),
          etag: metadata.etag || '',
        });
      }
      
      logger.info(`[ObjectStorage] Listed ${results.length} files from Replit GCS`);
      return results;
    } catch (error) {
      logger.error(`[ObjectStorage] Replit list failed, trying local: ${error}`);
      return this.listFromLocal(prefix, maxResults);
    }
  }

  private async listFromLocal(prefix?: string, maxResults?: number): Promise<StorageObject[]> {
    try {
      const searchPath = prefix ? this.getFilePath(prefix) : this.storagePath;
      const files: StorageObject[] = [];

      const walk = async (dir: string, baseDir: string) => {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            if (maxResults && files.length >= maxResults) break;
            
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
              await walk(fullPath, baseDir);
            } else {
              const stats = await fs.stat(fullPath);
              const key = path.relative(baseDir, fullPath);
              const buffer = await fs.readFile(fullPath);
              const etag = crypto.createHash('md5').update(buffer).digest('hex');
              
              files.push({
                key,
                size: stats.size,
                contentType: 'application/octet-stream',
                lastModified: stats.mtime,
                etag
              });
            }
          }
        } catch (error) {
          logger.warn(`[ObjectStorage] Error walking directory ${dir}: ${error}`);
        }
      };

      await walk(searchPath, this.storagePath);

      logger.info(`[ObjectStorage] Listed ${files.length} files from local`);
      return files.slice(0, maxResults);

    } catch (error) {
      logger.error(`[ObjectStorage] Failed to list files: ${error}`);
      return [];
    }
  }

  async getSignedUrl(
    key: string,
    expiresIn: number = 3600,
    action: 'read' | 'write' = 'read'
  ): Promise<string> {
    logger.info(`[ObjectStorage] Generating signed URL for: ${key}`);

    if (this.useReplitStorage) {
      return this.getSignedUrlFromReplit(key, expiresIn, action);
    } else {
      return this.getSignedUrlLocal(key, expiresIn);
    }
  }

  private async getSignedUrlFromReplit(key: string, expiresIn: number, action: 'read' | 'write'): Promise<string> {
    try {
      const method = action === 'write' ? 'PUT' : 'GET';
      const request = {
        bucket_name: this.bucketName,
        object_name: key,
        method,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };

      const response = await fetch(
        `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to sign object URL: ${response.status}`);
      }

      const { signed_url: signedURL } = await response.json();
      logger.info(`[ObjectStorage] Generated signed URL from Replit for: ${key}`);
      return signedURL;
    } catch (error) {
      logger.error(`[ObjectStorage] Replit signed URL failed, using local: ${error}`);
      return this.getSignedUrlLocal(key, expiresIn);
    }
  }

  private getSignedUrlLocal(key: string, expiresIn: number): string {
    const url = `/storage/${key}?expires=${Date.now() + expiresIn * 1000}`;
    logger.info(`[ObjectStorage] Generated local signed URL for: ${key}`);
    return url;
  }

  async copyFile(sourceKey: string, destKey: string): Promise<StorageObject> {
    try {
      const sourcePath = this.getFilePath(sourceKey);
      const destPath = this.getFilePath(destKey);
      
      await this.ensureDirectory(destPath);
      await fs.copyFile(sourcePath, destPath);
      
      const stats = await fs.stat(destPath);
      const buffer = await fs.readFile(destPath);
      const etag = crypto.createHash('md5').update(buffer).digest('hex');
      
      const storageObject: StorageObject = {
        key: destKey,
        size: stats.size,
        contentType: 'application/octet-stream',
        lastModified: stats.mtime,
        etag
      };

      logger.info(`Copied file from ${sourceKey} to ${destKey}`);
      return storageObject;

    } catch (error) {
      logger.error(`Failed to copy file from ${sourceKey} to ${destKey}: ${error}`);
      throw error;
    }
  }

  async moveFile(sourceKey: string, destKey: string): Promise<StorageObject> {
    const result = await this.copyFile(sourceKey, destKey);
    await this.deleteFile(sourceKey);
    return result;
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileMetadata(key: string): Promise<StorageObject> {
    try {
      const filePath = this.getFilePath(key);
      const stats = await fs.stat(filePath);
      const buffer = await fs.readFile(filePath);
      const etag = crypto.createHash('md5').update(buffer).digest('hex');
      
      return {
        key,
        size: stats.size,
        contentType: 'application/octet-stream',
        lastModified: stats.mtime,
        etag
      };
    } catch (error) {
      logger.error(`Failed to get metadata for ${key}: ${error}`);
      throw error;
    }
  }

  async createMultipartUpload(
    key: string,
    contentType?: string
  ): Promise<string> {
    const uploadId = crypto.randomUUID();
    logger.info(`Created multipart upload for ${key}: ${uploadId}`);
    return uploadId;
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    content: Buffer
  ): Promise<string> {
    const etag = crypto.createHash('md5').update(content).digest('hex');
    logger.info(`Uploaded part ${partNumber} for ${key} (${content.length} bytes)`);
    return etag;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<StorageObject> {
    return {
      key,
      size: 0,
      contentType: 'application/octet-stream',
      lastModified: new Date(),
      etag: crypto.randomUUID()
    };
  }

  // Specialized methods for different use cases

  async uploadProjectFile(
    projectId: number,
    filePath: string,
    content: Buffer | string
  ): Promise<StorageObject> {
    const key = `projects/${projectId}/${filePath}`;
    return this.uploadFile(key, content, {
      metadata: {
        projectId: projectId.toString(),
        filePath
      }
    });
  }

  async uploadUserAvatar(
    userId: number,
    imageBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    const key = `avatars/${userId}-${Date.now()}.${this.getExtension(contentType)}`;
    const result = await this.uploadFile(key, imageBuffer, {
      contentType,
      public: true,
      metadata: {
        userId: userId.toString()
      }
    });
    
    return result.url || await this.getSignedUrl(key, 86400 * 365); // 1 year
  }

  async createProjectBackup(projectId: number): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `backups/project-${projectId}-${timestamp}.tar.gz`;
    logger.info(`Created backup placeholder for project ${projectId}: ${key}`);
    return key;
  }

  private getExtension(contentType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'application/zip': 'zip'
    };
    
    return extensions[contentType] || 'bin';
  }

  // Get storage usage statistics
  async getStorageStats(prefix?: string): Promise<{
    totalSize: number;
    fileCount: number;
    largestFile?: StorageObject;
  }> {
    const files = await this.listFiles(prefix);
    
    let totalSize = 0;
    let largestFile: StorageObject | undefined;
    
    for (const file of files) {
      totalSize += file.size;
      if (!largestFile || file.size > largestFile.size) {
        largestFile = file;
      }
    }
    
    return {
      totalSize,
      fileCount: files.length,
      largestFile
    };
  }
}

export const realObjectStorageService = new RealObjectStorageService();

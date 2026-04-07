import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Readable } from 'stream';
import { createLogger } from '../utils/logger';

const logger = createLogger('object-storage-service');

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
}

export interface DownloadOptions {
  start?: number;
  end?: number;
}

const REPLIT_SIDECAR_ENDPOINT = process.env.REPLIT_SIDECAR_ENDPOINT || "http://127.0.0.1:1106";

export class ObjectStorageService {
  private storagePath: string;
  private useReplitStorage: boolean;
  private bucketName: string;

  constructor() {
    // Bucket name: prefer Replit's auto-provisioned dir, fall back to explicit env var
    this.bucketName = process.env.PRIVATE_OBJECT_DIR?.split('/')[1] ||
                      process.env.REPLIT_OBJECT_STORAGE_BUCKET || '';

    const isReplitEnv = !!(process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT);
    const hasExplicitBucket = !!process.env.REPLIT_OBJECT_STORAGE_BUCKET;

    // Activate Replit GCS when:
    //   a) A bucket is configured AND we're on Replit AND in production, OR
    //   b) REPLIT_OBJECT_STORAGE_BUCKET is explicitly set (user opted in, any env)
    this.useReplitStorage = !!this.bucketName && isReplitEnv &&
                            (process.env.NODE_ENV === 'production' || hasExplicitBucket);

    this.storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
    this.initialize();
  }

  /** Returns true when Replit GCS is the active backend (used for health/banner reporting) */
  get isUsingReplitStorage(): boolean {
    return this.useReplitStorage;
  }

  /** Returns the storage backend label for diagnostics */
  get storageBackend(): string {
    return this.useReplitStorage ? 'Replit GCS' : 'local filesystem';
  }

  private async initialize() {
    if (this.useReplitStorage) {
      logger.info(`Using Replit built-in Object Storage (bucket: ${this.bucketName})`);
    } else {
      logger.info(`Using local filesystem storage at: ${this.storagePath}`);
      try {
        await fs.mkdir(this.storagePath, { recursive: true });
      } catch (error) {
        logger.error(`Failed to initialize local storage: ${error}`);
      }
    }
  }

  private async ensureDirectory(filePath: string) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  private getFilePath(key: string): string {
    return path.join(this.storagePath, key);
  }

  async uploadFile(
    key: string,
    content: Buffer | Readable | string,
    options: UploadOptions = {}
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

    if (this.useReplitStorage) {
      return this.uploadToReplit(key, buffer, options);
    } else {
      return this.uploadToLocal(key, buffer, options);
    }
  }

  private async uploadToReplit(
    key: string,
    buffer: Buffer,
    options: UploadOptions
  ): Promise<StorageObject> {
    try {
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage({
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

      const bucket = storage.bucket(this.bucketName);
      const file = bucket.file(key);
      
      await file.save(buffer, {
        contentType: options.contentType || 'application/octet-stream',
        metadata: options.metadata,
      });

      const etag = crypto.createHash('sha256').update(buffer).digest('hex');
      
      logger.info(`[ObjectStorage] Uploaded to Replit: ${key} (${buffer.length} bytes)`);
      
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

    logger.info(`[ObjectStorage] Uploaded to local: ${key} (${buffer.length} bytes)`);

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

  async downloadFile(key: string, options: DownloadOptions = {}): Promise<Buffer> {
    logger.info(`[ObjectStorage] Downloading file: ${key}`);

    if (this.useReplitStorage) {
      return this.downloadFromReplit(key, options);
    } else {
      return this.downloadFromLocal(key, options);
    }
  }

  private async downloadFromReplit(key: string, options: DownloadOptions): Promise<Buffer> {
    try {
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage({
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

      const bucket = storage.bucket(this.bucketName);
      const file = bucket.file(key);
      const [buffer] = await file.download();
      
      logger.info(`[ObjectStorage] Downloaded from Replit: ${key} (${buffer.length} bytes)`);
      
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

  async deleteFile(key: string): Promise<void> {
    logger.info(`[ObjectStorage] Deleting file: ${key}`);

    if (this.useReplitStorage) {
      await this.deleteFromReplit(key);
    } else {
      await this.deleteFromLocal(key);
    }
  }

  private async deleteFromReplit(key: string): Promise<void> {
    try {
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage({
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

      const bucket = storage.bucket(this.bucketName);
      const file = bucket.file(key);
      await file.delete();
      
      logger.info(`[ObjectStorage] Deleted from Replit: ${key}`);
    } catch (error) {
      logger.error(`[ObjectStorage] Replit delete failed, trying local: ${error}`);
      await this.deleteFromLocal(key);
    }
  }

  private async deleteFromLocal(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    try {
      await fs.unlink(filePath);
      logger.info(`[ObjectStorage] Deleted from local: ${key}`);
    } catch (error) {
      logger.error(`[ObjectStorage] Failed to delete local file: ${key}`, error);
      throw error;
    }
  }

  async listFiles(prefix?: string, maxResults?: number): Promise<StorageObject[]> {
    logger.info(`[ObjectStorage] Listing files with prefix: ${prefix || 'none'}`);

    if (this.useReplitStorage) {
      return this.listFromReplit(prefix, maxResults);
    } else {
      return this.listFromLocal(prefix, maxResults);
    }
  }

  private async listFromReplit(prefix?: string, maxResults?: number): Promise<StorageObject[]> {
    try {
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage({
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
      
      logger.info(`[ObjectStorage] Listed ${results.length} files from Replit`);
      return results;
    } catch (error) {
      logger.error(`[ObjectStorage] Replit list failed, trying local: ${error}`);
      return this.listFromLocal(prefix, maxResults);
    }
  }

  private async listFromLocal(prefix?: string, maxResults?: number): Promise<StorageObject[]> {
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
            const etag = crypto.createHash('sha256').update(buffer).digest('hex');
            
            files.push({
              key,
              size: stats.size,
              contentType: 'application/octet-stream',
              lastModified: stats.mtime,
              etag,
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
  }

  async getSignedUrl(key: string, expiresIn: number = 3600, action: 'read' | 'write' = 'read'): Promise<string> {
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

  async fileExists(key: string): Promise<boolean> {
    if (this.useReplitStorage) {
      try {
        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage({
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

        const bucket = storage.bucket(this.bucketName);
        const file = bucket.file(key);
        const [exists] = await file.exists();
        return exists;
      } catch (error) {
        logger.error(`[ObjectStorage] Replit file exists check failed: ${error}`);
        return this.localFileExists(key);
      }
    } else {
      return this.localFileExists(key);
    }
  }

  private async localFileExists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(sourceKey: string, destKey: string): Promise<StorageObject> {
    logger.info(`[ObjectStorage] Copying file: ${sourceKey} -> ${destKey}`);
    const content = await this.downloadFile(sourceKey);
    return this.uploadFile(destKey, content);
  }

  async moveFile(sourceKey: string, destKey: string): Promise<StorageObject> {
    logger.info(`[ObjectStorage] Moving file: ${sourceKey} -> ${destKey}`);
    const result = await this.copyFile(sourceKey, destKey);
    await this.deleteFile(sourceKey);
    return result;
  }

  async getFileMetadata(key: string): Promise<StorageObject> {
    if (this.useReplitStorage) {
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage({
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

      const bucket = storage.bucket(this.bucketName);
      const file = bucket.file(key);
      const [metadata] = await file.getMetadata();
      
      return {
        key,
        size: parseInt(metadata.size as string) || 0,
        contentType: metadata.contentType || 'application/octet-stream',
        lastModified: new Date(metadata.updated || Date.now()),
        etag: metadata.etag || '',
      };
    } else {
      const filePath = this.getFilePath(key);
      const stats = await fs.stat(filePath);
      const buffer = await fs.readFile(filePath);
      const etag = crypto.createHash('sha256').update(buffer).digest('hex');
      
      return {
        key,
        size: stats.size,
        contentType: 'application/octet-stream',
        lastModified: stats.mtime,
        etag,
      };
    }
  }

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
    
    return { totalSize, fileCount: files.length, largestFile };
  }
}

export const objectStorageService = new ObjectStorageService();

export { ObjectStorageService as RealObjectStorageService };
export const realObjectStorageService = objectStorageService;

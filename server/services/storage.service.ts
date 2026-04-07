// @ts-nocheck
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Readable } from 'stream';
import { createLogger } from '../utils/logger';
import type { S3Client as S3ClientType } from '@aws-sdk/client-s3';

const logger = createLogger('storage-service');

export type StorageBackend = 'replit' | 's3' | 'local';

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

export interface StorageServiceConfig {
  backend: StorageBackend;
  replitBucket?: string;
  replitSidecarEndpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3Endpoint?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3ForcePathStyle?: boolean;
  localPath?: string;
}

function resolveConfig(): StorageServiceConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const replitBucket = process.env.PRIVATE_OBJECT_DIR?.split('/')[1] ||
                       process.env.REPLIT_OBJECT_STORAGE_BUCKET || '';
  const hasReplit = !!replitBucket && !!process.env.REPL_ID;
  const hasS3 = !!process.env.S3_BUCKET && !!process.env.S3_ACCESS_KEY_ID;

  let backend: StorageBackend;
  const envBackend = process.env.STORAGE_BACKEND?.toLowerCase();
  if (envBackend === 'replit' || envBackend === 's3' || envBackend === 'local') {
    if (isProduction && envBackend === 'local') {
      throw new Error(
        'STORAGE_BACKEND=local is not supported in production. ' +
        'Use "replit" or "s3" with the required credentials.'
      );
    }
    backend = envBackend;
  } else if (hasReplit && isProduction) {
    backend = 'replit';
  } else if (hasS3) {
    backend = 's3';
  } else {
    if (isProduction) {
      throw new Error(
        'Object storage is not configured. In production, set STORAGE_BACKEND to "replit" or "s3" ' +
        'with the required credentials (REPLIT_OBJECT_STORAGE_BUCKET or S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY). ' +
        'Local filesystem storage is not supported in production.'
      );
    }
    backend = 'local';
  }

  if (isProduction && backend === 's3') {
    if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
      throw new Error(
        'S3 storage backend selected but required credentials are missing. ' +
        'Set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY environment variables.'
      );
    }
  }

  if (isProduction && backend === 'replit' && !replitBucket) {
    throw new Error(
      'Replit storage backend selected but REPLIT_OBJECT_STORAGE_BUCKET (or PRIVATE_OBJECT_DIR) is not set.'
    );
  }

  return {
    backend,
    replitBucket,
    replitSidecarEndpoint: process.env.REPLIT_SIDECAR_ENDPOINT || 'http://127.0.0.1:1106',
    s3Region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || '',
    s3Endpoint: process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    localPath: process.env.STORAGE_PATH || path.join(process.cwd(), 'storage'),
  };
}

export class StorageService {
  private config: StorageServiceConfig;
  private s3Client: S3ClientType | null = null;
  private initPromise: Promise<void>;

  constructor(config?: StorageServiceConfig) {
    this.config = config || resolveConfig();
    this.initPromise = this.initialize();
  }

  get activeBackend(): StorageBackend {
    return this.config.backend;
  }

  private async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    logger.info(`StorageService initializing with backend: ${this.config.backend}`);

    switch (this.config.backend) {
      case 'replit':
        logger.info('Using Replit Object Storage (GCS sidecar)');
        break;
      case 's3':
        await this.initS3();
        break;
      case 'local':
        logger.info('Using local filesystem storage (development mode)');
        await fs.mkdir(this.config.localPath!, { recursive: true }).catch(() => {});
        break;
    }
  }

  private async initS3(): Promise<void> {
    try {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const s3Config: ConstructorParameters<typeof S3Client>[0] = {
        region: this.config.s3Region,
        credentials: {
          accessKeyId: this.config.s3AccessKeyId!,
          secretAccessKey: this.config.s3SecretAccessKey!,
        },
      };
      if (this.config.s3Endpoint) {
        s3Config.endpoint = this.config.s3Endpoint;
      }
      if (this.config.s3ForcePathStyle) {
        s3Config.forcePathStyle = true;
      }
      this.s3Client = new S3Client(s3Config);
      logger.info(`Using S3 storage: bucket=${this.config.s3Bucket}, region=${this.config.s3Region}`);
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Failed to initialize S3 client in production: ${error}`);
      }
      logger.error(`Failed to initialize S3 client: ${error}. Falling back to local.`);
      this.config.backend = 'local';
      await fs.mkdir(this.config.localPath!, { recursive: true }).catch(() => {});
    }
  }

  private async getGcsStorage() {
    const { Storage } = await import('@google-cloud/storage');
    return new Storage({
      credentials: {
        audience: 'replit',
        subject_token_type: 'access_token',
        token_url: `${this.config.replitSidecarEndpoint}/token`,
        type: 'external_account',
        credential_source: {
          url: `${this.config.replitSidecarEndpoint}/credential`,
          format: { type: 'json', subject_token_field_name: 'access_token' },
        },
        universe_domain: 'googleapis.com',
      } as Parameters<typeof Storage>[0]['credentials'],
      projectId: '',
    });
  }

  private sanitizeKey(key: string): string {
    const normalized = path.posix.normalize(key).replace(/^\.\.\/|\/\.\.\//g, '');
    const cleaned = normalized.replace(/\.\.\//g, '').replace(/^\/+/, '');
    if (cleaned.includes('..')) {
      throw new Error(`Invalid storage key: path traversal detected in "${key}"`);
    }
    return cleaned;
  }

  private getLocalPath(key: string): string {
    const safePath = path.resolve(this.config.localPath!, key);
    const rootPath = path.resolve(this.config.localPath!);
    if (!safePath.startsWith(rootPath + path.sep) && safePath !== rootPath) {
      throw new Error(`Invalid storage key: path escapes storage root`);
    }
    return safePath;
  }

  private async ensureDir(filePath: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  private async toBuffer(content: Buffer | Readable | string): Promise<Buffer> {
    if (Buffer.isBuffer(content)) return content;
    if (typeof content === 'string') return Buffer.from(content);
    const chunks: Buffer[] = [];
    for await (const chunk of content) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async uploadFile(
    key: string,
    content: Buffer | Readable | string,
    options: UploadOptions = {}
  ): Promise<StorageObject> {
    await this.ensureInitialized();
    key = this.sanitizeKey(key);
    const buffer = await this.toBuffer(content);
    logger.info(`Uploading: ${key} (${buffer.length} bytes) via ${this.config.backend}`);

    switch (this.config.backend) {
      case 'replit':
        return this.uploadReplit(key, buffer, options);
      case 's3':
        return this.uploadS3(key, buffer, options);
      default:
        return this.uploadLocal(key, buffer, options);
    }
  }

  private async uploadReplit(key: string, buffer: Buffer, options: UploadOptions): Promise<StorageObject> {
    try {
      const storage = await this.getGcsStorage();
      const bucket = storage.bucket(this.config.replitBucket!);
      const file = bucket.file(key);
      await file.save(buffer, {
        contentType: options.contentType || 'application/octet-stream',
        metadata: options.metadata,
      });
      const etag = crypto.createHash('md5').update(buffer).digest('hex');
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
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Replit Object Storage upload failed for ${key}: ${error}`);
      }
      logger.error(`Replit upload failed for ${key}, falling back to local: ${error}`);
      return this.uploadLocal(key, buffer, options);
    }
  }

  private async uploadS3(key: string, buffer: Buffer, options: UploadOptions): Promise<StorageObject> {
    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const contentType = options.contentType || 'application/octet-stream';
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: options.metadata,
      }));
      const etag = crypto.createHash('md5').update(buffer).digest('hex');
      return {
        key,
        size: buffer.length,
        contentType,
        lastModified: new Date(),
        etag,
        url: options.public ? `/storage/${key}` : undefined,
        metadata: options.metadata,
      };
    } catch (error) {
      logger.error(`S3 upload failed for ${key}: ${error}`);
      throw error;
    }
  }

  private async uploadLocal(key: string, buffer: Buffer, options: UploadOptions): Promise<StorageObject> {
    const filePath = this.getLocalPath(key);
    await this.ensureDir(filePath);
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

  async downloadFile(key: string, options: DownloadOptions = {}): Promise<Buffer> {
    await this.ensureInitialized();
    key = this.sanitizeKey(key);
    logger.info(`Downloading: ${key} via ${this.config.backend}`);

    switch (this.config.backend) {
      case 'replit':
        return this.downloadReplit(key, options);
      case 's3':
        return this.downloadS3(key, options);
      default:
        return this.downloadLocal(key, options);
    }
  }

  private async downloadReplit(key: string, options: DownloadOptions): Promise<Buffer> {
    try {
      const storage = await this.getGcsStorage();
      const bucket = storage.bucket(this.config.replitBucket!);
      const file = bucket.file(key);
      const [buffer] = await file.download();
      return this.applyRange(buffer, options);
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Replit Object Storage download failed for ${key}: ${error}`);
      }
      logger.error(`Replit download failed for ${key}, trying local: ${error}`);
      return this.downloadLocal(key, options);
    }
  }

  private async downloadS3(key: string, options: DownloadOptions): Promise<Buffer> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const rangeHeader = (options.start !== undefined || options.end !== undefined)
      ? `bytes=${options.start ?? 0}-${options.end ?? ''}`
      : undefined;
    const resp = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
      Range: rangeHeader,
    }));
    const chunks: Buffer[] = [];
    for await (const chunk of resp.Body) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private async downloadLocal(key: string, options: DownloadOptions): Promise<Buffer> {
    const filePath = this.getLocalPath(key);
    try { await fs.access(filePath); } catch { throw new Error(`File not found: ${key}`); }
    const buffer = await fs.readFile(filePath);
    return this.applyRange(buffer, options);
  }

  private applyRange(buffer: Buffer, options: DownloadOptions): Buffer {
    if (options.start !== undefined || options.end !== undefined) {
      return buffer.subarray(options.start || 0, options.end || buffer.length);
    }
    return buffer;
  }

  async deleteFile(key: string): Promise<void> {
    await this.ensureInitialized();
    key = this.sanitizeKey(key);
    logger.info(`Deleting: ${key} via ${this.config.backend}`);

    switch (this.config.backend) {
      case 'replit':
        return this.deleteReplit(key);
      case 's3':
        return this.deleteS3(key);
      default:
        return this.deleteLocal(key);
    }
  }

  private async deleteReplit(key: string): Promise<void> {
    try {
      const storage = await this.getGcsStorage();
      const bucket = storage.bucket(this.config.replitBucket!);
      await bucket.file(key).delete();
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Replit Object Storage delete failed for ${key}: ${error}`);
      }
      logger.error(`Replit delete failed for ${key}, trying local: ${error}`);
      await this.deleteLocal(key);
    }
  }

  private async deleteS3(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
    }));
  }

  private async deleteLocal(key: string): Promise<void> {
    const filePath = this.getLocalPath(key);
    await fs.unlink(filePath);
  }

  async listFiles(prefix?: string, maxResults?: number): Promise<StorageObject[]> {
    await this.ensureInitialized();
    if (prefix) prefix = this.sanitizeKey(prefix);
    switch (this.config.backend) {
      case 'replit':
        return this.listReplit(prefix, maxResults);
      case 's3':
        return this.listS3(prefix, maxResults);
      default:
        return this.listLocal(prefix, maxResults);
    }
  }

  private async listReplit(prefix?: string, maxResults?: number): Promise<StorageObject[]> {
    try {
      const storage = await this.getGcsStorage();
      const bucket = storage.bucket(this.config.replitBucket!);
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
      return results;
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Replit Object Storage list failed: ${error}`);
      }
      logger.error(`Replit list failed, trying local: ${error}`);
      return this.listLocal(prefix, maxResults);
    }
  }

  private async listS3(prefix?: string, maxResults?: number): Promise<StorageObject[]> {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const resp = await this.s3Client.send(new ListObjectsV2Command({
      Bucket: this.config.s3Bucket,
      Prefix: prefix,
      MaxKeys: maxResults,
    }));
    return (resp.Contents || []).map((obj: any) => ({
      key: obj.Key,
      size: obj.Size || 0,
      contentType: 'application/octet-stream',
      lastModified: obj.LastModified || new Date(),
      etag: obj.ETag || '',
    }));
  }

  private async listLocal(prefix?: string, maxResults?: number): Promise<StorageObject[]> {
    const searchPath = prefix ? this.getLocalPath(prefix) : this.config.localPath!;
    const files: StorageObject[] = [];

    const walk = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (maxResults && files.length >= maxResults) break;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else {
            const stats = await fs.stat(fullPath);
            const key = path.relative(this.config.localPath!, fullPath);
            files.push({
              key,
              size: stats.size,
              contentType: 'application/octet-stream',
              lastModified: stats.mtime,
              etag: '',
            });
          }
        }
      } catch { }
    };

    await walk(searchPath);
    return files.slice(0, maxResults);
  }

  async getSignedUrl(key: string, ttlSeconds: number = 3600, action: 'read' | 'write' = 'read'): Promise<string> {
    await this.ensureInitialized();
    key = this.sanitizeKey(key);
    switch (this.config.backend) {
      case 'replit':
        return this.signedUrlReplit(key, ttlSeconds, action);
      case 's3':
        return this.signedUrlS3(key, ttlSeconds, action);
      default:
        return this.signedUrlLocal(key, ttlSeconds);
    }
  }

  private async signedUrlReplit(key: string, ttlSeconds: number, action: 'read' | 'write'): Promise<string> {
    try {
      const method = action === 'write' ? 'PUT' : 'GET';
      const response = await fetch(
        `${this.config.replitSidecarEndpoint}/object-storage/signed-object-url`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket_name: this.config.replitBucket,
            object_name: key,
            method,
            expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
          }),
        }
      );
      if (!response.ok) throw new Error(`Sidecar returned ${response.status}`);
      const { signed_url } = await response.json() as { signed_url: string };
      return signed_url;
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Replit signed URL generation failed for ${key}: ${error}`);
      }
      logger.error(`Replit signed URL failed for ${key}: ${error}`);
      return this.signedUrlLocal(key, ttlSeconds);
    }
  }

  private async signedUrlS3(key: string, ttlSeconds: number, action: 'read' | 'write'): Promise<string> {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const command = action === 'write'
      ? new (await import('@aws-sdk/client-s3')).PutObjectCommand({ Bucket: this.config.s3Bucket, Key: key })
      : new (await import('@aws-sdk/client-s3')).GetObjectCommand({ Bucket: this.config.s3Bucket, Key: key });
    return getSignedUrl(this.s3Client, command, { expiresIn: ttlSeconds });
  }

  private signedUrlLocal(key: string, ttlSeconds: number): string {
    return `/storage/${key}?expires=${Date.now() + ttlSeconds * 1000}`;
  }

  async fileExists(key: string): Promise<boolean> {
    await this.ensureInitialized();
    key = this.sanitizeKey(key);
    switch (this.config.backend) {
      case 'replit':
        try {
          const storage = await this.getGcsStorage();
          const [exists] = await storage.bucket(this.config.replitBucket!).file(key).exists();
          return exists;
        } catch (error) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(`Replit Object Storage fileExists failed for ${key}: ${error}`);
          }
          return this.localFileExists(key);
        }
      case 's3':
        try {
          const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
          await this.s3Client.send(new HeadObjectCommand({ Bucket: this.config.s3Bucket, Key: key }));
          return true;
        } catch {
          return false;
        }
      default:
        return this.localFileExists(key);
    }
  }

  private async localFileExists(key: string): Promise<boolean> {
    try {
      await fs.access(this.getLocalPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(sourceKey: string, destKey: string): Promise<StorageObject> {
    const content = await this.downloadFile(sourceKey);
    return this.uploadFile(destKey, content);
  }

  async moveFile(sourceKey: string, destKey: string): Promise<StorageObject> {
    const result = await this.copyFile(sourceKey, destKey);
    await this.deleteFile(sourceKey);
    return result;
  }

  async getFileMetadata(key: string): Promise<StorageObject> {
    await this.ensureInitialized();
    key = this.sanitizeKey(key);
    switch (this.config.backend) {
      case 'replit': {
        const storage = await this.getGcsStorage();
        const file = storage.bucket(this.config.replitBucket!).file(key);
        const [metadata] = await file.getMetadata();
        return {
          key,
          size: parseInt(metadata.size as string) || 0,
          contentType: metadata.contentType || 'application/octet-stream',
          lastModified: new Date(metadata.updated || Date.now()),
          etag: metadata.etag || '',
        };
      }
      case 's3': {
        const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
        const resp = await this.s3Client.send(new HeadObjectCommand({ Bucket: this.config.s3Bucket, Key: key }));
        return {
          key,
          size: resp.ContentLength || 0,
          contentType: resp.ContentType || 'application/octet-stream',
          lastModified: resp.LastModified || new Date(),
          etag: resp.ETag || '',
        };
      }
      default: {
        const filePath = this.getLocalPath(key);
        const stats = await fs.stat(filePath);
        return {
          key,
          size: stats.size,
          contentType: 'application/octet-stream',
          lastModified: stats.mtime,
          etag: '',
        };
      }
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

  async uploadBuildArtifact(
    projectId: number,
    buildId: string,
    filename: string,
    content: Buffer,
    contentType?: string
  ): Promise<{ storageObject: StorageObject; downloadUrl: string }> {
    const key = `builds/${projectId}/${buildId}/${filename}`;
    const storageObject = await this.uploadFile(key, content, {
      contentType: contentType || 'application/octet-stream',
      metadata: { projectId: String(projectId), buildId },
    });
    const downloadUrl = await this.getSignedUrl(key, 86400);
    return { storageObject, downloadUrl };
  }

  async uploadDatabaseBackup(
    databaseId: number | string,
    backupId: string,
    content: Buffer
  ): Promise<{ storageObject: StorageObject; downloadUrl: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `backups/db-${databaseId}/${backupId}-${timestamp}.sql.gz`;
    const storageObject = await this.uploadFile(key, content, {
      contentType: 'application/gzip',
      metadata: { databaseId: String(databaseId), backupId, timestamp },
    });
    const downloadUrl = await this.getSignedUrl(key, 86400 * 7);
    return { storageObject, downloadUrl };
  }

  async uploadProjectBackup(
    projectId: number,
    backupId: string,
    content: Buffer
  ): Promise<{ storageObject: StorageObject; downloadUrl: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `backups/project-${projectId}/${backupId}-${timestamp}.zip`;
    const storageObject = await this.uploadFile(key, content, {
      contentType: 'application/zip',
      metadata: { projectId: String(projectId), backupId, timestamp },
    });
    const downloadUrl = await this.getSignedUrl(key, 86400 * 7);
    return { storageObject, downloadUrl };
  }

  async downloadDatabaseBackup(
    databaseId: number | string,
    backupId: string
  ): Promise<Buffer> {
    const prefix = `backups/db-${databaseId}/`;
    const objects = await this.listFiles(prefix);
    const match = objects.find(obj => obj.key.includes(backupId));
    if (!match) {
      throw new Error(`Database backup ${backupId} not found in object storage (prefix: ${prefix})`);
    }
    return this.downloadFile(match.key);
  }

  async downloadProjectBackup(
    projectId: number,
    backupId: string
  ): Promise<Buffer> {
    const prefix = `backups/project-${projectId}/`;
    const objects = await this.listFiles(prefix);
    const match = objects.find(obj => obj.key.includes(backupId));
    if (!match) {
      throw new Error(`Project backup ${backupId} not found in object storage (prefix: ${prefix})`);
    }
    return this.downloadFile(match.key);
  }

  async uploadUserFile(
    projectId: number,
    filePath: string,
    content: Buffer | string,
    contentType?: string
  ): Promise<StorageObject> {
    const key = `projects/${projectId}/storage/${filePath}`;
    return this.uploadFile(key, content, {
      contentType: contentType || 'application/octet-stream',
      metadata: { projectId: String(projectId), filePath },
    });
  }
}

export const storageService = new StorageService();

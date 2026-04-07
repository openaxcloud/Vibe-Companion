import fs from "fs";
import path from "path";
import { promisify } from "util";
import crypto from "crypto";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import mime from "mime-types";

const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);

export type SupportedFileType = "image" | "document" | "other";

export interface StoredFileMetadata {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  type: SupportedFileType;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  checksum: string;
  createdAt: Date;
  updatedAt: Date;
  path: string;
}

export interface FileServiceConfig {
  baseUploadPath: string;
  imageDir?: string;
  documentDir?: string;
  thumbnailDir?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  maxImageSizeBytes?: number;
  maxDocumentSizeBytes?: number;
  allowedImageMimeTypes?: string[];
  allowedDocumentMimeTypes?: string[];
}

export interface ProcessedFileResult {
  metadata: StoredFileMetadata;
  buffer: Buffer;
  thumbnailBuffer?: Buffer;
}

const DEFAULT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/avif",
];

const DEFAULT_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

const DEFAULT_CONFIG: Required<Omit<FileServiceConfig, "baseUploadPath">> = {
  imageDir: "images",
  documentDir: "documents",
  thumbnailDir: "thumbnails",
  thumbnailWidth: 320,
  thumbnailHeight: 320,
  maxImageSizeBytes: 10 * 1024 * 1024,
  maxDocumentSizeBytes: 25 * 1024 * 1024,
  allowedImageMimeTypes: DEFAULT_IMAGE_MIME_TYPES,
  allowedDocumentMimeTypes: DEFAULT_DOCUMENT_MIME_TYPES,
};

export class FileValidationError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = "FILE_VALIDATION_ERROR") {
    super(message);
    this.name = "FileValidationError";
    this.code = code;
    Object.setPrototypeOf(this, FileValidationError.prototype);
  }
}

export class FileStorageError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = "FILE_STORAGE_ERROR") {
    super(message);
    this.name = "FileStorageError";
    this.code = code;
    Object.setPrototypeOf(this, FileStorageError.prototype);
  }
}

export class FileService {
  private readonly config: Required<FileServiceConfig>;

  constructor(config: FileServiceConfig) {
    if (!config.baseUploadPath) {
      throw new Error("FileService requires baseUploadPath in config");
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      allowedImageMimeTypes:
        config.allowedImageMimeTypes ?? DEFAULT_IMAGE_MIME_TYPES,
      allowedDocumentMimeTypes:
        config.allowedDocumentMimeTypes ?? DEFAULT_DOCUMENT_MIME_TYPES,
    } as Required<FileServiceConfig>;
  }

  public async initialize(): Promise<void> {
    await this.ensureDirExists(this.config.baseUploadPath);
    await this.ensureDirExists(this.getImageDir());
    await this.ensureDirExists(this.getDocumentDir());
    await this.ensureDirExists(this.getThumbnailDir());
  }

  public async processAndStoreFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType?: string | null
  ): Promise<ProcessedFileResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new FileValidationError("Empty file buffer");
    }

    const detectedMimeType = mimeType || this.guessMimeType(originalName);
    const fileType = this.determineFileType(detectedMimeType);

    this.validateFileSize(fileBuffer.length, fileType);
    this.validateMimeType(detectedMimeType, fileType);

    const id = uuidv4();
    const extension = this.getExtensionFromNameOrMime(originalName, detectedMimeType);
    const storedName = `undefinedundefined` : ""}`;
    const checksum = this.calculateChecksum(fileBuffer);

    const now = new Date();
    const targetDir =
      fileType === "image" ? this.getImageDir() : this.getDocumentDir();
    const fullPath = path.join(targetDir, storedName);

    await this.ensureDirExists(targetDir);

    let width: number | undefined;
    let height: number | undefined;
    let thumbnailPath: string | undefined;
    let thumbnailBuffer: Buffer | undefined;

    if (fileType === "image") {
      try {
        const metadata = await sharp(fileBuffer).metadata();
        width = metadata.width;
        height = metadata.height;

        const thumbnailName = `undefined_thumb.undefined`;
        thumbnailPath = path.join(this.getThumbnailDir(), thumbnailName);

        const thumbnailSharp = sharp(fileBuffer).resize(
          this.config.thumbnailWidth,
          this.config.thumbnailHeight,
          { fit: "inside", withoutEnlargement: true }
        );

        thumbnailBuffer = await thumbnailSharp.toBuffer();
        await writeFile(thumbnailPath, thumbnailBuffer);
      } catch (err) {
        throw new FileStorageError(
          "Failed to process image or generate thumbnail",
          "IMAGE_PROCESSING_FAILED"
        );
      }
    }

    try {
      await writeFile(fullPath, fileBuffer);
    } catch (err) {
      if (thumbnailPath) {
        await this.safeUnlink(thumbnailPath);
      }
      throw new FileStorageError("Failed to write file to disk", "WRITE_FAILED");
    }

    const metadata: StoredFileMetadata = {
      id,
      originalName,
      storedName,
      mimeType: detectedMimeType,
      size: fileBuffer.length,
      type: fileType,
      width,
      height,
      thumbnailPath,
      checksum,
      createdAt: now,
      updatedAt: now,
      path: fullPath,
    };

    return {
      metadata,
      buffer: fileBuffer,
      thumbnailBuffer,
    };
  }

  public async deleteFile(metadata: StoredFileMetadata): Promise<void> {
    await this.safeUnlink(metadata.path);
    if (metadata.thumbnailPath) {
      await this.safeUnlink(metadata.thumbnailPath);
    }
  }

  public async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async getFileStream(filePath: string): Promise<fs.ReadStream> {
    const exists = await this.fileExists(filePath);
    if (!exists) {
      throw new FileStorageError("File not found", "FILE_NOT_FOUND");
    }
    return fs.createReadStream(filePath);
  }

  public getImageDir(): string {
    return path.join(this.config.baseUploadPath, this.config.imageDir);
  }

  public getDocumentDir(): string {
    return path.join(this.config.baseUploadPath, this.config.documentDir);
  }

  public getThumbnailDir(): string {
    return path.join(this.config.baseUploadPath, this.config.thumbnailDir);
  }

  private determineFileType(mimeType: string): SupportedFileType {
    if (this.config.allowedImageMimeTypes.includes(mimeType)) {
      return "image";
    }
    if (this.config.allowedDocumentMimeTypes.includes(mimeType)) {
      return "document";
    }
    if (mimeType.startsWith("image/")) {
      return "image";
    }
    if (
      mimeType.startsWith("application/") ||
      mimeType.startsWith("text/")
    ) {
      return "document";
    }
    return "other";
  }

  private validateFileSize(size: number, fileType: SupportedFileType): void {
    if (fileType === "image" && size > this.config.maxImageSizeBytes) {
      throw new FileValidationError(
        `Image file too large. Max size is undefined bytes`,
        "IMAGE_TOO_LARGE"
      );
    }
    if (
      (fileType === "document" || fileType === "other") &&
      size > this.config.maxDocumentSizeBytes
    ) {
      throw new FileValidationError(
        `Document file too large. Max size is undefined bytes`,
        "DOCUMENT_TOO_LARGE"
      );
    }
  }

  private validateMimeType(mimeType: string, fileType: SupportedFileType): void {
    if (fileType === "image") {
      if (!this.config.allowedImageMimeTypes.includes(mimeType)) {
        throw new FileValidationError(
          `Unsupported image MIME type: undefined`,
          "UNSUPPORTED_IMAGE_TYPE"
        );
      }
    } else if (fileType === "document")
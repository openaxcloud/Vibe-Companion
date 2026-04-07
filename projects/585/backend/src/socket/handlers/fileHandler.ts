import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const access = promisify(fs.access);

export interface FileChunkPayload {
  uploadId: string;
  fileName: string;
  fileType: string;
  totalSize: number;
  chunk: string;
  chunkIndex: number;
  totalChunks: number;
  roomId?: string;
}

export interface FileUploadStartPayload {
  uploadId?: string;
  fileName: string;
  fileType: string;
  totalSize: number;
  totalChunks: number;
  roomId?: string;
}

export interface FileUploadCompletePayload {
  uploadId: string;
  roomId?: string;
}

export interface FileSharePayload {
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  roomId?: string;
  sharedBy: string;
}

interface ActiveUpload {
  uploadId: string;
  fileName: string;
  fileType: string;
  totalSize: number;
  totalChunks: number;
  receivedChunks: number;
  chunks: Buffer[];
  roomId?: string;
  startedAt: number;
  lastUpdatedAt: number;
}

interface FileHandlerOptions {
  uploadDir: string;
  baseFileUrl: string;
  maxFileSizeBytes?: number;
  maxChunkSizeBytes?: number;
  uploadTimeoutMs?: number;
}

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 1024;
const DEFAULT_MAX_CHUNK_SIZE = 2 * 1024 * 1024;
const DEFAULT_UPLOAD_TIMEOUT = 5 * 60 * 1000;

export class FileSocketHandler {
  private io: Server;
  private options: Required<FileHandlerOptions>;
  private activeUploads: Map<string, ActiveUpload>;
  private cleanupInterval: NodeJS.Timeout;

  constructor(io: Server, options: FileHandlerOptions) {
    this.io = io;
    this.options = {
      uploadDir: options.uploadDir,
      baseFileUrl: options.baseFileUrl.replace(/\/+$/, ""),
      maxFileSizeBytes: options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE,
      maxChunkSizeBytes: options.maxChunkSizeBytes ?? DEFAULT_MAX_CHUNK_SIZE,
      uploadTimeoutMs: options.uploadTimeoutMs ?? DEFAULT_UPLOAD_TIMEOUT
    };
    this.activeUploads = new Map();
    this.ensureUploadDir();
    this.cleanupInterval = setInterval(
      () => this.cleanupStaleUploads(),
      this.options.uploadTimeoutMs
    );
  }

  public attachHandlers(socket: Socket): void {
    socket.on("file:upload:start", (payload: FileUploadStartPayload, cb?: (response: any) => void) => {
      this.handleUploadStart(socket, payload, cb);
    });

    socket.on("file:upload:chunk", (payload: FileChunkPayload, cb?: (response: any) => void) => {
      this.handleUploadChunk(socket, payload, cb);
    });

    socket.on("file:upload:complete", (payload: FileUploadCompletePayload, cb?: (response: any) => void) => {
      this.handleUploadComplete(socket, payload, cb);
    });

    socket.on("file:share", (payload: FileSharePayload, cb?: (response: any) => void) => {
      this.handleFileShare(socket, payload, cb);
    });

    socket.on("disconnect", () => {
      this.handleDisconnect(socket);
    });
  }

  public dispose(): void {
    clearInterval(this.cleanupInterval);
    this.activeUploads.clear();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await access(this.options.uploadDir, fs.constants.F_OK);
    } catch {
      await mkdir(this.options.uploadDir, { recursive: true });
    }
  }

  private handleUploadStart(
    socket: Socket,
    payload: FileUploadStartPayload,
    cb?: (response: any) => void
  ): void {
    const uploadId = payload.uploadId || uuidv4();
    const now = Date.now();

    if (!payload.fileName || !payload.fileType || !payload.totalSize || !payload.totalChunks) {
      const error = { error: "INVALID_PAYLOAD", message: "Missing required upload metadata" };
      if (cb) cb({ ok: false, ...error });
      return;
    }

    if (payload.totalSize > this.options.maxFileSizeBytes) {
      const error = {
        error: "FILE_TOO_LARGE",
        message: `File exceeds max allowed size of undefined bytes`
      };
      if (cb) cb({ ok: false, ...error });
      return;
    }

    const existing = this.activeUploads.get(uploadId);
    if (existing) {
      this.activeUploads.delete(uploadId);
    }

    const upload: ActiveUpload = {
      uploadId,
      fileName: path.basename(payload.fileName),
      fileType: payload.fileType,
      totalSize: payload.totalSize,
      totalChunks: payload.totalChunks,
      receivedChunks: 0,
      chunks: new Array(payload.totalChunks),
      roomId: payload.roomId,
      startedAt: now,
      lastUpdatedAt: now
    };

    this.activeUploads.set(uploadId, upload);

    if (payload.roomId) {
      this.io.to(payload.roomId).emit("file:upload:started", {
        uploadId,
        fileName: upload.fileName,
        fileType: upload.fileType,
        totalSize: upload.totalSize,
        totalChunks: upload.totalChunks,
        startedBy: socket.id,
        startedAt: upload.startedAt
      });
    }

    if (cb) {
      cb({
        ok: true,
        uploadId,
        message: "Upload initialized"
      });
    }
  }

  private handleUploadChunk(
    socket: Socket,
    payload: FileChunkPayload,
    cb?: (response: any) => void
  ): void {
    const upload = this.activeUploads.get(payload.uploadId);
    if (!upload) {
      const error = { error: "UPLOAD_NOT_FOUND", message: "Upload session not found" };
      if (cb) cb({ ok: false, ...error });
      return;
    }

    if (
      payload.chunkIndex < 0 ||
      payload.chunkIndex >= upload.totalChunks ||
      payload.totalChunks !== upload.totalChunks
    ) {
      const error = { error: "INVALID_CHUNK_INDEX", message: "Chunk index or totalChunks mismatch" };
      if (cb) cb({ ok: false, ...error });
      return;
    }

    try {
      const buffer = Buffer.from(payload.chunk, "base64");

      if (buffer.length > this.options.maxChunkSizeBytes) {
        const error = {
          error: "CHUNK_TOO_LARGE",
          message: `Chunk exceeds max size of undefined bytes`
        };
        if (cb) cb({ ok: false, ...error });
        return;
      }

      if (!upload.chunks[payload.chunkIndex]) {
        upload.chunks[payload.chunkIndex] = buffer;
        upload.receivedChunks += 1;
      }
      upload.lastUpdatedAt = Date.now();

      const progress = Math.round((upload.receivedChunks / upload.totalChunks) * 100);

      if (upload.roomId) {
        this.io.to(upload.roomId).emit("file:upload:progress", {
          uploadId: upload.uploadId,
          receivedChunks: upload.receivedChunks,
          totalChunks: upload.totalChunks,
          progress,
          updatedAt: upload.lastUpdatedAt,
          uploadedBy: socket.id
        });
      }

      if (cb) {
        cb({
          ok: true,
          uploadId: upload.uploadId,
          chunkIndex: payload.chunkIndex,
          receivedChunks: upload.receivedChunks,
          totalChunks: upload.totalChunks,
          progress
        });
      }
    } catch {
      const error = { error: "CHUNK_DECODE_ERROR", message: "Failed to decode file chunk" };
      if (cb) cb({ ok: false, ...error });
    }
  }

  private async handleUploadComplete(
    socket: Socket,
    payload: FileUploadCompletePayload,
    cb?: (response: any) => void
  ): Promise<void> {
    const upload = this.activeUploads.get(payload.uploadId);
    if (!upload) {
      const error = { error: "UPLOAD_NOT_FOUND", message: "Upload session not found" };
      if (cb) cb({ ok: false, ...error });
      return;
    }

    if (upload.receivedChunks !== upload.totalChunks) {
      const error = {
        error: "UPLOAD_INCOMPLETE",
        message: `Expected undefined chunks, received undefined`
      };
      if (cb) cb({ ok: false, ...error });
      return;
    }

    try {
      const fileBuffer = Buffer.concat(upload.chunks);
      if (fileBuffer.length !== upload.totalSize) {
        const error = {
          error: "SIZE_MISMATCH",
          message: "Reconstructed file size does not match expected size"
        };
        if (cb) cb({ ok: false, ...error });
        return;
      }

      const fileId =
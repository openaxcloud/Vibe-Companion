import multer, { FileFilterCallback } from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { Request } from "express";
import sharp from "sharp";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const TEMP_UPLOAD_DIR = path.join(process.cwd(), "tmp", "uploads");

type SupportedMimetype = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface UploadedFileInfo {
  originalName: string;
  mimeType: SupportedMimetype;
  size: number;
  buffer?: Buffer;
  localPath?: string;
  filename?: string;
}

export interface CloudUploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
  contentType: string;
}

export interface ImageCompressionOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "jpeg" | "png" | "webp";
}

export interface UploadConfig {
  useCloudStorage: boolean;
  s3Bucket: string;
  s3Region: string;
  s3BaseUrl?: string;
  s3Folder?: string;
  compressImages: boolean;
  compressionOptions?: ImageCompressionOptions;
}

export interface UploadUtils {
  uploadMiddleware: multer.Multer;
  compressImageBuffer: (file: Express.Multer.File, options?: ImageCompressionOptions) => Promise<Buffer>;
  uploadToCloud: (file: Express.Multer.File | UploadedFileInfo, options?: ImageCompressionOptions) => Promise<CloudUploadResult>;
  deleteFromCloud: (key: string) => Promise<void>;
  getPublicUrl: (key: string) => string;
}

let s3Client: S3Client | null = null;
let configCache: UploadConfig | null = null;

const ensureTempUploadDir = (): void => {
  if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
    fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
  }
};

const getS3Client = (region: string): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({
      region,
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
  }
  return s3Client;
};

const getConfig = (): UploadConfig => {
  if (configCache) return configCache;

  const useCloudStorage = process.env.USE_CLOUD_STORAGE === "true";
  const s3Bucket = process.env.AWS_S3_BUCKET || "";
  const s3Region = process.env.AWS_REGION || "us-east-1";
  const s3BaseUrl = process.env.AWS_S3_BASE_URL || "";
  const s3Folder = process.env.AWS_S3_FOLDER || "uploads";
  const compressImages = (process.env.COMPRESS_IMAGES || "true") === "true";

  if (useCloudStorage && !s3Bucket) {
    throw new Error("AWS_S3_BUCKET must be set when USE_CLOUD_STORAGE is true");
  }

  const compressionOptions: ImageCompressionOptions = {
    width: process.env.IMAGE_MAX_WIDTH ? parseInt(process.env.IMAGE_MAX_WIDTH, 10) : 1920,
    quality: process.env.IMAGE_QUALITY ? parseInt(process.env.IMAGE_QUALITY, 10) : 80,
    format: (process.env.IMAGE_FORMAT as ImageCompressionOptions["format"]) || "webp",
  };

  configCache = {
    useCloudStorage,
    s3Bucket,
    s3Region,
    s3BaseUrl,
    s3Folder,
    compressImages,
    compressionOptions,
  };

  return configCache;
};

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    cb(new Error("Unsupported file type. Only image files are allowed."));
    return;
  }
  cb(null, true);
};

const storage = multer.memoryStorage();

const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

const buildS3Key = (originalName: string): string => {
  const { s3Folder } = getConfig();
  const ext = path.extname(originalName) || ".jpg";
  const nameHash = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const folderPrefix = s3Folder ? `undefined/` : "";
  return `undefinedundefined-undefinedundefined`;
};

export const compressImageBuffer = async (
  file: Express.Multer.File,
  options?: ImageCompressionOptions
): Promise<Buffer> => {
  const cfg = getConfig();
  const compressionOptions: ImageCompressionOptions = {
    ...cfg.compressionOptions,
    ...options,
  };

  const { width, height, quality, format } = compressionOptions;

  let sharpInstance = sharp(file.buffer);

  if (width || height) {
    sharpInstance = sharpInstance.resize({
      width,
      height,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const targetFormat = format || "webp";
  switch (targetFormat) {
    case "jpeg":
      sharpInstance = sharpInstance.jpeg({ quality: quality ?? 80, mozjpeg: true });
      break;
    case "png":
      sharpInstance = sharpInstance.png({ quality: quality ?? 80, compressionLevel: 9 });
      break;
    case "webp":
    default:
      sharpInstance = sharpInstance.webp({ quality: quality ?? 80 });
      break;
  }

  return sharpInstance.toBuffer();
};

export const uploadToCloud = async (
  file: Express.Multer.File | UploadedFileInfo,
  options?: ImageCompressionOptions
): Promise<CloudUploadResult> => {
  const cfg = getConfig();

  if (!cfg.useCloudStorage) {
    throw new Error("Cloud storage is disabled. Enable it by setting USE_CLOUD_STORAGE=true");
  }

  const s3 = getS3Client(cfg.s3Region);

  const originalName = "originalname" in file ? file.originalname : file.originalName;
  const mimeType = ("mimetype" in file ? file.mimetype : file.mimeType) as SupportedMimetype;
  const buffer =
    "buffer" in file && file.buffer
      ? file.buffer
      : "buffer" in file
      ? (file as Express.Multer.File).buffer
      : (file as UploadedFileInfo).buffer;

  if (!buffer) {
    throw new Error("File buffer is missing");
  }

  let uploadBuffer = buffer;
  let contentType = mimeType;
  let key = buildS3Key(originalName);

  if (cfg.compressImages) {
    uploadBuffer = await compressImageBuffer(
      {
        ...file,
        buffer,
        mimetype: mimeType,
        originalname: originalName,
        fieldname: "file",
        size: buffer.length,
        encoding: "7bit",
        destination: "",
        filename: "",
        path: "",
        stream: fs.createReadStream("/dev/null"),
      } as Express.Multer.File,
      options
    );

    const ext = path.extname(key).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") {
      contentType = "image/jpeg";
    } else if (ext === ".png") {
      contentType = "image/png";
    } else {
      contentType = "image/webp";
      if (![".webp"].includes(ext)) {
        key = key.replace(ext, ".webp");
      }
    }
  }

  const command = new PutObjectCommand({
    Bucket: cfg.s3Bucket,
    Key: key,
    Body: uploadBuffer,
    ContentType: contentType,
    ACL: "public-read",
  });

  await s3.send(command);

  const baseUrl =
    cfg.s3BaseUrl ||
    `https://undefined.s3.undefined.amazonaws.com`;

  const url = `undefined/undefined`;

  return {
    key,
    url,
    bucket: cfg.s3Bucket,
    size: uploadBuffer.length,
    contentType,
  };
};

export const deleteFromCloud = async (key: string): Promise<void> => {
  const cfg = getConfig();

  if (!cfg.useCloudStorage) {
    return;
  }

  const s3 = getS3Client(cfg.s3Region);

  const command = new DeleteObjectCommand({
    Bucket: cfg.s3Bucket,
    Key: key,
  });

  await s3.send(command);
};

export const getPublicUrl = (key: string): string => {
  const cfg = getConfig();
  const baseUrl =
    cfg.s3BaseUrl ||
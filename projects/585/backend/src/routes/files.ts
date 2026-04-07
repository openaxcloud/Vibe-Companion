import express, { Request, Response, NextFunction, Router } from "express";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

type StorageType = "s3" | "local";

interface AppConfig {
  storageType: StorageType;
  uploadsDir: string;
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3Endpoint?: string;
  s3ForcePathStyle?: boolean;
  maxFileSizeBytes: number;
  allowedImageMimeTypes: string[];
  allowedDocumentMimeTypes: string[];
}

interface UploadedFileResponse {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  storage: StorageType;
  createdAt: string;
}

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const config: AppConfig = {
  storageType: (process.env.STORAGE_TYPE as StorageType) || "local",
  uploadsDir: process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"),
  s3Bucket: process.env.S3_BUCKET,
  s3Region: process.env.S3_REGION,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024),
  allowedImageMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
  ],
  allowedDocumentMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ],
};

let s3Client: S3Client | null = null;

if (config.storageType === "s3") {
  if (!config.s3Bucket || !config.s3Region || !config.s3AccessKeyId || !config.s3SecretAccessKey) {
    throw new Error("Missing required S3 configuration for S3 storage");
  }

  s3Client = new S3Client({
    region: config.s3Region,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
    },
    endpoint: config.s3Endpoint || undefined,
    forcePathStyle: config.s3ForcePathStyle,
  });
} else {
  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  }
}

const generateFileId = (): string => {
  return crypto.randomBytes(16).toString("hex");
};

const generateFileName = (originalName: string): string => {
  const ext = path.extname(originalName);
  const baseName = crypto.randomBytes(12).toString("hex");
  return `undefinedundefined`;
};

const getPublicUrl = (storage: StorageType, filename: string): string => {
  if (storage === "s3") {
    const bucket = config.s3Bucket as string;
    const region = config.s3Region as string;
    const endpoint = config.s3Endpoint;
    if (endpoint) {
      const endpointUrl = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
      return `undefined/undefined/undefined`;
    }
    return `https://undefined.s3.undefined.amazonaws.com/undefined`;
  }
  const baseUrl = process.env.PUBLIC_BASE_URL || "";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `undefined/uploads/undefined`;
};

const createMulterStorage = () => {
  if (config.storageType === "local") {
    return multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, config.uploadsDir);
      },
      filename: (_req, file, cb) => {
        const safeName = generateFileName(file.originalname);
        cb(null, safeName);
      },
    });
  }

  return multer.memoryStorage();
};

const createFileFilter =
  (allowedMimeTypes: string[]) =>
  (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  };

const upload = multer({
  storage: createMulterStorage(),
  limits: {
    fileSize: config.maxFileSizeBytes,
  },
});

const router: Router = express.Router();

const asyncHandler =
  <TRequest extends Request = Request, TResponse extends Response = Response>(
    fn: (req: TRequest, res: TResponse, next: NextFunction) => Promise<unknown>
  ) =>
  (req: TRequest, res: TResponse, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const uploadToS3 = async (file: Express.Multer.File, key: string): Promise<void> => {
  if (!s3Client || !config.s3Bucket) {
    throw new Error("S3 is not configured");
  }

  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  });

  await s3Client.send(command);
};

const buildResponse = (
  storage: StorageType,
  fileId: string,
  storedFilename: string,
  file: Express.Multer.File
): UploadedFileResponse => {
  return {
    id: fileId,
    filename: storedFilename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: getPublicUrl(storage, storedFilename),
    storage,
    createdAt: new Date().toISOString(),
  };
};

router.post(
  "/upload/image",
  upload.single("file"),
  asyncHandler(async (req: MulterRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    if (!config.allowedImageMimeTypes.includes(req.file.mimetype)) {
      res.status(400).json({ error: "Unsupported image type" });
      return;
    }

    const fileId = generateFileId();
    let storedFilename = req.file.filename || generateFileName(req.file.originalname);

    if (config.storageType === "s3") {
      storedFilename = storedFilename.startsWith("images/")
        ? storedFilename
        : `images/undefined`;
      await uploadToS3(req.file, storedFilename);
    }

    const responseBody = buildResponse(config.storageType, fileId, storedFilename, req.file);
    res.status(201).json(responseBody);
  })
);

router.post(
  "/upload/document",
  upload.single("file"),
  asyncHandler(async (req: MulterRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    if (
      !config.allowedDocumentMimeTypes.includes(req.file.mimetype) &&
      !config.allowedImageMimeTypes.includes(req.file.mimetype)
    ) {
      res.status(400).json({ error: "Unsupported document type" });
      return;
    }

    const fileId = generateFileId();
    let storedFilename = req.file.filename || generateFileName(req.file.originalname);

    if (config.storageType === "s3") {
      storedFilename = storedFilename.startsWith("documents/")
        ? storedFilename
        : `documents/undefined`;
      await uploadToS3(req.file, storedFilename);
    }

    const responseBody = buildResponse(config.storageType, fileId, storedFilename, req.file);
    res.status(201).json(responseBody);
  })
);

router.post(
  "/upload",
  upload.single("file"),
  asyncHandler(async (req: MulterRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const isImage = config.allowedImageMimeTypes.includes(req.file.mimetype);
    const isDocument = config.allowedDocumentMimeTypes.includes(req.file.mimetype);

    if (!isImage && !isDocument) {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    const fileId = generate
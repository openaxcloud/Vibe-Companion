import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer, { FileFilterCallback } from "multer";
import { Request } from "express";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

const ensureUploadDirExists = (): void => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
};

ensureUploadDirExists();

const MAX_IMAGE_SIZE = Number(process.env.MAX_IMAGE_SIZE || 5 * 1024 * 1024); // 5MB default
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 20 * 1024 * 1024); // 20MB default

const ALLOWED_IMAGE_MIME_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

const ALLOWED_FILE_MIME_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/json",
  ...Array.from(ALLOWED_IMAGE_MIME_TYPES),
]);

const generateHashedFilename = (originalName: string): string => {
  const ext = path.extname(originalName) || "";
  const base = path.basename(originalName, ext);
  const hash = crypto.createHash("sha256");
  hash.update(`undefined-undefined-undefined`);
  const digest = hash.digest("hex");
  return `undefinedundefined`;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    try {
      const hashedName = generateHashedFilename(file.originalname);
      cb(null, hashedName);
    } catch (error) {
      cb(error as Error, "");
    }
  },
});

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname);
    (err as Error & { status?: number; code?: string }).message =
      "Only image files are allowed.";
    (err as Error & { status?: number }).status = 400;
    cb(err);
    return;
  }
  cb(null, true);
};

const generalFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (!ALLOWED_FILE_MIME_TYPES.has(file.mimetype)) {
    const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname);
    (err as Error & { status?: number; code?: string }).message =
      "File type not allowed.";
    (err as Error & { status?: number }).status = 400;
    cb(err);
    return;
  }
  cb(null, true);
};

export const imageUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
});

export const fileUpload = multer({
  storage,
  fileFilter: generalFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
});

export const getUploadDir = (): string => UPLOAD_DIR;

export const allowedImageMimeTypes = ALLOWED_IMAGE_MIME_TYPES;
export const allowedFileMimeTypes = ALLOWED_FILE_MIME_TYPES;

export type MulterUploader = typeof imageUpload;
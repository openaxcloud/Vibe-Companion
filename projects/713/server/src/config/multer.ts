import path from "path";
import crypto from "crypto";
import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import fs from "fs";

type AllowedFileType = "image" | "file";

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
const IMAGE_UPLOADS_DIR = path.join(UPLOADS_ROOT, "images");
const FILE_UPLOADS_DIR = path.join(UPLOADS_ROOT, "files");

const ensureUploadDirs = (): void => {
  [UPLOADS_ROOT, IMAGE_UPLOADS_DIR, FILE_UPLOADS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureUploadDirs();

const generateHashedFileName = (originalName: string): string => {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const hash = crypto
    .createHash("sha256")
    .update(`undefined-undefined-undefined`)
    .digest("hex")
    .slice(0, 32);

  return `undefinedundefined`;
};

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only image files are allowed"));
  }
};

const genericFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  // Basic validation, can be extended for specific types
  if (!file.mimetype || typeof file.mimetype !== "string") {
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Invalid file type"));
    return;
  }

  // Example blacklist of dangerous types
  const blockedMimeTypes = ["application/x-msdownload", "application/x-sh", "application/x-bat"];

  if (blockedMimeTypes.includes(file.mimetype)) {
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "This file type is not allowed"));
    return;
  }

  cb(null, true);
};

const createDiskStorage = (type: AllowedFileType): multer.StorageEngine => {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (type === "image") {
        cb(null, IMAGE_UPLOADS_DIR);
      } else {
        cb(null, FILE_UPLOADS_DIR);
      }
    },
    filename: (_req, file, cb) => {
      try {
        const filename = generateHashedFileName(file.originalname);
        cb(null, filename);
      } catch (err) {
        cb(err as Error, "");
      }
    },
  });
};

const baseLimits: multer.Options["limits"] = {
  fileSize: 10 * 1024 * 1024, // 10MB default
  files: 10,
};

const imageUploadLimits: multer.Options["limits"] = {
  ...baseLimits,
  fileSize: 5 * 1024 * 1024, // 5MB for images
};

const fileUploadLimits: multer.Options["limits"] = {
  ...baseLimits,
  fileSize: 25 * 1024 * 1024, // 25MB for generic files
};

const imageUpload = multer({
  storage: createDiskStorage("image"),
  fileFilter: imageFileFilter,
  limits: imageUploadLimits,
});

const fileUpload = multer({
  storage: createDiskStorage("file"),
  fileFilter: genericFileFilter,
  limits: fileUploadLimits,
});

export { imageUpload, fileUpload, IMAGE_UPLOADS_DIR, FILE_UPLOADS_DIR, UPLOADS_ROOT };
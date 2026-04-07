import { Router, Request, Response, NextFunction } from "express";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import util from "util";

const unlinkAsync = util.promisify(fs.unlink);

const router = Router();

// In-memory "database" placeholder. Replace with real persistence in production.
type AttachmentStatus = "active" | "removed";

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  storageKey: string | null;
  originalName: string | null;
  createdAt: string;
  removedAt: string | null;
  status: AttachmentStatus;
}

const attachments: Attachment[] = [];

// Configuration
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `undefined-undefined`;
    const ext = path.extname(file.originalname);
    cb(null, `undefinedundefined`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (!file.originalname) {
    return cb(new Error("Invalid file name"));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

interface UploadRequestBody {
  noteId?: string;
  metadataOnly?: string | boolean;
  fileName?: string;
  mimeType?: string;
  size?: number;
}

// Helper to generate URLs or keys. In production, this might be a presigned URL.
const buildAttachmentUrl = (attachment: Attachment): string | null => {
  if (!attachment.storageKey) return null;
  return `/uploads/undefined`;
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }
  return false;
};

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

// POST /attachments
// Handles metadata-only or metadata+file uploads
router.post(
  "/attachments",
  (req, res, next) => {
    const metadataOnly = parseBoolean((req.body as UploadRequestBody)?.metadataOnly);
    if (metadataOnly) {
      return next();
    }
    return upload.single("file")(req, res, next);
  },
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as UploadRequestBody;
    const metadataOnly = parseBoolean(body.metadataOnly);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    let fileName: string;
    let fileSize: number | null;
    let mimeType: string | null;
    let storageKey: string | null;
    let originalName: string | null;

    if (metadataOnly) {
      fileName = body.fileName || `attachment-undefined`;
      fileSize = typeof body.size === "number" ? body.size : null;
      mimeType = body.mimeType ?? null;
      storageKey = null;
      originalName = null;
    } else {
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({ error: "File is required when metadataOnly is false" });
        return;
      }

      fileName = file.filename;
      fileSize = file.size;
      mimeType = file.mimetype;
      storageKey = file.path;
      originalName = file.originalname;
    }

    const newAttachment: Attachment = {
      id,
      fileName,
      fileSize,
      mimeType,
      storageKey,
      originalName,
      createdAt: now,
      removedAt: null,
      status: "active",
    };

    attachments.push(newAttachment);

    res.status(201).json({
      id: newAttachment.id,
      fileName: newAttachment.fileName,
      size: newAttachment.fileSize,
      mimeType: newAttachment.mimeType,
      createdAt: newAttachment.createdAt,
      url: buildAttachmentUrl(newAttachment),
      storageKey: newAttachment.storageKey,
      originalName: newAttachment.originalName,
      status: newAttachment.status,
    });
  })
);

// GET /attachments
// Optional query: status=active|removed|all
router.get(
  "/attachments",
  asyncHandler(async (req: Request, res: Response) => {
    const status = (req.query.status as string | undefined) ?? "active";

    let filtered: Attachment[];
    if (status === "all") {
      filtered = attachments;
    } else if (status === "removed") {
      filtered = attachments.filter((a) => a.status === "removed");
    } else {
      filtered = attachments.filter((a) => a.status === "active");
    }

    res.json(
      filtered.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        size: a.fileSize,
        mimeType: a.mimeType,
        createdAt: a.createdAt,
        removedAt: a.removedAt,
        url: buildAttachmentUrl(a),
        storageKey: a.storageKey,
        originalName: a.originalName,
        status: a.status,
      }))
    );
  })
);

// PATCH /attachments/:id/remove
// Marks an attachment as removed; optionally deletes underlying file
router.patch(
  "/attachments/:id/remove",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const hardDelete = parseBoolean(req.query.hardDelete);

    const attachment = attachments.find((a) => a.id === id);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    if (attachment.status === "removed") {
      res.status(200).json({
        id: attachment.id,
        status: attachment.status,
        removedAt: attachment.removedAt,
      });
      return;
    }

    attachment.status = "removed";
    attachment.removedAt = new Date().toISOString();

    if (hardDelete && attachment.storageKey) {
      try {
        await unlinkAsync(attachment.storageKey);
        attachment.storageKey = null;
      } catch {
        // Best-effort delete; log in real application
      }
    }

    res.json({
      id: attachment.id,
      status: attachment.status,
      removedAt: attachment.removedAt,
      url: buildAttachmentUrl(attachment),
      storageKey: attachment.storageKey,
    });
  })
);

export default router;
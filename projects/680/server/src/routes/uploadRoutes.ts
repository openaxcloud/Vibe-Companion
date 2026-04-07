import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

const router = Router();

interface UploadRequestBody {
  filename?: string;
  contentType?: string;
  dataUrl?: string;
  metadata?: Record<string, unknown>;
}

interface UploadResponseBody {
  id: string;
  url: string;
  filename?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Basic validation for data URLs if provided.
 */
const isValidDataUrl = (value: string | undefined): boolean => {
  if (!value) return true;
  // Very lightweight check, not full RFC compliant – just enough for MVP
  return /^data:.+;base64,[a-zA-Z0-9+/=]+$/.test(value.trim());
};

router.post(
  "/",
  async (
    req: Request<unknown, UploadResponseBody | { error: string }, UploadRequestBody>,
    res: Response<UploadResponseBody | { error: string }>,
    next: NextFunction
  ) => {
    try {
      const { filename, contentType, dataUrl, metadata } = req.body || {};

      if (!filename && !dataUrl) {
        return res.status(400).json({
          error: "Either 'filename' or 'dataUrl' must be provided.",
        });
      }

      if (!isValidDataUrl(dataUrl)) {
        return res.status(400).json({
          error: "Invalid 'dataUrl' format. Must be a base64 data URL.",
        });
      }

      const id = uuidv4();

      // MVP behavior:
      // We do not actually persist files, but simulate a stored resource.
      // In a real implementation, dataUrl or file buffer would be saved to storage (S3, disk, etc.).
      const storedUrl = `/uploads/undefinedundefined` : ""}`;

      const responseBody: UploadResponseBody = {
        id,
        url: storedUrl,
        filename,
        contentType,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
      };

      return res.status(201).json(responseBody);
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
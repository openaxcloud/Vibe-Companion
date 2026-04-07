import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import AttachmentModel, { AttachmentDocument } from "../models/Attachment";
import TaskModel from "../models/Task";
import AuditLogModel from "../models/AuditLog";
import { getCurrentUserIdFromRequest } from "../utils/auth";
import { buildAttachmentDownloadUrl } from "../utils/urlBuilder";
import { HttpError } from "../utils/errors";

const unlinkAsync = promisify(fs.unlink);

interface CreateAttachmentBody {
  taskId: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  storageProvider?: string;
}

interface MarkRemovedBody {
  reason?: string;
}

const validateObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

const ensureTaskExists = async (taskId: string) => {
  if (!validateObjectId(taskId)) {
    throw new HttpError(400, "Invalid task id");
  }
  const task = await TaskModel.findById(taskId).select("_id");
  if (!task) {
    throw new HttpError(404, "Task not found");
  }
  return task;
};

const ensureAttachmentExists = async (
  attachmentId: string
): Promise<AttachmentDocument> => {
  if (!validateObjectId(attachmentId)) {
    throw new HttpError(400, "Invalid attachment id");
  }
  const attachment = await AttachmentModel.findById(attachmentId);
  if (!attachment) {
    throw new HttpError(404, "Attachment not found");
  }
  return attachment;
};

const logAttachmentAction = async (params: {
  userId: string | null;
  taskId: string;
  attachmentId: string;
  action: "created" | "downloaded" | "marked_removed";
  details?: Record<string, unknown>;
}) => {
  const { userId, taskId, attachmentId, action, details } = params;

  try {
    await AuditLogModel.create({
      actor: userId ? new Types.ObjectId(userId) : null,
      action: `attachment_undefined`,
      entityType: "Attachment",
      entityId: new Types.ObjectId(attachmentId),
      context: {
        taskId: new Types.ObjectId(taskId),
        details: details || {},
      },
      createdAt: new Date(),
    });
  } catch (err) {
    // Fail silently for logging errors; do not block main flow
  }
};

export const createAttachment = async (
  req: Request<unknown, unknown, Partial<CreateAttachmentBody>>,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      taskId,
      originalName,
      mimeType,
      size,
      storagePath,
      storageProvider,
    } = req.body;

    if (!taskId || !originalName || !mimeType || !size || !storagePath) {
      throw new HttpError(400, "Missing required attachment fields");
    }

    await ensureTaskExists(taskId);

    const userId = getCurrentUserIdFromRequest(req);

    const attachment = await AttachmentModel.create({
      taskId: new Types.ObjectId(taskId),
      originalName,
      mimeType,
      size,
      storagePath,
      storageProvider: storageProvider || "local",
      createdBy: userId ? new Types.ObjectId(userId) : null,
      isRemoved: false,
      removedAt: null,
      removedBy: null,
      removedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await logAttachmentAction({
      userId,
      taskId,
      attachmentId: attachment._id.toString(),
      action: "created",
      details: {
        originalName,
        mimeType,
        size,
        storageProvider: storageProvider || "local",
      },
    });

    const downloadUrl = buildAttachmentDownloadUrl(attachment._id.toString());

    res.status(201).json({
      id: attachment._id,
      taskId: attachment.taskId,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdBy: attachment.createdBy,
      createdAt: attachment.createdAt,
      isRemoved: attachment.isRemoved,
      downloadUrl,
    });
  } catch (err) {
    next(err);
  }
};

export const listAttachmentsForTask = async (
  req: Request<{ taskId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { taskId } = req.params;

    await ensureTaskExists(taskId);

    const attachments = await AttachmentModel.find({
      taskId: new Types.ObjectId(taskId),
    })
      .sort({ createdAt: 1 })
      .lean();

    const response = attachments.map((a) => ({
      id: a._id,
      taskId: a.taskId,
      originalName: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
      isRemoved: a.isRemoved,
      removedAt: a.removedAt,
      removedBy: a.removedBy,
      downloadUrl: a.isRemoved
        ? null
        : buildAttachmentDownloadUrl(a._id.toString()),
    }));

    res.json(response);
  } catch (err) {
    next(err);
  }
};

export const getAttachmentMetadata = async (
  req: Request<{ attachmentId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attachmentId } = req.params;
    const attachment = await ensureAttachmentExists(attachmentId);

    const response = {
      id: attachment._id,
      taskId: attachment.taskId,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdBy: attachment.createdBy,
      createdAt: attachment.createdAt,
      isRemoved: attachment.isRemoved,
      removedAt: attachment.removedAt,
      removedBy: attachment.removedBy,
      removedReason: attachment.removedReason,
      downloadUrl: attachment.isRemoved
        ? null
        : buildAttachmentDownloadUrl(attachment._id.toString()),
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
};

export const getAttachmentDownloadUrl = async (
  req: Request<{ attachmentId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attachmentId } = req.params;
    const attachment = await ensureAttachmentExists(attachmentId);

    if (attachment.isRemoved) {
      throw new HttpError(410, "Attachment has been removed");
    }

    const userId = getCurrentUserIdFromRequest(req);

    await logAttachmentAction({
      userId,
      taskId: attachment.taskId.toString(),
      attachmentId: attachment._id.toString(),
      action: "downloaded",
      details: {
        originalName: attachment.originalName,
      },
    });

    const downloadUrl = buildAttachmentDownloadUrl(attachment._id.toString());

    res.json({
      id: attachment._id,
      downloadUrl,
      expiresInSeconds: 60 * 15,
    });
  } catch (err) {
    next(err);
  }
};

export const streamAttachment = async (
  req: Request<{ attachmentId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attachmentId } = req.params;
    const attachment = await ensureAttachmentExists(attachmentId);

    if (attachment.isRemoved) {
      throw new HttpError(410, "Attachment has been removed");
    }

    if (attachment.storageProvider !== "local") {
      throw new HttpError(501, "Streaming not implemented for this provider");
    }

    const filePath = attachment.storagePath;
    if (!fs.existsSync(filePath)) {
      throw new HttpError(404, "Attachment file not found");
    }

    const stat = fs.statSync(filePath);

    res.writeHead(200, {
      "Content-Type": attachment.mimeType,
      "Content-Length": stat.size,
      "Content-Disposition": `attachment; filename="undefined"`,
    });

    const readStream = fs.createReadStream(filePath);
    readStream.on("error", (err) => {
      next(err);
    });
    readStream.pipe(res);
  } catch (err) {
    next(err);
  }
};

export const markAttachmentRemoved = async (
  req: Request<{ attachmentId: string }, unknown, MarkRemovedBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attachmentId } = req.params;
    const { reason } = req.body;

    const attachment = await ensureAttachmentExists(attachmentId);

    if (attachment.isRemoved) {
      res.status(200).json({
        id: attachment._id,
        taskId: attachment.taskId,
        isRemoved: true,
        removedAt: attachment.removedAt,
        removedBy: attachment.removedBy,
        removedReason: attachment.removedReason,
      });
      return;
    }

    const userId = getCurrentUserIdFromRequest(req);

    attachment.isRemoved =
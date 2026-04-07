import express, { Request, Response, NextFunction, Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Types } from "mongoose";
import { MessageModel } from "../models/Message";
import { ChannelModel } from "../models/Channel";
import { DirectMessageThreadModel } from "../models/DirectMessageThread";
import { authenticate } from "../middleware/authenticate";
import { authorizeChannelAccess, authorizeDMAccess } from "../middleware/authorization";

const messageRoutes: Router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    roles?: string[];
  };
}

const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      errors: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
      })),
    });
    return;
  }
  next();
};

const parsePagination = (req: Request) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
  const before = req.query.before ? new Date(req.query.before as string) : undefined;
  const after = req.query.after ? new Date(req.query.after as string) : undefined;
  return { limit, before, after };
};

const isValidObjectId = (id: string): boolean => Types.ObjectId.isValid(id);

/**
 * GET /api/messages/channel/:channelId
 * Fetch paginated messages for a channel
 */
messageRoutes.get(
  "/channel/:channelId",
  authenticate,
  param("channelId").custom((value) => isValidObjectId(value)).withMessage("Invalid channelId"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),
  query("before").optional().isISO8601().withMessage("before must be a valid ISO8601 date"),
  query("after").optional().isISO8601().withMessage("after must be a valid ISO8601 date"),
  validateRequest,
  authorizeChannelAccess("channelId"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { channelId } = req.params;
      const { limit, before, after } = parsePagination(req);

      const channel = await ChannelModel.findById(channelId).select("_id workspaceId isArchived");
      if (!channel) {
        res.status(404).json({ message: "Channel not found" });
        return;
      }

      const query: Record<string, any> = {
        channelId: new Types.ObjectId(channelId),
        isDeleted: { $ne: true },
      };

      if (before) {
        query.createdAt = { ...(query.createdAt || {}), $lt: before };
      }
      if (after) {
        query.createdAt = { ...(query.createdAt || {}), $gt: after };
      }

      const messages = await MessageModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .lean()
        .exec();

      const hasMore = messages.length > limit;
      const items = hasMore ? messages.slice(0, limit) : messages;

      res.json({
        items,
        pageInfo: {
          hasMore,
          nextCursor: hasMore ? items[items.length - 1].createdAt : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/messages/dm/:threadId
 * Fetch paginated direct messages for a DM thread
 */
messageRoutes.get(
  "/dm/:threadId",
  authenticate,
  param("threadId").custom((value) => isValidObjectId(value)).withMessage("Invalid threadId"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),
  query("before").optional().isISO8601().withMessage("before must be a valid ISO8601 date"),
  query("after").optional().isISO8601().withMessage("after must be a valid ISO8601 date"),
  validateRequest,
  authorizeDMAccess("threadId"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { threadId } = req.params;
      const { limit, before, after } = parsePagination(req);

      const dmThread = await DirectMessageThreadModel.findById(threadId).select("_id participantIds isArchived");
      if (!dmThread) {
        res.status(404).json({ message: "DM thread not found" });
        return;
      }

      const query: Record<string, any> = {
        dmThreadId: new Types.ObjectId(threadId),
        isDeleted: { $ne: true },
      };

      if (before) {
        query.createdAt = { ...(query.createdAt || {}), $lt: before };
      }
      if (after) {
        query.createdAt = { ...(query.createdAt || {}), $gt: after };
      }

      const messages = await MessageModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .lean()
        .exec();

      const hasMore = messages.length > limit;
      const items = hasMore ? messages.slice(0, limit) : messages;

      res.json({
        items,
        pageInfo: {
          hasMore,
          nextCursor: hasMore ? items[items.length - 1].createdAt : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/messages/:messageId/replies
 * Create threaded reply via REST as a fallback for real-time
 */
messageRoutes.post(
  "/:messageId/replies",
  authenticate,
  param("messageId").custom((value) => isValidObjectId(value)).withMessage("Invalid messageId"),
  body("content").isString().trim().notEmpty().withMessage("content is required"),
  body("metadata").optional().isObject().withMessage("metadata must be an object"),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { messageId } = req.params;
      const { content, metadata } = req.body;
      const userId = req.user?.id;

      const parentMessage = await MessageModel.findById(messageId);
      if (!parentMessage || parentMessage.isDeleted) {
        res.status(404).json({ message: "Parent message not found" });
        return;
      }

      if (parentMessage.channelId) {
        await authorizeChannelAccess("channelId")(
          { ...req, params: { ...req.params, channelId: parentMessage.channelId.toString() } } as any,
          res,
          () => undefined
        );
      } else if (parentMessage.dmThreadId) {
        await authorizeDMAccess("dmThreadId")(
          { ...req, params: { ...req.params, dmThreadId: parentMessage.dmThreadId.toString() } } as any,
          res,
          () => undefined
        );
      }

      const reply = await MessageModel.create({
        channelId: parentMessage.channelId,
        dmThreadId: parentMessage.dmThreadId,
        parentMessageId: parentMessage._id,
        authorId: userId,
        content,
        metadata: metadata || {},
        isDeleted: false,
      });

      res.status(201).json(reply);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/messages/:messageId/thread
 * Retrieve a message along with its thread replies
 */
messageRoutes.get(
  "/:messageId/thread",
  authenticate,
  param("messageId").custom((value) => isValidObjectId(value)).withMessage("Invalid messageId"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),
  query("before").optional().isISO8601().withMessage("before must be a valid ISO8601 date"),
  query("after").optional().isISO8601().withMessage("after must be a valid ISO8601 date"),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { messageId } = req.params;
      const { limit, before, after } = parsePagination(req);

      const message = await MessageModel.findById(messageId).lean().exec();
      if (!message || message.isDeleted) {
        res.status(404).json({ message: "Message not found" });
        return;
      }

      if (message.channelId) {
        await authorizeChannelAccess("channelId")(
          { ...req, params: { ...req.params, channelId: message.channelId.toString() } } as any,
          res,
          () => undefined
        );
      } else if (message.dmThreadId) {
        await authorizeDMAccess("dmThreadId")
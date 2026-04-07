import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Types } from 'mongoose';
import Message from '../models/Message';
import Thread from '../models/Thread';
import User from '../models/User';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    roles?: string[];
  };
};

const validateObjectId = (value: string, { req }: { req: Request }) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error('Invalid ID format');
  }
  return true;
};

const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }
  next();
};

const getPagination = (req: Request) => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const limit = Math.min(
    Math.max(parseInt((req.query.limit as string) || '20', 10), 1),
    100
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

router.use(authenticate);

// GET /messages
router.get(
  '/',
  [
    query('threadId').optional().custom(validateObjectId),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sort').optional().isIn(['asc', 'desc']),
    query('includeReplies').optional().isBoolean().toBoolean()
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { page, limit, skip } = getPagination(req);
      const {
        threadId,
        sort = 'asc',
        includeReplies = false
      } = req.query as {
        threadId?: string;
        sort?: 'asc' | 'desc';
        includeReplies?: boolean;
      };

      const filter: Record<string, unknown> = {};

      if (threadId) {
        filter.threadId = new Types.ObjectId(threadId);
      }

      if (!includeReplies) {
        filter.parentId = { $exists: false };
      }

      filter.$or = [
        { senderId: userId },
        { recipientId: userId },
        { participants: userId }
      ];

      const [data, total] = await Promise.all([
        Message.find(filter)
          .sort({ createdAt: sort === 'asc' ? 1 : -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Message.countDocuments(filter)
      ]);

      res.json({
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /messages/:id
router.get(
  '/:id',
  [param('id').custom(validateObjectId)],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const message = await Message.findById(id).lean();

      if (!message) {
        res.status(404).json({ message: 'Message not found' });
        return;
      }

      const isParticipant =
        message.senderId.toString() === userId ||
        message.recipientId?.toString() === userId ||
        (Array.isArray(message.participants) &&
          message.participants.some((p: Types.ObjectId) => p.toString() === userId));

      if (!isParticipant) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      res.json(message);
    } catch (err) {
      next(err);
    }
  }
);

// POST /messages
router.post(
  '/',
  [
    body('threadId').optional().custom(validateObjectId),
    body('parentId').optional().custom(validateObjectId),
    body('recipientId').optional().custom(validateObjectId),
    body('content').isString().trim().notEmpty().isLength({ max: 5000 }),
    body('metadata').optional().isObject(),
    body('participants').optional().isArray(),
    body('participants.*').custom(validateObjectId)
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const {
        threadId,
        parentId,
        recipientId,
        content,
        metadata,
        participants
      } = req.body as {
        threadId?: string;
        parentId?: string;
        recipientId?: string;
        content: string;
        metadata?: Record<string, unknown>;
        participants?: string[];
      };

      let resolvedThreadId: Types.ObjectId | undefined;

      if (threadId) {
        const existingThread = await Thread.findById(threadId);
        if (!existingThread) {
          res.status(404).json({ message: 'Thread not found' });
          return;
        }
        resolvedThreadId = existingThread._id;
      } else if (parentId) {
        const parentMessage = await Message.findById(parentId);
        if (!parentMessage) {
          res.status(404).json({ message: 'Parent message not found' });
          return;
        }
        resolvedThreadId = parentMessage.threadId || parentMessage._id;
      } else {
        const thread = await Thread.create({
          createdBy: userId,
          participants: [userId, recipientId].filter(Boolean),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        resolvedThreadId = thread._id;
      }

      const allParticipants = new Set<string>();
      allParticipants.add(userId);
      if (recipientId) allParticipants.add(recipientId);
      if (Array.isArray(participants)) {
        participants.forEach(p => allParticipants.add(p));
      }

      const message = await Message.create({
        threadId: resolvedThreadId,
        parentId: parentId ? new Types.ObjectId(parentId) : undefined,
        senderId: new Types.ObjectId(userId),
        recipientId: recipientId ? new Types.ObjectId(recipientId) : undefined,
        participants: Array.from(allParticipants).map(id => new Types.ObjectId(id)),
        content,
        metadata: metadata || {},
        reactions: [],
        readBy: [
          {
            userId: new Types.ObjectId(userId),
            readAt: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await Thread.findByIdAndUpdate(resolvedThreadId, {
        $addToSet: { participants: { $each: Array.from(allParticipants) } },
        $set: { updatedAt: new Date(), lastMessageAt: new Date() }
      });

      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /messages/:id
router.patch(
  '/:id',
  [
    param('id').custom(validateObjectId),
    body('content').optional().isString().trim().notEmpty().isLength({ max: 5000 }),
    body('metadata').optional().isObject()
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { content, metadata } = req.body as {
        content?: string;
        metadata?: Record<string, unknown>;
      };

      const message = await Message.findById(id);

      if (!message) {
        res.status(404).json({ message: 'Message not found' });
        return;
      }

      if (message.senderId.toString() !== userId) {
        res.status(403).json({ message: 'Only the sender can edit the message' });
        return;
      }

      const now = new Date();
      if ((now.getTime() - message.createdAt.getTime()) / 1000 / 60 > 30) {
        res.status(400).json({ message: 'Edit window has expired' });
        return;
      }

      if (content !== undefined) {
        message.content = content;
      }

      if (metadata !== undefined) {
        message.metadata = metadata;
      }

      message.updatedAt = new Date();
      await message.save();

      res.json(message);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /messages/:id
router.delete(
  '/:id',
  [param('id').custom(validateObjectId)],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
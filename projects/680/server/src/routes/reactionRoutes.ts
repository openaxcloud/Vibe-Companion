import { Router, Request, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { body, validationResult } from 'express-validator';
import { Types } from 'mongoose';
import { getIO } from '../websocket/io';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { MessageModel, MessageDocument } from '../models/Message';
import { ReactionModel, ReactionDocument } from '../models/Reaction';

const router = Router();

const AVAILABLE_REACTIONS = ['like', 'love', 'laugh', 'sad', 'angry'] as const;
type ReactionType = (typeof AVAILABLE_REACTIONS)[number];

interface ReactionCounts {
  [reactionType: string]: number;
}

interface MessageWithReactions {
  messageId: string;
  reactions: ReactionCounts;
  userReactions: ReactionType[];
}

const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

const validateObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

const buildReactionCountsFromDocs = (docs: ReactionDocument[]): ReactionCounts => {
  const counts: ReactionCounts = {};
  for (const doc of docs) {
    const type = doc.type;
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
};

const getUserReactionsFromDocs = (docs: ReactionDocument[], userId: string): ReactionType[] => {
  const set = new Set<ReactionType>();
  for (const doc of docs) {
    if (doc.user.toString() === userId) {
      set.add(doc.type as ReactionType);
    }
  }
  return Array.from(set);
};

const broadcastReactionUpdate = async (
  io: SocketIOServer | null,
  message: MessageDocument,
  reactionState: MessageWithReactions
): Promise<void> => {
  if (!io) return;
  const roomId = message.conversation?.toString?.() || message.channel?.toString?.() || undefined;
  const payload = {
    messageId: reactionState.messageId,
    reactions: reactionState.reactions,
  };
  if (roomId) {
    io.to(roomId).emit('message:reactionUpdated', payload);
  } else {
    io.emit('message:reactionUpdated', payload);
  }
};

router.post(
  '/api/reactions',
  authMiddleware,
  body('messageId').isString().notEmpty(),
  body('type')
    .isString()
    .custom((value) => AVAILABLE_REACTIONS.includes(value)),
  body('action').isString().isIn(['add', 'remove']),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { messageId, type, action } = req.body as {
        messageId: string;
        type: ReactionType;
        action: 'add' | 'remove';
      };

      if (!validateObjectId(messageId)) {
        res.status(400).json({ error: 'Invalid messageId' });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const message = await MessageModel.findById(messageId);
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      if (action === 'add') {
        const existing = await ReactionModel.findOne({
          message: messageId,
          user: userId,
          type,
        });
        if (!existing) {
          const reaction = new ReactionModel({
            message: messageId,
            user: userId,
            type,
          });
          await reaction.save();
        }
      } else if (action === 'remove') {
        await ReactionModel.deleteMany({
          message: messageId,
          user: userId,
          type,
        });
      }

      const reactions = await ReactionModel.find({ message: messageId });
      const counts = buildReactionCountsFromDocs(reactions);
      const userReactions = getUserReactionsFromDocs(reactions, userId);

      const responsePayload: MessageWithReactions = {
        messageId,
        reactions: counts,
        userReactions,
      };

      const io = getIO();
      await broadcastReactionUpdate(io, message, responsePayload);

      res.status(200).json(responsePayload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error handling reaction:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get(
  '/api/reactions/:messageId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { messageId } = req.params;
      if (!validateObjectId(messageId)) {
        res.status(400).json({ error: 'Invalid messageId' });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const message = await MessageModel.findById(messageId);
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      const reactions = await ReactionModel.find({ message: messageId });
      const counts = buildReactionCountsFromDocs(reactions);
      const userReactions = getUserReactionsFromDocs(reactions, userId);

      const responsePayload: MessageWithReactions = {
        messageId,
        reactions: counts,
        userReactions,
      };

      res.status(200).json(responsePayload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching reactions:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
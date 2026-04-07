import express, { Request, Response, NextFunction } from "express";
import { body, param, query } from "express-validator";
import { Types } from "mongoose";
import { DirectMessageService } from "../services/DirectMessageService";
import { authMiddleware } from "../middleware/authMiddleware";
import { validateRequest } from "../middleware/validateRequest";

const router = express.Router();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    username?: string;
  };
}

const directMessageService = new DirectMessageService();

function ensureAuthenticated(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || !req.user.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use(authMiddleware);
router.use(ensureAuthenticated);

router.post(
  "/",
  [
    body("participantId")
      .exists()
      .withMessage("participantId is required")
      .bail()
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("participantId must be a valid user id"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user!.id;
      const { participantId } = req.body as { participantId: string };

      if (participantId === currentUserId) {
        res.status(400).json({ error: "Cannot start DM with yourself" });
        return;
      }

      const conversation = await directMessageService.startOrGetConversation(
        currentUserId,
        participantId
      );

      res.status(201).json(conversation);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
    query("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("offset must be 0 or greater"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user!.id;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 25;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string, 10)
        : 0;

      const conversations = await directMessageService.listUserConversations(
        currentUserId,
        {
          limit,
          offset,
        }
      );

      res.json(conversations);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:conversationId",
  [
    param("conversationId")
      .exists()
      .withMessage("conversationId is required")
      .bail()
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("conversationId must be a valid id"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user!.id;
      const { conversationId } = req.params;

      const conversation = await directMessageService.getConversationById(
        conversationId,
        currentUserId
      );

      if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      res.json(conversation);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:conversationId/participants",
  [
    param("conversationId")
      .exists()
      .withMessage("conversationId is required")
      .bail()
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("conversationId must be a valid id"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user!.id;
      const { conversationId } = req.params;

      const participants = await directMessageService.getConversationParticipants(
        conversationId,
        currentUserId
      );

      if (!participants) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      res.json(participants);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/sidebar/list",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
    query("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("offset must be 0 or greater"),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user!.id;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 50;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string, 10)
        : 0;

      const sidebarItems = await directMessageService.getSidebarConversations(
        currentUserId,
        {
          limit,
          offset,
        }
      );

      res.json(sidebarItems);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
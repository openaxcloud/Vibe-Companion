import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import { getPrisma } from "../services/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorizeTaskAccess } from "../middleware/authorizeTaskAccess";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role?: string;
  };
}

const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: "ValidationError",
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
    return;
  }
  next();
};

router.get(
  "/tasks/:taskId/comments",
  authenticate,
  param("taskId").isString().notEmpty().withMessage("Task ID is required"),
  handleValidationErrors,
  authorizeTaskAccess("taskId"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prisma = getPrisma();
      const { taskId } = req.params;

      const comments = await prisma.comment.findMany({
        where: { taskId },
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      res.json({
        data: comments.map(comment => ({
          id: comment.id,
          taskId: comment.taskId,
          authorId: comment.authorId,
          author: comment.author,
          content: comment.content,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/tasks/:taskId/comments",
  authenticate,
  param("taskId").isString().notEmpty().withMessage("Task ID is required"),
  body("content")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ max: 5000 })
    .withMessage("Content must be at most 5000 characters"),
  handleValidationErrors,
  authorizeTaskAccess("taskId"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prisma = getPrisma();
      const { taskId } = req.params;
      const { content } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true },
      });

      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      const createdComment = await prisma.comment.create({
        data: {
          id: uuidv4(),
          taskId,
          authorId: userId,
          content,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json({
        data: {
          id: createdComment.id,
          taskId: createdComment.taskId,
          authorId: createdComment.authorId,
          author: createdComment.author,
          content: createdComment.content,
          createdAt: createdComment.createdAt,
          updatedAt: createdComment.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/tasks/:taskId/comments/:commentId",
  authenticate,
  param("taskId").isString().notEmpty().withMessage("Task ID is required"),
  param("commentId").isString().notEmpty().withMessage("Comment ID is required"),
  body("content")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ max: 5000 })
    .withMessage("Content must be at most 5000 characters"),
  handleValidationErrors,
  authorizeTaskAccess("taskId"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prisma = getPrisma();
      const { taskId, commentId } = req.params;
      const { content } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const existingComment = await prisma.comment.findFirst({
        where: {
          id: commentId,
          taskId,
        },
        select: {
          id: true,
          authorId: true,
        },
      });

      if (!existingComment) {
        res.status(404).json({ error: "Comment not found" });
        return;
      }

      if (existingComment.authorId !== userId) {
        res.status(403).json({ error: "Forbidden: cannot edit another user's comment" });
        return;
      }

      const updatedComment = await prisma.comment.update({
        where: { id: existingComment.id },
        data: { content },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      res.json({
        data: {
          id: updatedComment.id,
          taskId: updatedComment.taskId,
          authorId: updatedComment.authorId,
          author: updatedComment.author,
          content: updatedComment.content,
          createdAt: updatedComment.createdAt,
          updatedAt: updatedComment.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/tasks/:taskId/comments/:commentId",
  authenticate,
  param("taskId").isString().notEmpty().withMessage("Task ID is required"),
  param("commentId").isString().notEmpty().withMessage("Comment ID is required"),
  handleValidationErrors,
  authorizeTaskAccess("taskId"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prisma = getPrisma();
      const { taskId, commentId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const existingComment = await prisma.comment.findFirst({
        where: {
          id: commentId,
          taskId,
        },
        select: {
          id: true,
          authorId: true,
        },
      });

      if (!existingComment) {
        res.status(404).json({ error: "Comment not found" });
        return;
      }

      if (existingComment.authorId !== userId) {
        res.status(403).json({ error: "Forbidden: cannot delete another user's comment" });
        return;
      }

      await prisma.comment.delete({
        where: { id: existingComment.id },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
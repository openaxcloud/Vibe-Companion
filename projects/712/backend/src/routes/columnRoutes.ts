import express, { Request, Response, NextFunction, Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient, Column } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';
import { authorizeBoardAccess } from '../middleware/authorizeBoardAccess';

const prisma = new PrismaClient();
const router: Router = express.Router();

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
      message: 'Validation failed',
      errors: errors.array(),
    });
    return;
  }
  next();
};

const parseIntegerOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

// POST /api/boards/:boardId/columns
router.post(
  '/boards/:boardId/columns',
  authenticate,
  authorizeBoardAccess('boardId'),
  [
    param('boardId').isString().notEmpty(),
    body('name').isString().trim().isLength({ min: 1, max: 255 }),
    body('wipLimit')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('wipLimit must be a positive integer'),
    body('position')
      .optional({ nullable: true })
      .isInt({ min: 0 })
      .withMessage('position must be a non-negative integer'),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { boardId } = req.params;
    const { name, wipLimit, position } = req.body;

    try {
      const board = await prisma.board.findUnique({
        where: { id: boardId },
      });

      if (!board) {
        res.status(404).json({ message: 'Board not found' });
        return;
      }

      const existingColumnsCount = await prisma.column.count({
        where: { boardId },
      });

      const targetPosition =
        typeof position === 'number' && position >= 0 && position <= existingColumnsCount
          ? position
          : existingColumnsCount;

      await prisma.$transaction(async (tx) => {
        await tx.column.updateMany({
          where: {
            boardId,
            position: {
              gte: targetPosition,
            },
          },
          data: {
            position: {
              increment: 1,
            },
          },
        });

        const newColumn = await tx.column.create({
          data: {
            boardId,
            name: name.trim(),
            wipLimit: parseIntegerOrNull(wipLimit),
            position: targetPosition,
          },
        });

        res.status(201).json(newColumn);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating column:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PATCH /api/columns/:columnId
router.patch(
  '/columns/:columnId',
  authenticate,
  [
    param('columnId').isString().notEmpty(),
    body('name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('name must be between 1 and 255 characters'),
    body('wipLimit')
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null) return true;
        if (typeof value === 'number' && Number.isInteger(value) && value >= 1) return true;
        throw new Error('wipLimit must be a positive integer or null');
      }),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const { columnId } = req.params;
    const { name, wipLimit } = req.body;

    try {
      const column = await prisma.column.findUnique({
        where: { id: columnId },
        include: { board: true },
      });

      if (!column) {
        res.status(404).json({ message: 'Column not found' });
        return;
      }

      (req as any).boardId = column.boardId;
      authorizeBoardAccess('boardId')(req, res, async (authErr?: any) => {
        if (authErr) {
          next(authErr);
          return;
        }

        try {
          const updatedColumn: Column = await prisma.column.update({
            where: { id: columnId },
            data: {
              name: typeof name === 'string' ? name.trim() : undefined,
              wipLimit: wipLimit === undefined ? undefined : parseIntegerOrNull(wipLimit),
            },
          });

          res.status(200).json(updatedColumn);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error updating column:', error);
          res.status(500).json({ message: 'Internal server error' });
        }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching column for update:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PATCH /api/columns/:columnId/wip-limit
router.patch(
  '/columns/:columnId/wip-limit',
  authenticate,
  [
    param('columnId').isString().notEmpty(),
    body('wipLimit')
      .exists()
      .custom((value) => {
        if (value === null) return true;
        if (typeof value === 'number' && Number.isInteger(value) && value >= 1) return true;
        throw new Error('wipLimit must be a positive integer or null');
      }),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const { columnId } = req.params;
    const { wipLimit } = req.body;

    try {
      const column = await prisma.column.findUnique({
        where: { id: columnId },
      });

      if (!column) {
        res.status(404).json({ message: 'Column not found' });
        return;
      }

      (req as any).boardId = column.boardId;
      authorizeBoardAccess('boardId')(req, res, async (authErr?: any) => {
        if (authErr) {
          next(authErr);
          return;
        }

        try {
          const updated = await prisma.column.update({
            where: { id: columnId },
            data: {
              wipLimit: parseIntegerOrNull(wipLimit),
            },
          });

          res.status(200).json(updated);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error updating WIP limit:', error);
          res.status(500).json({ message: 'Internal server error' });
        }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching column for WIP update:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PATCH /api/boards/:boardId/columns/reorder
router.patch(
  '/boards/:boardId/columns/reorder',
  authenticate,
  authorizeBoardAccess('boardId'),
  [
    param('boardId').isString().notEmpty(),
    body('columnOrder')
      .isArray({ min: 1 })
      .withMessage('columnOrder must be a non-empty array of column IDs'),
    body('columnOrder.*').isString().notEmpty().withMessage('Each column ID must be a non-empty string'),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { boardId } = req.params;
    const { columnOrder } = req.body as { columnOrder: string[] };

    try {
      const columns = await prisma.column.findMany({
        where: { boardId },
        select: { id: true },
      });

      const existingIds = new Set(columns.map((c) => c.id));
      const orderIdsSet = new Set(columnOrder);

      if (existingIds.size !== orderIdsSet.size || ![...existingIds].every((id) => orderIdsSet.has(id))) {
        res.status(400).json({
          message: 'columnOrder must contain all and only the column IDs for this board',
        });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await Promise.all(
          columnOrder.map((columnId, index) =>
            tx.column.update({
              where: { id: columnId },
              data: { position: index },
            })
          )
        );
      });

      const updatedColumns = await prisma.column.findMany({
        where: { boardId },
        orderBy: { position: 'asc' },
      });

      res.status(200).json(updated
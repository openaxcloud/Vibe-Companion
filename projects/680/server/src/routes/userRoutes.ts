import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import createHttpError from 'http-errors';
import type { JwtPayload } from 'jsonwebtoken';
import { getUserById, listUsers, updateUserPresence } from '../services/userService';
import { requireAuth } from '../middleware/requireAuth';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles?: string[];
    iat?: number;
    exp?: number;
  } & JwtPayload;
}

const router = Router();

const handleValidationErrors = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const mapped = errors.array().map((err) => ({
      field: err.param,
      message: err.msg,
    }));
    next(createHttpError(400, { message: 'Validation error', errors: mapped }));
    return;
  }
  next();
};

const ensureSameUserOrAdmin = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const requestedId = req.params.id;
  const authUser = req.user;

  if (!authUser) {
    next(createHttpError(401, 'Unauthorized'));
    return;
  }

  const isSelf = authUser.id === requestedId;
  const isAdmin = Array.isArray(authUser.roles) && authUser.roles.includes('admin');

  if (!isSelf && !isAdmin) {
    next(createHttpError(403, 'Forbidden'));
    return;
  }

  next();
};

router.use(requireAuth);

/**
 * GET /api/users
 * List users (basic presence/profile info)
 */
router.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw createHttpError(401, 'Unauthorized');
      }

      const users = await listUsers({
        requestingUserId: authUser.id,
      });

      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/:id
 * Fetch user by id
 */
router.get(
  '/:id',
  param('id').isString().trim().notEmpty().withMessage('User id is required'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await getUserById(id);
      if (!user) {
        throw createHttpError(404, 'User not found');
      }

      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/users/:id/presence
 * Update presence-related profile fields
 */
router.patch(
  '/:id/presence',
  param('id').isString().trim().notEmpty().withMessage('User id is required'),
  body('displayName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('Display name must be between 1 and 80 characters'),
  body('statusMessage')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 0, max: 160 })
    .withMessage('Status message must be at most 160 characters'),
  body('status')
    .optional()
    .isString()
    .trim()
    .isIn(['online', 'away', 'busy', 'offline'])
    .withMessage('Invalid status'),
  handleValidationErrors,
  ensureSameUserOrAdmin,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { displayName, statusMessage, status } = req.body;

      if (
        typeof displayName === 'undefined' &&
        typeof statusMessage === 'undefined' &&
        typeof status === 'undefined'
      ) {
        throw createHttpError(400, 'No updatable fields provided');
      }

      const updatedUser = await updateUserPresence(id, {
        displayName,
        statusMessage,
        status,
      });

      if (!updatedUser) {
        throw createHttpError(404, 'User not found');
      }

      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
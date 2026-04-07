import express, { Request, Response, NextFunction, Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Types } from "mongoose";
import { getUserById, updateUserProfile, searchUsers, setUserPresence } from "../services/userService";
import { authenticate } from "../middleware/authenticate";
import { rateLimiter } from "../middleware/rateLimiter";

const router: Router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

type PresenceStatus = "online" | "offline" | "away" | "busy";

const validateRequest =
  (validations: any[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: "ValidationError",
        details: errors.array().map((e) => ({
          field: e.param,
          message: e.msg,
        })),
      });
      return;
    }
    next();
  };

const handleAsync =
  (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };

router.get(
  "/me",
  authenticate,
  handleAsync(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ error: "UserNotFound" });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      presence: user.presence,
      bio: user.bio,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  })
);

router.get(
  "/:id",
  authenticate,
  validateRequest([
    param("id")
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage("Invalid user id"),
  ]),
  handleAsync(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const user = await getUserById(id);
    if (!user) {
      res.status(404).json({ error: "UserNotFound" });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      presence: user.presence,
      bio: user.bio,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  })
);

router.patch(
  "/me",
  authenticate,
  rateLimiter({ windowMs: 60 * 1000, max: 20 }),
  validateRequest([
    body("displayName")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Display name must be between 2 and 50 characters"),
    body("avatarUrl").optional().isString().trim().isURL().withMessage("Invalid avatar URL"),
    body("bio")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 280 })
      .withMessage("Bio must not exceed 280 characters"),
  ]),
  handleAsync(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { displayName, avatarUrl, bio } = req.body;

    const updated = await updateUserProfile(req.user.id, {
      displayName,
      avatarUrl,
      bio,
    });

    res.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      presence: updated.presence,
      bio: updated.bio,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  })
);

router.patch(
  "/me/presence",
  authenticate,
  rateLimiter({ windowMs: 30 * 1000, max: 60 }),
  validateRequest([
    body("status")
      .exists()
      .withMessage("Presence status is required")
      .isString()
      .isIn(["online", "offline", "away", "busy"])
      .withMessage("Invalid presence status"),
  ]),
  handleAsync(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const status = req.body.status as PresenceStatus;

    const updated = await setUserPresence(req.user.id, status);

    res.json({
      id: updated.id,
      presence: updated.presence,
      updatedAt: updated.updatedAt,
    });
  })
);

router.get(
  "/",
  authenticate,
  validateRequest([
    query("q").optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage("Query must be between 1 and 100 characters"),
    query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
    query("offset").optional().isInt({ min: 0, max: 1000 }).toInt(),
  ]),
  handleAsync(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const q = (req.query.q as string) || "";
    const limit = (req.query.limit as unknown as number) || 20;
    const offset = (req.query.offset as unknown as number) || 0;

    const results = await searchUsers({
      query: q,
      limit,
      offset,
      excludeUserId: req.user?.id,
    });

    res.json({
      results: results.items.map((user) => ({
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        presence: user.presence,
        bio: user.bio,
      })),
      total: results.total,
      limit,
      offset,
    });
  })
);

export default router;
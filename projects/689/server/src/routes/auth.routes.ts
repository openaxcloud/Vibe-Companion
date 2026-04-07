import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { AuthService } from "../services/auth.service";
import { AuthenticatedRequest } from "../types/auth.types";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
const authService = new AuthService();

const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: "ValidationError",
      details: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
      })),
    });
    return;
  }
  next();
};

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isString()
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("name").optional().isString().isLength({ min: 1 }).withMessage("Name must be a non-empty string"),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, name } = req.body;

      const { user, token } = await authService.register({
        email,
        password,
        name,
      });

      res.status(201).json({
        user,
        token,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isString().withMessage("Password is required"),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;

      const { user, token } = await authService.login({
        email,
        password,
      });

      res.status(200).json({
        user,
        token,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/logout",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.token;
      if (token) {
        await authService.logout(token);
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/me",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      res.status(200).json({
        user: req.user,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
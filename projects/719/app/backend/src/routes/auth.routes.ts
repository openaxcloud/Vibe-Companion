import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

type RegisterBody = z.infer<typeof registerSchema>;
type LoginBody = z.infer<typeof loginSchema>;

const validate =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'ValidationError',
        details: result.error.flatten(),
      });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).validatedBody = result.data;
    next();
  };

router.post(
  '/register',
  validate(registerSchema),
  (req: Request, res: Response, next: NextFunction) => {
    const body = (req as unknown as { validatedBody: RegisterBody }).validatedBody;
    authController
      .register(body, req, res)
      .catch((err: unknown) => next(err));
  }
);

router.post(
  '/login',
  validate(loginSchema),
  (req: Request, res: Response, next: NextFunction) => {
    const body = (req as unknown as { validatedBody: LoginBody }).validatedBody;
    authController
      .login(body, req, res)
      .catch((err: unknown) => next(err));
  }
);

router.post(
  '/logout',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    authController
      .logout(req, res)
      .catch((err: unknown) => next(err));
  }
);

router.get(
  '/me',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    authController
      .me(req, res)
      .catch((err: unknown) => next(err));
  }
);

export default router;
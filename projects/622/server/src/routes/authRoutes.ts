import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { authenticate } from '../middleware/authenticate';
import { User } from '../types/user';

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type RegisterBody = z.infer<typeof registerSchema>;
type LoginBody = z.infer<typeof loginSchema>;

const sanitizeUser = (user: User) => {
  const { passwordHash, ...safeUser } = user as any;
  return safeUser;
};

const setAuthCookies = (res: Response, tokens: { accessToken: string; refreshToken: string }) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('accessToken', tokens.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/auth/refresh' });
};

router.post(
  '/register',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedBody: RegisterBody = registerSchema.parse(req.body);

      const { user, tokens } = await authService.register(parsedBody);

      setAuthCookies(res, tokens);

      res.status(201).json({
        user: sanitizeUser(user),
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: 'ValidationError',
          details: err.errors,
        });
        return;
      }
      next(err);
    }
  }
);

router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedBody: LoginBody = loginSchema.parse(req.body);

      const { user, tokens } = await authService.login(parsedBody.email, parsedBody.password);

      setAuthCookies(res, tokens);

      res.status(200).json({
        user: sanitizeUser(user),
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: 'ValidationError',
          details: err.errors,
        });
        return;
      }
      next(err);
    }
  }
);

router.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      clearAuthCookies(res);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as User | undefined;

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      res.status(200).json({
        user: sanitizeUser(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
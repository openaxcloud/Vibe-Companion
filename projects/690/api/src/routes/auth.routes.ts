import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = Router();

// Placeholder rate limiters – replace with real implementation in production
const createRateLimiter = (): RateLimitRequestHandler => {
  return ((req: Request, res: Response, next: NextFunction) => {
    // TODO: plug in express-rate-limit or custom rate limiter here
    next();
  }) as unknown as RateLimitRequestHandler;
};

const authRateLimiter = createRateLimiter();

// Types
interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

// In-memory user store placeholder – replace with real DB in production
const users: User[] = [];

// Config – in real app, use environment variables / config module
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change_me_access_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change_me_refresh_secret';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const PASSWORD_SALT_ROUNDS = parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10);

// Utility functions
const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const signAccessToken = (user: User): string => {
  const payload: Partial<JwtPayload> = {
    sub: user.id,
    email: user.email,
  };
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
};

const signRefreshToken = (user: User): string => {
  const payload: Partial<JwtPayload> = {
    sub: user.id,
    email: user.email,
  };
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
};

const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;
};

const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
};

// Auth middleware
const authenticate =
  (optional = false) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      if (optional) {
        return next();
      }
      res.status(401).json({ error: 'Authorization header missing' });
      return;
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      res.status(401).json({ error: 'Invalid authorization header format' });
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      const user = users.find((u) => u.id === payload.sub);
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }
      (req as any).user = { id: user.id, email: user.email };
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

// Validation chains
const registerValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isString().withMessage('Password is required'),
];

const refreshValidation = [
  body('refreshToken').isString().withMessage('Refresh token is required'),
];

// Shared validation error handler
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  res.status(400).json({
    error: 'Validation failed',
    details: errors.array().map((e) => ({
      field: e.param,
      message: e.msg,
    })),
  });
};

// Routes

// POST /register
router.post(
  '/register',
  authRateLimiter,
  registerValidation,
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email: string; password: string };

    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user: User = {
      id: generateId(),
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date(),
    };

    users.push(user);

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  }
);

// POST /login
router.post(
  '/login',
  authRateLimiter,
  loginValidation,
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email: string; password: string };

    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  }
);

// GET /me
router.get(
  '/me',
  authRateLimiter,
  authenticate(false),
  (req: Request, res: Response): void => {
    const authUser = (req as any).user as { id: string; email: string } | undefined;
    if (!authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = users.find((u) => u.id === authUser.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
    });
  }
);

// POST /refresh (optional)
router.post(
  '/refresh',
  authRateLimiter,
  refreshValidation,
  handleValidationErrors,
  (req: Request, res: Response): void => {
    const { refreshToken } = req.body as { refreshToken: string };

    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = users.find((u) => u.id === payload.sub);
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      const newAccessToken = signAccessToken(user);
      const newRefreshToken = signRefreshToken(user);

      res.status(200).json({
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  }
);

// POST /logout (optional, stateless placeholder)
router.post(
  '/logout',
  authRateLimiter,
  authenticate(true),
  (req: Request, res: Response): void => {
    // For stateless JWT, logout is typically handled client-side
    // To support server-side invalidation, implement token blacklist / revocation here
    res.status(200).json({ success: true });
  }
);

export default router;
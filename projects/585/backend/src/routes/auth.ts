import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';

const authRouter = Router();

// In a real-world app these would be environment variables
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change_this_access_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change_this_refresh_secret';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const SALT_ROUNDS = parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10);

// Simple in-memory storage for demonstration purposes.
// Replace with persistent storage (database) in production.
type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

type RefreshTokenRecord = {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  revoked: boolean;
};

const users: UserRecord[] = [];
const refreshTokens: RefreshTokenRecord[] = [];

// Utility functions
const generateId = (): string => {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
};

const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

const comparePassword = (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

type JwtUserPayload = {
  sub: string;
  email: string;
};

const signAccessToken = (user: UserRecord): string => {
  const payload: JwtUserPayload = {
    sub: user.id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
};

const signRefreshToken = (user: UserRecord): string => {
  const payload: JwtUserPayload = {
    sub: user.id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
};

const verifyAccessToken = (token: string): JwtPayload & JwtUserPayload => {
  return jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload & JwtUserPayload;
};

const verifyRefreshToken = (token: string): JwtPayload & JwtUserPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload & JwtUserPayload;
};

const createRefreshTokenRecord = (token: string, userId: string): RefreshTokenRecord => {
  const decoded = jwt.decode(token) as JwtPayload | null;
  const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date();

  const record: RefreshTokenRecord = {
    token,
    userId,
    createdAt: new Date(),
    expiresAt,
    revoked: false,
  };

  refreshTokens.push(record);
  return record;
};

const revokeRefreshToken = (token: string): void => {
  const record = refreshTokens.find((t) => t.token === token);
  if (record) {
    record.revoked = true;
  }
};

const isRefreshTokenValid = (token: string): boolean => {
  const record = refreshTokens.find((t) => t.token === token);
  if (!record) return false;
  if (record.revoked) return false;
  if (record.expiresAt.getTime() < Date.now()) return false;
  return true;
};

// Middleware for validating requests
const validateRequest =
  (validations: ReturnType<typeof body>[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    for (const validation of validations) {
      // eslint-disable-next-line no-await-in-loop
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'ValidationError',
        details: errors.array(),
      });
      return;
    }
    next();
  };

// Routes

// POST /auth/register
authRouter.post(
  '/register',
  validateRequest([
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
  ]),
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email: string; password: string };

    const existingUser = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      res.status(409).json({ error: 'UserAlreadyExists' });
      return;
    }

    try {
      const passwordHash = await hashPassword(password);
      const newUser: UserRecord = {
        id: generateId(),
        email: email.toLowerCase(),
        passwordHash,
        createdAt: new Date(),
      };

      users.push(newUser);

      const accessToken = signAccessToken(newUser);
      const refreshToken = signRefreshToken(newUser);
      createRefreshTokenRecord(refreshToken, newUser.id);

      res.status(201).json({
        user: {
          id: newUser.id,
          email: newUser.email,
          createdAt: newUser.createdAt,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      });
    } catch {
      res.status(500).json({ error: 'RegistrationFailed' });
    }
  }
);

// POST /auth/login
authRouter.post(
  '/login',
  validateRequest([
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email: string; password: string };

    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      res.status(401).json({ error: 'InvalidCredentials' });
      return;
    }

    try {
      const isMatch = await comparePassword(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ error: 'InvalidCredentials' });
        return;
      }

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      createRefreshTokenRecord(refreshToken, user.id);

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      });
    } catch {
      res.status(500).json({ error: 'LoginFailed' });
    }
  }
);

// POST /auth/logout
authRouter.post(
  '/logout',
  validateRequest([
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ]),
  (req: Request, res: Response): void => {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      res.status(400).json({ error: 'RefreshTokenRequired' });
      return;
    }

    revokeRefreshToken(refreshToken);

    res.status(200).json({ message: 'LoggedOut' });
  }
);

// POST /auth/refresh
authRouter.post(
  '/refresh',
  validateRequest([
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ]),
  (req: Request, res: Response): void => {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      res.status(400).json({ error: 'RefreshTokenRequired' });
      return;
    }

    if (!isRefreshTokenValid(refreshToken)) {
      res.status(401).json({ error: 'InvalidOrExpiredRefreshToken' });
      return;
    }

    let decoded: JwtPayload & JwtUserPayload;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ error: 'InvalidOrExpiredRefreshToken' });
      return;
    }

    const user = users.find((u) => u.id === decoded.sub);
    if (!user) {
      res.status(401).json({ error: 'UserNotFound' });
      return;
    }

    // Rotate refresh tokens: revoke old one and issue a new one
    revokeRefreshToken(refreshToken);

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    createRefreshTokenRecord(newRefreshToken, user.id);

    res.status(200).json({
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  }
);

// Optional: authenticated route example using access token
authRouter.get('/me', (req: Request, res: Response): void => {
  const authHeader = req
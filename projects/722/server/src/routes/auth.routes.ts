import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtPayload as DefaultJwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';

const router = Router();

interface JwtPayload extends DefaultJwtPayload {
  userId: string;
}

interface User {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthenticatedRequest extends Request {
  user?: UserJwtData;
}

interface UserJwtData {
  id: string;
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

const users: User[] = [];

function generateUserId(): string {
  return `u_undefinedundefined`;
}

function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

function toUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function signToken(user: User): string {
  const payload: UserJwtData = {
    id: user.id,
    email: user.email,
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
  });
}

function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: () => void
): void {
  const token =
    (req.cookies && req.cookies[COOKIE_NAME]) ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : undefined);

  if (!token) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & UserJwtData;
    if (!decoded || !decoded.id || !decoded.email) {
      res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ error: 'Invalid authentication token' });
      return;
    }

    const user = findUserById(decoded.id);
    if (!user) {
      res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ error: 'User not found or no longer exists' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
    };
    next();
  } catch {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: 'Invalid or expired authentication token' });
  }
}

router.post(
  '/signup',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, name } = req.body ?? {};

      if (!email || typeof email !== 'string') {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: 'Email is required' });
        return;
      }
      if (!password || typeof password !== 'string') {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: 'Password is required' });
        return;
      }
      if (password.length < 8) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Password must be at least 8 characters long',
        });
        return;
      }

      const existingUser = findUserByEmail(email);
      if (existingUser) {
        res
          .status(StatusCodes.CONFLICT)
          .json({ error: 'A user with this email already exists' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const now = new Date();
      const user: User = {
        id: generateUserId(),
        email: email.toLowerCase(),
        passwordHash,
        name:
          typeof name === 'string' && name.trim().length > 0
            ? name.trim()
            : undefined,
        createdAt: now,
        updatedAt: now,
      };

      users.push(user);

      const token = signToken(user);
      setAuthCookie(res, token);

      res.status(StatusCodes.CREATED).json({
        user: toUserResponse(user),
      });
    } catch {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: 'Failed to create user' });
    }
  }
);

router.post(
  '/login',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body ?? {};

      if (!email || typeof email !== 'string') {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: 'Email is required' });
        return;
      }
      if (!password || typeof password !== 'string') {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: 'Password is required' });
        return;
      }

      const user = findUserByEmail(email);
      if (!user) {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ error: 'Invalid email or password' });
        return;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ error: 'Invalid email or password' });
        return;
      }

      const token = signToken(user);
      setAuthCookie(res, token);

      res.status(StatusCodes.OK).json({
        user: toUserResponse(user),
      });
    } catch {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: 'Failed to login' });
    }
  }
);

router.get(
  '/me',
  (req: AuthenticatedRequest, res: Response): void => {
    authMiddleware(req, res, () => {
      if (!req.user) {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ error: 'Authentication required' });
        return;
      }

      const user = findUserById(req.user.id);
      if (!user) {
        res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ error: 'User not found' });
        return;
      }

      res.status(StatusCodes.OK).json({
        user: toUserResponse(user),
      });
    });
  }
);

router.post(
  '/logout',
  (req: Request, res: Response): void => {
    clearAuthCookie(res);
    res.status(StatusCodes.OK).json({ message: 'Logged out successfully' });
  }
);

export default router;
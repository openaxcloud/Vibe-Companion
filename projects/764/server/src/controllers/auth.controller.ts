import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { createSessionToken, verifySessionToken } from '../utils/jwt';
import { getEnv } from '../utils/env';

interface AuthRequestBody {
  name?: string;
  email?: string;
  password?: string;
}

interface TypedRequest<TBody = unknown> extends Request {
  body: TBody;
}

const SESSION_COOKIE_NAME = 'session';
const SESSION_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const isProduction = getEnv('NODE_ENV', 'development') === 'production';

const sanitizeUser = (user: { id: string; name: string | null; email: string; createdAt: Date; updatedAt: Date }) => {
  const { id, name, email, createdAt, updatedAt } = user;
  return { id, name, email, createdAt, updatedAt };
};

const setSessionCookie = (res: Response, token: string) => {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
    path: '/',
  });
};

const clearSessionCookie = (res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
};

export const register = async (
  req: TypedRequest<AuthRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      res.status(409).json({ message: 'Email is already in use.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name?.trim() || null,
        email: normalizedEmail,
        passwordHash,
      },
    });

    const token = createSessionToken({ userId: user.id });

    setSessionCookie(res, token);

    res.status(201).json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: TypedRequest<AuthRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const token = createSessionToken({ userId: user.id });

    setSessionCookie(res, token);

    res.status(200).json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    clearSessionCookie(res);
    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];

    if (!token) {
      res.status(401).json({ message: 'Not authenticated.' });
      return;
    }

    const payload = verifySessionToken(token);

    if (!payload || typeof payload !== 'object' || !('userId' in payload)) {
      res.status(401).json({ message: 'Invalid session.' });
      return;
    }

    const userId = (payload as { userId: string }).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      clearSessionCookie(res);
      res.status(401).json({ message: 'User not found.' });
      return;
    }

    res.status(200).json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    clearSessionCookie(res);
    next(error);
  }
};
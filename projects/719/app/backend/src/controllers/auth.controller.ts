import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { User } from '../models/user.model';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'token';
const JWT_COOKIE_SECURE = process.env.JWT_COOKIE_SECURE === 'true';
const JWT_COOKIE_SAME_SITE = (process.env.JWT_COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax';

if (!JWT_SECRET) {
  // Fail fast on misconfiguration
  // eslint-disable-next-line no-console
  console.error('FATAL: JWT_SECRET is not configured');
  throw new Error('JWT_SECRET is not configured');
}

const signToken = (userId: string, email: string): string => {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: userId,
    email,
  };

  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
  };

  return jwt.sign(payload, JWT_SECRET, options);
};

const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: JWT_COOKIE_SECURE,
    sameSite: JWT_COOKIE_SAME_SITE,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  });
};

const clearAuthCookie = (res: Response): void => {
  res.clearCookie(JWT_COOKIE_NAME, {
    httpOnly: true,
    secure: JWT_COOKIE_SECURE,
    sameSite: JWT_COOKIE_SAME_SITE,
    path: '/',
  });
};

const sanitizeUser = (user: any) => {
  if (!user) return null;
  const { password, __v, ...rest } = user.toObject ? user.toObject() : user;
  return rest;
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Email and password are required',
      });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (existingUser) {
      res.status(StatusCodes.CONFLICT).json({
        message: 'Email is already in use',
      });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name: name?.trim() || null,
    });

    const token = signToken(user.id, user.email);
    setAuthCookie(res, token);

    res.status(StatusCodes.CREATED).json({
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Email and password are required',
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'Invalid email or password',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'Invalid email or password',
      });
      return;
    }

    const token = signToken(user.id, user.email);
    setAuthCookie(res, token);

    res.status(StatusCodes.OK).json({
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (req: Request, res: Response): void => {
  clearAuthCookie(res);
  res.status(StatusCodes.OK).json({ message: 'Logged out successfully' });
};

export const me = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'Not authenticated',
      });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      clearAuthCookie(res);
      res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'User not found',
      });
      return;
    }

    res.status(StatusCodes.OK).json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.id || !req.user.email) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'Not authenticated',
      });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      clearAuthCookie(res);
      res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'User not found',
      });
      return;
    }

    const token = signToken(user.id, user.email);
    setAuthCookie(res, token);

    res.status(StatusCodes.OK).json({
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  logout,
  me,
  refreshToken,
};
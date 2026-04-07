import jwt, { JwtPayload, SignOptions, VerifyErrors } from 'jsonwebtoken';
import { Response } from 'express';

export interface JwtUserPayload {
  id: string;
  email: string;
  role?: string;
  [key: string]: unknown;
}

export interface DecodedToken extends JwtPayload {
  user: JwtUserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'auth_token';
const JWT_COOKIE_SECURE = process.env.JWT_COOKIE_SECURE === 'true';
const JWT_COOKIE_SAME_SITE: boolean | 'lax' | 'strict' | 'none' =
  (process.env.JWT_COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax';
const JWT_COOKIE_DOMAIN = process.env.JWT_COOKIE_DOMAIN || undefined;
const JWT_COOKIE_PATH = process.env.JWT_COOKIE_PATH || '/';

if (!JWT_SECRET) {
  // Fail fast if secret is not configured
  // In production, this should be provided via environment variables
  throw new Error('JWT_SECRET environment variable is required');
}

export const signToken = (
  user: JwtUserPayload,
  options: SignOptions = {}
): string => {
  const signOptions: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
    ...options,
  };

  return jwt.sign({ user }, JWT_SECRET, signOptions);
};

export const verifyToken = (token: string): DecodedToken | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    return decoded;
  } catch (error) {
    const err = error as VerifyErrors;
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('Failed to verify JWT:', err.message);
    }
    return null;
  }
};

export const setAuthCookie = (
  res: Response,
  token: string,
  options?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: boolean | 'lax' | 'strict' | 'none';
    domain?: string;
    path?: string;
    maxAgeMs?: number;
  }
): void => {
  const isProd = process.env.NODE_ENV === 'production';

  const {
    httpOnly = true,
    secure = JWT_COOKIE_SECURE || isProd,
    sameSite = JWT_COOKIE_SAME_SITE,
    domain = JWT_COOKIE_DOMAIN,
    path = JWT_COOKIE_PATH,
    maxAgeMs,
  } = options || {};

  const cookieOptions: Parameters<Response['cookie']>[2] = {
    httpOnly,
    secure,
    sameSite,
    domain,
    path,
  };

  if (maxAgeMs !== undefined) {
    cookieOptions.maxAge = maxAgeMs;
  }

  res.cookie(JWT_COOKIE_NAME, token, cookieOptions);
};

export const clearAuthCookie = (res: Response): void => {
  const isProd = process.env.NODE_ENV === 'production';

  res.clearCookie(JWT_COOKIE_NAME, {
    httpOnly: true,
    secure: JWT_COOKIE_SECURE || isProd,
    sameSite: JWT_COOKIE_SAME_SITE,
    domain: JWT_COOKIE_DOMAIN,
    path: JWT_COOKIE_PATH,
  });
};

export const createAndSetAuthToken = (
  res: Response,
  user: JwtUserPayload,
  options?: {
    signOptions?: SignOptions;
    cookieOptions?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: boolean | 'lax' | 'strict' | 'none';
      domain?: string;
      path?: string;
      maxAgeMs?: number;
    };
  }
): string => {
  const token = signToken(user, options?.signOptions);
  setAuthCookie(res, token, options?.cookieOptions);
  return token;
};

export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return null;
  return token;
};
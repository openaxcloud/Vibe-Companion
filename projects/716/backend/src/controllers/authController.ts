import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AuthService } from '../services/authService';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/ApiError';
import { registerSchema, loginSchema } from '../validation/authSchemas';

const authService = new AuthService();

const ACCESS_TOKEN_COOKIE = 'accessToken';
const REFRESH_TOKEN_COOKIE = 'refreshToken';

const isProduction = process.env.NODE_ENV === 'production';
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
const accessTokenMaxAgeMs = Number(process.env.ACCESS_TOKEN_MAX_AGE_MS || 15 * 60 * 1000); // 15 min
const refreshTokenMaxAgeMs = Number(process.env.REFRESH_TOKEN_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000); // 7 days

const buildCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' as const : 'lax' as const,
  maxAge,
  domain: cookieDomain,
  path: '/',
});

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, buildCookieOptions(accessTokenMaxAgeMs));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, buildCookieOptions(refreshTokenMaxAgeMs));
};

const clearAuthCookies = (res: Response): void => {
  const opts = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' as const : 'lax' as const,
    domain: cookieDomain,
    path: '/',
  };
  res.clearCookie(ACCESS_TOKEN_COOKIE, opts);
  res.clearCookie(REFRESH_TOKEN_COOKIE, opts);
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = registerSchema.parse(req.body);

    const { user, accessToken, refreshToken } = await authService.registerUser(parsed);

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const message = 'Validation error';
      logger.warn({ error, body: req.body }, message);
      next(new ApiError(400, message, error.flatten()));
      return;
    }

    logger.error({ error }, 'Error during registration');
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.parse(req.body);

    const { user, accessToken, refreshToken } = await authService.loginUser(parsed);

    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const message = 'Validation error';
      logger.warn({ error, body: req.body }, message);
      next(new ApiError(400, message, error.flatten()));
      return;
    }

    if (error instanceof ApiError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        clearAuthCookies(res);
      }
      next(error);
      return;
    }

    logger.error({ error }, 'Error during login');
    next(error);
  }
};

export const logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    clearAuthCookies(res);
    res.status(204).send();
  } catch (error: unknown) {
    logger.error({ error }, 'Error during logout');
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tokenFromCookie = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    const tokenFromBody = (req.body && typeof req.body.refreshToken === 'string')
      ? req.body.refreshToken
      : undefined;

    const refreshTokenValue = tokenFromCookie || tokenFromBody;

    if (!refreshTokenValue) {
      throw new ApiError(401, 'Refresh token missing');
    }

    const { user, accessToken, refreshToken: newRefreshToken } =
      await authService.refreshTokens(refreshTokenValue);

    setAuthCookies(res, accessToken, newRefreshToken);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error: unknown) {
    if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
      clearAuthCookies(res);
    }

    logger.error({ error }, 'Error during token refresh');
    next(error);
  }
};

export const getCurrentUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).userId as string | undefined;

    if (!userId) {
      throw new ApiError(401, 'Not authenticated');
    }

    const user = await authService.getUserById(userId);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Error fetching current user');
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).userId as string | undefined;

    if (!userId) {
      throw new ApiError(401, 'Not authenticated');
    }

    const { currentPassword, newPassword } = req.body || {};

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      throw new ApiError(400, 'currentPassword and newPassword are required');
    }

    await authService.changePassword({
      userId,
      currentPassword,
      newPassword,
    });

    res.status(204).send();
  } catch (error: unknown) {
    logger.error({ error }, 'Error changing password');
    next(error);
  }
};

export const initiatePasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body || {};

    if (typeof email !== 'string') {
      throw new ApiError(400, 'email is required');
    }

    await authService.initiatePasswordReset(email);

    res.status(204).send();
  } catch (error: unknown) {
    logger.error({ error }, 'Error initiating password reset');
    next(error);
  }
};

export const completePasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, newPassword } = req.body || {};

    if (typeof token !== 'string' || typeof newPassword !== 'string') {
      throw new ApiError(400, 'token and newPassword are required');
    }

    await authService.completePasswordReset({
      token,
      newPassword,
    });

    res.status(204).send();
  } catch (error: unknown) {
    logger.error({ error }, 'Error completing password reset');
    next(error);
  }
};

export default {
  register,
  login,
  logout,
  refreshToken,
  getCurrentUser,
  changePassword,
  initiatePasswordReset,
  completePasswordReset,
};
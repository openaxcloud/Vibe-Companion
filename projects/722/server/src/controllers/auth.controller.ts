import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AuthService } from "../services/auth.service";

const authService = new AuthService();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const refreshTokenSchema = z.object({
  cookies: z.object({
    refreshToken: z.string().min(1),
  }).partial(),
  body: z
    .object({
      refreshToken: z.string().min(1),
    })
    .partial(),
});

const logoutSchema = z.object({
  cookies: z.object({
    refreshToken: z.string().optional(),
  }).partial(),
});

const tokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
});

type RegisterRequest = z.infer<typeof registerSchema>["body"];
type LoginRequest = z.infer<typeof loginSchema>["body"];

const sanitizeUser = (user: any) => {
  if (!user) return null;
  const { password, hashedPassword, refreshToken, ...rest } = user;
  return rest;
};

const setAuthCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken?: string },
) => {
  const isProd = process.env.NODE_ENV === "production";

  if (tokens.refreshToken) {
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      path: "/api/auth/refresh-token",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
  }

  res.cookie("accessToken", tokens.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/",
    maxAge: 1000 * 60 * 15,
  });
};

const clearAuthCookies = (res: Response) => {
  const isProd = process.env.NODE_ENV === "production";

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/api/auth/refresh-token",
  });
};

const shouldUseCookies = () => {
  const mode = process.env.AUTH_TOKEN_TRANSPORT?.toLowerCase();
  return mode === "cookie" || !mode;
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = registerSchema.parse({
      body: req.body,
    });

    const payload: RegisterRequest = parsed.body;

    const { user, tokens } = await authService.register(payload);

    const tokenPayload = tokenResponseSchema.parse(tokens);

    if (shouldUseCookies()) {
      setAuthCookies(res, tokenPayload);
      res.status(201).json({
        user: sanitizeUser(user),
      });
    } else {
      res.status(201).json({
        user: sanitizeUser(user),
        tokens: tokenPayload,
      });
    }
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = loginSchema.parse({
      body: req.body,
    });

    const payload: LoginRequest = parsed.body;

    const { user, tokens } = await authService.login(payload);

    const tokenPayload = tokenResponseSchema.parse(tokens);

    if (shouldUseCookies()) {
      setAuthCookies(res, tokenPayload);
      res.status(200).json({
        user: sanitizeUser(user),
      });
    } else {
      res.status(200).json({
        user: sanitizeUser(user),
        tokens: tokenPayload,
      });
    }
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = refreshTokenSchema.parse({
      cookies: req.cookies,
      body: req.body,
    });

    const tokenFromCookie = parsed.cookies?.refreshToken;
    const tokenFromBody = parsed.body?.refreshToken;

    const refreshTokenValue = tokenFromCookie || tokenFromBody;

    if (!refreshTokenValue) {
      res.status(401).json({ message: "Refresh token missing" });
      return;
    }

    const tokens = await authService.refreshToken(refreshTokenValue);

    const tokenPayload = tokenResponseSchema.parse(tokens);

    if (shouldUseCookies()) {
      setAuthCookies(res, tokenPayload);
      res.status(200).json({
        success: true,
      });
    } else {
      res.status(200).json({
        tokens: tokenPayload,
      });
    }
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = logoutSchema.parse({
      cookies: req.cookies,
    });

    const refreshTokenValue = parsed.cookies?.refreshToken;

    if (refreshTokenValue) {
      await authService.logout(refreshTokenValue);
    }

    if (shouldUseCookies()) {
      clearAuthCookies(res);
    }

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
  req: Request & { user?: any },
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const user = await authService.getCurrentUser(req.user.id);

    res.status(200).json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};
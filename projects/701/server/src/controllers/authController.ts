import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authService } from "../services/authService";
import { AppError } from "../utils/AppError";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const COOKIE_NAME = "auth_token";
const COOKIE_OPTIONS: Parameters<Response["cookie"]>[2] = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

type SignupBody = z.infer<typeof signupSchema>;
type LoginBody = z.infer<typeof loginSchema>;

export const signup = async (
  req: Request<unknown, unknown, SignupBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        "Validation failed",
        400,
        "VALIDATION_ERROR",
        parsed.error.flatten()
      );
    }

    const { email, password, name } = parsed.data;

    const { user, token } = await authService.signup({ email, password, name });

    res
      .status(201)
      .cookie(COOKIE_NAME, token, COOKIE_OPTIONS)
      .json({
        success: true,
        data: {
          user,
        },
      });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request<unknown, unknown, LoginBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        "Validation failed",
        400,
        "VALIDATION_ERROR",
        parsed.error.flatten()
      );
    }

    const { email, password } = parsed.data;

    const { user, token } = await authService.login({ email, password });

    res
      .status(200)
      .cookie(COOKIE_NAME, token, COOKIE_OPTIONS)
      .json({
        success: true,
        data: {
          user,
        },
      });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res
      .clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        path: "/",
      })
      .status(200)
      .json({
        success: true,
        message: "Logged out successfully",
      });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).userId as string | undefined;

    if (!userId) {
      throw new AppError("Not authenticated", 401, "UNAUTHORIZED");
    }

    const user = await authService.getCurrentUser(userId);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const authController = {
  signup,
  login,
  logout,
  getCurrentUser,
};

export default authController;
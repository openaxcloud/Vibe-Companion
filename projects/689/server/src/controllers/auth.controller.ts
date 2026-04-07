import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import {
  AuthService,
  LoginPayload,
  RegisterPayload,
  RefreshTokenPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  VerifyEmailPayload,
  ResendVerificationEmailPayload,
  ChangePasswordPayload,
  UpdateProfilePayload,
} from "../services/auth.service";
import { ApiResponse } from "../types/api-response";
import { HttpStatus } from "../utils/http-status";
import { AuthenticatedRequest } from "../types/authenticated-request";
import { logger } from "../utils/logger";
import { COOKIE_NAMES, COOKIE_OPTIONS } from "../config/cookies";

const authService = new AuthService();

const sendError = (res: Response, status: number, message: string, errors?: unknown): Response => {
  const payload: ApiResponse<null> = {
    success: false,
    message,
    data: null,
    errors,
  };
  return res.status(status).json(payload);
};

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendError(res, HttpStatus.UNPROCESSABLE_ENTITY, "Validation failed", errors.array());
    return false;
  }
  return true;
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  if (!handleValidation(req, res)) return;

  try {
    const payload: RegisterPayload = {
      email: req.body.email,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
    };

    const result = await authService.register(payload);

    if (result.tokens) {
      res.cookie(COOKIE_NAMES.ACCESS_TOKEN, result.tokens.accessToken, COOKIE_OPTIONS.ACCESS_TOKEN);
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.tokens.refreshToken, COOKIE_OPTIONS.REFRESH_TOKEN);
    }

    const response: ApiResponse<typeof result.user> = {
      success: true,
      message: "Registration successful",
      data: result.user,
    };

    return res.status(HttpStatus.CREATED).json(response);
  } catch (error) {
    logger.error("Error in register controller", { error });
    return next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  if (!handleValidation(req, res)) return;

  try {
    const payload: LoginPayload = {
      email: req.body.email,
      password: req.body.password,
    };

    const result = await authService.login(payload);

    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, result.tokens.accessToken, COOKIE_OPTIONS.ACCESS_TOKEN);
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.tokens.refreshToken, COOKIE_OPTIONS.REFRESH_TOKEN);

    const response: ApiResponse<typeof result.user> = {
      success: true,
      message: "Login successful",
      data: result.user,
    };

    return res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error("Error in login controller", { error });
    return next(error);
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
  try {
    const userId = req.user?.id;

    if (userId) {
      await authService.logout(userId);
    }

    res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, COOKIE_OPTIONS.CLEAR);
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, COOKIE_OPTIONS.CLEAR);

    const response: ApiResponse<null> = {
      success: true,
      message: "Logout successful",
      data: null,
    };

    return res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error("Error in logout controller", { error });
    return next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  try {
    const refreshTokenCookie = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
    const bearerToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : undefined;

    const token = req.body.refreshToken || refreshTokenCookie || bearerToken;

    if (!token) {
      return sendError(res, HttpStatus.UNAUTHORIZED, "Refresh token is required");
    }

    const payload: RefreshTokenPayload = { refreshToken: token };
    const result = await authService.refreshToken(payload);

    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, result.tokens.accessToken, COOKIE_OPTIONS.ACCESS_TOKEN);
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.tokens.refreshToken, COOKIE_OPTIONS.REFRESH_TOKEN);

    const response: ApiResponse<typeof result.user> = {
      success: true,
      message: "Token refreshed successfully",
      data: result.user,
    };

    return res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error("Error in refreshToken controller", { error });
    return next(error);
  }
};

export const me = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
  try {
    if (!req.user) {
      return sendError(res, HttpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const user = await authService.getCurrentUser(req.user.id);

    const response: ApiResponse<typeof user> = {
      success: true,
      message: "Current user fetched successfully",
      data: user,
    };

    return res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error("Error in me controller", { error });
    return next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  if (!handleValidation(req, res)) return;

  try {
    const payload: ForgotPasswordPayload = {
      email: req.body.email,
    };

    await authService.forgotPassword(payload);

    const response: ApiResponse<null> = {
      success: true,
      message: "Password reset email sent if the email exists",
      data: null,
    };

    return res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error("Error in forgotPassword controller", { error });
    return next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  if (!handleValidation(req, res)) return;

  try {
    const payload: ResetPasswordPayload = {
      token: req.body.token || req.query.token || req.params.token,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
    };

    await authService.resetPassword(payload);

    const response: ApiResponse<null> = {
      success: true,
      message: "Password has been reset successfully",
      data: null,
    };

    return res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error("Error in resetPassword controller", { error });
    return next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  if (!handleValidation(req, res)) return;

  try {
    const payload: VerifyEmailPayload = {
      token: req.body.token || req.query.token || req.params.token,
    };

    await authService.verifyEmail(payload);

    const response: ApiResponse<null> = {
      success: true,
      message: "Email verified successfully",
      data: null,
    };

    return res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error("Error in verifyEmail controller", { error });
    return next(error);
  }
};

export const resendVerificationEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  if (!handleValidation(req, res)) return;

  try {
    const payload: ResendVerificationEmailPayload = {
      email: req.body.email,
    };

    await authService.resendVerificationEmail(payload);

    const response: ApiResponse<null> = {
      success: true,
      message: "Verification email resent if the email exists and is not verified",
      data: null,
    };

    return res.status(HttpStatus.OK).json(response);
  } catch (error) {
    logger.error("Error in resendVerificationEmail controller", { error });
    return next(error);
  }
};

export const changePassword = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  if (!handleValidation(req, res)) return;

  try {
    if (!req.user) {
      return sendError(res, HttpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const payload: ChangePasswordPayload = {
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      confirmPassword: req.body.confirmPassword,
    };

    await authService.changePassword(payload);

    const response: ApiResponse<null> = {
      success: true,
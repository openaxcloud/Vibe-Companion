import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { Types } from "mongoose";

const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_SUPER_SECRET";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const COOKIE_SAME_SITE = (process.env.COOKIE_SAME_SITE as "lax" | "strict" | "none") || "lax";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

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

const createToken = (userId: string, email: string): string => {
  const payload: JwtPayload = {
    sub: userId,
    email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const setAuthCookie = (res: Response, token: string): void => {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE || isProduction,
    sameSite: COOKIE_SAME_SITE,
    domain: COOKIE_DOMAIN,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookie = (res: Response): void => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE || process.env.NODE_ENV === "production",
    sameSite: COOKIE_SAME_SITE,
    domain: COOKIE_DOMAIN,
  });
};

const sanitizeUser = (user: any) => {
  if (!user) return null;
  const { _id, id, email, name, createdAt, updatedAt } = user.toObject ? user.toObject() : user;
  return {
    id: (id || _id || "").toString(),
    email,
    name,
    createdAt,
    updatedAt,
  };
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (existing) {
      return res.status(409).json({ message: "Email is already in use." });
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name: name?.trim() || "",
    });

    const token = createToken((user._id as Types.ObjectId).toString(), user.email);
    setAuthCookie(res, token);

    return res.status(201).json({
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password as string);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = createToken((user._id as Types.ObjectId).toString(), user.email);
    setAuthCookie(res, token);

    return res.status(200).json({
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
};

export const logout = async (_req: Request, res: Response, _next: NextFunction) => {
  clearAuthCookie(res);
  return res.status(200).json({ message: "Logged out successfully." });
};

export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ message: "User not found." });
    }

    return res.status(200).json({
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
};

export const refreshToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.id || !req.user.email) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    const userExists = await User.exists({ _id: req.user.id });
    if (!userExists) {
      clearAuthCookie(res);
      return res.status(401).json({ message: "User not found." });
    }

    const token = createToken(req.user.id, req.user.email);
    setAuthCookie(res, token);

    return res.status(200).json({ message: "Token refreshed." });
  } catch (err) {
    return next(err);
  }
};

export const authenticateFromCookie = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return next();
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      return next();
    }

    if (!decoded.sub || !decoded.email) {
      return next();
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
    };

    return next();
  } catch (err) {
    return next(err);
  }
};
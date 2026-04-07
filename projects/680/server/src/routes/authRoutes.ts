import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, User } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "auth_token";
const COOKIE_SECURE = process.env.NODE_ENV === "production";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

interface AuthenticatedRequest extends Request {
  user?: User;
}

const createToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SECURE ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookie = (res: Response): void => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SECURE ? "strict" : "lax",
  });
};

const asyncHandler =
  (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ): ((req: Request, res: Response, next: NextFunction) => void) =>
  (req, res, next) =>
    void fn(req, res, next).catch(next);

const authMiddleware = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token =
        req.cookies?.[COOKIE_NAME] ||
        (req.headers.authorization &&
          req.headers.authorization.startsWith("Bearer ") &&
          req.headers.authorization.split(" ")[1]);

      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

      if (!decoded?.userId) {
        return res.status(401).json({ message: "Invalid token" });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
      });

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      req.user = user as User;
      next();
    } catch (error) {
      return res.status(401).json({ message: "Authentication failed" });
    }
  }
);

router.post(
  "/signup",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name?.trim() || null,
      },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });

    const token = createToken(user.id);
    setAuthCookie(res, token);

    res.status(201).json({ user });
  })
);

router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = createToken(user.id);
    setAuthCookie(res, token);

    const { passwordHash, ...safeUser } = user;

    res.json({
      user: {
        id: safeUser.id,
        email: safeUser.email,
        name: safeUser.name,
        createdAt: safeUser.createdAt,
        updatedAt: safeUser.updatedAt,
      },
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (_req: Request, res: Response) => {
    clearAuthCookie(res);
    res.status(200).json({ message: "Logged out successfully" });
  })
);

router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { id, email, name, createdAt, updatedAt } = req.user;

    res.json({
      user: {
        id,
        email,
        name,
        createdAt,
        updatedAt,
      },
    });
  })
);

export default router;
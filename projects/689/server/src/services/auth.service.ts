import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Response } from "express";
import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

export interface RegisterInput {
  email: string;
  password: string;
  name?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtUserPayload {
  userId: string;
}

export class AuthError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";
const COOKIE_REFRESH_TOKEN_NAME = "refreshToken";
const COOKIE_SECURE = process.env.NODE_ENV === "production";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "";

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  // In a real production system you'd likely fail fast at app bootstrap instead of here
  console.warn(
    "JWT secrets are not properly configured. Please set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET."
  );
}

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(password, salt);
}

async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

function signAccessToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

function signRefreshToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

function verifyAccessToken(token: string): JwtPayload & JwtUserPayload {
  return jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload & JwtUserPayload;
}

function verifyRefreshToken(token: string): JwtPayload & JwtUserPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload & JwtUserPayload;
}

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(COOKIE_REFRESH_TOKEN_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(COOKIE_REFRESH_TOKEN_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
  });
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthService {
  public async register(input: RegisterInput): Promise<AuthenticatedUser> {
    const email = input.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AuthError("Email is already in use", 409);
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: input.name ?? null,
      },
    });

    return toAuthenticatedUser(user);
  }

  public async login(
    input: LoginInput,
    res: Response
  ): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const email = input.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new AuthError("Invalid email or password", 401);
    }

    const passwordValid = await verifyPassword(input.password, user.passwordHash);

    if (!passwordValid) {
      throw new AuthError("Invalid email or password", 401);
    }

    const payload: JwtUserPayload = { userId: user.id };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    setRefreshTokenCookie(res, refreshToken);

    return {
      user: toAuthenticatedUser(user),
      tokens: { accessToken },
    };
  }

  public async logout(res: Response): Promise<void> {
    clearRefreshTokenCookie(res);
  }

  public async me(userId: string): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return toAuthenticatedUser(user);
  }

  public async refreshTokenFromCookie(
    req: { cookies?: Record<string, string | undefined> },
    res: Response
  ): Promise<AuthTokens | null> {
    const token = req.cookies?.[COOKIE_REFRESH_TOKEN_NAME];

    if (!token) {
      return null;
    }

    let decoded: JwtPayload & JwtUserPayload;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      clearRefreshTokenCookie(res);
      return null;
    }

    const userId = decoded.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      clearRefreshTokenCookie(res);
      return null;
    }

    const payload: JwtUserPayload = { userId: user.id };
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    setRefreshTokenCookie(res, newRefreshToken);

    return { accessToken: newAccessToken };
  }

  public verifyAccessTokenString(token: string): JwtUserPayload {
    try {
      const decoded = verifyAccessToken(token);
      return { userId: decoded.userId };
    } catch (error) {
      throw new AuthError("Invalid or expired token", 401);
    }
  }
}

export const authService = new AuthService();
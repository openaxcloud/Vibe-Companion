import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import { UserModel, UserDocument } from "../models/user.model";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role?: string;
  type: "access" | "refresh";
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role?: string;
}

export interface AuthServiceOptions {
  accessTokenTtl: string | number;
  refreshTokenTtl: string | number;
  jwtSecret: string;
}

export class AuthError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 400, code = "AUTH_ERROR") {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthService {
  private readonly accessTokenTtl: string | number;
  private readonly refreshTokenTtl: string | number;
  private readonly jwtSecret: string;

  constructor(options: AuthServiceOptions) {
    if (!options.jwtSecret) {
      throw new Error("JWT secret must be provided to AuthService");
    }
    this.accessTokenTtl = options.accessTokenTtl;
    this.refreshTokenTtl = options.refreshTokenTtl;
    this.jwtSecret = options.jwtSecret;
  }

  public async createUser(input: CreateUserInput): Promise<UserDocument> {
    const existing = await UserModel.findOne({ email: input.email.toLowerCase().trim() }).lean();
    if (existing) {
      throw new AuthError("Email is already in use", 409, "EMAIL_TAKEN");
    }

    const hashedPassword = await this.hashPassword(input.password);
    const user = await UserModel.create({
      email: input.email.toLowerCase().trim(),
      password: hashedPassword,
      name: input.name,
      role: input.role,
    });

    return user;
  }

  public async findByEmail(email: string): Promise<UserDocument | null> {
    const normalizedEmail = email.toLowerCase().trim();
    return UserModel.findOne({ email: normalizedEmail }).exec();
  }

  public async verifyPassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    if (!plainPassword || !hashedPassword) return false;
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  public async generateTokens(user: UserDocument): Promise<AuthTokens> {
    const userId = (user._id as Types.ObjectId).toHexString();
    const payloadBase = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(
      { ...payloadBase, type: "access" as const },
      this.jwtSecret,
      { expiresIn: this.accessTokenTtl }
    );

    const refreshToken = jwt.sign(
      { ...payloadBase, type: "refresh" as const },
      this.jwtSecret,
      { expiresIn: this.refreshTokenTtl }
    );

    return { accessToken, refreshToken };
  }

  public verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
      if (!decoded.sub || !decoded.email || !decoded.type) {
        throw new AuthError("Invalid token payload", 401, "INVALID_TOKEN");
      }

      return {
        sub: String(decoded.sub),
        email: String(decoded.email),
        role: decoded.role ? String(decoded.role) : undefined,
        type: decoded.type === "refresh" ? "refresh" : "access",
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError("Token expired", 401, "TOKEN_EXPIRED");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError("Invalid token", 401, "INVALID_TOKEN");
      }
      throw error;
    }
  }

  public async authenticateByEmailAndPassword(
    email: string,
    password: string
  ): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new AuthError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) {
      throw new AuthError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const tokens = await this.generateTokens(user);
    return { user, tokens };
  }

  public async rotateRefreshToken(
    refreshToken: string
  ): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    const payload = this.verifyToken(refreshToken);
    if (payload.type !== "refresh") {
      throw new AuthError("Invalid token type", 401, "INVALID_TOKEN_TYPE");
    }

    const user = await UserModel.findById(payload.sub).exec();
    if (!user) {
      throw new AuthError("User not found", 404, "USER_NOT_FOUND");
    }

    const tokens = await this.generateTokens(user);
    return { user, tokens };
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }
}

export const authService = new AuthService({
  accessTokenTtl: process.env.JWT_ACCESS_TTL || "15m",
  refreshTokenTtl: process.env.JWT_REFRESH_TTL || "7d",
  jwtSecret: process.env.JWT_SECRET || "changeme-in-production",
});
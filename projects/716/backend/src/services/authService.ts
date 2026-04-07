import bcrypt from "bcryptjs";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuthTokenPayload {
  userId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: string | number; // e.g. "15m"
  refreshTokenExpiresIn: string | number; // e.g. "7d"
  saltRounds: number;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string | null;
}

export interface AuthService {
  registerUser(input: CreateUserInput): Promise<User>;
  validateUserCredentials(email: string, password: string): Promise<User | null>;
  generateTokens(user: User): AuthTokens;
  verifyAccessToken(token: string): AuthTokenPayload | null;
  verifyRefreshToken(token: string): AuthTokenPayload | null;
  hashPassword(password: string): Promise<string>;
  comparePassword(password: string, hash: string): Promise<boolean>;
}

export class AuthServiceImpl implements AuthService {
  private readonly config: AuthConfig;

  constructor(config: AuthConfig) {
    if (
      !config.accessTokenSecret ||
      !config.refreshTokenSecret ||
      !config.accessTokenExpiresIn ||
      !config.refreshTokenExpiresIn ||
      !config.saltRounds
    ) {
      throw new Error("Invalid AuthConfig provided to AuthServiceImpl");
    }

    this.config = config;
  }

  public async registerUser(input: CreateUserInput): Promise<User> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new Error("User with this email already exists");
    }

    const passwordHash = await this.hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name ?? null,
      },
    });

    return user;
  }

  public async validateUserCredentials(
    email: string,
    password: string
  ): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await this.comparePassword(password, user.passwordHash);

    if (!isValid) {
      return null;
    }

    return user;
  }

  public generateTokens(user: User): AuthTokens {
    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
    };

    const accessToken = this.signToken(
      payload,
      this.config.accessTokenSecret,
      this.config.accessTokenExpiresIn
    );

    const refreshToken = this.signToken(
      payload,
      this.config.refreshTokenSecret,
      this.config.refreshTokenExpiresIn
    );

    return { accessToken, refreshToken };
  }

  public verifyAccessToken(token: string): AuthTokenPayload | null {
    return this.verifyToken(token, this.config.accessTokenSecret);
  }

  public verifyRefreshToken(token: string): AuthTokenPayload | null {
    return this.verifyToken(token, this.config.refreshTokenSecret);
  }

  public async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.config.saltRounds);
    return bcrypt.hash(password, salt);
  }

  public async comparePassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private signToken(
    payload: AuthTokenPayload,
    secret: string,
    expiresIn: string | number
  ): string {
    const options: SignOptions = { expiresIn };
    return jwt.sign(payload, secret, options);
  }

  private verifyToken(token: string, secret: string): AuthTokenPayload | null {
    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;
      if (
        typeof decoded === "object" &&
        typeof decoded.userId === "string" &&
        typeof decoded.email === "string"
      ) {
        return {
          userId: decoded.userId,
          email: decoded.email,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const createAuthService = (): AuthService => {
  const accessTokenSecret =
    process.env.JWT_ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "";
  const refreshTokenSecret =
    process.env.JWT_REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "";

  if (!accessTokenSecret || !refreshTokenSecret) {
    throw new Error(
      "JWT secrets are not configured. Please set JWT_ACCESS_TOKEN_SECRET and JWT_REFRESH_TOKEN_SECRET (or JWT_SECRET)."
    );
  }

  const accessTokenExpiresIn =
    process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || "15m";
  const refreshTokenExpiresIn =
    process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || "7d";
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);

  const config: AuthConfig = {
    accessTokenSecret,
    refreshTokenSecret,
    accessTokenExpiresIn,
    refreshTokenExpiresIn,
    saltRounds,
  };

  return new AuthServiceImpl(config);
};
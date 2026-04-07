import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthUserPayload {
  id: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string | number;
  bcryptSaltRounds: number;
}

export interface DecodedToken extends JwtPayload {
  userId: string;
  email: string;
}

const defaultConfig: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET || 'change_me_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
};

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string | number;
  private readonly bcryptSaltRounds: number;

  constructor(config: Partial<AuthConfig> = {}) {
    const mergedConfig: AuthConfig = {
      jwtSecret: config.jwtSecret || defaultConfig.jwtSecret,
      jwtExpiresIn: config.jwtExpiresIn || defaultConfig.jwtExpiresIn,
      bcryptSaltRounds: config.bcryptSaltRounds || defaultConfig.bcryptSaltRounds,
    };

    this.jwtSecret = mergedConfig.jwtSecret;
    this.jwtExpiresIn = mergedConfig.jwtExpiresIn;
    this.bcryptSaltRounds = mergedConfig.bcryptSaltRounds;
  }

  public async registerUser(input: RegisterInput): Promise<{ user: AuthUserPayload; tokens: AuthTokens }> {
    const { email, password, name } = input;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const error = new Error('Email is already registered');
      (error as any).code = 'USER_ALREADY_EXISTS';
      (error as any).status = 409;
      throw error;
    }

    const hashedPassword = await this.hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name ?? null,
      },
    });

    const payload: AuthUserPayload = {
      id: user.id,
      email: user.email,
    };

    const tokens = this.generateTokens(payload);

    return { user: payload, tokens };
  }

  public async loginUser(input: LoginInput): Promise<{ user: AuthUserPayload; tokens: AuthTokens }> {
    const { email, password } = input;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      const error = new Error('Invalid email or password');
      (error as any).code = 'INVALID_CREDENTIALS';
      (error as any).status = 401;
      throw error;
    }

    const isValidPassword = await this.comparePassword(password, user.password);
    if (!isValidPassword) {
      const error = new Error('Invalid email or password');
      (error as any).code = 'INVALID_CREDENTIALS';
      (error as any).status = 401;
      throw error;
    }

    const payload: AuthUserPayload = {
      id: user.id,
      email: user.email,
    };

    const tokens = this.generateTokens(payload);

    return { user: payload, tokens };
  }

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptSaltRounds);
  }

  public async comparePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  public generateTokens(user: AuthUserPayload): AuthTokens {
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );

    return { accessToken };
  }

  public verifyToken(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as DecodedToken;

      if (!decoded || !decoded.userId || !decoded.email) {
        const error = new Error('Invalid token payload');
        (error as any).code = 'INVALID_TOKEN';
        (error as any).status = 401;
        throw error;
      }

      return decoded;
    } catch (err) {
      const error = new Error('Invalid or expired token');
      (error as any).code = 'INVALID_TOKEN';
      (error as any).status = 401;
      throw error;
    }
  }

  public async getUserFromToken(token: string): Promise<User | null> {
    const decoded = this.verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    return user;
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      const error = new Error('User not found');
      (error as any).code = 'USER_NOT_FOUND';
      (error as any).status = 404;
      throw error;
    }

    const isValidPassword = await this.comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      const error = new Error('Current password is incorrect');
      (error as any).code = 'INVALID_CURRENT_PASSWORD';
      (error as any).status = 400;
      throw error;
    }

    const hashedPassword = await this.hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });
  }
}

const authService = new AuthService();
export default authService;
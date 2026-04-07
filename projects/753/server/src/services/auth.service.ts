import bcrypt from 'bcryptjs';
import jwt, { JwtPayload, SignOptions, VerifyErrors } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { UserModel, UserDocument } from '../models/user.model';

export interface SerializedUser {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthServiceConfig {
  jwtSecret: string;
  jwtExpiresIn: string | number;
  jwtIssuer?: string;
  jwtAudience?: string;
  saltRounds?: number;
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string | number;
  private readonly jwtIssuer?: string;
  private readonly jwtAudience?: string;
  private readonly saltRounds: number;

  constructor(config: AuthServiceConfig) {
    if (!config.jwtSecret) {
      throw new Error('JWT secret must be provided');
    }

    this.jwtSecret = config.jwtSecret;
    this.jwtExpiresIn = config.jwtExpiresIn || '1h';
    this.jwtIssuer = config.jwtIssuer;
    this.jwtAudience = config.jwtAudience;
    this.saltRounds = config.saltRounds ?? 10;
  }

  public async createUser(params: {
    email: string;
    password: string;
    name?: string;
  }): Promise<SerializedUser> {
    const { email, password, name } = params;

    const existingUser = await UserModel.findOne({ email: email.toLowerCase().trim() }).lean();
    if (existingUser) {
      throw new Error('Email is already in use');
    }

    const hashedPassword = await this.hashPassword(password);

    const user = await UserModel.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name: name?.trim() || undefined,
    });

    return this.serializeUser(user);
  }

  public async findByEmail(email: string): Promise<UserDocument | null> {
    const normalizedEmail = email.toLowerCase().trim();
    return UserModel.findOne({ email: normalizedEmail }).exec();
  }

  public async validatePassword(user: UserDocument, password: string): Promise<boolean> {
    if (!user.password) {
      return false;
    }
    return bcrypt.compare(password, user.password);
  }

  public signToken(user: UserDocument | SerializedUser, options: Partial<SignOptions> = {}): string {
    const userId = 'id' in user ? user.id : (user._id as Types.ObjectId).toHexString();
    const email = 'email' in user ? user.email : undefined;

    const payload: TokenPayload = {
      sub: userId,
      email: email ?? '',
    };

    const signOptions: SignOptions = {
      expiresIn: this.jwtExpiresIn,
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
      ...options,
    };

    return jwt.sign(payload, this.jwtSecret, signOptions);
  }

  public verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
      }) as JwtPayload;

      if (!decoded || typeof decoded.sub !== 'string' || typeof decoded.email !== 'string') {
        throw new Error('Invalid token payload');
      }

      return {
        sub: decoded.sub,
        email: decoded.email,
        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (error) {
      const err = error as VerifyErrors;
      if (err.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  public serializeUser(user: UserDocument | (UserDocument & { _id: Types.ObjectId }) | any): SerializedUser {
    const id =
      typeof user.id === 'string'
        ? user.id
        : user._id instanceof Types.ObjectId
        ? user._id.toHexString()
        : String(user._id);

    return {
      id,
      email: user.email,
      name: user.name ?? null,
      createdAt: user.createdAt ?? undefined,
      updatedAt: user.updatedAt ?? undefined,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    const salt = await bcrypt.genSalt(this.saltRounds);
    return bcrypt.hash(password, salt);
  }
}

export const authService = new AuthService({
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtIssuer: process.env.JWT_ISSUER,
  jwtAudience: process.env.JWT_AUDIENCE,
  saltRounds: process.env.BCRYPT_SALT_ROUNDS ? Number(process.env.BCRYPT_SALT_ROUNDS) : 10,
});
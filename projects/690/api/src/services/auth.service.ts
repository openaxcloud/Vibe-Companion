import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';

export type UserRole = 'user' | 'admin' | 'superadmin';

export interface JwtUserPayload {
  id: string;
  email: string;
  role: UserRole;
}

export interface AccessTokenPayload extends JwtUserPayload {
  type: 'access';
}

export interface RefreshTokenPayload extends JwtUserPayload {
  type: 'refresh';
  tokenVersion?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterParams {
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface AuthConfig {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtl: string | number;
  refreshTokenTtl: string | number;
  bcryptSaltRounds: number;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  tokenVersion?: number;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(user: {
    email: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<UserRecord>;
  incrementTokenVersion?(userId: string): Promise<void>;
}

export class AuthError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthService {
  private readonly userRepo: UserRepository;
  private readonly config: AuthConfig;

  constructor(userRepo: UserRepository, config: AuthConfig) {
    this.userRepo = userRepo;
    this.config = config;
    this.validateConfig();
  }

  private validateConfig(): void {
    const { jwtAccessSecret, jwtRefreshSecret, accessTokenTtl, refreshTokenTtl, bcryptSaltRounds } =
      this.config;

    if (!jwtAccessSecret || typeof jwtAccessSecret !== 'string') {
      throw new Error('AuthService configuration error: jwtAccessSecret is required');
    }
    if (!jwtRefreshSecret || typeof jwtRefreshSecret !== 'string') {
      throw new Error('AuthService configuration error: jwtRefreshSecret is required');
    }
    if (!accessTokenTtl) {
      throw new Error('AuthService configuration error: accessTokenTtl is required');
    }
    if (!refreshTokenTtl) {
      throw new Error('AuthService configuration error: refreshTokenTtl is required');
    }
    if (!Number.isInteger(bcryptSaltRounds) || bcryptSaltRounds < 4) {
      throw new Error('AuthService configuration error: bcryptSaltRounds must be an integer >= 4');
    }
  }

  async register(params: RegisterParams): Promise<UserRecord> {
    const email = params.email.trim().toLowerCase();
    const password = params.password;
    const role: UserRole = params.role ?? 'user';

    if (!email || !password) {
      throw new AuthError('Email and password are required', 'VALIDATION_ERROR', 400);
    }

    if (!this.isValidEmail(email)) {
      throw new AuthError('Invalid email format', 'INVALID_EMAIL', 400);
    }

    if (!this.isValidPassword(password)) {
      throw new AuthError(
        'Password does not meet complexity requirements',
        'WEAK_PASSWORD',
        400
      );
    }

    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new AuthError('Email already in use', 'EMAIL_TAKEN', 409);
    }

    const passwordHash = await bcrypt.hash(password, this.config.bcryptSaltRounds);

    const user = await this.userRepo.create({
      email,
      passwordHash,
      role
    });

    return user;
  }

  async login(params: LoginParams): Promise<{ user: UserRecord; tokens: AuthTokens }> {
    const email = params.email.trim().toLowerCase();
    const password = params.password;

    if (!email || !password) {
      throw new AuthError('Email and password are required', 'VALIDATION_ERROR', 400);
    }

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    const tokens = this.issueTokens(user);

    return { user, tokens };
  }

  issueTokens(user: UserRecord): AuthTokens {
    const basePayload: JwtUserPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const accessPayload: AccessTokenPayload = {
      ...basePayload,
      type: 'access'
    };

    const refreshPayload: RefreshTokenPayload = {
      ...basePayload,
      type: 'refresh',
      tokenVersion: user.tokenVersion
    };

    const accessToken = jwt.sign(accessPayload, this.config.jwtAccessSecret, {
      expiresIn: this.config.accessTokenTtl
    });

    const refreshToken = jwt.sign(refreshPayload, this.config.jwtRefreshSecret, {
      expiresIn: this.config.refreshTokenTtl
    });

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtAccessSecret) as JwtPayload;
      if (!decoded || decoded.type !== 'access') {
        throw new AuthError('Invalid access token', 'INVALID_TOKEN', 401);
      }
      return decoded as AccessTokenPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthError('Access token expired', 'TOKEN_EXPIRED', 401);
      }
      if (err.name === 'JsonWebTokenError') {
        throw new AuthError('Invalid access token', 'INVALID_TOKEN', 401);
      }
      throw err;
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const decoded = jwt.verify(token, this.config.jwtRefreshSecret) as JwtPayload;
      if (!decoded || decoded.type !== 'refresh') {
        throw new AuthError('Invalid refresh token', 'INVALID_TOKEN', 401);
      }

      const payload = decoded as RefreshTokenPayload;

      if (payload.id) {
        const user = await this.userRepo.findById(payload.id);
        if (!user) {
          throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
        }
        if (
          typeof user.tokenVersion === 'number' &&
          typeof payload.tokenVersion === 'number' &&
          user.tokenVersion !== payload.tokenVersion
        ) {
          throw new AuthError('Refresh token revoked', 'TOKEN_REVOKED', 401);
        }
      }

      return payload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthError('Refresh token expired', 'TOKEN_EXPIRED', 401);
      }
      if (err.name === 'JsonWebTokenError') {
        throw new AuthError('Invalid refresh token', 'INVALID_TOKEN', 401);
      }
      throw err;
    }
  }

  async rotateRefreshToken(
    refreshToken: string
  ): Promise<{ user: UserRecord; tokens: AuthTokens }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.userRepo.findById(payload.id);
    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
    }
    const tokens = this.issueTokens(user);
    return { user, tokens };
  }

  async revokeRefreshTokensForUser(userId: string): Promise<void> {
    if (typeof this.userRepo.incrementTokenVersion !== 'function') {
      throw new Error(
        'UserRepository.incrementTokenVersion is not implemented but is required for token revocation'
      );
    }
    await this.userRepo.incrementTokenVersion(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new AuthError('Current password is incorrect', 'INVALID_CREDENTIALS', 401);
    }

    if (!this.isValidPassword(newPassword)) {
      throw new AuthError(
        'Password does not meet complexity requirements',
        'WEAK_PASSWORD',
        400
      );
    }

    if (typeof this.userRepo.incrementTokenVersion === 'function') {
      await this.userRepo.incrementTokenVersion(user.id);
    }
  }

  hasRole(user: JwtUserPayload | null | undefined, role: UserRole):
import jwt, { JwtPayload, SignOptions, VerifyErrors } from 'jsonwebtoken';
import crypto from 'crypto';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  type: 'access';
  roles?: string[];
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  type: 'refresh';
  tokenId: string;
}

export interface GeneratedTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  refreshTokenId: string;
}

export interface JwtConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: string | number;
  refreshTokenExpiresIn: string | number;
  issuer?: string;
  audience?: string;
}

export class JwtError extends Error {
  public code: string;
  public originalError?: VerifyErrors;

  constructor(message: string, code: string, originalError?: VerifyErrors) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'JwtError';
    this.code = code;
    this.originalError = originalError;
  }
}

export class JwtUtil {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiresIn: string | number;
  private readonly refreshTokenExpiresIn: string | number;
  private readonly issuer?: string;
  private readonly audience?: string;

  constructor(config: JwtConfig) {
    if (!config.accessTokenSecret || !config.refreshTokenSecret) {
      throw new Error('JWT secrets must be provided');
    }

    this.accessTokenSecret = config.accessTokenSecret;
    this.refreshTokenSecret = config.refreshTokenSecret;
    this.accessTokenExpiresIn = config.accessTokenExpiresIn;
    this.refreshTokenExpiresIn = config.refreshTokenExpiresIn;
    this.issuer = config.issuer;
    this.audience = config.audience;
  }

  public generateTokens(userId: string, roles?: string[]): GeneratedTokens {
    const now = Math.floor(Date.now() / 1000);

    const accessPayload: AccessTokenPayload = {
      sub: userId,
      type: 'access',
      roles,
      iat: now
    };

    const refreshTokenId = this.generateTokenId();

    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      type: 'refresh',
      tokenId: refreshTokenId,
      iat: now
    };

    const accessToken = this.signToken(accessPayload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn
    });

    const refreshToken = this.signToken(refreshPayload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiresIn
    });

    const accessTokenExpiresAt = this.calculateExpiryDate(this.accessTokenExpiresIn);
    const refreshTokenExpiresAt = this.calculateExpiryDate(this.refreshTokenExpiresIn);

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      refreshTokenId
    };
  }

  public generateAccessTokenFromRefresh(
    refreshToken: string,
    expectedTokenId?: string,
    roles?: string[]
  ): { accessToken: string; accessTokenExpiresAt: Date; userId: string; refreshTokenId: string } {
    const payload = this.verifyRefreshToken(refreshToken);

    if (expectedTokenId && payload.tokenId !== expectedTokenId) {
      throw new JwtError('Refresh token ID mismatch', 'REFRESH_TOKEN_ID_MISMATCH');
    }

    const now = Math.floor(Date.now() / 1000);

    const accessPayload: AccessTokenPayload = {
      sub: payload.sub,
      type: 'access',
      roles,
      iat: now
    };

    const accessToken = this.signToken(accessPayload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn
    });

    const accessTokenExpiresAt = this.calculateExpiryDate(this.accessTokenExpiresIn);

    return {
      accessToken,
      accessTokenExpiresAt,
      userId: payload.sub,
      refreshTokenId: payload.tokenId
    };
  }

  public verifyAccessToken(token: string): AccessTokenPayload {
    const payload = this.verifyToken<AccessTokenPayload>(token, this.accessTokenSecret);

    if (payload.type !== 'access') {
      throw new JwtError('Invalid token type', 'INVALID_TOKEN_TYPE');
    }

    if (!payload.sub) {
      throw new JwtError('Token payload missing subject', 'INVALID_TOKEN_PAYLOAD');
    }

    return payload;
  }

  public verifyRefreshToken(token: string): RefreshTokenPayload {
    const payload = this.verifyToken<RefreshTokenPayload>(token, this.refreshTokenSecret);

    if (payload.type !== 'refresh') {
      throw new JwtError('Invalid token type', 'INVALID_TOKEN_TYPE');
    }

    if (!payload.sub || !payload.tokenId) {
      throw new JwtError('Token payload missing required fields', 'INVALID_TOKEN_PAYLOAD');
    }

    return payload;
  }

  public decodeToken<T extends JwtPayload = JwtPayload>(token: string): T | null {
    try {
      const decoded = jwt.decode(token) as T | null;
      return decoded;
    } catch {
      return null;
    }
  }

  private signToken(
    payload: JwtPayload,
    secret: string,
    options: SignOptions
  ): string {
    const signOptions: SignOptions = {
      algorithm: 'HS256',
      issuer: this.issuer,
      audience: this.audience,
      ...options
    };

    return jwt.sign(payload, secret, signOptions);
  }

  private verifyToken<T extends JwtPayload>(
    token: string,
    secret: string
  ): T {
    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience
      }) as T;

      return payload;
    } catch (error) {
      const err = error as VerifyErrors;

      if (err.name === 'TokenExpiredError') {
        throw new JwtError('Token expired', 'TOKEN_EXPIRED', err);
      }

      if (err.name === 'JsonWebTokenError') {
        throw new JwtError('Invalid token', 'INVALID_TOKEN', err);
      }

      if (err.name === 'NotBeforeError') {
        throw new JwtError('Token not active', 'TOKEN_NOT_ACTIVE', err);
      }

      throw new JwtError('Token verification failed', 'TOKEN_VERIFICATION_FAILED', err);
    }
  }

  private calculateExpiryDate(expiresIn: string | number): Date {
    const now = Date.now();

    if (typeof expiresIn === 'number') {
      return new Date(now + expiresIn * 1000);
    }

    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) {
      return new Date(now);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    let multiplier: number;
    switch (unit) {
      case 's':
        multiplier = 1000;
        break;
      case 'm':
        multiplier = 60 * 1000;
        break;
      case 'h':
        multiplier = 60 * 60 * 1000;
        break;
      case 'd':
        multiplier = 24 * 60 * 60 * 1000;
        break;
      default:
        multiplier = 1000;
        break;
    }

    return new Date(now + value * multiplier);
  }

  private generateTokenId(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

let singletonInstance: JwtUtil | null = null;

export function getJwtUtilFromEnv(): JwtUtil {
  if (singletonInstance) {
    return singletonInstance;
  }

  const {
    JWT_ACCESS_TOKEN_SECRET,
    JWT_REFRESH_TOKEN_SECRET,
    JWT_ACCESS_TOKEN_EXPIRES_IN,
    JWT_REFRESH_TOKEN_EXPIRES_IN,
    JWT_ISSUER,
    JWT_AUDIENCE
  } = process.env;

  if (!JWT_ACCESS_TOKEN_SECRET || !JWT_REFRESH_TOKEN_SECRET) {
    throw new Error('JWT_ACCESS_TOKEN_SECRET and JWT_REFRESH_TOKEN_SECRET must be set');
  }

  const accessTokenExpiresIn = JWT_ACCESS_TOKEN_EXPIRES_IN || '15m';
  const refreshTokenExpiresIn = JWT_REFRESH_TOKEN_EXPIRES_IN || '7d';

  singletonInstance = new JwtUtil({
    accessTokenSecret: JWT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: JWT_REFRESH_TOKEN_SECRET,
    accessTokenExpiresIn,
    refreshTokenExpiresIn,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });

  return singletonInstance;
}
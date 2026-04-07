import jwt, { SignOptions, VerifyErrors } from 'jsonwebtoken';

export interface JwtUserPayload {
  id: string;
  email: string;
}

export interface JwtConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: string | number;
  refreshTokenExpiresIn: string | number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JwtError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'JWT_ERROR') {
    super(message);
    this.name = 'JwtError';
    this.code = code;
    Object.setPrototypeOf(this, JwtError.prototype);
  }
}

export class JwtService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiresIn: string | number;
  private readonly refreshTokenExpiresIn: string | number;

  constructor(config: JwtConfig) {
    if (!config.accessTokenSecret || !config.refreshTokenSecret) {
      throw new JwtError('JWT secrets must be provided', 'JWT_CONFIG_ERROR');
    }

    this.accessTokenSecret = config.accessTokenSecret;
    this.refreshTokenSecret = config.refreshTokenSecret;
    this.accessTokenExpiresIn = config.accessTokenExpiresIn;
    this.refreshTokenExpiresIn = config.refreshTokenExpiresIn;
  }

  public generateAccessToken(payload: JwtUserPayload): string {
    return this.signToken(payload, this.accessTokenSecret, this.accessTokenExpiresIn);
  }

  public generateRefreshToken(payload: JwtUserPayload): string {
    return this.signToken(payload, this.refreshTokenSecret, this.refreshTokenExpiresIn);
  }

  public generateTokenPair(payload: JwtUserPayload): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    return { accessToken, refreshToken };
  }

  public verifyAccessToken(token: string): JwtUserPayload {
    return this.verifyToken<JwtUserPayload>(token, this.accessTokenSecret);
  }

  public verifyRefreshToken(token: string): JwtUserPayload {
    return this.verifyToken<JwtUserPayload>(token, this.refreshTokenSecret);
  }

  private signToken<T extends object>(
    payload: T,
    secret: string,
    expiresIn: string | number,
    options: SignOptions = {}
  ): string {
    try {
      return jwt.sign(payload, secret, {
        expiresIn,
        ...options,
      });
    } catch (error) {
      throw new JwtError('Failed to sign token', 'JWT_SIGN_ERROR');
    }
  }

  private verifyToken<T>(token: string, secret: string): T {
    try {
      const decoded = jwt.verify(token, secret);
      return decoded as T;
    } catch (error) {
      const err = error as VerifyErrors;
      if (err.name === 'TokenExpiredError') {
        throw new JwtError('Token has expired', 'JWT_EXPIRED');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new JwtError('Invalid token', 'JWT_INVALID');
      }
      throw new JwtError('Failed to verify token', 'JWT_VERIFY_ERROR');
    }
  }
}

let defaultJwtService: JwtService | null = null;

export const getDefaultJwtService = (): JwtService => {
  if (defaultJwtService) {
    return defaultJwtService;
  }

  const accessTokenSecret = process.env.JWT_ACCESS_TOKEN_SECRET;
  const refreshTokenSecret = process.env.JWT_REFRESH_TOKEN_SECRET;

  if (!accessTokenSecret || !refreshTokenSecret) {
    throw new JwtError('Environment JWT secrets are not set', 'JWT_ENV_CONFIG_ERROR');
  }

  const accessTokenExpiresIn = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m';
  const refreshTokenExpiresIn = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d';

  defaultJwtService = new JwtService({
    accessTokenSecret,
    refreshTokenSecret,
    accessTokenExpiresIn,
    refreshTokenExpiresIn,
  });

  return defaultJwtService;
};

export const signAccessToken = (payload: JwtUserPayload): string => {
  return getDefaultJwtService().generateAccessToken(payload);
};

export const signRefreshToken = (payload: JwtUserPayload): string => {
  return getDefaultJwtService().generateRefreshToken(payload);
};

export const signTokenPair = (payload: JwtUserPayload): TokenPair => {
  return getDefaultJwtService().generateTokenPair(payload);
};

export const verifyAccessToken = (token: string): JwtUserPayload => {
  return getDefaultJwtService().verifyAccessToken(token);
};

export const verifyRefreshToken = (token: string): JwtUserPayload => {
  return getDefaultJwtService().verifyRefreshToken(token);
};
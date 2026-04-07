import jwt, { SignOptions, VerifyErrors } from "jsonwebtoken";

export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface JwtConfig {
  accessTokenSecret: string;
  refreshTokenSecret?: string;
  accessTokenExpiresIn: string | number; // e.g. "15m", "7d" or seconds
  refreshTokenExpiresIn?: string | number;
  issuer?: string;
  audience?: string;
}

export class JwtError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = "JWT_ERROR", statusCode = 401) {
    super(message);
    this.name = "JwtError";
    this.code = code;
    this.statusCode = statusCode;

    Object.setPrototypeOf(this, JwtError.prototype);
  }
}

export class JwtUtil {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret?: string;
  private readonly accessTokenExpiresIn: string | number;
  private readonly refreshTokenExpiresIn?: string | number;
  private readonly issuer?: string;
  private readonly audience?: string;

  constructor(config: JwtConfig) {
    if (!config.accessTokenSecret) {
      throw new Error("JwtUtil requires accessTokenSecret");
    }

    this.accessTokenSecret = config.accessTokenSecret;
    this.refreshTokenSecret = config.refreshTokenSecret;
    this.accessTokenExpiresIn = config.accessTokenExpiresIn;
    this.refreshTokenExpiresIn = config.refreshTokenExpiresIn;
    this.issuer = config.issuer;
    this.audience = config.audience;
  }

  public generateAccessToken(
    payload: Omit<JwtPayload, "iat" | "exp">
  ): string {
    const options: SignOptions = {
      expiresIn: this.accessTokenExpiresIn,
      issuer: this.issuer,
      audience: this.audience,
      subject: payload.sub,
    };

    return jwt.sign(payload, this.accessTokenSecret, options);
  }

  public generateRefreshToken(
    payload: Omit<JwtPayload, "iat" | "exp">
  ): string {
    if (!this.refreshTokenSecret || !this.refreshTokenExpiresIn) {
      throw new Error(
        "Refresh token generation requested but refresh token secret or expiration not configured"
      );
    }

    const options: SignOptions = {
      expiresIn: this.refreshTokenExpiresIn,
      issuer: this.issuer,
      audience: this.audience,
      subject: payload.sub,
    };

    return jwt.sign(payload, this.refreshTokenSecret, options);
  }

  public verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
      });

      if (typeof decoded === "string") {
        throw new JwtError("Invalid token payload", "INVALID_PAYLOAD");
      }

      return decoded as JwtPayload;
    } catch (error) {
      throw this.mapJwtError(error);
    }
  }

  public verifyRefreshToken(token: string): JwtPayload {
    if (!this.refreshTokenSecret) {
      throw new Error(
        "Refresh token verification requested but refresh token secret not configured"
      );
    }

    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
      });

      if (typeof decoded === "string") {
        throw new JwtError("Invalid token payload", "INVALID_PAYLOAD");
      }

      return decoded as JwtPayload;
    } catch (error) {
      throw this.mapJwtError(error);
    }
  }

  private mapJwtError(error: unknown): JwtError {
    const err = error as VerifyErrors;

    if (err.name === "TokenExpiredError") {
      return new JwtError("Token has expired", "TOKEN_EXPIRED", 401);
    }

    if (err.name === "JsonWebTokenError") {
      return new JwtError("Invalid token", "INVALID_TOKEN", 401);
    }

    if (err.name === "NotBeforeError") {
      return new JwtError("Token not active yet", "TOKEN_NOT_ACTIVE", 401);
    }

    return new JwtError(err.message || "JWT verification failed", "JWT_ERROR", 401);
  }
}

let jwtUtilInstance: JwtUtil | null = null;

export const initJwtUtil = (config: JwtConfig): JwtUtil => {
  jwtUtilInstance = new JwtUtil(config);
  return jwtUtilInstance;
};

export const getJwtUtil = (): JwtUtil => {
  if (!jwtUtilInstance) {
    throw new Error(
      "JwtUtil has not been initialized. Call initJwtUtil(config) during application startup."
    );
  }
  return jwtUtilInstance;
};

export const signAccessToken = (
  payload: Omit<JwtPayload, "iat" | "exp">
): string => {
  return getJwtUtil().generateAccessToken(payload);
};

export const signRefreshToken = (
  payload: Omit<JwtPayload, "iat" | "exp">
): string => {
  return getJwtUtil().generateRefreshToken(payload);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return getJwtUtil().verifyAccessToken(token);
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return getJwtUtil().verifyRefreshToken(token);
};
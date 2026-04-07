import jwt, { JwtPayload, SignOptions, VerifyErrors } from "jsonwebtoken";

export interface AccessTokenPayload extends JwtPayload {
  userId: string;
  email?: string;
  roles?: string[];
  type: "access";
}

export interface RefreshTokenPayload extends JwtPayload {
  userId: string;
  tokenVersion?: number;
  type: "refresh";
}

export type AnyTokenPayload = AccessTokenPayload | RefreshTokenPayload;

interface TokenConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: string | number;
  refreshTokenExpiresIn: string | number;
}

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Environment variable undefined is not set`);
  }
  return value;
};

const tokenConfig: TokenConfig = {
  accessTokenSecret: getEnv("JWT_ACCESS_TOKEN_SECRET"),
  refreshTokenSecret: getEnv("JWT_REFRESH_TOKEN_SECRET"),
  accessTokenExpiresIn: getEnv("JWT_ACCESS_TOKEN_EXPIRES_IN", "15m"),
  refreshTokenExpiresIn: getEnv("JWT_REFRESH_TOKEN_EXPIRES_IN", "7d"),
};

export class JwtError extends Error {
  public readonly code: string;
  public readonly originalError?: VerifyErrors | Error;

  constructor(message: string, code: string, originalError?: VerifyErrors | Error) {
    super(message);
    this.name = "JwtError";
    this.code = code;
    this.originalError = originalError;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const signToken = <T extends JwtPayload>(
  payload: T,
  secret: string,
  expiresIn: string | number,
  options?: SignOptions
): string => {
  return jwt.sign(payload, secret, {
    expiresIn,
    ...options,
  });
};

const verifyToken = <T extends JwtPayload>(
  token: string,
  secret: string
): T => {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string") {
      throw new JwtError("Invalid token payload type", "INVALID_PAYLOAD_TYPE");
    }
    return decoded as T;
  } catch (err) {
    const error = err as VerifyErrors;
    if (error.name === "TokenExpiredError") {
      throw new JwtError("Token has expired", "TOKEN_EXPIRED", error);
    }
    if (error.name === "JsonWebTokenError") {
      throw new JwtError("Invalid token", "INVALID_TOKEN", error);
    }
    if (error.name === "NotBeforeError") {
      throw new JwtError("Token not active", "TOKEN_NOT_ACTIVE", error);
    }
    throw new JwtError("Token verification failed", "TOKEN_VERIFICATION_FAILED", error);
  }
};

export const signAccessToken = (payload: Omit<AccessTokenPayload, "type" | "iat" | "exp">): string => {
  const fullPayload: AccessTokenPayload = {
    ...payload,
    type: "access",
  };
  return signToken<AccessTokenPayload>(
    fullPayload,
    tokenConfig.accessTokenSecret,
    tokenConfig.accessTokenExpiresIn
  );
};

export const signRefreshToken = (payload: Omit<RefreshTokenPayload, "type" | "iat" | "exp">): string => {
  const fullPayload: RefreshTokenPayload = {
    ...payload,
    type: "refresh",
  };
  return signToken<RefreshTokenPayload>(
    fullPayload,
    tokenConfig.refreshTokenSecret,
    tokenConfig.refreshTokenExpiresIn
  );
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const payload = verifyToken<AccessTokenPayload>(token, tokenConfig.accessTokenSecret);
  if (payload.type !== "access") {
    throw new JwtError("Token is not an access token", "INVALID_TOKEN_TYPE");
  }
  return payload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const payload = verifyToken<RefreshTokenPayload>(token, tokenConfig.refreshTokenSecret);
  if (payload.type !== "refresh") {
    throw new JwtError("Token is not a refresh token", "INVALID_TOKEN_TYPE");
  }
  return payload;
};

export const decodeToken = <T extends JwtPayload = AnyTokenPayload>(
  token: string
): T | null => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string") {
    return null;
  }
  return decoded as T;
};

export const getTokenConfig = (): TokenConfig => {
  return { ...tokenConfig };
};

export const isAccessTokenPayload = (payload: JwtPayload): payload is AccessTokenPayload => {
  return payload.type === "access";
};

export const isRefreshTokenPayload = (payload: JwtPayload): payload is RefreshTokenPayload => {
  return payload.type === "refresh";
};
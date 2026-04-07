import jwt, { SignOptions, VerifyErrors, JwtPayload } from "jsonwebtoken";

export interface JwtConfig {
  accessTokenSecret: string;
  accessTokenExpiresIn: string | number;
}

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  type: "access";
  [key: string]: unknown;
}

export interface DecodedToken<T extends JwtPayload = JwtPayload> {
  valid: boolean;
  expired: boolean;
  decoded: T | null;
  error?: string;
}

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: undefined`);
  }
  return value;
};

const config: JwtConfig = {
  accessTokenSecret: getEnv("JWT_ACCESS_TOKEN_SECRET"),
  accessTokenExpiresIn: getEnv("JWT_ACCESS_TOKEN_EXPIRES_IN", "15m"),
};

export const signAccessToken = (
  userId: string,
  payload: Record<string, unknown> = {},
  options: SignOptions = {}
): string => {
  const jwtPayload: AccessTokenPayload = {
    sub: userId,
    type: "access",
    ...payload,
  };

  const signOptions: SignOptions = {
    expiresIn: config.accessTokenExpiresIn,
    ...options,
  };

  return jwt.sign(jwtPayload, config.accessTokenSecret, signOptions);
};

export const verifyAccessToken = (
  token: string
): DecodedToken<AccessTokenPayload> => {
  try {
    const decoded = jwt.verify(
      token,
      config.accessTokenSecret
    ) as AccessTokenPayload;
    return {
      valid: true,
      expired: false,
      decoded,
    };
  } catch (error) {
    const err = error as VerifyErrors;
    return {
      valid: false,
      expired: err.name === "TokenExpiredError",
      decoded: null,
      error: err.message,
    };
  }
};

export const decodeToken = <T extends JwtPayload = JwtPayload>(
  token: string
): T | null => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string") {
    return null;
  }
  return decoded as T;
};

export const getJwtConfig = (): JwtConfig => ({ ...config });
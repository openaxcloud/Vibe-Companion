import jwt, { SignOptions, VerifyErrors } from "jsonwebtoken";
import ms from "ms";

export interface JwtPayload extends jwt.JwtPayload {
  sub?: string;
  [key: string]: unknown;
}

export type TokenType = "access" | "refresh";

export interface JwtConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: string; // e.g. "15m"
  refreshTokenExpiresIn: string; // e.g. "7d"
  issuer?: string;
  audience?: string;
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
  maxAge?: number;
  domain?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

let config: JwtConfig | null = null;

export const configureJwt = (jwtConfig: JwtConfig): void => {
  config = { ...jwtConfig };
};

const assertConfigured = (): asserts config is JwtConfig => {
  if (!config) {
    throw new Error("JWT not configured. Call configureJwt() during initialization.");
  }
};

const getSecretForType = (type: TokenType): string => {
  assertConfigured();
  return type === "access" ? config.accessTokenSecret : config.refreshTokenSecret;
};

const getExpiresInForType = (type: TokenType): string => {
  assertConfigured();
  return type === "access" ? config.accessTokenExpiresIn : config.refreshTokenExpiresIn;
};

const getIssuedAtAndExpiry = (expiresIn: string): { iat: number; exp: number; expiresAt: Date } => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const durationMs = ms(expiresIn);
  if (typeof durationMs !== "number" || Number.isNaN(durationMs) || durationMs <= 0) {
    throw new Error(`Invalid JWT expiresIn value: undefined`);
  }
  const expSeconds = nowSeconds + Math.floor(durationMs / 1000);
  return {
    iat: nowSeconds,
    exp: expSeconds,
    expiresAt: new Date(expSeconds * 1000),
  };
};

export interface SignTokenOptions {
  subject?: string;
  type: TokenType;
  payload?: Record<string, unknown>;
}

export const signToken = (options: SignTokenOptions): { token: string; expiresAt: Date } => {
  assertConfigured();
  const { subject, type, payload = {} } = options;
  const secret = getSecretForType(type);
  const expiresIn = getExpiresInForType(type);

  const { iat, exp, expiresAt } = getIssuedAtAndExpiry(expiresIn);

  const signOptions: SignOptions = {
    algorithm: "HS256",
    issuer: config.issuer,
    audience: config.audience,
    subject,
    expiresIn,
    notBefore: 0,
  };

  const tokenPayload: JwtPayload = {
    ...payload,
    iat,
    exp,
    type,
  };

  const token = jwt.sign(tokenPayload, secret, signOptions);
  return { token, expiresAt };
};

export interface VerifyTokenResult {
  valid: boolean;
  expired: boolean;
  decoded?: JwtPayload;
  error?: VerifyErrors | Error;
}

export const verifyToken = (token: string, type: TokenType): VerifyTokenResult => {
  try {
    const secret = getSecretForType(type);
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: config?.issuer,
      audience: config?.audience,
    }) as JwtPayload;

    if (decoded.type !== type) {
      return {
        valid: false,
        expired: false,
        error: new Error("Invalid token type"),
      };
    }

    return {
      valid: true,
      expired: false,
      decoded,
    };
  } catch (error) {
    const verifyError = error as VerifyErrors;
    const isExpired = verifyError.name === "TokenExpiredError";
    return {
      valid: false,
      expired: isExpired,
      error: verifyError,
    };
  }
};

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null;
    return decoded;
  } catch {
    return null;
  }
};

export interface AuthCookies {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthCookieConfig {
  accessTokenCookieName?: string;
  refreshTokenCookieName?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  path?: string;
}

export interface AuthCookieOptionsResult {
  cookies: Record<string, { value: string; options: CookieOptions }>;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt?: Date;
}

export const getAuthCookieOptions = (
  tokens: TokenPair | { accessToken: string; accessTokenExpiresAt: Date; refreshToken?: string; refreshTokenExpiresAt?: Date },
  cookieConfig: AuthCookieConfig = {}
): AuthCookieOptionsResult => {
  assertConfigured();

  const accessTokenCookieName = cookieConfig.accessTokenCookieName || "access_token";
  const refreshTokenCookieName = cookieConfig.refreshTokenCookieName || "refresh_token";

  const baseSecure = cookieConfig.secure ?? true;
  const baseSameSite = cookieConfig.sameSite ?? "lax";
  const basePath = cookieConfig.path ?? "/";

  const cookies: Record<string, { value: string; options: CookieOptions }> = {};

  const accessMaxAgeMs = ms(config.accessTokenExpiresIn);
  const refreshMaxAgeMs = ms(config.refreshTokenExpiresIn);

  cookies[accessTokenCookieName] = {
    value: tokens.accessToken,
    options: {
      httpOnly: true,
      secure: baseSecure,
      sameSite: baseSameSite,
      path: basePath,
      domain: cookieConfig.domain,
      maxAge: typeof accessMaxAgeMs === "number" ? Math.floor(accessMaxAgeMs / 1000) : undefined,
    },
  };

  if ("refreshToken" in tokens && tokens.refreshToken) {
    cookies[refreshTokenCookieName] = {
      value: tokens.refreshToken,
      options: {
        httpOnly: true,
        secure: baseSecure,
        sameSite: baseSameSite,
        path: basePath,
        domain: cookieConfig.domain,
        maxAge: typeof refreshMaxAgeMs === "number" ? Math.floor(refreshMaxAgeMs / 1000) : undefined,
      },
    };
  }

  return {
    cookies,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
  };
};

export const clearAuthCookieOptions = (
  cookieConfig: AuthCookieConfig = {}
): Record<string, { value: string; options: CookieOptions }> => {
  const accessTokenCookieName = cookieConfig.accessTokenCookieName || "access_token";
  const refreshTokenCookieName = cookieConfig.refreshTokenCookieName || "refresh_token";

  const baseSecure = cookieConfig.secure ?? true;
  const baseSameSite = cookieConfig.sameSite ?? "lax";
  const basePath = cookieConfig.path ?? "/";

  const expiredDate = new Date(0);

  const toClearOptions: CookieOptions = {
    httpOnly: true,
    secure: baseSecure,
    sameSite: baseSameSite,
    path: basePath,
    domain: cookieConfig.domain,
    maxAge: 0,
  };

  return {
    [accessTokenCookieName]: {
      value: "",
      options: { ...toClearOptions },
    },
    [refreshTokenCookieName]: {
      value: "",
      options: { ...toClearOptions },
    },
  };
};

export const createTokenPair = (subject: string, payload: Record<string, unknown> = {}): TokenPair => {
  const access = signToken({
    subject,
    type: "access",
    payload,
  });

  const refresh = signToken({
    subject,
    type: "refresh",
    payload: { tokenType: "refresh" },
  });

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshTokenExpiresAt: refresh.expiresAt,
  };
};
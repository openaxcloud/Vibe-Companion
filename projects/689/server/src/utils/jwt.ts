import jwt, { JwtPayload, SignOptions, VerifyOptions } from "jsonwebtoken";
import { serialize as serializeCookie, CookieSerializeOptions } from "cookie";

export interface JwtConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: string | number;
  refreshTokenExpiresIn: string | number;
  cookieDomain?: string;
  secureCookies?: boolean;
}

export interface JwtUserPayload {
  sub: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenCookies {
  accessTokenCookie: string;
  refreshTokenCookie: string;
}

export interface JwtUtilsOptions {
  config: JwtConfig;
}

export class JwtUtils {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiresIn: string | number;
  private readonly refreshTokenExpiresIn: string | number;
  private readonly cookieDomain?: string;
  private readonly secureCookies: boolean;

  constructor(options: JwtUtilsOptions) {
    if (!options?.config) {
      throw new Error("JwtUtils requires a config object");
    }

    const {
      accessTokenSecret,
      refreshTokenSecret,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
      cookieDomain,
      secureCookies,
    } = options.config;

    if (!accessTokenSecret || !refreshTokenSecret) {
      throw new Error("JWT secrets must be provided");
    }

    this.accessTokenSecret = accessTokenSecret;
    this.refreshTokenSecret = refreshTokenSecret;
    this.accessTokenExpiresIn = accessTokenExpiresIn;
    this.refreshTokenExpiresIn = refreshTokenExpiresIn;
    this.cookieDomain = cookieDomain;
    this.secureCookies = secureCookies ?? true;
  }

  signAccessToken(payload: JwtUserPayload, options?: SignOptions): string {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn,
      ...options,
    });
  }

  signRefreshToken(payload: JwtUserPayload, options?: SignOptions): string {
    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiresIn,
      ...options,
    });
  }

  verifyAccessToken<T extends JwtPayload = JwtPayload>(
    token: string,
    options?: VerifyOptions,
  ): T {
    return jwt.verify(token, this.accessTokenSecret, options) as T;
  }

  verifyRefreshToken<T extends JwtPayload = JwtPayload>(
    token: string,
    options?: VerifyOptions,
  ): T {
    return jwt.verify(token, this.refreshTokenSecret, options) as T;
  }

  generateTokenPair(payload: JwtUserPayload): GeneratedTokens {
    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.signRefreshToken(payload);
    return { accessToken, refreshToken };
  }

  clearTokenCookiesConfig(): TokenCookies {
    const baseOptions: CookieSerializeOptions = {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "lax",
      domain: this.cookieDomain,
      path: "/",
      maxAge: 0,
    };

    const accessTokenCookie = serializeCookie("access_token", "", baseOptions);
    const refreshTokenCookie = serializeCookie(
      "refresh_token",
      "",
      baseOptions,
    );

    return {
      accessTokenCookie,
      refreshTokenCookie,
    };
  }

  serializeTokenCookies(tokens: GeneratedTokens): TokenCookies {
    const accessTokenCookie = serializeCookie("access_token", tokens.accessToken, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "lax",
      domain: this.cookieDomain,
      path: "/",
      maxAge: this.normalizeExpiryToSeconds(this.accessTokenExpiresIn),
    });

    const refreshTokenCookie = serializeCookie(
      "refresh_token",
      tokens.refreshToken,
      {
        httpOnly: true,
        secure: this.secureCookies,
        sameSite: "lax",
        domain: this.cookieDomain,
        path: "/",
        maxAge: this.normalizeExpiryToSeconds(this.refreshTokenExpiresIn),
      },
    );

    return {
      accessTokenCookie,
      refreshTokenCookie,
    };
  }

  private normalizeExpiryToSeconds(expiresIn: string | number): number | undefined {
    if (typeof expiresIn === "number") {
      return expiresIn;
    }

    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) {
      return undefined;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 60 * 60;
      case "d":
        return value * 60 * 60 * 24;
      default:
        return undefined;
    }
  }
}

export const createJwtUtilsFromEnv = (): JwtUtils => {
  const accessTokenSecret =
    process.env.JWT_ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
  const refreshTokenSecret =
    process.env.JWT_REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!accessTokenSecret || !refreshTokenSecret) {
    throw new Error(
      "JWT secrets are not configured. Set JWT_ACCESS_TOKEN_SECRET and JWT_REFRESH_TOKEN_SECRET (or JWT_SECRET).",
    );
  }

  const accessTokenExpiresIn =
    process.env.JWT_ACCESS_EXPIRES_IN || "15m";
  const refreshTokenExpiresIn =
    process.env.JWT_REFRESH_EXPIRES_IN || "7d";

  const cookieDomain = process.env.JWT_COOKIE_DOMAIN;
  const secureCookies = process.env.NODE_ENV === "production";

  return new JwtUtils({
    config: {
      accessTokenSecret,
      refreshTokenSecret,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
      cookieDomain,
      secureCookies,
    },
  });
};
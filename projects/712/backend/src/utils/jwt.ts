import jwt, { JwtPayload, SignOptions, VerifyErrors } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export type TokenType = "access" | "refresh" | "passwordReset" | "emailVerification";

export interface DecodedToken extends JwtPayload {
  sub: string;
  type: TokenType;
}

export interface SignTokenOptions {
  subject: string;
  type: TokenType;
  expiresIn?: string | number;
  payload?: Record<string, unknown>;
}

const {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_PASSWORD_RESET_SECRET,
  JWT_EMAIL_VERIFICATION_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  JWT_PASSWORD_RESET_EXPIRES_IN,
  JWT_EMAIL_VERIFICATION_EXPIRES_IN,
  NODE_ENV,
} = process.env;

if (!JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET is not set in environment variables");
}
if (!JWT_REFRESH_SECRET) {
  throw new Error("JWT_REFRESH_SECRET is not set in environment variables");
}
if (!JWT_PASSWORD_RESET_SECRET) {
  throw new Error("JWT_PASSWORD_RESET_SECRET is not set in environment variables");
}
if (!JWT_EMAIL_VERIFICATION_SECRET) {
  throw new Error("JWT_EMAIL_VERIFICATION_SECRET is not set in environment variables");
}

const isProduction = NODE_ENV === "production";

const defaultExpirations: Record<TokenType, string> = {
  access: JWT_ACCESS_EXPIRES_IN || "15m",
  refresh: JWT_REFRESH_EXPIRES_IN || "7d",
  passwordReset: JWT_PASSWORD_RESET_EXPIRES_IN || "1h",
  emailVerification: JWT_EMAIL_VERIFICATION_EXPIRES_IN || "24h",
};

const secrets: Record<TokenType, string> = {
  access: JWT_ACCESS_SECRET,
  refresh: JWT_REFRESH_SECRET,
  passwordReset: JWT_PASSWORD_RESET_SECRET,
  emailVerification: JWT_EMAIL_VERIFICATION_SECRET,
};

function getSecretForType(type: TokenType): string {
  const secret = secrets[type];
  if (!secret) {
    throw new Error(`No JWT secret configured for token type: undefined`);
  }
  return secret;
}

function getExpirationForType(type: TokenType): string {
  const exp = defaultExpirations[type];
  if (!exp) {
    throw new Error(`No JWT expiration configured for token type: undefined`);
  }
  return exp;
}

export function signToken(options: SignTokenOptions): string {
  const { subject, type, expiresIn, payload = {} } = options;

  const secret = getSecretForType(type);
  const finalExpiresIn = expiresIn ?? getExpirationForType(type);

  const signOptions: SignOptions = {
    subject,
    expiresIn: finalExpiresIn,
    algorithm: "HS256",
  };

  const tokenPayload: JwtPayload = {
    ...payload,
    type,
  };

  return jwt.sign(tokenPayload, secret, signOptions);
}

export function verifyToken(token: string, type: TokenType): DecodedToken {
  const secret = getSecretForType(type);

  try {
    const decoded = jwt.verify(token, secret) as DecodedToken;

    if (!decoded || typeof decoded !== "object") {
      throw new Error("Invalid token payload");
    }

    if (!decoded.type || decoded.type !== type) {
      throw new Error("Token type mismatch");
    }

    if (!decoded.sub) {
      throw new Error("Token subject (sub) is missing");
    }

    return decoded;
  } catch (err) {
    const error = err as VerifyErrors | Error;
    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.error("JWT verification error:", error);
    }
    throw new Error("Invalid or expired token");
  }
}

export function decodeToken(token: string): DecodedToken | null {
  try {
    const decoded = jwt.decode(token) as DecodedToken | null;
    if (!decoded || typeof decoded !== "object") {
      return null;
    }
    if (!decoded.sub || !decoded.type) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const decoded = jwt.decode(token) as JwtPayload | null;
  if (!decoded || typeof decoded !== "object" || !decoded.exp) {
    return true;
  }
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return decoded.exp < nowInSeconds;
}

export function getTokenSubject(token: string): string | null {
  const decoded = jwt.decode(token) as JwtPayload | null;
  if (!decoded || typeof decoded !== "object" || !decoded.sub) {
    return null;
  }
  return decoded.sub;
}

export function tryVerifyToken(token: string, type: TokenType): DecodedToken | null {
  try {
    return verifyToken(token, type);
  } catch {
    return null;
  }
}
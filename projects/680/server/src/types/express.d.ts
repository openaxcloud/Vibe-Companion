import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface AuthUserClaims extends JwtPayload {
      userId: string;
      email?: string;
      roles?: string[];
      permissions?: string[];
      iat?: number;
      exp?: number;
      iss?: string;
      sub?: string;
      aud?: string | string[];
      [key: string]: unknown;
    }

    interface Request {
      user?: AuthUserClaims;
    }
  }
}

export {};
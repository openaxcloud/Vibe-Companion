import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface UserPayload extends JwtPayload {
      id: string;
      sub?: string;
      email?: string;
      roles?: string[];
      permissions?: string[];
      iat?: number;
      exp?: number;
      [key: string]: unknown;
    }

    interface Request {
      user?: UserPayload | null;
      authToken?: string | null;
    }
  }
}

export {};
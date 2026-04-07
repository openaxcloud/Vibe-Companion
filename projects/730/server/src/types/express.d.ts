import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface AuthUserPayload extends JwtPayload {
      sub: string;
      email?: string;
      roles?: string[];
      permissions?: string[];
      iat?: number;
      exp?: number;
      [key: string]: unknown;
    }

    interface Request {
      /**
       * Authenticated user payload attached by authentication middleware.
       * Will be defined for routes that require authentication and have
       * successfully validated a JWT or other auth mechanism.
       */
      user?: AuthUserPayload | null;
    }
  }
}

export {};
import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface AuthUserPayload extends JwtPayload {
      id: string;
      email: string;
      roles?: string[];
      permissions?: string[];
    }

    interface Request {
      user?: AuthUserPayload | null;
      correlationId?: string;
      requestId?: string;
    }
  }
}

export {};
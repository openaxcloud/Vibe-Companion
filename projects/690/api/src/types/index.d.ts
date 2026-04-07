import { JwtPayload } from "jsonwebtoken";

export type UserRole = "ADMIN" | "USER" | "MODERATOR" | "SYSTEM";

export interface AuthUserPayload extends JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  issuedAt: number;
  tenantId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload | null;
    }
  }
}

export {};
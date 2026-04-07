import type { Role } from "../auth/roles";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      role?: Role | string;
      isAuthenticated?: boolean;
    }
  }
}

export {};
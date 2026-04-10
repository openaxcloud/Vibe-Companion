/**
 * Type augmentation for Express Request
 * Adds proper typing for req.user after Passport authentication
 * User type extends the full database User schema
 */

import type { User as DBUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends DBUser {}
  }
}

export {};

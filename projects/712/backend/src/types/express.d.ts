import type { User } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      /**
       * The full authenticated user object, if loaded by authentication middleware.
       * May be undefined if the route does not require authentication or the user
       * has not been attached to the request.
       */
      user?: User | null;

      /**
       * The authenticated user's ID, typically set by authentication middleware.
       * Prefer using this over `user.id` in cases where only the ID is required
       * and the full user object has not been loaded.
       */
      userId?: string | null;
    }
  }
}

export {};
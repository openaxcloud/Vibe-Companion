import { User } from '../models/User';

declare global {
  namespace Express {
    // Extend built-in Request interface
    interface Request {
      /**
       * Authenticated user populated by authentication middleware.
       * It can be undefined when the request is unauthenticated or
       * before the auth middleware has been executed.
       */
      user?: User | null;
    }
  }
}

export {};
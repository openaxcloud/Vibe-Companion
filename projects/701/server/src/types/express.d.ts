import { JwtUserPayload } from '../auth/types';

declare global {
  namespace Express {
    interface User extends JwtUserPayload {}

    interface Request {
      /**
       * The authenticated user, if present.
       * This is populated by authentication middleware after successful verification.
       */
      user?: User;
    }
  }
}

export {};
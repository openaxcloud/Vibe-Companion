import { JwtPayload } from "jsonwebtoken";
import { User as PrismaUser } from "@prisma/client";

declare global {
  namespace AppTypes {
    export type Role = "ADMIN" | "STAFF" | "CUSTOMER";

    export enum OrderStatus {
      PENDING = "PENDING",
      PROCESSING = "PROCESSING",
      SHIPPED = "SHIPPED",
      DELIVERED = "DELIVERED",
      CANCELLED = "CANCELLED",
      RETURNED = "RETURNED",
    }

    export interface AuthTokenPayload extends JwtPayload {
      userId: string;
      role: Role;
      email?: string;
    }

    export interface AuthenticatedUser extends PrismaUser {
      role: Role;
    }
  }

  namespace Express {
    export interface Request {
      user?: AppTypes.AuthenticatedUser | null;
      authTokenPayload?: AppTypes.AuthTokenPayload | null;
    }
  }
}

export {};
import type { UserRole } from '../constants/roles';

declare global {
  namespace Express {
    interface PaginationMeta {
      page: number;
      pageSize: number;
      totalItems?: number;
      totalPages?: number;
      hasNextPage?: boolean;
      hasPrevPage?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }

    interface AuthUser {
      id: string;
      email: string;
      role: UserRole;
      isEmailVerified: boolean;
      createdAt: Date;
      updatedAt: Date;
      [key: string]: unknown;
    }

    interface RequestContext {
      requestId?: string;
      ipAddress?: string;
      userAgent?: string;
      locale?: string;
      [key: string]: unknown;
    }

    interface Request {
      user?: AuthUser | null;
      authUser?: AuthUser | null;
      pagination?: PaginationMeta;
      context?: RequestContext;
      traceId?: string;
      correlationId?: string;
      rawBody?: string | Buffer;
      [key: string]: unknown;
    }
  }
}

export {};
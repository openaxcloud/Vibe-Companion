import type { Request } from "express";

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email: string;
      role: UserRole;
      createdAt: string;
      updatedAt: string;
    }

    interface Request {
      user?: AuthUser;
      requestId?: string;
      metadata?: RequestMetadata;
    }
  }
}

export type UserRole = "user" | "admin" | "system";

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    correlationId?: string;
  };
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: PaginationMeta | Record<string, unknown>;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ErrorResponse;

export interface RequestMetadata {
  ip: string;
  userAgent?: string;
  requestId?: string;
  receivedAt: string;
}

export interface UserDTO {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  role?: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserDTO;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenPayload {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface HealthCheckResponse {
  status: "ok";
  uptime: number;
  timestamp: string;
  version?: string;
}

export interface IdParam {
  id: string;
}

export interface ListQuery extends PaginationQuery {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

export type TypedRequest<TBody = unknown, TParams = Record<string, string>, TQuery = Record<string, unknown>> = Request<
  TParams,
  any,
  TBody,
  TQuery
>;
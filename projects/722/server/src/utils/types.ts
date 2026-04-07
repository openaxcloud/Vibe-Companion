/* eslint-disable @typescript-eslint/no-explicit-any */

import { ZodTypeAny } from "zod";

/**
 * Core utility types
 */

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;
export type Primitive = string | number | boolean | symbol | bigint | null | undefined;
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends ReadonlyArray<infer U2>
    ? ReadonlyArray<DeepPartial<U2>>
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (...args: any[]) => any
    ? T[P]
    : T[P] extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

export type ValuesOf<T> = T[keyof T];

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Id = Brand<string, "Id">;
export type EntityId = Id;

export type Timestamp = Brand<string, "TimestampISO8601">;

/**
 * Generic result types
 */

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
}

/**
 * Error / Result modeling
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_SERVER_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export interface FieldValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface AppErrorShape {
  code: ErrorCode;
  message: string;
  details?: string;
  fields?: FieldValidationError[];
  meta?: Record<string, unknown>;
}

export type ResultOk<T> = {
  ok: true;
  data: T;
};

export type ResultErr<E = AppErrorShape> = {
  ok: false;
  error: E;
};

export type Result<T, E = AppErrorShape> = ResultOk<T> | ResultErr<E>;

/**
 * Domain base entities
 */

export interface BaseEntity {
  id: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SoftDeletableEntity extends BaseEntity {
  deletedAt: Nullable<Timestamp>;
}

/**
 * User domain types
 */

export type UserRole = "user" | "admin" | "system";

export interface User extends SoftDeletableEntity {
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Nullable<Timestamp>;
}

export interface NewUserDTO {
  email: string;
  displayName: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserDTO {
  email?: string;
  displayName?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * Auth types
 */

export interface AuthTokenPayload {
  sub: EntityId;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequestDTO {
  email: string;
  password: string;
}

export interface LoginResponseDTO {
  user: User;
  tokens: AuthTokens;
}

export interface RefreshTokenRequestDTO {
  refreshToken: string;
}

export interface RefreshTokenResponseDTO {
  tokens: AuthTokens;
}

/**
 * Common HTTP / API types
 */

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface SortingQuery {
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface BaseQuery extends PaginationQuery, SortingQuery {
  search?: string;
}

export interface ApiRequestContext<UserType = User> {
  user?: UserType;
  requestId: string;
  ip?: string;
  userAgent?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: AppErrorShape;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * DTO factory helpers
 */

export interface DtoSchema<T> {
  in: ZodTypeAny;
  out?: ZodTypeAny;
  type?: T;
}

export interface CrudDtoSet<Entity, CreateDTO, UpdateDTO, QueryDTO = BaseQuery> {
  entity: DtoSchema<Entity>;
  listQuery?: DtoSchema<QueryDTO>;
  create: DtoSchema<CreateDTO>;
  update: DtoSchema<UpdateDTO>;
}

/**
 * Service and repository contracts
 */

export interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
}

export interface BaseRepository<EntityType, CreateDTO, UpdateDTO> {
  findById(id: EntityId): Promise<Nullable<EntityType>>;
  findMany(options?: FindOptions): Promise<EntityType[]>;
  count(options?: FindOptions): Promise<number>;
  create(data: CreateDTO): Promise<EntityType>;
  update(id: EntityId, data: UpdateDTO): Promise<Nullable<EntityType>>;
  delete(id: EntityId): Promise<boolean>;
}

export interface BaseService<EntityType, CreateDTO, UpdateDTO, QueryDTO = BaseQuery> {
  getById(id: EntityId, ctx?: ApiRequestContext): Promise<Result<EntityType>>;
  list(query: QueryDTO, ctx?: ApiRequestContext): Promise<Result<PaginatedResult<EntityType>>>;
  create(data: CreateDTO, ctx?: ApiRequestContext): Promise<Result<EntityType>>;
  update(id: EntityId, data: UpdateDTO, ctx?: ApiRequestContext): Promise<Result<EntityType>>;
  remove(id: EntityId, ctx?: ApiRequestContext): Promise<Result<{ id: EntityId }>>;
}

/**
 * Eventing / messaging
 */

export type DomainEventType =
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "auth.login"
  | "auth.logout"
  | "system.health_check";

export interface DomainEvent<TPayload = any> {
  id: EntityId;
  type: DomainEventType | string;
  payload: TPayload;
  occurredAt: Timestamp;
  correlationId?: string;
  causedByUserId?: EntityId;
}

/**
 * Logging
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  requestId?: string;
  userId?: EntityId;
  ip?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Timestamp;
  context?: LogContext;
  error?: Error | AppErrorShape;
}

/**
 * Config types
 */

export interface ServerConfig {
  port: number;
  env: "development" | "test" | "staging" | "production";
  logLevel: LogLevel;
  corsOrigins: string[];
}

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  ssl: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
}

export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
}

/**
 * Utility guards
 */

export const isResultOk = <T, E = AppErrorShape>(result: Result<T, E>): result is ResultOk<T> =>
  result.ok === true;

export const isResultErr = <T, E = AppErrorShape>(result: Result<T, E>): result is ResultErr<E> =>
  result.ok === false;
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'archived';

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: number;
  createdAt: string;
  updatedAt: string;
  dueDate?: string | null;
  tags?: string[];
  assigneeId?: string | null;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ApiErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

export interface ApiErrorShape {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: ApiErrorDetail[];
  };
}

export interface ApiSuccessShape<T> {
  success: true;
  data: T;
  meta?: PaginatedMeta;
}

export type ApiResponse<T> = ApiSuccessShape<T> | ApiErrorShape;

export interface TaskCreateInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: number;
  dueDate?: string | null;
  tags?: string[];
  assigneeId?: string | null;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: number;
  dueDate?: string | null;
  tags?: string[];
  assigneeId?: string | null;
}

export interface TaskQueryFilters {
  search?: string;
  status?: TaskStatus;
  assigneeId?: string;
  tag?: string;
  minPriority?: number;
  maxPriority?: number;
  dueBefore?: string;
  dueAfter?: string;
}

export interface PaginatedQueryParams {
  page?: number;
  pageSize?: number;
}

export interface TaskListQueryParams extends TaskQueryFilters, PaginatedQueryParams {
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface ErrorWithStatus extends Error {
  statusCode?: number;
  code?: string;
  details?: ApiErrorDetail[];
}

export type Nullable<T> = T | null;

export type WithId<T> = T & { id: string };

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
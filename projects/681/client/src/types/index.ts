export type ISODateString = string;
export type UUID = string;

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedRequest {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskDto {
  id: UUID;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateTaskDto {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: ISODateString | null;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: ISODateString | null;
}

export interface TaskListQueryDto extends PaginatedRequest {
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface TaskListResponseDto extends PaginatedResponse<TaskDto> {}

export interface GetTaskResponseDto {
  data: TaskDto;
}

export interface CreateTaskResponseDto {
  data: TaskDto;
}

export interface UpdateTaskResponseDto {
  data: TaskDto;
}

export interface DeleteTaskResponseDto {
  success: boolean;
}

export interface ApiSuccessResponse<T> {
  data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiError;

export const isApiError = (response: unknown): response is ApiError => {
  if (!response || typeof response !== 'object') return false;
  const r = response as ApiError;
  return typeof r.message === 'string';
};

export const isPaginatedResponse = <T>(
  response: unknown
): response is PaginatedResponse<T> => {
  if (!response || typeof response !== 'object') return false;
  const r = response as PaginatedResponse<T>;
  return (
    Array.isArray(r.data) &&
    typeof r.page === 'number' &&
    typeof r.limit === 'number' &&
    typeof r.total === 'number' &&
    typeof r.totalPages === 'number'
  );
};

export const isTaskDto = (value: unknown): value is TaskDto => {
  if (!value || typeof value !== 'object') return false;
  const v = value as TaskDto;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.status === 'string' &&
    typeof v.priority === 'string' &&
    typeof v.createdAt === 'string' &&
    typeof v.updatedAt === 'string'
  );
};

export const isTaskListResponseDto = (
  value: unknown
): value is TaskListResponseDto => isPaginatedResponse<TaskDto>(value);

export const TASK_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'done',
  'archived',
];

export const TASK_PRIORITIES: TaskPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
];
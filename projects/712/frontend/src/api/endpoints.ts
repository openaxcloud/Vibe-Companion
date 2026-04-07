import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export interface ApiErrorPayload {
  message: string;
  code?: string;
  details?: unknown;
}

export class ApiError extends Error {
  public status?: number;
  public code?: string;
  public details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  user: User;
  tokens: AuthTokens;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

export interface ProjectSummary extends Project {
  boardsCount: number;
  membersCount: number;
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";

export interface Task {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  assigneeId?: string | null;
  estimateMinutes?: number | null;
  spentMinutes: number;
  dueDate?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimeLog {
  id: string;
  taskId: string;
  userId: string;
  minutes: number;
  comment?: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FetchProjectsParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
}

export interface CreateBoardRequest {
  projectId: string;
  name: string;
  description?: string;
}

export interface UpdateBoardRequest {
  name?: string;
  description?: string | null;
}

export interface CreateTaskRequest {
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  assigneeId?: string | null;
  estimateMinutes?: number | null;
  dueDate?: string | null;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assigneeId?: string | null;
  estimateMinutes?: number | null;
  dueDate?: string | null;
  columnId?: string;
  position?: number;
}

export interface LogTimeRequest {
  taskId: string;
  minutes: number;
  comment?: string;
}

export interface BoardWithColumnsAndTasks extends Board {
  columns: Column[];
  tasks: Task[];
}

let apiClient: AxiosInstance | null = null;

const createApiClient = (): AxiosInstance => {
  if (apiClient) return apiClient;

  const instance = axios.create({
    baseURL: "/api",
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
    },
  });

  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError<ApiErrorPayload>) => {
      const status = error.response?.status;
      const payload = error.response?.data;

      const message =
        payload?.message ||
        error.message ||
        "An unexpected error occurred while communicating with the server.";

      const apiError = new ApiError(message, status, payload?.code, payload?.details);

      return Promise.reject(apiError);
    }
  );

  apiClient = instance;
  return instance;
};

const client = (): AxiosInstance => createApiClient();

export const login = async (data: LoginRequest, config?: AxiosRequestConfig): Promise<LoginResponse> => {
  const response = await client().post<LoginResponse>("/auth/login", data, config);
  return response.data;
};

export const register = async (
  data: RegisterRequest,
  config?: AxiosRequestConfig
): Promise<RegisterResponse> => {
  const response = await client().post<RegisterResponse>("/auth/register", data, config);
  return response.data;
};

export const logout = async (config?: AxiosRequestConfig): Promise<void> => {
  await client().post("/auth/logout", undefined, config);
};

export const refreshToken = async (config?: AxiosRequestConfig): Promise<AuthTokens> => {
  const response = await client().post<AuthTokens>("/auth/refresh", undefined, config);
  return response.data;
};

export const getCurrentUser = async (config?: AxiosRequestConfig): Promise<User> => {
  const response = await client().get<User>("/auth/me", config);
  return response.data;
};

export const fetchProjects = async (
  params: FetchProjectsParams = {},
  config?: AxiosRequestConfig
): Promise<PaginatedResponse<ProjectSummary>> => {
  const response = await client().get<PaginatedResponse<ProjectSummary>>("/projects", {
    ...config,
    params,
  });
  return response.data;
};

export const getProject = async (projectId: string, config?: AxiosRequestConfig): Promise<Project> => {
  const response = await client().get<Project>(`/projects/undefined`, config);
  return response.data;
};

export const createProject = async (
  data: CreateProjectRequest,
  config?: AxiosRequestConfig
): Promise<Project> => {
  const response = await client().post<Project>("/projects", data, config);
  return response.data;
};

export const updateProject = async (
  projectId: string,
  data: UpdateProjectRequest,
  config?: AxiosRequestConfig
): Promise<Project> => {
  const response = await client().patch<Project>(
    `/projects/undefined`,
    data,
    config
  );
  return response.data;
};

export const deleteProject = async (projectId: string, config?: AxiosRequestConfig): Promise<void> => {
  await client().delete(`/projects/undefined`, config);
};

export const fetchBoardsByProject = async (
  projectId: string,
  config?: AxiosRequestConfig
): Promise<Board[]> => {
  const response = await client().get<Board[]>(
    `/projects/undefined/boards`,
    config
  );
  return response.data;
};

export const getBoard = async (
  boardId: string,
  config?: AxiosRequestConfig
): Promise<BoardWithColumnsAndTasks> => {
  const response = await client().get<BoardWithColumnsAndTasks>(
    `/boards/undefined`,
    config
  );
  return response.data;
};

export const createBoard = async (
  data: CreateBoardRequest,
  config?: AxiosRequestConfig
): Promise<Board> => {
  const response = await client().post<Board>("/boards", data, config);
  return response.data;
};

export const updateBoard = async (
  boardId: string,
  data: UpdateBoardRequest,
  config?: AxiosRequestConfig
): Promise<Board> => {
  const response = await client().patch<Board>(
    `/boards/undefined`,
    data,
    config
  );
  return response.data;
};

export const deleteBoard = async (boardId: string, config?: AxiosRequestConfig): Promise<void> => {
  await client().delete(`/boards/undefined`, config);
};

export const createTask = async (
  data: CreateTaskRequest,
  config?: AxiosRequestConfig
): Promise<Task> => {
  const response = await client().post<Task>("/tasks", data, config);
  return response.data;
};

export const getTask = async (taskId: string, config?: AxiosRequestConfig): Promise<Task> => {
  const response = await client().get<Task>(`/tasks/undefined`, config);
  return response.data;
};

export const updateTask = async (
  taskId: string,
  data: UpdateTaskRequest,
  config?: AxiosRequestConfig
): Promise<Task> => {
  const response = await client().patch<Task>(
    `/tasks/undefined`,
    data,
    config
  );
  return response.data;
};

export const deleteTask = async (taskId: string,
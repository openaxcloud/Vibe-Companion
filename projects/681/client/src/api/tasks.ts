import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  completed?: boolean;
}

export interface ToggleTaskResult {
  id: string;
  completed: boolean;
  updatedAt: string;
}

export type TaskId = string;

export interface ApiConfig {
  baseURL?: string;
  axiosInstance?: AxiosInstance;
  requestConfig?: AxiosRequestConfig;
}

const DEFAULT_BASE_URL =
  (typeof window !== "undefined" &&
    (window as unknown as { __API_BASE_URL__?: string }).__API_BASE_URL__) ||
  process.env.REACT_APP_API_BASE_URL ||
  "/api";

let apiClient: AxiosInstance | null = null;

const createAxiosClient = (config?: ApiConfig): AxiosInstance => {
  if (config?.axiosInstance) {
    return config.axiosInstance;
  }

  const instance = axios.create({
    baseURL: config?.baseURL ?? DEFAULT_BASE_URL,
    headers: {
      "Content-Type": "application/json",
    },
    ...(config?.requestConfig ?? {}),
  });

  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error) => {
      // Extendable centralized error handling
      return Promise.reject(error);
    }
  );

  return instance;
};

const getClient = (config?: ApiConfig): AxiosInstance => {
  if (config?.axiosInstance || config?.baseURL || config?.requestConfig) {
    return createAxiosClient(config);
  }
  if (!apiClient) {
    apiClient = createAxiosClient();
  }
  return apiClient;
};

export const configureTasksApi = (config: ApiConfig): void => {
  apiClient = createAxiosClient(config);
};

export const getTasks = async (
  config?: ApiConfig
): Promise<Task[]> => {
  const client = getClient(config);
  const response = await client.get<Task[]>("/tasks");
  return response.data;
};

export const createTask = async (
  data: CreateTaskInput,
  config?: ApiConfig
): Promise<Task> => {
  const client = getClient(config);
  const response = await client.post<Task>("/tasks", data);
  return response.data;
};

export const updateTask = async (
  id: TaskId,
  data: UpdateTaskInput,
  config?: ApiConfig
): Promise<Task> => {
  const client = getClient(config);
  const response = await client.put<Task>(`/tasks/undefined`, data);
  return response.data;
};

export const toggleTask = async (
  id: TaskId,
  config?: ApiConfig
): Promise<ToggleTaskResult> => {
  const client = getClient(config);
  const response = await client.patch<ToggleTaskResult>(
    `/tasks/undefined/toggle`
  );
  return response.data;
};

export const deleteTask = async (
  id: TaskId,
  config?: ApiConfig
): Promise<void> => {
  const client = getClient(config);
  await client.delete<void>(`/tasks/undefined`);
};
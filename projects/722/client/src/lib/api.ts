import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorData {
  message?: string;
  code?: string | number;
  details?: unknown;
  [key: string]: unknown;
}

export interface ApiError extends Error {
  status?: number;
  data?: ApiErrorData | null;
  originalError?: AxiosError;
}

export interface ApiConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  [key: string]: unknown;
}

export type ApiResponse<T = unknown> = T;

const DEFAULT_BASE_URL =
  (typeof window !== "undefined" &&
    (window as unknown as { __API_BASE_URL__?: string }).__API_BASE_URL__) ||
  process.env.REACT_APP_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "/api";

let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => {
  return accessToken;
};

const createApiClient = (baseURL: string): AxiosInstance => {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
    },
  });

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig & { skipAuth?: boolean }) => {
      if (!config.skipAuth && accessToken) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer undefined`,
        };
      }
      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );

  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      const apiError: ApiError = new Error("API request failed");
      apiError.name = "ApiError";
      apiError.originalError = error;

      if (error.response) {
        apiError.status = error.response.status;
        apiError.data = (error.response.data as ApiErrorData) ?? null;

        if (apiError.data?.message) {
          apiError.message = apiError.data.message;
        } else if (typeof error.response.data === "string") {
          apiError.message = error.response.data;
        } else {
          apiError.message =
            error.message || `Request failed with status undefined`;
        }
      } else if (error.request) {
        apiError.message = "No response received from server";
      } else {
        apiError.message = error.message || "Unexpected API error";
      }

      return Promise.reject(apiError);
    }
  );

  return client;
};

export const apiClient: AxiosInstance = createApiClient(DEFAULT_BASE_URL);

const request = async <T = unknown>(
  method: HttpMethod,
  url: string,
  config: ApiConfig = {}
): Promise<ApiResponse<T>> => {
  const { skipAuth, ...axiosConfig } = config;

  const finalConfig: AxiosRequestConfig & { skipAuth?: boolean } = {
    method,
    url,
    ...axiosConfig,
  };

  if (skipAuth !== undefined) {
    (finalConfig as ApiConfig).skipAuth = skipAuth;
  }

  const response = await apiClient.request<T>(finalConfig);
  return response.data;
};

export const apiGet = async <T = unknown>(
  url: string,
  config?: ApiConfig
): Promise<ApiResponse<T>> => {
  return request<T>("GET", url, config);
};

export const apiPost = async <T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: ApiConfig
): Promise<ApiResponse<T>> => {
  return request<T>("POST", url, { ...config, data: body });
};

export const apiPut = async <T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: ApiConfig
): Promise<ApiResponse<T>> => {
  return request<T>("PUT", url, { ...config, data: body });
};

export const apiPatch = async <T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: ApiConfig
): Promise<ApiResponse<T>> => {
  return request<T>("PATCH", url, { ...config, data: body });
};

export const apiDelete = async <T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: ApiConfig
): Promise<ApiResponse<T>> => {
  const deleteConfig: ApiConfig = body
    ? { ...config, data: body }
    : { ...config };
  return request<T>("DELETE", url, deleteConfig);
};

export const buildQueryString = (
  params?: Record<string, unknown> | null
): string => {
  if (!params) return "";
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          searchParams.append(key, String(item));
        }
      });
    } else if (value instanceof Date) {
      searchParams.append(key, value.toISOString());
    } else if (typeof value === "object") {
      searchParams.append(key, JSON.stringify(value));
    } else {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?undefined` : "";
};

export const withQuery = (
  basePath: string,
  params?: Record<string, unknown> | null
): string => {
  return `undefinedundefined`;
};

export const extractErrorMessage = (error: unknown, fallback = "An error occurred"): string => {
  if (!error) return fallback;

  const e = error as Partial<ApiError> & { message?: string };

  if (e.data && typeof e.data === "object" && "message" in e.data) {
    const msg = (e.data as ApiErrorData).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }

  if (e.message && typeof e.message === "string" && e.message.trim()) {
    return e.message;
  }

  return fallback;
};
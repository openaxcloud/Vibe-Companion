import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from "axios";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorResponse {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly originalError?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown, originalError?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.originalError = originalError;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiClientConfig {
  baseURL?: string;
  withCredentials?: boolean;
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  onUnauthorized?: (error: ApiError) => void;
  onForbidden?: (error: ApiError) => void;
  onError?: (error: ApiError) => void;
}

export interface TypedAxiosRequestConfig<D = any> extends AxiosRequestConfig<D> {
  skipAuth?: boolean;
}

export type ApiResponse<T = unknown> = AxiosResponse<T>;

const DEFAULT_BASE_URL =
  typeof window !== "undefined"
    ? (window as any).__API_BASE_URL__ || "/api"
    : process.env.API_BASE_URL || "/api";

let accessTokenProvider: ApiClientConfig["getAccessToken"] = undefined;
let unauthorizedHandler: ApiClientConfig["onUnauthorized"] = undefined;
let forbiddenHandler: ApiClientConfig["onForbidden"] = undefined;
let genericErrorHandler: ApiClientConfig["onError"] = undefined;

const client: AxiosInstance = axios.create({
  baseURL: DEFAULT_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const typedConfig = config as InternalAxiosRequestConfig & { skipAuth?: boolean };

    if (!typedConfig.skipAuth && accessTokenProvider) {
      try {
        const token = await accessTokenProvider();
        if (token) {
          typedConfig.headers = {
            ...typedConfig.headers,
            Authorization: `Bearer undefined`
          };
        }
      } catch {
        // Silently ignore token retrieval failures; request proceeds without auth header.
      }
    }

    return typedConfig;
  },
  (error: AxiosError) => Promise.reject(error)
);

client.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const status = error.response?.status ?? 0;

    const apiError = new ApiError(
      extractErrorMessage(error),
      status,
      extractErrorCode(error),
      error.response?.data,
      error
    );

    if (status === 401 && unauthorizedHandler) {
      unauthorizedHandler(apiError);
    } else if (status === 403 && forbiddenHandler) {
      forbiddenHandler(apiError);
    } else if (genericErrorHandler) {
      genericErrorHandler(apiError);
    }

    return Promise.reject(apiError);
  }
);

function extractErrorMessage(error: AxiosError): string {
  if (error.response?.data && typeof error.response.data === "object") {
    const data = error.response.data as any;
    if (typeof data.message === "string") return data.message;
    if (typeof data.error === "string") return data.error;
  }

  if (error.message) return error.message;

  return "An unknown error occurred while communicating with the server.";
}

function extractErrorCode(error: AxiosError): string | undefined {
  if (error.response?.data && typeof error.response.data === "object") {
    const data = error.response.data as any;
    if (typeof data.code === "string") return data.code;
    if (typeof data.errorCode === "string") return data.errorCode;
  }
  return undefined;
}

export function configureApiClient(config: ApiClientConfig): void {
  if (config.baseURL) {
    client.defaults.baseURL = config.baseURL;
  }

  if (typeof config.withCredentials === "boolean") {
    client.defaults.withCredentials = config.withCredentials;
  }

  if (config.getAccessToken) {
    accessTokenProvider = config.getAccessToken;
  }

  if (config.onUnauthorized) {
    unauthorizedHandler = config.onUnauthorized;
  }

  if (config.onForbidden) {
    forbiddenHandler = config.onForbidden;
  }

  if (config.onError) {
    genericErrorHandler = config.onError;
  }
}

export async function get<T = unknown>(
  url: string,
  config?: TypedAxiosRequestConfig
): Promise<ApiResponse<T>> {
  return client.get<T>(url, config);
}

export async function post<T = unknown, D = unknown>(
  url: string,
  data?: D,
  config?: TypedAxiosRequestConfig<D>
): Promise<ApiResponse<T>> {
  return client.post<T>(url, data, config);
}

export async function put<T = unknown, D = unknown>(
  url: string,
  data?: D,
  config?: TypedAxiosRequestConfig<D>
): Promise<ApiResponse<T>> {
  return client.put<T>(url, data, config);
}

export async function patch<T = unknown, D = unknown>(
  url: string,
  data?: D,
  config?: TypedAxiosRequestConfig<D>
): Promise<ApiResponse<T>> {
  return client.patch<T>(url, data, config);
}

export async function del<T = unknown>(
  url: string,
  config?: TypedAxiosRequestConfig
): Promise<ApiResponse<T>> {
  return client.delete<T>(url, config);
}

export interface RequestOptions<D = unknown> extends TypedAxiosRequestConfig<D> {
  method?: HttpMethod;
}

export async function request<T = unknown, D = unknown>(
  url: string,
  options: RequestOptions<D> = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", ...config } = options;
  const upperMethod = method.toUpperCase() as HttpMethod;

  switch (upperMethod) {
    case "GET":
      return client.get<T>(url, config);
    case "POST":
      return client.post<T>(url, config.data as D, config);
    case "PUT":
      return client.put<T>(url, config.data as D, config);
    case "PATCH":
      return client.patch<T>(url, config.data as D, config);
    case "DELETE":
      return client.delete<T>(url, config);
    default:
      throw new Error(`Unsupported HTTP method: undefined`);
  }
}

export { client as apiClient };
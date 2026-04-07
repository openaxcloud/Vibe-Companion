import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';

export interface ApiErrorResponse {
  message: string;
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<TBody = unknown> {
  params?: Record<string, unknown>;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ApiConfig {
  baseURL?: string;
  getAccessToken?: () => string | null | undefined;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
  onError?: (error: ApiErrorResponse) => void;
}

const DEFAULT_TIMEOUT = 15000;

let accessTokenProvider: (() => string | null | undefined) | undefined;
let unauthorizedHandler: (() => void) | undefined;
let forbiddenHandler: (() => void) | undefined;
let globalErrorHandler: ((error: ApiErrorResponse) => void) | undefined;

const apiBaseURL =
  (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) ||
  process.env.REACT_APP_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  '/api';

const axiosInstance: AxiosInstance = axios.create({
  baseURL: apiBaseURL,
  timeout: DEFAULT_TIMEOUT,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const configureApi = (config: ApiConfig): void => {
  if (config.baseURL) {
    axiosInstance.defaults.baseURL = config.baseURL;
  }

  accessTokenProvider = config.getAccessToken;
  unauthorizedHandler = config.onUnauthorized;
  forbiddenHandler = config.onForbidden;
  globalErrorHandler = config.onError;
};

const attachAuthToken = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  if (!accessTokenProvider) return config;

  const token = accessTokenProvider();
  if (token) {
    config.headers = config.headers ?? {};
    if (!('Authorization' in config.headers)) {
      config.headers.Authorization = `Bearer undefined`;
    }
  }

  return config;
};

const normalizeError = (error: AxiosError): ApiErrorResponse => {
  if (error.response) {
    const { status, data } = error.response;
    const base: ApiErrorResponse = {
      message: 'An unexpected error occurred',
      statusCode: status
    };

    if (data && typeof data === 'object') {
      const maybeMessage =
        (data as any).message ||
        (Array.isArray((data as any).errors) &&
          (data as any).errors[0]?.message);
      const maybeCode = (data as any).code;

      return {
        ...base,
        message: typeof maybeMessage === 'string' ? maybeMessage : base.message,
        code: typeof maybeCode === 'string' ? maybeCode : undefined,
        details: data
      };
    }

    return base;
  }

  if (error.request) {
    return {
      message: 'No response received from server. Please check your connection.',
      code: 'NETWORK_ERROR'
    };
  }

  return {
    message: error.message || 'Request setup failed.',
    code: 'REQUEST_SETUP_ERROR'
  };
};

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => attachAuthToken(config),
  (error: AxiosError) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const normalized = normalizeError(error);

    if (error.response) {
      if (error.response.status === 401 && unauthorizedHandler) {
        unauthorizedHandler();
      }

      if (error.response.status === 403 && forbiddenHandler) {
        forbiddenHandler();
      }
    }

    if (globalErrorHandler) {
      globalErrorHandler(normalized);
    }

    return Promise.reject(normalized);
  }
);

const buildConfig = <TBody = unknown>(
  method: HttpMethod,
  url: string,
  options: RequestOptions<TBody> = {}
): AxiosRequestConfig => {
  const { params, body, headers, signal } = options;

  const config: AxiosRequestConfig = {
    url,
    method,
    params,
    headers: {
      ...headers
    }
  };

  if (signal) {
    config.signal = signal;
  }

  if (body !== undefined && method !== 'GET') {
    config.data = body;
  }

  return config;
};

const request = async <TResponse = unknown, TBody = unknown>(
  method: HttpMethod,
  url: string,
  options: RequestOptions<TBody> = {}
): Promise<TResponse> => {
  const config = buildConfig(method, url, options);
  const response = await axiosInstance.request<TResponse>(config);
  return response.data;
};

export const api = {
  get: <TResponse = unknown>(
    url: string,
    options?: RequestOptions
  ): Promise<TResponse> => request<TResponse>('GET', url, options),

  post: <TResponse = unknown, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'body'>
  ): Promise<TResponse> =>
    request<TResponse, TBody>('POST', url, { ...(options || {}), body }),

  put: <TResponse = unknown, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'body'>
  ): Promise<TResponse> =>
    request<TResponse, TBody>('PUT', url, { ...(options || {}), body }),

  patch: <TResponse = unknown, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, 'body'>
  ): Promise<TResponse> =>
    request<TResponse, TBody>('PATCH', url, { ...(options || {}), body }),

  delete: <TResponse = unknown, TBody = unknown>(
    url: string,
    options?: RequestOptions<TBody>
  ): Promise<TResponse> => request<TResponse, TBody>('DELETE', url, options)
};

export const apiClient = axiosInstance;

export default api;
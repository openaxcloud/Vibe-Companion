import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios';

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

type HttpMethod = 'get' | 'post' | 'put' | 'delete';

const getBaseURL = (): string => {
  if (typeof window !== 'undefined') {
    // Browser environment
    return (
      (window as unknown as { __APP_API_BASE_URL__?: string })
        .__APP_API_BASE_URL__ ||
      import.meta.env.VITE_API_BASE_URL ||
      process.env.VITE_API_BASE_URL ||
      '/api'
    );
  }

  // SSR / Node environment
  return (
    process.env.VITE_API_BASE_URL ||
    process.env.API_BASE_URL ||
    'http://localhost:3000/api'
  );
};

const createApiError = (error: AxiosError): ApiError => {
  const apiError: ApiError = new Error('Request failed');
  apiError.name = 'ApiError';

  if (error.response) {
    apiError.status = error.response.status;
    apiError.data = (error.response.data ?? null) as ApiErrorData | null;
    apiError.message =
      (apiError.data && (apiError.data.message as string)) ||
      error.message ||
      `Request failed with status code undefined`;
  } else if (error.request) {
    apiError.message = 'Network error or no response received from server';
  } else {
    apiError.message = error.message || 'Unexpected error occurred';
  }

  apiError.originalError = error;
  return apiError;
};

const api: AxiosInstance = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

let accessTokenProvider: (() => string | null | undefined) | null = null;

export const setAccessTokenProvider = (
  provider: () => string | null | undefined
): void => {
  accessTokenProvider = provider;
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig & { skipAuth?: boolean }) => {
    const skipAuth = config.skipAuth ?? (config as unknown as ApiConfig).skipAuth;
    if (!skipAuth && accessTokenProvider) {
      const token = accessTokenProvider();
      if (token) {
        config.headers = {
          ...(config.headers || {}),
          Authorization: `Bearer undefined`
        };
      }
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.config && (error.config as ApiConfig).skipAuth) {
      return Promise.reject(error);
    }

    const apiError = createApiError(error);
    return Promise.reject(apiError);
  }
);

const request = async <T = unknown>(
  method: HttpMethod,
  url: string,
  data?: unknown,
  config: ApiConfig = {}
): Promise<T> => {
  const requestConfig: ApiConfig = {
    method,
    url,
    ...config
  };

  if (method === 'get' || method === 'delete') {
    requestConfig.params = data;
  } else {
    requestConfig.data = data;
  }

  const response = await api.request<T>(requestConfig);
  return response.data;
};

export const get = async <T = unknown>(
  url: string,
  params?: unknown,
  config?: ApiConfig
): Promise<T> => request<T>('get', url, params, config);

export const post = async <T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: ApiConfig
): Promise<T> => request<T>('post', url, body, config);

export const put = async <T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: ApiConfig
): Promise<T> => request<T>('put', url, body, config);

export const del = async <T = unknown>(
  url: string,
  paramsOrBody?: unknown,
  config?: ApiConfig
): Promise<T> => request<T>('delete', url, paramsOrBody, config);

export const rawApiInstance = api;

export default {
  get,
  post,
  put,
  delete: del,
  instance: api,
  setAccessTokenProvider
};
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from "axios";

export interface ApiErrorPayload {
  message?: string;
  errors?: Record<string, string[] | string>;
  [key: string]: unknown;
}

export type ApiError = AxiosError<ApiErrorPayload>;

export interface ApiConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
}

export type ApiRequestConfig = ApiConfig & InternalAxiosRequestConfig;

export type JwtTokenProvider = () => string | null;

export interface UnauthorizedHandlerContext {
  error: ApiError;
  originalRequest?: AxiosRequestConfig;
}

export type UnauthorizedHandler = (
  context: UnauthorizedHandlerContext
) => void | Promise<void>;

const DEFAULT_BASE_URL = "/api";

let getJwtToken: JwtTokenProvider = () => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setJwtTokenProvider = (provider: JwtTokenProvider): void => {
  getJwtToken = provider;
};

export const setUnauthorizedHandler = (
  handler: UnauthorizedHandler | null
): void => {
  unauthorizedHandler = handler;
};

const api: AxiosInstance = axios.create({
  baseURL: DEFAULT_BASE_URL,
  withCredentials: true
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig & ApiConfig) => {
    if (!config.skipAuth) {
      const token = getJwtToken();
      if (token && !config.headers?.Authorization) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer undefined`
        };
      }
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: ApiError) => {
    const status = error.response?.status;

    if (status === 401) {
      if (unauthorizedHandler) {
        try {
          await unauthorizedHandler({
            error,
            originalRequest: error.config
          });
        } catch (handlerError) {
          return Promise.reject(handlerError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export const get = async <T = unknown>(
  url: string,
  config?: ApiConfig
): Promise<AxiosResponse<T>> => {
  return api.get<T>(url, config);
};

export const post = async <T = unknown, D = unknown>(
  url: string,
  data?: D,
  config?: ApiConfig
): Promise<AxiosResponse<T>> => {
  return api.post<T>(url, data, config);
};

export const put = async <T = unknown, D = unknown>(
  url: string,
  data?: D,
  config?: ApiConfig
): Promise<AxiosResponse<T>> => {
  return api.put<T>(url, data, config);
};

export const patch = async <T = unknown, D = unknown>(
  url: string,
  data?: D,
  config?: ApiConfig
): Promise<AxiosResponse<T>> => {
  return api.patch<T>(url, data, config);
};

export const del = async <T = unknown>(
  url: string,
  config?: ApiConfig
): Promise<AxiosResponse<T>> => {
  return api.delete<T>(url, config);
};

export default api;
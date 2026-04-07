import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

export interface ApiErrorPayload {
  message: string;
  code?: string | number;
  details?: unknown;
  status?: number;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public status?: number;
  public code?: string | number;
  public details?: unknown;
  public originalError?: AxiosError;

  constructor(payload: ApiErrorPayload, originalError?: AxiosError) {
    super(payload.message || 'An unexpected error occurred');
    this.name = 'ApiError';
    this.status = payload.status;
    this.code = payload.code;
    this.details = payload.details;
    this.originalError = originalError;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface AuthTokens {
  accessToken: string | null;
}

type TokenSubscriber = (token: string | null) => void;

class TokenManager {
  private tokens: AuthTokens = { accessToken: null };
  private subscribers: Set<TokenSubscriber> = new Set();

  setAccessToken(token: string | null): void {
    this.tokens.accessToken = token;
    this.notify();
  }

  getAccessToken(): string | null {
    return this.tokens.accessToken;
  }

  subscribe(subscriber: TokenSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.tokens.accessToken);
    }
  }
}

const tokenManager = new TokenManager();

const API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string> }).env &&
    (import.meta as unknown as { env: Record<string, string> }).env
      .VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' &&
    (process as unknown as { env?: Record<string, string> }).env &&
    (process as unknown as { env: Record<string, string> }).env
      .VITE_API_BASE_URL) ||
  (typeof window !== 'undefined' &&
    (window as unknown as { __APP_API_BASE_URL__?: string })
      .__APP_API_BASE_URL__) ||
  '';

if (!API_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    '[api] API base URL is not configured. Set VITE_API_BASE_URL or __APP_API_BASE_URL__.'
  );
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = tokenManager.getAccessToken();
    if (token) {
      // eslint-disable-next-line no-param-reassign
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer undefined`,
      };
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

export type UnauthorizedHandler = (error: ApiError) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null): void => {
  unauthorizedHandler = handler;
};

const normalizeError = (error: AxiosError): ApiError => {
  const response = error.response as AxiosResponse | undefined;
  const data = (response && (response.data as Partial<ApiErrorPayload>)) || {};
  const status = response?.status;
  const message =
    data.message ||
    (typeof error.message === 'string' && error.message) ||
    'An unexpected error occurred';

  const payload: ApiErrorPayload = {
    message,
    status,
    code: data.code ?? status,
    details: data.details ?? data,
  };

  return new ApiError(payload, error);
};

api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  (error: AxiosError) => {
    if (!error.response) {
      const networkError = new ApiError(
        {
          message:
            'Network error or server is unreachable. Please check your connection and try again.',
        },
        error
      );
      return Promise.reject(networkError);
    }

    const apiError = normalizeError(error);

    if (apiError.status === 401 && unauthorizedHandler) {
      try {
        unauthorizedHandler(apiError);
      } catch {
        // swallow handler errors
      }
    }

    return Promise.reject(apiError);
  }
);

export interface ApiRequestConfig<D = unknown> extends AxiosRequestConfig<D> {}

export const setAccessToken = (token: string | null): void => {
  tokenManager.setAccessToken(token);
};

export const getAccessToken = (): string | null => tokenManager.getAccessToken();

export const onAccessTokenChange = (subscriber: TokenSubscriber): (() => void) =>
  tokenManager.subscribe(subscriber);

export const get = <T = unknown, R = AxiosResponse<T>>(
  url: string,
  config?: ApiRequestConfig
): Promise<R> => api.get<T, R>(url, config);

export const post = <T = unknown, B = unknown, R = AxiosResponse<T>>(
  url: string,
  data?: B,
  config?: ApiRequestConfig<B>
): Promise<R> => api.post<T, R, B>(url, data, config);

export const put = <T = unknown, B = unknown, R = AxiosResponse<T>>(
  url: string,
  data?: B,
  config?: ApiRequestConfig<B>
): Promise<R> => api.put<T, R, B>(url, data, config);

export const patch = <T = unknown, B = unknown, R = AxiosResponse<T>>(
  url: string,
  data?: B,
  config?: ApiRequestConfig<B>
): Promise<R> => api.patch<T, R, B>(url, data, config);

export const del = <T = unknown, R = AxiosResponse<T>>(
  url: string,
  config?: ApiRequestConfig
): Promise<R> => api.delete<T, R>(url, config);

export const request = <T = unknown, R = AxiosResponse<T>, D = unknown>(
  config: ApiRequestConfig<D>
): Promise<R> => api.request<T, R, D>(config);

export { api };
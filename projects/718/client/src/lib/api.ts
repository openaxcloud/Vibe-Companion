import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

export interface ApiConfig {
  baseURL?: string;
}

export interface ApiErrorPayload {
  message?: string;
  code?: string | number;
  details?: unknown;
}

export class ApiError extends Error {
  public status?: number;
  public code?: string | number;
  public details?: unknown;
  public originalError?: AxiosError;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string | number;
      details?: unknown;
      originalError?: AxiosError;
    }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status;
    this.code = options?.code;
    this.details = options?.details;
    this.originalError = options?.originalError;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

type TokenPair = {
  accessToken: string | null;
  refreshToken: string | null;
};

type TokenStorageKeys = {
  access: string;
  refresh: string;
};

type TokenSubscriber = (accessToken: string | null) => void;

const DEFAULT_TOKEN_KEYS: TokenStorageKeys = {
  access: "access_token",
  refresh: "refresh_token",
};

class TokenService {
  private storage: Storage;
  private keys: TokenStorageKeys;

  constructor(storage: Storage, keys?: Partial<TokenStorageKeys>) {
    this.storage = storage;
    this.keys = {
      access: keys?.access ?? DEFAULT_TOKEN_KEYS.access,
      refresh: keys?.refresh ?? DEFAULT_TOKEN_KEYS.refresh,
    };
  }

  getTokens(): TokenPair {
    return {
      accessToken: this.storage.getItem(this.keys.access),
      refreshToken: this.storage.getItem(this.keys.refresh),
    };
  }

  getAccessToken(): string | null {
    return this.storage.getItem(this.keys.access);
  }

  getRefreshToken(): string | null {
    return this.storage.getItem(this.keys.refresh);
  }

  setTokens(tokens: TokenPair): void {
    if (tokens.accessToken) {
      this.storage.setItem(this.keys.access, tokens.accessToken);
    } else {
      this.storage.removeItem(this.keys.access);
    }

    if (tokens.refreshToken) {
      this.storage.setItem(this.keys.refresh, tokens.refreshToken);
    } else {
      this.storage.removeItem(this.keys.refresh);
    }
  }

  clearTokens(): void {
    this.storage.removeItem(this.keys.access);
    this.storage.removeItem(this.keys.refresh);
  }
}

interface RefreshResponse {
  accessToken: string;
  refreshToken?: string | null;
}

type RefreshRequestConfig = AxiosRequestConfig & { _retry?: boolean };

class ApiClient {
  private axiosInstance: AxiosInstance;
  private tokenService: TokenService;
  private isRefreshing = false;
  private refreshQueue: TokenSubscriber[] = [];
  private loginRedirectCallback?: () => void;

  constructor(config?: ApiConfig) {
    this.tokenService = new TokenService(window.localStorage);
    this.axiosInstance = axios.create({
      baseURL: config?.baseURL ?? "/api",
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  setLoginRedirectCallback(callback: () => void): void {
    this.loginRedirectCallback = callback;
  }

  setTokens(tokens: TokenPair): void {
    this.tokenService.setTokens(tokens);
  }

  clearTokens(): void {
    this.tokenService.clearTokens();
  }

  getAccessToken(): string | null {
    return this.tokenService.getAccessToken();
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.tokenService.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer undefined`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as RefreshRequestConfig;

        if (!error.response) {
          throw this.wrapError(error);
        }

        const status = error.response.status;

        if (status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const newToken = await this.handleTokenRefresh();
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer undefined`;
            }
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            this.handleUnauthorized();
            throw this.wrapError(error);
          }
        }

        if (status === 403) {
          this.handleUnauthorized();
        }

        throw this.wrapError(error);
      }
    );
  }

  private async handleTokenRefresh(): Promise<string | null> {
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.refreshQueue.push((token) => resolve(token));
      });
    }

    this.isRefreshing = true;

    try {
      const refreshToken = this.tokenService.getRefreshToken();
      if (!refreshToken) {
        this.tokenService.clearTokens();
        this.flushRefreshQueue(null);
        return null;
      }

      const response = await this.axiosInstance.post<RefreshResponse>(
        "/auth/refresh",
        {
          refreshToken,
        },
        {
          headers: {
            Authorization: undefined,
          },
        }
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data;
      this.tokenService.setTokens({
        accessToken,
        refreshToken: newRefreshToken ?? refreshToken,
      });

      this.flushRefreshQueue(accessToken);
      return accessToken;
    } catch (error) {
      this.tokenService.clearTokens();
      this.flushRefreshQueue(null);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  private flushRefreshQueue(token: string | null): void {
    this.refreshQueue.forEach((callback) => callback(token));
    this.refreshQueue = [];
  }

  private handleUnauthorized(): void {
    this.tokenService.clearTokens();
    if (this.loginRedirectCallback) {
      this.loginRedirectCallback();
    }
  }

  private wrapError(error: AxiosError): ApiError {
    const status = error.response?.status;
    const data = error.response?.data as ApiErrorPayload | undefined;

    const message =
      data?.message ||
      error.message ||
      (status ? `Request failed with status code undefined` : "Network error");

    return new ApiError(message, {
      status,
      code: data?.code,
      details: data?.details ?? error.response?.data,
      originalError: error,
    });
  }

  get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  post<T = unknown, B = unknown>(
    url: string,
    data?: B,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  put<T = unknown, B = unknown>(
    url: string,
    data?: B,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(url, data, config);
  }

  patch<T = unknown, B = unknown>(
    url: string,
    data?: B,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.patch<T>(url, data, config);
  }

  delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }

  request<T = unknown>(
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.request<T>(config);
  }
}

let defaultApiClient: ApiClient | null = null;

export const getApiClient = (config?: ApiConfig): ApiClient => {
  if (!defaultApiClient) {
    defaultApiClient = new ApiClient(config);
  }
  return defaultApiClient;
};

export const api = getApiClient();
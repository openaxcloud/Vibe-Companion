import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiErrorPayload {
  message?: string;
  code?: string;
  status?: number;
  details?: unknown;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public status?: number;
  public code?: string;
  public details?: unknown;
  public raw?: unknown;

  constructor(message: string, payload?: ApiErrorPayload, raw?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = payload?.status;
    this.code = payload?.code;
    this.details = payload?.details;
    this.raw = raw;
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export type AuthTokenProvider = () => string | null | Promise<string | null>;
export type AuthTokenSetter = (tokens: AuthTokens | null) => void;
export type LogoutHandler = () => void | Promise<void>;

export interface ApiClientConfig {
  baseURL?: string;
  getAuthToken?: AuthTokenProvider;
  setAuthTokens?: AuthTokenSetter;
  onLogout?: LogoutHandler;
  withCredentials?: boolean;
  timeout?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthRegisterPayload {
  email: string;
  password: string;
  name?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  [key: string]: unknown;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  [key: string]: unknown;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

export interface CartItemPayload {
  productId: string;
  quantity: number;
  [key: string]: unknown;
}

export interface CartItem extends CartItemPayload {
  id: string;
  product?: Product;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  currency: string;
  [key: string]: unknown;
}

export interface CheckoutPayload {
  cartId: string;
  paymentMethodId: string;
  shippingAddressId?: string;
  [key: string]: unknown;
}

export interface CheckoutSession {
  id: string;
  url?: string;
  status: 'pending' | 'completed' | 'failed';
  [key: string]: unknown;
}

export interface Order {
  id: string;
  cartId: string;
  total: number;
  currency: string;
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
  createdAt: string;
  [key: string]: unknown;
}

class ApiClient {
  private axiosInstance: AxiosInstance;
  private getAuthToken?: AuthTokenProvider;
  private setAuthTokens?: AuthTokenSetter;
  private onLogout?: LogoutHandler;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(config: ApiClientConfig = {}) {
    const {
      baseURL,
      getAuthToken,
      setAuthTokens,
      onLogout,
      withCredentials = true,
      timeout = 15000,
    } = config;

    this.getAuthToken = getAuthToken;
    this.setAuthTokens = setAuthTokens;
    this.onLogout = onLogout;

    const resolvedBaseURL =
      baseURL ||
      (typeof window !== 'undefined'
        ? (window as any).__API_BASE_URL__ || process.env.NEXT_PUBLIC_API_BASE_URL || '/api'
        : process.env.NEXT_PUBLIC_API_BASE_URL || '/api');

    this.axiosInstance = axios.create({
      baseURL: resolvedBaseURL,
      withCredentials,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      async (config: AxiosRequestConfig) => {
        if (!this.getAuthToken) return config;
        try {
          const token = await this.getAuthToken();
          if (token && config.headers) {
            config.headers.Authorization = `Bearer undefined`;
          }
        } catch {
          // swallow token retrieval errors, request may proceed unauthenticated
        }
        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & {
          _retry?: boolean;
        };

        const status = error.response?.status;
        const data = error.response?.data as ApiErrorPayload | undefined;

        if (status === 401 && this.setAuthTokens && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const newAccessToken = await this.refreshToken();
            if (newAccessToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer undefined`;
              return this.axiosInstance(originalRequest);
            }
          } catch {
            // fall through to logout
          }
          if (this.setAuthTokens) this.setAuthTokens(null);
          if (this.onLogout) await this.onLogout();
        }

        const message =
          data?.message ||
          error.message ||
          'An unexpected error occurred while communicating with the server.';

        const apiError = new ApiError(
          message,
          {
            ...data,
            status,
          },
          error
        );

        return Promise.reject(apiError);
      }
    );
  }

  private async refreshToken(): Promise<string | null> {
    if (!this.setAuthTokens) return null;
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const response = await this.axiosInstance.post<{
          accessToken: string;
          refreshToken?: string;
        }>('/auth/refresh', {});
        const tokens: AuthTokens = {
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
        };
        this.setAuthTokens && this.setAuthTokens(tokens);
        return tokens.accessToken;
      } catch {
        this.setAuthTokens && this.setAuthTokens(null);
        if (this.onLogout) await this.onLogout();
        return null;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T = unknown>(
    method: HttpMethod,
    url: string,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    const response = await this.axiosInstance.request<T>({
      method,
      url,
      ...config,
    });
    return response.data;
  }

  // Auth endpoints

  async login(credentials: AuthCredentials): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const data = await this.request<{ user: AuthUser; accessToken: string; refreshToken?: string }>(
      'POST',
      '/auth/login',
      { data: credentials }
    );
    const tokens: AuthTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
    if (this.setAuthTokens) this.setAuthTokens(tokens);
    return { user: data.user, tokens };
  }

  async register(
    payload: AuthRegisterPayload
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const data = await this.request<{ user: AuthUser; accessToken: string; refreshToken?: string }>(
      'POST',
      '/auth/register',
      { data: payload }
    );
    const tokens: AuthTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
    if (this.setAuthTokens) this.setAuthTokens(tokens);
    return { user: data.user, tokens };
  }

  async getCurrentUser(): Promise<AuthUser> {
    return this.request<AuthUser>('GET', '/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>('POST', '/auth/logout');
    } finally {
      if (this.setAuthTokens) this.setAuthTokens(null);
      if (this.onLogout) await this.onLogout();
    }
  }

  // Products endpoints

  async getProducts(filters: ProductFilters = {}): Promise<PaginatedResponse<Product>> {
    return this.request<PaginatedResponse<Product>>('GET', '/products', {
      params: filters,
    });
  }

  async getProductById(id: string): Promise<Product> {
    return this.request<Product>('GET', `/products/undefined`);
  }

  //
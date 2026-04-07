import axios, { AxiosError, AxiosInstance } from "axios";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface User {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

type AuthEvent = "login" | "logout" | "tokenRefresh";

type AuthEventListener = (state: AuthState) => void;

export interface AuthServiceConfig {
  baseURL: string;
  storageKey?: string;
  refreshEndpoint?: string;
  loginEndpoint?: string;
  registerEndpoint?: string;
  logoutEndpoint?: string;
}

class AuthService {
  private axiosInstance: AxiosInstance;
  private storageKey: string;
  private refreshEndpoint: string;
  private loginEndpoint: string;
  private registerEndpoint: string;
  private logoutEndpoint: string;

  private state: AuthState = {
    user: null,
    tokens: null,
  };

  private isRefreshing = false;
  private refreshPromise: Promise<AuthTokens | null> | null = null;
  private eventListeners: Map<AuthEvent, Set<AuthEventListener>> = new Map();

  constructor(config: AuthServiceConfig) {
    this.storageKey = config.storageKey ?? "app_auth";
    this.refreshEndpoint = config.refreshEndpoint ?? "/auth/refresh";
    this.loginEndpoint = config.loginEndpoint ?? "/auth/login";
    this.registerEndpoint = config.registerEndpoint ?? "/auth/register";
    this.logoutEndpoint = config.logoutEndpoint ?? "/auth/logout";

    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      withCredentials: true,
    });

    this.loadFromStorage();
    this.setupInterceptors();
  }

  // Public API

  public getState(): AuthState {
    return { ...this.state };
  }

  public isAuthenticated(): boolean {
    return !!this.state.tokens?.accessToken;
  }

  public getAccessToken(): string | null {
    return this.state.tokens?.accessToken ?? null;
  }

  public async login(credentials: LoginCredentials): Promise<AuthState> {
    try {
      const response = await this.axiosInstance.post<AuthResponse>(
        this.loginEndpoint,
        credentials
      );
      this.setAuthState(response.data);
      this.emit("login");
      return this.getState();
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  public async register(payload: RegisterPayload): Promise<AuthState> {
    try {
      const response = await this.axiosInstance.post<AuthResponse>(
        this.registerEndpoint,
        payload
      );
      this.setAuthState(response.data);
      this.emit("login");
      return this.getState();
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this.isAuthenticated()) {
        await this.axiosInstance.post(this.logoutEndpoint);
      }
    } catch {
      // Ignore logout errors
    } finally {
      this.clearAuthState();
      this.emit("logout");
    }
  }

  public async refreshTokens(): Promise<AuthTokens | null> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    const currentTokens = this.state.tokens;
    if (!currentTokens?.refreshToken) {
      await this.logout();
      return null;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh(currentTokens.refreshToken)
      .catch(async () => {
        await this.logout();
        return null;
      })
      .finally(() => {
        this.isRefreshing = false;
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  public on(event: AuthEvent, listener: AuthEventListener): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    const listeners = this.eventListeners.get(event)!;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  public off(event: AuthEvent, listener: AuthEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // Internal logic

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
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
        if (!error.response) {
          return Promise.reject(error);
        }

        const originalRequest = error.config;
        if (!originalRequest) {
          return Promise.reject(error);
        }

        const status = error.response.status;

        if (status === 401 && !this.isAuthEndpoint(originalRequest.url)) {
          try {
            const newTokens = await this.refreshTokens();
            if (newTokens && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer undefined`;
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }

        if (status === 403) {
          await this.logout();
        }

        return Promise.reject(error);
      }
    );
  }

  private isAuthEndpoint(url?: string): boolean {
    if (!url) return false;
    const endpoints = [
      this.loginEndpoint,
      this.registerEndpoint,
      this.refreshEndpoint,
      this.logoutEndpoint,
    ];
    return endpoints.some((endpoint) => url.includes(endpoint));
  }

  private async performTokenRefresh(refreshToken: string): Promise<AuthTokens> {
    const response = await this.axiosInstance.post<{ tokens: AuthTokens }>(
      this.refreshEndpoint,
      { refreshToken }
    );

    const newTokens = response.data.tokens;
    this.state = {
      ...this.state,
      tokens: newTokens,
    };
    this.saveToStorage();
    this.emit("tokenRefresh");
    return newTokens;
  }

  private setAuthState(response: AuthResponse): void {
    this.state = {
      user: response.user,
      tokens: response.tokens,
    };
    this.saveToStorage();
  }

  private clearAuthState(): void {
    this.state = {
      user: null,
      tokens: null,
    };
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as AuthState;
      if (parsed && parsed.tokens?.accessToken && parsed.tokens?.refreshToken) {
        this.state = parsed;
      }
    } catch {
      // Ignore malformed storage
    }
  }

  private saveToStorage(): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch {
      // Ignore storage errors
    }
  }

  private emit(event: AuthEvent): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners || listeners.size === 0) return;
    const snapshot = this.getState();
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // Ignore listener errors
      }
    });
  }

  private handleAuthError(error: unknown): void {
    if (!axios.isAxiosError(error)) return;
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      this.clearAuthState();
    }
  }
}

let authServiceInstance: AuthService | null = null;

export const createAuthService = (config: AuthServiceConfig): AuthService => {
  authServiceInstance = new AuthService(config);
  return authServiceInstance;
};

export const getAuthService = (): AuthService => {
  if (!authServiceInstance) {
    throw new Error(
      "AuthService has not been initialized. Call createAuthService(config) first."
    );
  }
  return authServiceInstance;
};

export default AuthService;
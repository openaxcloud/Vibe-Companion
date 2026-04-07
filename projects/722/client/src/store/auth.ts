import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  initializing: boolean;
  user: UserProfile | null;
  tokens: AuthTokens | null;
  error: string | null;
  lastFetchedAt: number | null;

  login: (params: { email: string; password: string }) => Promise<void>;
  signup: (params: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  initialize: () => Promise<void>;
  clearError: () => void;

  // Internal setters (not to be called directly from UI where possible)
  _setTokens: (tokens: AuthTokens | null) => void;
  _setUser: (user: UserProfile | null) => void;
}

type AuthResponse = {
  accessToken: string;
  refreshToken?: string;
  user: UserProfile;
};

const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || '/api';

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  tokens?: AuthTokens | null
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (tokens?.accessToken) {
    (headers as Record<string, string>).Authorization = `Bearer undefined`;
  }

  const response = await fetch(`undefinedundefined`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.json();
      if (data && typeof data.message === 'string') {
        message = data.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return (await response.json()) as T;
}

function persistTokens(tokens: AuthTokens | null) {
  if (!tokens) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

function loadTokensFromStorage(): AuthTokens | null {
  try {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!accessToken) return null;
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || undefined;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

function persistUser(user: UserProfile | null) {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function loadUserFromStorage(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      loading: false,
      initializing: true,
      user: null,
      tokens: null,
      error: null,
      lastFetchedAt: null,

      _setTokens: (tokens: AuthTokens | null) => {
        persistTokens(tokens);
        set({ tokens, isAuthenticated: !!tokens });
      },

      _setUser: (user: UserProfile | null) => {
        persistUser(user);
        set({ user, lastFetchedAt: user ? Date.now() : null });
      },

      clearError: () => set({ error: null }),

      initialize: async () => {
        const state = get();
        if (!state.initializing) return;

        try {
          const storedTokens = loadTokensFromStorage();
          const storedUser = loadUserFromStorage();

          if (storedTokens) {
            set({
              tokens: storedTokens,
              isAuthenticated: true,
              user: storedUser,
              initializing: false,
              error: null,
            });
            // Try to refresh profile silently in background
            get()
              .refreshProfile()
              .catch(() => {
                // If profile refresh fails, log the user out silently
                get().logout().catch(() => undefined);
              });
          } else {
            set({
              tokens: null,
              isAuthenticated: false,
              user: null,
              initializing: false,
              error: null,
            });
          }
        } catch {
          set({
            tokens: null,
            isAuthenticated: false,
            user: null,
            initializing: false,
            error: null,
          });
        }
      },

      login: async ({ email, password }) => {
        set({ loading: true, error: null });
        try {
          const data = await apiRequest<AuthResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          });

          const tokens: AuthTokens = {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          };

          get()._setTokens(tokens);
          get()._setUser(data.user);

          set({ loading: false, error: null });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unable to login';
          get()._setTokens(null);
          get()._setUser(null);
          set({
            loading: false,
            error: message,
            isAuthenticated: false,
          });
          throw err;
        }
      },

      signup: async ({ email, password, name }) => {
        set({ loading: true, error: null });
        try {
          const data = await apiRequest<AuthResponse>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
          });

          const tokens: AuthTokens = {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          };

          get()._setTokens(tokens);
          get()._setUser(data.user);

          set({ loading: false, error: null });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unable to sign up';
          get()._setTokens(null);
          get()._setUser(null);
          set({
            loading: false,
            error: message,
            isAuthenticated: false,
          });
          throw err;
        }
      },

      logout: async () => {
        const { tokens } = get();
        set({ loading: true, error: null });

        try {
          if (tokens?.accessToken) {
            await apiRequest<void>('/auth/logout', { method: 'POST' }, tokens);
          }
        } catch {
          // Ignore logout API errors; we still clear client state
        } finally {
          get()._setTokens(null);
          get()._setUser(null);

          set({
            loading: false,
            error: null,
            isAuthenticated: false,
          });
        }
      },

      refreshProfile: async () => {
        const { tokens } = get();
        if (!tokens?.accessToken) {
          throw new Error('Not authenticated');
        }

        set({ loading: true, error: null });
        try {
          const user = await apiRequest<UserProfile>('/auth/me', { method: 'GET' }, tokens);
          get()._setUser(user);
          set({ loading: false, error: null });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unable to fetch profile';
          set({ loading: false, error: message });
          // If unauthorized, force logout
          if (message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('token')) {
            get().logout().catch(() => undefined);
          }
          throw err;
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
      skipHydration: true,
    }
  )
);
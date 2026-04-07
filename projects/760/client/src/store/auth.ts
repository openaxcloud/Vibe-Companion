import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => void;
  setAuth: (payload: { token: string; user: User }) => void;
  clearError: () => void;
}

interface AuthPersistedState {
  token: string | null;
  user: User | null;
}

const AUTH_STORAGE_KEY = "auth";

const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    return (window as any).__API_BASE_URL__ || process.env.REACT_APP_API_BASE_URL || "";
  }
  return process.env.REACT_APP_API_BASE_URL || "";
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,
      error: null,

      setAuth: ({ token, user }) => {
        set({ token, user, error: null });
      },

      clearError: () => {
        set({ error: null });
      },

      login: async ({ email, password }) => {
        const apiBaseUrl = getApiBaseUrl();
        set({ loading: true, error: null });
        try {
          const response = await fetch(`undefined/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            let message = "Login failed";
            try {
              const errorData = await response.json();
              if (errorData?.message) {
                message = Array.isArray(errorData.message)
                  ? errorData.message.join(", ")
                  : String(errorData.message);
              }
            } catch {
              // ignore json parse errors
            }
            throw new Error(message);
          }

          const data = (await response.json()) as { token: string; user: User };
          set({
            token: data.token,
            user: data.user,
            loading: false,
            error: null,
          });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "An unexpected error occurred during login";
          set({ loading: false, error: message });
          throw err;
        }
      },

      register: async ({ email, password, name }) => {
        const apiBaseUrl = getApiBaseUrl();
        set({ loading: true, error: null });
        try {
          const response = await fetch(`undefined/auth/register`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password, name }),
          });

          if (!response.ok) {
            let message = "Registration failed";
            try {
              const errorData = await response.json();
              if (errorData?.message) {
                message = Array.isArray(errorData.message)
                  ? errorData.message.join(", ")
                  : String(errorData.message);
              }
            } catch {
              // ignore json parse errors
            }
            throw new Error(message);
          }

          const data = (await response.json()) as { token: string; user: User };
          set({
            token: data.token,
            user: data.user,
            loading: false,
            error: null,
          });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "An unexpected error occurred during registration";
          set({ loading: false, error: message });
          throw err;
        }
      },

      logout: () => {
        set({ token: null, user: null, loading: false, error: null });
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      getStorage: () => (typeof window !== "undefined" ? window.localStorage : undefined),
      partialize: (state: AuthState): AuthPersistedState => ({
        token: state.token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const current = state as AuthState;
        if (current.error) {
          current.error = null;
        }
        current.loading = false;
      },
    }
  )
);

export const selectIsAuthenticated = (state: AuthState): boolean => Boolean(state.token && state.user);
export const selectCurrentUser = (state: AuthState): User | null => state.user;
export const selectAuthToken = (state: AuthState): string | null => state.token;
export const selectAuthLoading = (state: AuthState): boolean => state.loading;
export const selectAuthError = (state: AuthState): string | null => state.error;
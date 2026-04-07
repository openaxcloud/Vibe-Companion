import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  csrfToken: string | null;
  login: (params: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setCsrfToken: (token: string | null) => void;
  clearError: () => void;
}

type PersistedAuthState = Pick<AuthState, "user" | "isAuthenticated" | "csrfToken">;

const AUTH_STORAGE_KEY = "auth-store";

const storage = createJSONStorage<PersistedAuthState>(() => ({
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    const value = window.localStorage.getItem(name);
    return value;
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(name);
  },
}));

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init && init.headers ? init.headers : {}),
    },
    ...init,
  });

  const contentType = res.headers.get("content-type");
  let data: unknown = null;

  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const errorMessage =
      (data as { message?: string })?.message ||
      `Request failed with status undefined`;
    throw new Error(errorMessage);
  }

  return data as T;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      csrfToken: null,

      setUser: (user: AuthUser | null) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },

      setCsrfToken: (token: string | null) => {
        set({ csrfToken: token });
      },

      clearError: () => {
        set({ error: null });
      },

      login: async ({ email, password }) => {
        set({ isLoading: true, error: null });

        try {
          const data = await fetchJson<{
            user: AuthUser;
            csrfToken?: string;
          }>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            csrfToken: data.csrfToken || null,
            error: null,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Login failed. Please try again.";
          set({
            isLoading: false,
            error: message,
            user: null,
            isAuthenticated: false,
          });
          throw err;
        }
      },

      logout: async () => {
        set({ isLoading: true, error: null });

        try {
          await fetchJson<{ success: boolean }>("/api/auth/logout", {
            method: "POST",
          });

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            csrfToken: null,
            error: null,
          });
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : "Logout failed. Please refresh and try again.";
          set({
            isLoading: false,
            error: message,
          });
          throw err;
        }
      },

      refreshUser: async () => {
        set({ isLoading: true, error: null });

        try {
          const data = await fetchJson<{
            user: AuthUser | null;
            csrfToken?: string;
          }>("/api/auth/me", {
            method: "GET",
          });

          set({
            user: data.user,
            isAuthenticated: !!data.user,
            isLoading: false,
            csrfToken: data.csrfToken || get().csrfToken || null,
            error: null,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unable to refresh session.";
          set({
            isLoading: false,
            error: message,
            user: null,
            isAuthenticated: false,
            csrfToken: null,
          });
        }
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage,
      partialize: (state): PersistedAuthState => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        csrfToken: state.csrfToken,
      }),
      onRehydrateStorage:
        () =>
        (state, error): void => {
          if (error) {
            // eslint-disable-next-line no-console
            console.error("Failed to rehydrate auth store", error);
            return;
          }
          if (!state) return;
          if (state.user) {
            state.isAuthenticated = true;
          }
        },
    }
  )
);

export const selectAuthUser = (state: AuthState): AuthUser | null => state.user;
export const selectIsAuthenticated = (state: AuthState): boolean =>
  state.isAuthenticated;
export const selectIsAuthLoading = (state: AuthState): boolean => state.isLoading;
export const selectAuthError = (state: AuthState): string | null => state.error;
export const selectCsrfToken = (state: AuthState): string | null =>
  state.csrfToken;
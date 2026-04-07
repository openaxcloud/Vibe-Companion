import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  roles?: string[];
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrating: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  signUp: (data: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  hydrateAuth: () => Promise<void>;
  clearError: () => void;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "/api";

async function apiRequest<TResponse>(
  path: string,
  options: RequestInit = {}
): Promise<TResponse> {
  const response = await fetch(`undefinedundefined`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("Content-Type");
  const isJson = contentType && contentType.includes("application/json");

  if (!response.ok) {
    let errorMessage = `Request failed with status undefined`;
    if (isJson) {
      const errorBody = (await response.json()) as { message?: string; error?: string };
      errorMessage = errorBody.message || errorBody.error || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (!isJson) {
    return {} as TResponse;
  }

  return (await response.json()) as TResponse;
}

interface LoginResponse {
  user: AuthUser;
}

interface SignUpResponse {
  user: AuthUser;
}

interface MeResponse {
  user: AuthUser | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrating: false,
      error: null,

      clearError: () => {
        set({ error: null });
      },

      login: async (credentials) => {
        const { isLoading } = get();
        if (isLoading) return;

        set({ isLoading: true, error: null });

        try {
          const data = await apiRequest<LoginResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify(credentials),
          });

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unable to log in. Please try again.";
          set({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            error: message,
          });
          throw err;
        }
      },

      signUp: async (payload) => {
        const { isLoading } = get();
        if (isLoading) return;

        set({ isLoading: true, error: null });

        try {
          const data = await apiRequest<SignUpResponse>("/auth/signup", {
            method: "POST",
            body: JSON.stringify(payload),
          });

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unable to sign up. Please try again.";
          set({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            error: message,
          });
          throw err;
        }
      },

      logout: async () => {
        const { isLoading, isHydrating } = get();
        if (isLoading || isHydrating) return;

        set({ isLoading: true, error: null });

        try {
          await apiRequest<{}>("/auth/logout", {
            method: "POST",
          });

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unable to log out. Please try again.";
          set({
            isLoading: false,
            error: message,
            user: null,
            isAuthenticated: false,
          });
          throw err;
        }
      },

      hydrateAuth: async () => {
        const { isHydrating } = get();
        if (isHydrating) return;

        set({ isHydrating: true, error: null });

        try {
          const data = await apiRequest<MeResponse>("/auth/me", {
            method: "GET",
          });

          if (data.user) {
            set({
              user: data.user,
              isAuthenticated: true,
              isHydrating: false,
              error: null,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isHydrating: false,
              error: null,
            });
          }
        } catch (err) {
          // On hydrate failure, we silently reset auth state but don't propagate error
          set({
            user: null,
            isAuthenticated: false,
            isHydrating: false,
            error: null,
          });
        }
      },
    }),
    {
      name: "auth-store",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Ensure non-persisted flags are reset correctly after rehydration
        state.isLoading = false;
        state.isHydrating = false;
        state.error = null;
      },
    }
  )
);
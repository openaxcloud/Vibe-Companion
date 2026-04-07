import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  [key: string]: unknown;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (params: { email: string; password: string }) => Promise<void>;
  register: (params: {
    email: string;
    password: string;
    name?: string;
  }) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

type AuthResponse = {
  token: string;
  user: User;
};

const API_BASE_URL =
  (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  process.env.NEXT_PUBLIC_API_URL ||
  "/api";

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer undefined`;
  }

  const response = await fetch(`undefinedundefined`, {
    ...options,
    headers,
  });

  const isJson =
    response.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json") ?? false;

  let data: any = null;
  if (isJson) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok) {
    const message =
      (data && (data.message || data.error)) ||
      response.statusText ||
      "Request failed";
    throw new Error(message);
  }

  return data as T;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      setToken: (token) => {
        set({ token });
      },

      setUser: (user) => {
        set({ user });
      },

      clearError: () => set({ error: null }),

      login: async ({ email, password }) => {
        set({ isLoading: true, error: null });
        try {
          const data = await apiRequest<AuthResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });

          set({
            token: data.token,
            user: data.user,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          set({
            isLoading: false,
            error: error?.message || "Login failed",
          });
          throw error;
        }
      },

      register: async ({ email, password, name }) => {
        set({ isLoading: true, error: null });
        try {
          const data = await apiRequest<AuthResponse>("/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, password, name }),
          });

          set({
            token: data.token,
            user: data.user,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          set({
            isLoading: false,
            error: error?.message || "Registration failed",
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isLoading: false,
          error: null,
        });
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem("auth");
            localStorage.removeItem("auth");
          } catch {
            // ignore storage errors
          }
        }
      },

      fetchMe: async () => {
        const { token } = get();
        if (!token) {
          set({ user: null });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const user = await apiRequest<User>("/auth/me", {}, token);
          set({ user, isLoading: false, error: null });
        } catch (error: any) {
          set({
            isLoading: false,
            error: error?.message || "Failed to fetch profile",
          });
          if (
            error?.message?.toLowerCase().includes("unauthorized") ||
            error?.message?.toLowerCase().includes("invalid token")
          ) {
            set({ user: null, token: null });
          }
          throw error;
        }
      },
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.localStorage;
      }),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      version: 1,
      migrate: (persistedState: any, version: number): Partial<AuthState> => {
        if (!persistedState) return {};
        if (version < 1) {
          return {
            token: persistedState.token ?? null,
            user: persistedState.user ?? null,
          };
        }
        return persistedState as Partial<AuthState>;
      },
    }
  )
);
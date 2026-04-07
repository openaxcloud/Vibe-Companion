import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  [key: string]: unknown;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  resetError: () => void;
}

const API_BASE =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_API_BASE_URL) ||
  (typeof process !== "undefined" && (process.env as any)?.VITE_API_BASE_URL) ||
  "";

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`undefinedundefined`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `Request failed with status undefined`;
    try {
      const errorBody = await res.json();
      if (errorBody?.message) {
        errorMessage = errorBody.message;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  if (res.status === 204) {
    // No Content
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const fetchMe = async () => {
    set({ isInitializing: true, error: null });
    try {
      const data = await apiRequest<AuthUser>("/me");
      set({
        user: data,
        isAuthenticated: true,
        isInitializing: false,
        isLoading: false,
      });
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isInitializing: false,
        isLoading: false,
      });
    }
  };

  // Kick off /me fetch on store initialization
  // This side-effect is safe here because Zustand create is only run once.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  fetchMe();

  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitializing: true,
    error: null,

    async login(credentials) {
      set({ isLoading: true, error: null });
      try {
        const data = await apiRequest<AuthUser>("/login", {
          method: "POST",
          body: JSON.stringify(credentials),
        });

        set({
          user: data,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Login failed. Please try again.";
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: message,
        });
        throw err;
      }
    },

    async logout() {
      set({ isLoading: true, error: null });
      try {
        await apiRequest<undefined>("/logout", {
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
          err instanceof Error ? err.message : "Logout failed. Please try again.";
        set({
          isLoading: false,
          error: message,
        });
        throw err;
      }
    },

    async fetchMe() {
      return fetchMe();
    },

    setUser(user) {
      set({
        user,
        isAuthenticated: Boolean(user),
      });
    },

    resetError() {
      if (get().error) {
        set({ error: null });
      }
    },
  };
});
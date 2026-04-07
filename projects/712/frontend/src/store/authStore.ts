import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>;
  setToken: (token: string | null) => void;
  resetError: () => void;
}

const TOKEN_STORAGE_KEY = "auth_token";

const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

const persistToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: getStoredToken(),
  loading: false,
  error: null,
  isAuthenticated: !!getStoredToken(),

  setToken: (token: string | null) => {
    persistToken(token);
    set((state) => ({
      token,
      isAuthenticated: !!token,
      user: token ? state.user : null,
    }));
  },

  resetError: () => {
    set({ error: null });
  },

  login: async (credentials: { email: string; password: string }) => {
    const { token } = get();
    if (token) return;

    set({ loading: true, error: null });

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          (errorBody && (errorBody.message as string)) ||
          "Unable to login. Please try again.";
        throw new Error(message);
      }

      const data = (await response.json()) as {
        token: string;
        user?: AuthUser;
      };

      if (!data.token) {
        throw new Error("Invalid login response from server");
      }

      persistToken(data.token);

      set({
        token: data.token,
        user: data.user ?? null,
        isAuthenticated: true,
        loading: false,
        error: null,
      });

      if (!data.user) {
        await get().fetchCurrentUser();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error during login";
      persistToken(null);
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        loading: false,
        error: message,
      });
      throw err;
    }
  },

  logout: () => {
    persistToken(null);
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });

    if (typeof window !== "undefined") {
      fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    }
  },

  fetchCurrentUser: async () => {
    const { token, user } = get();
    if (!token || user) return;

    set({ loading: true, error: null });

    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer undefined`,
        },
      });

      if (response.status === 401) {
        persistToken(null);
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          loading: false,
          error: null,
        });
        return;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          (errorBody && (errorBody.message as string)) ||
          "Failed to fetch current user";
        throw new Error(message);
      }

      const data = (await response.json()) as AuthUser;

      set({
        user: data,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error fetching user";
      set({
        loading: false,
        error: message,
      });
    }
  },
}));
import { create } from "zustand";
import { devtools, persist, StateStorage } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  roles?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface AuthTokens {
  accessToken: string | null;
  refreshToken?: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void> | void;
  setUser: (user: AuthUser | null) => void;
  setTokens: (tokens: AuthTokens) => void;
  hydrateFromStorage: () => void;
  clearError: () => void;
}

export type AuthStore = AuthState & AuthActions;

const STORAGE_KEY = "auth-store";

const isBrowser = typeof window !== "undefined";

const storage: StateStorage = {
  getItem: (name: string): string | null => {
    if (!isBrowser) return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // ignore
    }
  },
  removeItem: (name: string): void => {
    if (!isBrowser) return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

const parseJwt = (token: string | null): AuthUser | null => {
  if (!token) return null;
  try {
    const [, payloadBase64] = token.split(".");
    if (!payloadBase64) return null;
    const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;

    const user: AuthUser = {
      id: String(payload.sub ?? payload.id ?? ""),
      email: String(payload.email ?? ""),
      name: (payload.name as string) ?? null,
      roles: (payload.roles as string[]) ?? [],
      ...payload,
    };

    return user.id && user.email ? user : null;
  } catch {
    return null;
  }
};

async function apiRequest<T>(
  url: string,
  options: RequestInit & { skipAuthHeader?: boolean } = {}
): Promise<T> {
  const { skipAuthHeader, headers, ...rest } = options;
  const finalHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...(headers || {}),
  };

  if (!skipAuthHeader && isBrowser) {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { state?: { tokens?: AuthTokens } };
        const token = parsed?.state?.tokens?.accessToken ?? null;
        if (token) {
          (finalHeaders as Record<string, string>).Authorization = `Bearer undefined`;
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  const response = await fetch(url, {
    ...rest,
    headers: finalHeaders,
  });

  const contentType = response.headers.get("Content-Type") || "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    let errorMessage = "Request failed";
    if (isJson) {
      try {
        const data = (await response.json()) as { message?: string; error?: string };
        errorMessage = data.message || data.error || errorMessage;
      } catch {
        // ignore
      }
    }
    throw new Error(errorMessage);
  }

  if (!isJson) {
    // @ts-expect-error - caller knows expected type
    return null;
  }

  return (await response.json()) as T;
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        tokens: {
          accessToken: null,
          refreshToken: null,
        },
        isAuthenticated: false,
        isLoading: false,
        error: null,

        hydrateFromStorage: () => {
          const { tokens, user } = get();
          const currentAccessToken = tokens.accessToken;
          const derivedUser = parseJwt(currentAccessToken);
          if (currentAccessToken && derivedUser && !user) {
            set(
              {
                user: derivedUser,
                isAuthenticated: true,
              },
              false,
              "auth/hydrateFromStorage"
            );
          } else if (!currentAccessToken) {
            set(
              {
                user: null,
                isAuthenticated: false,
              },
              false,
              "auth/hydrateFromStorage/clear"
            );
          }
        },

        setUser: (user: AuthUser | null) => {
          set(
            {
              user,
              isAuthenticated: !!user,
            },
            false,
            "auth/setUser"
          );
        },

        setTokens: (tokens: AuthTokens) => {
          const derivedUser = parseJwt(tokens.accessToken);
          set(
            {
              tokens,
              user: derivedUser,
              isAuthenticated: !!tokens.accessToken && !!derivedUser,
            },
            false,
            "auth/setTokens"
          );
        },

        clearError: () => {
          set(
            {
              error: null,
            },
            false,
            "auth/clearError"
          );
        },

        login: async (credentials) => {
          set(
            {
              isLoading: true,
              error: null,
            },
            false,
            "auth/login/pending"
          );

          try {
            const data = await apiRequest<{
              user: AuthUser;
              accessToken: string;
              refreshToken?: string;
            }>("/api/auth/login", {
              method: "POST",
              body: JSON.stringify(credentials),
              skipAuthHeader: true,
            });

            set(
              {
                user: data.user,
                tokens: {
                  accessToken: data.accessToken,
                  refreshToken: data.refreshToken ?? null,
                },
                isAuthenticated: true,
                isLoading: false,
                error: null,
              },
              false,
              "auth/login/fulfilled"
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unable to login";
            set(
              {
                isLoading: false,
                error: message,
                user: null,
                tokens: { accessToken: null, refreshToken: null },
                isAuthenticated: false,
              },
              false,
              "auth/login/rejected"
            );
            throw err;
          }
        },

        register: async (payload) => {
          set(
            {
              isLoading: true,
              error: null,
            },
            false,
            "auth/register/pending"
          );

          try {
            const data = await apiRequest<{
              user: AuthUser;
              accessToken: string;
              refreshToken?: string;
            }>("/api/auth/register", {
              method: "POST",
              body: JSON.stringify(payload),
              skipAuthHeader: true,
            });

            set(
              {
                user: data.user,
                tokens: {
                  accessToken: data.accessToken,
                  refreshToken: data.refreshToken ?? null,
                },
                isAuthenticated: true,
                isLoading: false,
                error: null,
              },
              false,
              "auth/register/fulfilled"
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unable to register";
            set(
              {
                isLoading: false,
                error: message,
              },
              false,
              "auth/register/rejected"
            );
            throw err;
          }
        },

        logout: async () => {
          const currentTokens = get().tokens;
          set(
            {
              isLoading: true,
              error: null,
            },
            false,
            "auth/logout/pending"
          );

          try {
            if (currentTokens.refreshToken) {
              await apiRequest<void>("/api/auth/logout", {
                method: "POST",
                body: JSON.stringify({
                  refreshToken: currentTokens.refreshToken,
                }),
              });
            }
          } catch {
            // ignore remote logout errors
          } finally {
            set(
              {
                user: null,
                tokens: { accessToken: null, refreshToken: null },
                isAuthenticated: false,
                isLoading: false,
                error: null,
              },
              false,
              "auth/logout/fulfilled"
            );
          }
        },
      }),
      {
        name: STORAGE_KEY,
        storage,
        partialize: (state): Partial<AuthStore> => ({
          tokens: state.tokens,
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  )
);

export const useAuth = (): AuthStore => useAuthStore();

export const useAuthUser = (): AuthUser
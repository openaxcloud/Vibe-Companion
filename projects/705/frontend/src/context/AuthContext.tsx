import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  roles?: string[];
  [key: string]: unknown;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  signup: (payload: {
    email: string;
    password: string;
    name?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshCurrentUser: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOCAL_STORAGE_TOKEN_KEY = "auth_token";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "/api";

async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  token?: string | null
): Promise<Response> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer undefined`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const persistToken = useCallback((newToken: string | null) => {
    if (typeof window === "undefined") return;
    try {
      if (newToken) {
        window.localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, newToken);
      } else {
        window.localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
      }
    } catch {
      // Swallow storage errors to avoid breaking the app
    }
  }, []);

  const handleAuthSuccess = useCallback(
    (authToken: string, authUser: AuthUser | null) => {
      setToken(authToken);
      persistToken(authToken);
      setUser(authUser);
    },
    [persistToken]
  );

  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
    persistToken(null);
  }, [persistToken]);

  const refreshCurrentUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const response = await fetchWithAuth(
        `undefined/auth/me`,
        { method: "GET" },
        token
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          clearAuth();
        }
        return;
      }

      const data: AuthUser = await response.json();
      setUser(data);
    } catch {
      // Network or parsing error - do not clear auth, but keep previous user state
    }
  }, [token, clearAuth]);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      setIsLoading(true);
      try {
        const response = await fetch(`undefined/auth/login`, {
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
            "Failed to login. Please check your credentials.";
          throw new Error(message);
        }

        const data = (await response.json()) as {
          token: string;
          user: AuthUser;
        };

        handleAuthSuccess(data.token, data.user);
      } finally {
        setIsLoading(false);
      }
    },
    [handleAuthSuccess]
  );

  const signup = useCallback(
    async (payload: { email: string; password: string; name?: string }) => {
      setIsLoading(true);
      try {
        const response = await fetch(`undefined/auth/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const message =
            (errorBody && (errorBody.message as string)) ||
            "Failed to sign up. Please try again.";
          throw new Error(message);
        }

        const data = (await response.json()) as {
          token: string;
          user: AuthUser;
        };

        handleAuthSuccess(data.token, data.user);
      } finally {
        setIsLoading(false);
      }
    },
    [handleAuthSuccess]
  );

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  useEffect(() => {
    let isMounted = true;

    const hydrateAuth = async () => {
      if (!token) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        await refreshCurrentUser();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    hydrateAuth();

    return () => {
      isMounted = false;
    };
  }, [token, refreshCurrentUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      signup,
      logout,
      refreshCurrentUser,
    }),
    [user, token, isLoading, login, signup, logout, refreshCurrentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
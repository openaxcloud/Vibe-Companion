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
  name: string;
  email: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWithCredentials = useCallback(
    async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
      const response = await fetch(input, {
        ...init,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });

      if (!response.ok) {
        let message = `Request failed with status undefined`;
        try {
          const data = await response.json();
          if (data && typeof data.message === "string") {
            message = data.message;
          }
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      try {
        return (await response.json()) as T;
      } catch {
        // In case of empty body
        return {} as T;
      }
    },
    []
  );

  const refreshUser = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithCredentials<{ user: AuthUser | null }>("/api/auth/me");
      setUser(data.user ?? null);
    } catch (err) {
      setUser(null);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to refresh user information.");
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithCredentials]);

  const login = useCallback(
    async (credentials: { email: string; password: string }): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWithCredentials<{ user: AuthUser }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(credentials),
        });
        setUser(data.user);
      } catch (err) {
        setUser(null);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Login failed.");
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchWithCredentials]
  );

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await fetchWithCredentials<unknown>("/api/auth/logout", {
        method: "POST",
      });
      setUser(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Logout failed.");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchWithCredentials]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      logout,
      refreshUser,
      isAuthenticated: !!user,
    }),
    [user, loading, error, login, logout, refreshUser]
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

export default AuthContext;
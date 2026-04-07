import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

type User = {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
};

type AuthContextState = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (params: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
};

type AuthProviderProps = {
  children: ReactNode;
};

type LoginResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

type RefreshResponse = {
  accessToken: string;
};

const AuthContext = createContext<AuthContextState | undefined>(undefined);

const ACCESS_TOKEN_KEY = "auth_access_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";
const USER_KEY = "auth_user";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "/api";

async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`undefined/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    throw new Error(message || "Failed to login");
  }

  return res.json();
}

async function apiRefreshToken(refreshToken: string): Promise<RefreshResponse> {
  const res = await fetch(`undefined/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer undefined`,
    },
    credentials: "include",
  });

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    throw new Error(message || "Failed to refresh token");
  }

  return res.json();
}

async function extractErrorMessage(res: Response): Promise<string | null> {
  try {
    const data = await res.json();
    if (data && typeof data === "object" && "message" in data) {
      return (data as { message?: string }).message ?? null;
    }
  } catch {
    // ignore JSON parse errors
  }
  return null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isAuthenticated = !!user && !!accessToken;

  const persistAuthData = useCallback((payload: { user: User; accessToken: string; refreshToken: string }) => {
    setUser(payload.user);
    setAccessToken(payload.accessToken);
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    } catch {
      // Storage might be unavailable, continue without persistence
    }
  }, []);

  const clearAuthData = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
  }, []);

  const login = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      setIsLoading(true);
      try {
        const data = await apiLogin(email, password);
        persistAuthData(data);
      } finally {
        setIsLoading(false);
      }
    },
    [persistAuthData]
  );

  const logout = useCallback(() => {
    clearAuthData();
  }, [clearAuthData]);

  const refreshToken = useCallback(async () => {
    let storedRefreshToken: string | null = null;
    try {
      storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      storedRefreshToken = null;
    }

    if (!storedRefreshToken) {
      clearAuthData();
      throw new Error("No refresh token available");
    }

    try {
      const data = await apiRefreshToken(storedRefreshToken);
      setAccessToken(data.accessToken);
      try {
        localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      } catch {
        // ignore
      }
    } catch (error) {
      clearAuthData();
      throw error;
    }
  }, [clearAuthData]);

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      try {
        let storedUser: User | null = null;
        let storedAccessToken: string | null = null;
        let storedRefreshToken: string | null = null;

        try {
          const userJson = localStorage.getItem(USER_KEY);
          storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
          storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          storedUser = userJson ? (JSON.parse(userJson) as User) : null;
        } catch {
          storedUser = null;
          storedAccessToken = null;
          storedRefreshToken = null;
        }

        if (storedUser && storedAccessToken) {
          setUser(storedUser);
          setAccessToken(storedAccessToken);
          setIsLoading(false);
          return;
        }

        if (storedRefreshToken) {
          try {
            const data = await apiRefreshToken(storedRefreshToken);
            setAccessToken(data.accessToken);
            try {
              localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
            } catch {
              // ignore
            }
            if (storedUser) {
              setUser(storedUser);
            }
          } catch {
            clearAuthData();
          }
        } else {
          clearAuthData();
        }
      } finally {
        setIsLoading(false);
      }
    };

    void initializeAuth();
  }, [clearAuthData]);

  const contextValue: AuthContextState = {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function getStoredAuthTokens(): { accessToken: string | null; refreshToken: string | null } {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  try {
    accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    accessToken = null;
    refreshToken = null;
  }
  return { accessToken, refreshToken };
}
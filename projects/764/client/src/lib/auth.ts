import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roles?: string[];
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = "app_auth_token";

type AuthProviderProps = {
  children: ReactNode;
};

async function fakeApiLogin(credentials: LoginCredentials): Promise<{
  token: string;
  user: AuthUser;
}> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (credentials.email === "demo@example.com" && credentials.password === "demo") {
    return {
      token: "demo-token",
      user: {
        id: "1",
        name: "Demo User",
        email: "demo@example.com",
        roles: ["user"],
      },
    };
  }
  throw new Error("Invalid credentials");
}

async function fakeApiGetCurrentUser(token: string): Promise<AuthUser> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (token === "demo-token") {
    return {
      id: "1",
      name: "Demo User",
      email: "demo@example.com",
      roles: ["user"],
    };
  }
  throw new Error("Invalid token");
}

async function fakeApiLogout(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200));
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadUserFromToken = useCallback(async () => {
    const token = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await fakeApiGetCurrentUser(token);
      setUser(currentUser);
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserFromToken();
  }, [loadUserFromToken]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const { token, user: loggedInUser } = await fakeApiLogin(credentials);
      window.localStorage.setItem(AUTH_STORAGE_KEY, token);
      setUser(loggedInUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await fakeApiLogout();
    } finally {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadUserFromToken();
    } finally {
      setIsLoading(false);
    }
  }, [loadUserFromToken]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

type RequireAuthOptions = {
  redirectTo?: string;
  requiredRoles?: string[];
};

export function useRequireAuth(options: RequireAuthOptions = {}): {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthorized: boolean;
  redirectTo?: string;
} {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { redirectTo, requiredRoles } = options;

  const isAuthorized =
    isAuthenticated &&
    (!requiredRoles ||
      requiredRoles.length === 0 ||
      (user?.roles || []).some((role) => requiredRoles.includes(role)));

  return {
    user,
    isLoading,
    isAuthenticated,
    isAuthorized,
    redirectTo,
  };
}

type ProtectedProps = {
  children: ReactNode;
  fallback?: ReactNode;
  requiredRoles?: string[];
};

export const Protected: React.FC<ProtectedProps> = ({
  children,
  fallback = null,
  requiredRoles,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated) return <>{fallback}</>;

  if (
    requiredRoles &&
    requiredRoles.length > 0 &&
    !(user?.roles || []).some((role) => requiredRoles.includes(role))
  ) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
}

export function clearStoredAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
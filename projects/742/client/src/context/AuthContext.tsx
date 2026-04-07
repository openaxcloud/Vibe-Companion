import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import axios, { AxiosInstance } from "axios";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  [key: string]: any;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    data: Record<string, any> & { email: string; password: string }
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  axiosClient: AxiosInstance;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = "auth_token";

const axiosClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "/api",
  withCredentials: true,
});

let isRefreshingToken = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

const subscribeTokenRefresh = (cb: (token: string | null) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string | null) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  });
  const [loading, setLoading] = useState<boolean>(true);

  const isAuthenticated = !!token && !!user;

  const setAuthToken = useCallback((newToken: string | null) => {
    setToken(newToken);
    if (typeof window !== "undefined") {
      if (newToken) {
        localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
    if (newToken) {
      axiosClient.defaults.headers.common.Authorization = `Bearer undefined`;
    } else {
      delete axiosClient.defaults.headers.common.Authorization;
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const response = await axiosClient.get<AuthUser>("/auth/me");
      setUser(response.data);
    } catch (error) {
      console.error("Failed to fetch current user", error);
      setUser(null);
      setAuthToken(null);
    }
  }, [token, setAuthToken]);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await axiosClient.post<{ token: string }>(
        "/auth/refresh"
      );
      const newToken = response.data.token;
      setAuthToken(newToken);
      return newToken;
    } catch (error) {
      console.error("Failed to refresh token", error);
      setAuthToken(null);
      setUser(null);
      return null;
    }
  }, [setAuthToken]);

  useEffect(() => {
    if (token) {
      axiosClient.defaults.headers.common.Authorization = `Bearer undefined`;
    } else {
      delete axiosClient.defaults.headers.common.Authorization;
    }

    const requestInterceptor = axiosClient.interceptors.request.use(
      (config) => {
        if (token && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer undefined`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axiosClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url?.includes("/auth/login") &&
          !originalRequest.url?.includes("/auth/register")
        ) {
          if (isRefreshingToken) {
            return new Promise((resolve, reject) => {
              subscribeTokenRefresh((newToken) => {
                if (!newToken) {
                  reject(error);
                  return;
                }
                originalRequest.headers.Authorization = `Bearer undefined`;
                resolve(axiosClient(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          isRefreshingToken = true;

          try {
            const newToken = await refreshToken();
            isRefreshingToken = false;
            onRefreshed(newToken);

            if (!newToken) {
              return Promise.reject(error);
            }

            originalRequest.headers.Authorization = `Bearer undefined`;
            return axiosClient(originalRequest);
          } catch (refreshError) {
            isRefreshingToken = false;
            onRefreshed(null);
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axiosClient.interceptors.request.eject(requestInterceptor);
      axiosClient.interceptors.response.eject(responseInterceptor);
    };
  }, [token, refreshToken]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (token) {
          await fetchCurrentUser();
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token, fetchCurrentUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const response = await axiosClient.post<{
          token: string;
          user: AuthUser;
        }>("/auth/login", { email, password });

        const receivedToken = response.data.token;
        setAuthToken(receivedToken);
        setUser(response.data.user);
      } finally {
        setLoading(false);
      }
    },
    [setAuthToken]
  );

  const register = useCallback(
    async (data: Record<string, any> & { email: string; password: string }) => {
      setLoading(true);
      try {
        const response = await axiosClient.post<{
          token: string;
          user: AuthUser;
        }>("/auth/register", data);

        const receivedToken = response.data.token;
        setAuthToken(receivedToken);
        setUser(response.data.user);
      } finally {
        setLoading(false);
      }
    },
    [setAuthToken]
  );

  const logout = useCallback(() => {
    setUser(null);
    setAuthToken(null);
    try {
      axiosClient.post("/auth/logout").catch(() => undefined);
    } catch {
      // ignore
    }
  }, [setAuthToken]);

  const refreshUser = useCallback(async () => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    refreshUser,
    axiosClient,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
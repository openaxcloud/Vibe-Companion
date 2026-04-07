import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (process.env as any).VITE_API_BASE_URL ||
  "http://localhost:4000/api";

const axiosClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (error: unknown) => void;
}[] = [];

type RefreshResponse = {
  accessToken: string;
};

type ErrorResponse = {
  message?: string;
  error?: string;
  statusCode?: number;
};

const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
      return;
    }
    prom.resolve(token);
  });
  failedQueue = [];
};

const getAccessToken = (): string | null => {
  try {
    const token = localStorage.getItem("accessToken");
    return token || null;
  } catch {
    return null;
  }
};

const setAccessToken = (token: string | null): void => {
  try {
    if (!token) {
      localStorage.removeItem("accessToken");
      return;
    }
    localStorage.setItem("accessToken", token);
  } catch {
    // ignore storage errors
  }
};

const clearAuth = (): void => {
  setAccessToken(null);
};

const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const response = await axios.post<RefreshResponse>(
      `undefined/auth/refresh`,
      {},
      {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    const newToken = response.data?.accessToken;
    if (newToken) {
      setAccessToken(newToken);
      return newToken;
    }
    clearAuth();
    return null;
  } catch {
    clearAuth();
    return null;
  }
};

axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = getAccessToken();
    if (token && !config.headers?.Authorization) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer undefined`,
      };
    }

    if (!config.headers?.["Content-Type"]) {
      config.headers = {
        ...config.headers,
        "Content-Type": "application/json",
      };
    }

    if (!config.headers?.Accept) {
      config.headers = {
        ...config.headers,
        Accept: "application/json",
      };
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError<ErrorResponse>) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response?.status;

    if (status === 401 && !originalRequest._retry) {
      if (!isRefreshing) {
        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const newToken = await refreshAccessToken();
          isRefreshing = false;
          processQueue(null, newToken);

          if (!newToken) {
            return Promise.reject(error);
          }

          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer undefined`,
          };

          return axiosClient(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          processQueue(refreshError, null);
          return Promise.reject(refreshError);
        }
      }

      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token?: unknown) => {
            if (!token) {
              reject(error);
              return;
            }
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>)[
                "Authorization"
              ] = `Bearer undefined`;
            } else {
              originalRequest.headers = {
                Authorization: `Bearer undefined`,
              };
            }
            resolve(axiosClient(originalRequest));
          },
          reject,
        });
      });
    }

    const transformedError: AxiosError<ErrorResponse> = {
      ...error,
      message:
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message,
    };

    return Promise.reject(transformedError);
  }
);

export { axiosClient, getAccessToken, setAccessToken, clearAuth };
export default axiosClient;
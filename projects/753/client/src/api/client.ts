import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

export interface ApiErrorPayload {
  message?: string;
  code?: string | number;
  details?: unknown;
}

export class ApiClientError<T = ApiErrorPayload> extends Error {
  public readonly status?: number;
  public readonly data?: T;
  public readonly originalError: AxiosError<T>;

  constructor(error: AxiosError<T>) {
    const status = error.response?.status;
    const payload = error.response?.data;
    const messageFromPayload =
      (payload as ApiErrorPayload | undefined)?.message ||
      error.message ||
      "Request failed";

    super(messageFromPayload);

    this.name = "ApiClientError";
    this.status = status;
    this.data = payload;
    this.originalError = error;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiClientError);
    }
  }
}

export const createApiClient = (): AxiosInstance => {
  const baseURL =
    (typeof window !== "undefined"
      ? (window as any)?.__API_BASE_URL__
      : process.env.REACT_APP_API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.VITE_API_BASE_URL ||
        process.env.API_BASE_URL) || "";

  const instance: AxiosInstance = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  instance.interceptors.request.use(
    (config: AxiosRequestConfig) => {
      if (
        config.data &&
        typeof config.data === "object" &&
        !(config.data instanceof FormData)
      ) {
        config.data = JSON.stringify(config.data);
      }

      if (config.headers) {
        const headers =
          "common" in config.headers ? config.headers.common : config.headers;
        if (headers && typeof headers === "object") {
          if (!("Content-Type" in headers)) {
            (headers as Record<string, string>)["Content-Type"] =
              "application/json";
          }
        }
      }

      return config;
    },
    (error: unknown) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const contentType = response.headers["content-type"];

      if (
        contentType &&
        contentType.includes("application/json") &&
        typeof response.data === "string"
      ) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const parsed = JSON.parse(response.data);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          (response as any).data = parsed;
        } catch {
          // Fallback: keep raw string if JSON.parsing fails
        }
      }

      return response;
    },
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const apiError = new ApiClientError(error);
        return Promise.reject(apiError);
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

const apiClient = createApiClient();

export default apiClient;
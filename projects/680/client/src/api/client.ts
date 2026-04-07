import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse
} from "axios";

export interface ApiErrorPayload {
  message?: string;
  code?: string | number;
  details?: unknown;
  status?: number;
}

export class ApiError extends Error {
  public readonly status?: number;
  public readonly code?: string | number;
  public readonly details?: unknown;
  public readonly originalError?: unknown;

  constructor(payload: ApiErrorPayload & { originalError?: unknown }) {
    super(payload.message || "An unexpected error occurred");
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = "ApiError";
    this.status = payload.status;
    this.code = payload.code;
    this.details = payload.details;
    this.originalError = payload.originalError;
  }
}

export interface TokenProvider {
  getAccessToken: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void | Promise<void>;
  onForbidden?: () => void | Promise<void>;
  onError?: (error: ApiError) => void | Promise<void>;
}

export interface ApiClientConfig {
  baseURL?: string;
  withCredentials?: boolean;
  tokenProvider?: TokenProvider;
  /**
   * Optional function to transform AxiosError into ApiError.
   * If not provided, a default transformer is used.
   */
  errorTransformer?: (error: AxiosError) => ApiError;
}

const defaultBaseURL =
  (typeof window !== "undefined" &&
    (window as unknown as { __API_BASE_URL__?: string }).__API_BASE_URL__) ||
  (typeof process !== "undefined" &&
    (process as unknown as { env?: { [key: string]: string } }).env &&
    (process as unknown as { env: { [key: string]: string } }).env
      .VITE_API_BASE_URL) ||
  "/api";

const defaultErrorTransformer = (error: AxiosError): ApiError => {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data as
      | {
          message?: string;
          error?: string;
          code?: string | number;
          details?: unknown;
        }
      | undefined;

    return new ApiError({
      message:
        data?.message ||
        data?.error ||
        error.message ||
        `Request failed with status code undefined`,
      code: data?.code ?? status,
      details: data?.details ?? data,
      status,
      originalError: error
    });
  }

  if (error.request) {
    return new ApiError({
      message: "Network error or no response from server",
      code: "NETWORK_ERROR",
      details: undefined,
      status: undefined,
      originalError: error
    });
  }

  return new ApiError({
    message: error.message || "Unexpected client error",
    code: "CLIENT_ERROR",
    details: undefined,
    status: undefined,
    originalError: error
  });
};

const createAxiosInstance = (config?: ApiClientConfig): AxiosInstance => {
  const instance = axios.create({
    baseURL: config?.baseURL ?? defaultBaseURL,
    withCredentials: config?.withCredentials ?? true,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    }
  });

  const tokenProvider = config?.tokenProvider;
  const transformError = config?.errorTransformer ?? defaultErrorTransformer;

  instance.interceptors.request.use(
    async (request: AxiosRequestConfig) => {
      if (!tokenProvider) return request;

      try {
        const token = await Promise.resolve(tokenProvider.getAccessToken());
        if (token) {
          request.headers = {
            ...(request.headers || {}),
            Authorization: request.headers?.Authorization || `Bearer undefined`
          };
        }
      } catch {
        // Swallow token provider errors; request can proceed without token.
      }

      return request;
    },
    (error: unknown) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const apiError = transformError(error);

      const status = apiError.status;
      const isUnauthorized = status === 401;
      const isForbidden = status === 403;

      try {
        if (isUnauthorized && tokenProvider?.onUnauthorized) {
          await Promise.resolve(tokenProvider.onUnauthorized());
        } else if (isForbidden && tokenProvider?.onForbidden) {
          await Promise.resolve(tokenProvider.onForbidden());
        }

        if (tokenProvider?.onError) {
          await Promise.resolve(tokenProvider.onError(apiError));
        }
      } catch {
        // Avoid throwing from hooks; original error should propagate.
      }

      return Promise.reject(apiError);
    }
  );

  return instance;
};

let sharedClient: AxiosInstance | null = null;
let sharedConfig: ApiClientConfig | undefined;

export const initApiClient = (config?: ApiClientConfig): AxiosInstance => {
  sharedConfig = config;
  sharedClient = createAxiosInstance(config);
  return sharedClient;
};

export const getApiClient = (): AxiosInstance => {
  if (!sharedClient) {
    sharedClient = createAxiosInstance(sharedConfig);
  }
  return sharedClient;
};

export const setTokenProvider = (tokenProvider: TokenProvider | null): void => {
  sharedConfig = {
    ...(sharedConfig || {}),
    tokenProvider: tokenProvider || undefined
  };
  sharedClient = createAxiosInstance(sharedConfig);
};

export const apiClient = getApiClient();

export default apiClient;
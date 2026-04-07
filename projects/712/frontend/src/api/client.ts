import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

export interface ApiErrorDetails {
  status: number | null;
  message: string;
  code?: string;
  validationErrors?: Record<string, string[]>;
  raw?: unknown;
}

export class ApiError extends Error {
  public status: number | null;
  public code?: string;
  public validationErrors?: Record<string, string[]>;
  public raw?: unknown;

  constructor(details: ApiErrorDetails) {
    super(details.message);
    this.name = "ApiError";
    this.status = details.status;
    this.code = details.code;
    this.validationErrors = details.validationErrors;
    this.raw = details.raw;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiClientConfig {
  baseURL?: string;
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
  onError?: (error: ApiError) => void;
  /**
   * Optional additional headers that should be sent with every request.
   */
  defaultHeaders?: Record<string, string>;
}

export interface TypedRequestConfig<TRequest = unknown> extends AxiosRequestConfig<TRequest> {
  skipAuth?: boolean;
}

export interface TypedResponse<TResponse> extends AxiosResponse<TResponse> {}

const DEFAULT_BASE_URL =
  (typeof window !== "undefined" && window.location && window.location.origin
    ? window.location.origin
    : "") + "/api";

const CONTENT_TYPE_JSON = "application/json";

class ApiClient {
  private axiosInstance: AxiosInstance;
  private getToken?: ApiClientConfig["getToken"];
  private onUnauthorized?: ApiClientConfig["onUnauthorized"];
  private onForbidden?: ApiClientConfig["onForbidden"];
  private onError?: ApiClientConfig["onError"];

  constructor(config: ApiClientConfig = {}) {
    const {
      baseURL = DEFAULT_BASE_URL,
      getToken,
      onUnauthorized,
      onForbidden,
      onError,
      defaultHeaders = {},
    } = config;

    this.getToken = getToken;
    this.onUnauthorized = onUnauthorized;
    this.onForbidden = onForbidden;
    this.onError = onError;

    this.axiosInstance = axios.create({
      baseURL,
      withCredentials: true,
      headers: {
        "Content-Type": CONTENT_TYPE_JSON,
        Accept: CONTENT_TYPE_JSON,
        ...defaultHeaders,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      this.handleRequest.bind(this),
      (error: AxiosError) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      this.handleResponseError.bind(this)
    );
  }

  private async handleRequest(
    config: InternalAxiosRequestConfig
  ): Promise<InternalAxiosRequestConfig> {
    const typedConfig = config as InternalAxiosRequestConfig & { skipAuth?: boolean };

    if (!typedConfig.skipAuth && this.getToken) {
      const token = await this.getToken();
      if (token) {
        // eslint-disable-next-line no-param-reassign
        typedConfig.headers = {
          ...typedConfig.headers,
          Authorization: `Bearer undefined`,
        };
      }
    }

    if (
      typedConfig.data &&
      typeof typedConfig.data === "object" &&
      !(typedConfig.data instanceof FormData)
    ) {
      // Ensure JSON content type for non-FormData bodies
      // eslint-disable-next-line no-param-reassign
      typedConfig.headers = {
        ...typedConfig.headers,
        "Content-Type": CONTENT_TYPE_JSON,
      };
    }

    return typedConfig;
  }

  private handleResponseError(error: AxiosError): Promise<never> {
    const apiError = this.normalizeError(error);

    if (apiError.status === 401 && this.onUnauthorized) {
      this.onUnauthorized();
    } else if (apiError.status === 403 && this.onForbidden) {
      this.onForbidden();
    }

    if (this.onError) {
      this.onError(apiError);
    }

    return Promise.reject(apiError);
  }

  private normalizeError(error: AxiosError): ApiError {
    if (error.response) {
      const { status, data } = error.response as AxiosResponse<any>;
      let message = "An error occurred while communicating with the server.";
      let code: string | undefined;
      let validationErrors: Record<string, string[]> | undefined;

      if (data) {
        if (typeof data === "string") {
          message = data;
        } else if (typeof data === "object") {
          if (typeof data.message === "string") {
            message = data.message;
          }
          if (typeof data.error === "string" && !data.message) {
            message = data.error;
          }
          if (typeof data.code === "string") {
            code = data.code;
          }
          if (data.errors && typeof data.errors === "object") {
            validationErrors = data.errors as Record<string, string[]>;
          }
        }
      }

      return new ApiError({
        status,
        message,
        code,
        validationErrors,
        raw: data,
      });
    }

    if (error.request) {
      return new ApiError({
        status: null,
        message: "No response received from the server. Please check your connection.",
        raw: error.request,
      });
    }

    return new ApiError({
      status: null,
      message: error.message || "Unexpected error occurred.",
      raw: error,
    });
  }

  public async request<TResponse = unknown, TRequest = unknown>(
    method: HttpMethod,
    url: string,
    config: TypedRequestConfig<TRequest> = {}
  ): Promise<TResponse> {
    const response = await this.axiosInstance.request<TResponse, AxiosResponse<TResponse>, TRequest>(
      {
        ...config,
        method,
        url,
      }
    );
    return response.data;
  }

  public get<TResponse = unknown>(
    url: string,
    config?: TypedRequestConfig
  ): Promise<TResponse> {
    return this.request<TResponse>("GET", url, config);
  }

  public post<TResponse = unknown, TRequest = unknown>(
    url: string,
    data?: TRequest,
    config?: TypedRequestConfig<TRequest>
  ): Promise<TResponse> {
    return this.request<TResponse, TRequest>("POST", url, { ...config, data });
  }

  public put<TResponse = unknown, TRequest = unknown>(
    url: string,
    data?: TRequest,
    config?: TypedRequestConfig<TRequest>
  ): Promise<TResponse> {
    return this.request<TResponse, TRequest>("PUT", url, { ...config, data });
  }

  public patch<TResponse = unknown, TRequest = unknown>(
    url: string,
    data?: TRequest,
    config?: TypedRequestConfig<TRequest>
  ): Promise<TResponse> {
    return this.request<TResponse, TRequest>("PATCH", url, { ...config, data });
  }

  public delete<TResponse = unknown, TRequest = unknown>(
    url: string,
    config?: TypedRequestConfig<TRequest>
  ): Promise<TResponse> {
    return this.request<TResponse, TRequest>("DELETE", url, config);
  }

  public get instance(): AxiosInstance {
    return this.axiosInstance;
  }
}

let defaultClient: ApiClient | null = null;

export const createApiClient = (config?: ApiClientConfig): ApiClient => {
  return new ApiClient(config);
};

export const getApiClient = (config?: ApiClientConfig): ApiClient => {
  if (!defaultClient) {
    defaultClient = new ApiClient(config);
  }
  return defaultClient;
};

export const apiClient = getApiClient();
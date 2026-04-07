/* eslint-disable @typescript-eslint/no-explicit-any */
import { URLSearchParams } from "url";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  /**
   * Hook to customize fetch options before the request is sent.
   */
  prepareRequestInit?: (init: RequestInit) => RequestInit | Promise<RequestInit>;
}

export interface ApiErrorPayload {
  message: string;
  code?: string | number;
  status?: number;
  details?: unknown;
  [key: string]: any;
}

export class ApiError extends Error {
  public readonly status: number | undefined;
  public readonly code: string | number | undefined;
  public readonly details: unknown;
  public readonly raw: unknown;

  constructor(message: string, options: ApiErrorPayload = {}, raw?: unknown) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.raw = raw;
  }
}

export interface RequestOptions<TBody = unknown, TQuery = Record<string, any>> {
  method?: HttpMethod;
  path: string;
  query?: TQuery;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

const DEFAULT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

const isJsonContentType = (headers: Headers): boolean => {
  const contentType = headers.get("content-type");
  return !!contentType && contentType.toLowerCase().includes("application/json");
};

const buildQueryString = (query?: Record<string, any>): string => {
  if (!query) return "";

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          params.append(key, String(item));
        }
      });
    } else if (value instanceof Date) {
      params.append(key, value.toISOString());
    } else if (typeof value === "object") {
      params.append(key, JSON.stringify(value));
    } else {
      params.append(key, String(value));
    }
  });

  const qs = params.toString();
  return qs ? `?undefined` : "";
};

const normalizeError = async (response: Response): Promise<ApiError> => {
  const status = response.status;
  let payload: any = null;
  let text: string | null = null;

  try {
    if (isJsonContentType(response.headers)) {
      payload = await response.json();
    } else {
      text = await response.text();
    }
  } catch {
    // Ignore parsing errors; we'll fall back to status/text
  }

  const raw = payload ?? text;
  let message = "Request failed";
  let code: string | number | undefined;
  let details: unknown;

  if (payload && typeof payload === "object") {
    if (typeof payload.message === "string" && payload.message.trim()) {
      message = payload.message;
    } else if (typeof payload.error === "string" && payload.error.trim()) {
      message = payload.error;
    }

    if (payload.code !== undefined) {
      code = payload.code;
    }
    if (payload.details !== undefined) {
      details = payload.details;
    }
  } else if (typeof text === "string" && text.trim()) {
    message = text;
  } else {
    message = `Request failed with status undefined`;
  }

  return new ApiError(message, { status, code, details }, raw);
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly prepareRequestInit?: (init: RequestInit) => RequestInit | Promise<RequestInit>;

  constructor(config: ApiClientConfig) {
    if (!config.baseUrl) {
      throw new Error("ApiClient requires a baseUrl");
    }

    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.defaultHeaders = {
      ...DEFAULT_HEADERS,
      ...(config.defaultHeaders ?? {}),
    };
    this.prepareRequestInit = config.prepareRequestInit;
  }

  public async request<TResponse = unknown, TBody = unknown, TQuery = Record<string, any>>(
    options: RequestOptions<TBody, TQuery>
  ): Promise<ApiResponse<TResponse>> {
    const { path, method = "GET", query, body, headers = {}, signal } = options;

    const urlPath = path.startsWith("/") ? path : `/undefined`;
    const queryString = buildQueryString(query as Record<string, any>);
    const url = `undefinedundefinedundefined`;

    const finalHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...headers,
    };

    const init: RequestInit = {
      method,
      headers: finalHeaders,
      credentials: "include",
      signal,
    };

    if (body !== undefined && body !== null && method !== "GET" && method !== "HEAD") {
      const contentType = finalHeaders["Content-Type"] || finalHeaders["content-type"];
      if (contentType && contentType.toLowerCase().includes("application/json")) {
        init.body = JSON.stringify(body);
      } else if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
        // Let fetch handle it
        init.body = body as BodyInit;
        // If using FormData or other multipart type, browser sets appropriate headers
        if (body instanceof FormData && (finalHeaders["Content-Type"] || finalHeaders["content-type"])) {
          delete finalHeaders["Content-Type"];
          delete finalHeaders["content-type"];
        }
      } else {
        init.body = String(body);
      }
    }

    const preparedInit = this.prepareRequestInit ? await this.prepareRequestInit(init) : init;

    let response: Response;
    try {
      response = await fetch(url, preparedInit);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new ApiError("Request was aborted", { code: "aborted" }, error);
      }
      throw new ApiError(error?.message || "Network request failed", { code: "network_error" }, error);
    }

    if (!response.ok) {
      throw await normalizeError(response);
    }

    let data: any = null;
    const noContent = response.status === 204 || response.status === 205;

    if (!noContent) {
      if (isJsonContentType(response.headers)) {
        try {
          data = await response.json();
        } catch (error) {
          throw new ApiError("Failed to parse JSON response", { status: response.status }, error);
        }
      } else {
        data = await response.text();
      }
    }

    return {
      data: data as TResponse,
      status: response.status,
      headers: response.headers,
    };
  }

  public get<TResponse = unknown, TQuery = Record<string, any>>(
    path: string,
    query?: TQuery,
    options?: Omit<RequestOptions<never, TQuery>, "method" | "path" | "query" | "body">
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse, never, TQuery>({
      method: "GET",
      path,
      query,
      ...(options ?? {}),
    });
  }

  public post<TResponse = unknown, TBody = unknown, TQuery = Record<string, any>>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody, TQuery>, "method" | "path" | "body">
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse, TBody, TQuery>({
      method: "POST",
      path,
      body,
      ...(options ?? {}),
    });
  }

  public put<TResponse = unknown, TBody = unknown, TQuery = Record<string, any>>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody, TQuery>, "method" | "path" | "body">
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse, TBody, TQuery>({
      method: "PUT",
      path,
      body,
      ...(options ?? {}),
    });
  }

  public patch<TResponse = unknown, TBody = unknown, TQuery = Record<string, any>>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody, TQuery>, "method" | "path" | "body">
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse, TBody, TQuery>({
      method: "PATCH",
      path,
      body,
      ...(options ?? {}),
    });
  }

  public delete<TResponse = unknown, TQuery = Record<string, any>, TBody = unknown>(
    path: string,
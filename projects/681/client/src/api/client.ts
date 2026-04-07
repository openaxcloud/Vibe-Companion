/* eslint-disable @typescript-eslint/no-explicit-any */
import { URL } from "url";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpClientConfig {
  baseUrl?: string;
  defaultHeaders?: HeadersInit;
  /**
   * Timeout in milliseconds for each request.
   * If not provided, requests will not be explicitly timed out.
   */
  timeoutMs?: number;
}

export interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: HeadersInit;
  body?: TBody;
  /**
   * When true, will skip JSON serialization and send body as-is.
   * Useful for FormData, Blob, etc.
   */
  rawBody?: boolean;
  /**
   * Optional per-request timeout override in milliseconds.
   */
  timeoutMs?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  ok: boolean;
  headers: Headers;
  data: T;
}

export interface ErrorPayload {
  message: string;
  code?: string;
  details?: any;
}

export class HttpClientError<TError = ErrorPayload> extends Error {
  public readonly status: number;
  public readonly data?: TError;
  public readonly causeError?: unknown;

  constructor(message: string, status: number, data?: TError, cause?: unknown) {
    super(message);
    this.name = "HttpClientError";
    this.status = status;
    this.data = data;
    this.causeError = cause;
  }
}

export class NetworkError extends Error {
  public readonly causeError?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    this.causeError = cause;
  }
}

export class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

const getBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    // Browser environment
    const envBase =
      (window as any)?.ENV?.API_BASE_URL ??
      (import.meta as any)?.env?.VITE_API_BASE_URL ??
      process.env?.VITE_API_BASE_URL;
    if (envBase) return envBase as string;
    return window.location.origin;
  }

  // Node or other environments
  const envBase =
    process.env.API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    (process as any).env?.API_BASE_URL ||
    (process as any).env?.VITE_API_BASE_URL;

  if (!envBase) {
    throw new Error("API base URL is not configured in environment variables");
  }

  return envBase;
};

const buildUrl = (
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>
): string => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/undefined`;
  const url = new URL(`undefinedundefined`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.append(key, String(value));
    });
  }

  return url.toString();
};

export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: HeadersInit;
  private readonly timeoutMs?: number;

  constructor(config: HttpClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? getBaseUrl();
    this.defaultHeaders = config.defaultHeaders ?? {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    this.timeoutMs = config.timeoutMs;
  }

  public async request<TResponse = unknown, TBody = unknown>(
    options: RequestOptions<TBody>
  ): Promise<HttpResponse<TResponse>> {
    const {
      method = "GET",
      path,
      query,
      headers,
      body,
      rawBody = false,
      timeoutMs,
    } = options;

    const url = buildUrl(this.baseUrl, path, query);

    const controller =
      typeof AbortController !== "undefined"
        ? new AbortController()
        : undefined;
    const ms = timeoutMs ?? this.timeoutMs;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (controller && typeof ms === "number" && Number.isFinite(ms) && ms > 0) {
      timeoutId = setTimeout(() => {
        controller.abort();
      }, ms);
    }

    const finalHeaders = new Headers(this.defaultHeaders);

    if (headers) {
      const incoming = new Headers(headers);
      incoming.forEach((value, key) => {
        if (value === undefined || value === null) return;
        finalHeaders.set(key, value);
      });
    }

    const fetchInit: RequestInit = {
      method,
      headers: finalHeaders,
      signal: controller?.signal,
    };

    if (body !== undefined && body !== null && method !== "GET") {
      if (rawBody) {
        (fetchInit as any).body = body as any;
      } else {
        const contentType = finalHeaders.get("Content-Type");
        if (!contentType || contentType.includes("application/json")) {
          finalHeaders.set("Content-Type", "application/json");
          (fetchInit as any).body = JSON.stringify(body);
        } else {
          (fetchInit as any).body = body as any;
        }
      }
    }

    let response: Response;

    try {
      response = await fetch(url, fetchInit);
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (error?.name === "AbortError") {
        throw new TimeoutError();
      }
      throw new NetworkError("Network request failed", error);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    const contentType = response.headers.get("Content-Type") || "";
    const isJson =
      contentType.includes("application/json") ||
      contentType.includes("+json");

    let parsedBody: any = null;
    if (response.status !== 204 && response.status !== 205) {
      if (isJson) {
        try {
          parsedBody = await response.json();
        } catch {
          parsedBody = null;
        }
      } else {
        try {
          parsedBody = await response.text();
        } catch {
          parsedBody = null;
        }
      }
    }

    if (!response.ok) {
      const errorPayload: ErrorPayload =
        parsedBody && typeof parsedBody === "object"
          ? {
              message:
                (parsedBody as any).message ||
                (parsedBody as any).error ||
                "Request failed",
              code: (parsedBody as any).code,
              details: (parsedBody as any).details ?? parsedBody,
            }
          : {
              message: `Request failed with status undefined`,
            };

      throw new HttpClientError<ErrorPayload>(
        errorPayload.message,
        response.status,
        errorPayload
      );
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      data: parsedBody as TResponse,
    };
  }

  public get<TResponse = unknown>(
    path: string,
    query?: RequestOptions["query"],
    options?: Omit<RequestOptions, "path" | "method" | "query">
  ): Promise<HttpResponse<TResponse>> {
    return this.request<TResponse>({
      method: "GET",
      path,
      query,
      ...(options ?? {}),
    });
  }

  public post<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "path" | "method" | "body">
  ): Promise<HttpResponse<TResponse>> {
    return this.request<TResponse, TBody>({
      method: "POST",
      path,
      body,
      ...(options ?? {}),
    });
  }

  public put<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "path" | "method" | "body">
  ): Promise<HttpResponse<TResponse>> {
    return this.request<TResponse, TBody>({
      method: "PUT",
      path,
      body,
      ...(options ?? {}),
    });
  }

  public patch<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "path" | "method" | "body">
  ): Promise<HttpResponse<TResponse>> {
    return this.request<TResponse, TBody>({
      method: "PATCH",
      path,
      body,
      ...(options ?? {}),
    });
  }

  public delete<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: Omit<RequestOptions<TBody>, "path" | "method" | "body">
  ): Promise<HttpResponse<TResponse>> {
    return this.request<TResponse, TBody>({
      method: "DELETE",
      path,
      body,
      ...(options ?? {}),
    });
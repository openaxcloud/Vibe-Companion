/* eslint-disable @typescript-eslint/no-explicit-any */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiConfig {
  baseUrl: string;
  getToken?: () => string | null | undefined;
  /**
   * Optional hook to handle unauthorized (401) responses globally.
   * Useful for redirecting to login or clearing auth state.
   */
  onUnauthorized?: () => void;
}

export interface ApiRequestOptions<TBody = unknown> {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ApiErrorDetail {
  message: string;
  code?: string | number;
  status?: number;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string | number;
  public readonly details?: unknown;
  public readonly meta?: Record<string, unknown>;

  constructor(detail: ApiErrorDetail & { status: number; meta?: Record<string, unknown> }) {
    super(detail.message);
    this.name = 'ApiError';
    this.status = detail.status;
    this.code = detail.code;
    this.details = detail.details;
    this.meta = detail.meta;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

let config: ApiConfig | null = null;

export const configureApi = (cfg: ApiConfig): void => {
  config = {
    baseUrl: cfg.baseUrl.replace(/\/+$/, ''),
    getToken: cfg.getToken,
    onUnauthorized: cfg.onUnauthorized,
  };
};

const ensureConfigured = (): ApiConfig => {
  if (!config) {
    throw new Error('API not configured. Call configureApi(...) before using API helpers.');
  }
  return config;
};

const buildQueryString = (query?: ApiRequestOptions['query']): string => {
  if (!query) return '';
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.append(key, String(value));
  });

  const qs = params.toString();
  return qs ? `?undefined` : '';
};

const parseJsonSafe = async (response: Response): Promise<any | null> => {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
};

const buildUrl = (baseUrl: string, path: string, query?: ApiRequestOptions['query']): string => {
  const cleanPath = path.startsWith('/') ? path : `/undefined`;
  return `undefinedundefinedundefined`;
};

const buildHeaders = (customHeaders?: Record<string, string>): HeadersInit => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...customHeaders,
  };

  const { getToken } = ensureConfigured();
  const token = getToken?.();
  if (token) {
    headers.Authorization = `Bearer undefined`;
  }

  return headers;
};

export const apiRequest = async <TResponse = unknown, TBody = unknown>(
  options: ApiRequestOptions<TBody>
): Promise<TResponse> => {
  const { baseUrl, onUnauthorized } = ensureConfigured();
  const { method = 'GET', path, query, body, headers, signal } = options;

  const url = buildUrl(baseUrl, path, query);

  const init: RequestInit = {
    method,
    headers: buildHeaders(headers),
    signal,
  };

  if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
    (init.headers as Record<string, string>)['Content-Type'] ??= 'application/json';
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new ApiError({
        status: 0,
        message: 'Request was aborted',
        code: 'abort_error',
        details: { originalError: error },
      });
    }

    throw new ApiError({
      status: 0,
      message: 'Network request failed',
      code: 'network_error',
      details: { originalError: error },
    });
  }

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }

    const errorDetail: ApiErrorDetail = {
      status: response.status,
      message:
        (data && (data.message || data.error || data.title)) ||
        `Request failed with status undefined`,
      code: data?.code,
      details: data,
    };

    throw new ApiError({ ...errorDetail, status: response.status });
  }

  return data as TResponse;
};

export const apiGet = async <TResponse = unknown>(
  path: string,
  query?: ApiRequestOptions['query'],
  options?: { headers?: Record<string, string>; signal?: AbortSignal }
): Promise<TResponse> => {
  return apiRequest<TResponse>({
    method: 'GET',
    path,
    query,
    headers: options?.headers,
    signal: options?.signal,
  });
};

export const apiPost = async <TResponse = unknown, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: {
    query?: ApiRequestOptions['query'];
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }
): Promise<TResponse> => {
  return apiRequest<TResponse, TBody>({
    method: 'POST',
    path,
    body,
    query: options?.query,
    headers: options?.headers,
    signal: options?.signal,
  });
};

export const apiDelete = async <TResponse = unknown>(
  path: string,
  options?: {
    query?: ApiRequestOptions['query'];
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }
): Promise<TResponse> => {
  return apiRequest<TResponse>({
    method: 'DELETE',
    path,
    query: options?.query,
    headers: options?.headers,
    signal: options?.signal,
  });
};

export const apiPut = async <TResponse = unknown, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: {
    query?: ApiRequestOptions['query'];
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }
): Promise<TResponse> => {
  return apiRequest<TResponse, TBody>({
    method: 'PUT',
    path,
    body,
    query: options?.query,
    headers: options?.headers,
    signal: options?.signal,
  });
};

export const apiPatch = async <TResponse = unknown, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: {
    query?: ApiRequestOptions['query'];
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }
): Promise<TResponse> => {
  return apiRequest<TResponse, TBody>({
    method: 'PATCH',
    path,
    body,
    query: options?.query,
    headers: options?.headers,
    signal: options?.signal,
  });
};
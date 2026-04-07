import type { PushSubscriptionJSON } from "../types/push";
import { getApiBaseUrl } from "../config/apiConfig";

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export interface RegisterPushResponse {
  success: boolean;
  subscriptionId?: string;
}

export interface UnregisterPushResponse {
  success: boolean;
}

export interface PushRegistrationPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  browser: string;
  platform: string;
  timezone: string;
  language: string;
}

type HttpMethod = "POST" | "DELETE";

const PUSH_ENDPOINT = "/push/subscriptions";

function createApiError(message: string, status?: number, code?: string): ApiError {
  const error = new Error(message) as ApiError;
  if (status !== undefined) error.status = status;
  if (code) error.code = code;
  return error;
}

async function request<TResponse>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  signal?: AbortSignal
): Promise<TResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `undefinedundefined`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
    signal,
    credentials: "include",
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let response: Response;

  try {
    response = await fetch(url, options);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw createApiError("Request aborted", undefined, "ABORTED");
    }
    throw createApiError("Network error while communicating with push service", undefined, "NETWORK_ERROR");
  }

  let data: unknown = null;
  const isJson = response.headers.get("Content-Type")?.includes("application/json");

  if (isJson) {
    try {
      data = await response.json();
    } catch {
      // ignore JSON parse errors; will be handled below if needed
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "message" in data && typeof (data as any).message === "string"
        ? (data as any).message
        : `Push API request failed with status undefined`) || "Push API request failed";

    const code =
      data && typeof data === "object" && "code" in data && typeof (data as any).code === "string"
        ? (data as any).code
        : undefined;

    throw createApiError(message, response.status, code);
  }

  return data as TResponse;
}

function normalizeSubscription(
  subscription: PushSubscription | PushSubscriptionJSON
): PushRegistrationPayload | null {
  const json: PushSubscriptionJSON =
    typeof (subscription as PushSubscription).toJSON === "function"
      ? (subscription as PushSubscription).toJSON()
      : (subscription as PushSubscriptionJSON);

  if (!json || !json.endpoint || !json.keys || !json.keys.p256dh || !json.keys.auth) {
    return null;
  }

  const browser = detectBrowser();
  const platform = navigator.platform || navigator.userAgent || "unknown";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const language = navigator.language || (navigator.languages && navigator.languages[0]) || "en";

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    browser,
    platform,
    timezone,
    language,
  };
}

function detectBrowser(): string {
  const ua = navigator.userAgent || "";
  if (/edg/i.test(ua)) return "edge";
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua)) return "chrome";
  if (/firefox|fxios/i.test(ua)) return "firefox";
  if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) return "safari";
  if (/opr\//i.test(ua)) return "opera";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "unknown";
}

export async function registerPushSubscription(
  subscription: PushSubscription | PushSubscriptionJSON,
  options?: { signal?: AbortSignal }
): Promise<RegisterPushResponse> {
  const payload = normalizeSubscription(subscription);

  if (!payload) {
    throw createApiError("Invalid push subscription data", 400, "INVALID_SUBSCRIPTION");
  }

  return request<RegisterPushResponse>(PUSH_ENDPOINT, "POST", payload, options?.signal);
}

export async function unregisterPushSubscription(
  subscription: PushSubscription | PushSubscriptionJSON,
  options?: { signal?: AbortSignal }
): Promise<UnregisterPushResponse> {
  const payload = normalizeSubscription(subscription);

  if (!payload) {
    throw createApiError("Invalid push subscription data", 400, "INVALID_SUBSCRIPTION");
  }

  const query = new URLSearchParams({ endpoint: payload.endpoint });
  const path = `undefined?undefined`;

  return request<UnregisterPushResponse>(path, "DELETE", undefined, options?.signal);
}

export async function unregisterPushByEndpoint(
  endpoint: string,
  options?: { signal?: AbortSignal }
): Promise<UnregisterPushResponse> {
  if (!endpoint) {
    throw createApiError("Endpoint is required for unregistration", 400, "INVALID_ENDPOINT");
  }

  const query = new URLSearchParams({ endpoint });
  const path = `undefined?undefined`;

  return request<UnregisterPushResponse>(path, "DELETE", undefined, options?.signal);
}
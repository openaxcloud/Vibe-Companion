import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

let csrfToken: string | null = null;

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function resetCSRFToken() {
  csrfToken = null;
}

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch("/api/csrf-token?_=" + Date.now(), {
    credentials: "include",
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken!;
  }
  return "";
}

let _sessionExpiredFired = false;
let _sessionExpiredTimer: ReturnType<typeof setTimeout> | null = null;

function handleSessionExpired() {
  if (_sessionExpiredFired) return;
  _sessionExpiredFired = true;

  if (_sessionExpiredTimer) clearTimeout(_sessionExpiredTimer);
  _sessionExpiredTimer = setTimeout(() => { _sessionExpiredFired = false; }, 30000);

  queryClient.clear();

  toast({
    title: "Session expired",
    description: "Please log in again to continue.",
    variant: "destructive",
  });

  const currentPath = window.location.pathname + window.location.search;
  const isAuthPage = currentPath.startsWith("/login") || currentPath.startsWith("/register");
  if (!isAuthPage) {
    const next = encodeURIComponent(currentPath);
    setTimeout(() => {
      window.location.href = `/login?next=${next}`;
    }, 800);
  }
}

const PUBLIC_ENDPOINTS = new Set([
  "/api/login",
  "/api/register",
  "/api/csrf-token",
  "/api/auth/me",
  "/api/me",
]);

const PUBLIC_PREFIXES = [
  "/api/models",
  "/api/marketplace",
  "/api/themes",
];

function isPublicEndpoint(rawUrl: string): boolean {
  let pathname = rawUrl;
  try {
    pathname = new URL(rawUrl, window.location.origin).pathname;
  } catch {}
  if (PUBLIC_ENDPOINTS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      const url = res.url || "";
      const pathname = url.replace(window.location.origin, "");
      if (!isPublicEndpoint(pathname)) {
        handleSessionExpired();
      }
    }
    const text = (await res.text()) || res.statusText;
    let message = text;
    try {
      const json = JSON.parse(text);
      if (json.message) message = json.message;
    } catch {}
    throw new Error(message);
  }
}

export async function apiRequest<T = Response>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    if (!csrfToken) {
      await fetchCsrfToken();
    }
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const parsed = await res.json();
    parsed.json = () => Promise.resolve(parsed);
    parsed.text = () => Promise.resolve(JSON.stringify(parsed));
    return parsed as T;
  }
  return res as unknown as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (res.status === 401 && !isPublicEndpoint(url)) {
      handleSessionExpired();
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes("40")) return false;
        return failureCount < 2;
      },
      cacheTime: 10 * 60 * 1000,
    },
    mutations: {
      retry: false,
    },
  },
});

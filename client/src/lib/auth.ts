import { apiRequest, setCsrfToken, fetchCsrfToken } from "./queryClient";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  await fetchCsrfToken();
  const data: any = await apiRequest("POST", "/api/auth/login", { email, password });
  if (data.csrfToken) {
    setCsrfToken(data.csrfToken);
  }
  if (!data.id || !data.email) {
    throw new Error(data.message || "Login failed: invalid response data");
  }
  return { id: data.id, email: data.email, displayName: data.displayName };
}

export async function register(email: string, password: string, displayName?: string, acceptedTerms?: boolean): Promise<AuthUser> {
  await fetchCsrfToken();
  const data: any = await apiRequest("POST", "/api/auth/register", { email, password, displayName, acceptedTerms });
  if (data.csrfToken) {
    setCsrfToken(data.csrfToken);
  }
  if (!data.id || !data.email) {
    throw new Error(data.message || "Registration failed: invalid response data");
  }
  return { id: data.id, email: data.email, displayName: data.displayName };
}

export async function logout(): Promise<void> {
  await apiRequest("POST", "/api/auth/logout");
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    await fetchCsrfToken();
    return res.json();
  } catch {
    return null;
  }
}

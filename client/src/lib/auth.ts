import { apiRequest, setCsrfToken, fetchCsrfToken } from "./queryClient";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  await fetchCsrfToken();
  const res = await apiRequest("POST", "/api/auth/login", { email, password });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Login failed: unexpected server response");
  }
  if (data.csrfToken) {
    setCsrfToken(data.csrfToken);
  }
  return { id: data.id, email: data.email, displayName: data.displayName };
}

export async function register(email: string, password: string, displayName?: string): Promise<AuthUser> {
  await fetchCsrfToken();
  const res = await apiRequest("POST", "/api/auth/register", { email, password, displayName });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Registration failed: unexpected server response");
  }
  if (data.csrfToken) {
    setCsrfToken(data.csrfToken);
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

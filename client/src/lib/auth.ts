import { apiRequest } from "./queryClient";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiRequest("POST", "/api/auth/login", { email, password });
  return res.json();
}

export async function register(email: string, password: string, displayName?: string): Promise<AuthUser> {
  const res = await apiRequest("POST", "/api/auth/register", { email, password, displayName });
  return res.json();
}

export async function logout(): Promise<void> {
  await apiRequest("POST", "/api/auth/logout");
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

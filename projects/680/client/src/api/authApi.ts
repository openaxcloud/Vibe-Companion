import { apiClient } from "../client";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: unknown;
}

const ENDPOINTS = {
  login: "/auth/login",
  signup: "/auth/signup",
  logout: "/auth/logout",
  me: "/auth/me",
} as const;

function normalizeError(error: unknown): ApiError {
  if (error && typeof error === "object") {
    const anyError = error as any;

    if (anyError.response) {
      const { status, data } = anyError.response;
      const message =
        (data && (data.message || data.error || data.msg)) ||
        anyError.message ||
        "An error occurred";

      return {
        message,
        status,
        details: data ?? undefined,
      };
    }

    if (anyError.message) {
      return {
        message: anyError.message,
      };
    }
  }

  return {
    message: "An unknown error occurred",
  };
}

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>(ENDPOINTS.login, payload);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function signup(payload: SignupRequest): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>(ENDPOINTS.signup, payload);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post(ENDPOINTS.logout);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await apiClient.get<User>(ENDPOINTS.me);
    return response.data;
  } catch (error) {
    const normalized = normalizeError(error);

    if (normalized.status === 401 || normalized.status === 403) {
      return null;
    }

    throw normalized;
  }
}

export const authApi = {
  login,
  signup,
  logout,
  fetchCurrentUser,
};
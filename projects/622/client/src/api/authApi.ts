import axios, { AxiosError } from 'axios';
import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[] | string>;
}

export interface LogoutResponse {
  success: boolean;
}

const AUTH_BASE_PATH = '/auth';

const extractApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;

    const message =
      (typeof data === 'object' && data && 'message' in data && typeof data.message === 'string'
        ? data.message
        : axiosError.message) || 'An unexpected error occurred';

    const errors =
      typeof data === 'object' && data && 'errors' in data && typeof data.errors === 'object'
        ? (data.errors as Record<string, string[] | string>)
        : undefined;

    return { message, status, errors };
  }

  return {
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  };
};

export const authApi = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>(`undefined/login`, payload);
      return response.data;
    } catch (error) {
      throw extractApiError(error);
    }
  },

  async register(payload: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>(`undefined/register`, payload);
      return response.data;
    } catch (error) {
      throw extractApiError(error);
    }
  },

  async logout(): Promise<LogoutResponse> {
    try {
      const response = await apiClient.post<LogoutResponse>(`undefined/logout`);
      return response.data;
    } catch (error) {
      throw extractApiError(error);
    }
  },

  async fetchCurrentUser(): Promise<User> {
    try {
      const response = await apiClient.get<User>(`undefined/me`);
      return response.data;
    } catch (error) {
      throw extractApiError(error);
    }
  },
};

export default authApi;
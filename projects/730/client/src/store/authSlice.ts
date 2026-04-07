import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: AuthStatus;
  error: string | null;
  isInitialized: boolean;
  isAuthenticating: boolean;
  lastAuthCheck: number | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name?: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

const ACCESS_TOKEN_KEY = 'app_access_token';
const REFRESH_TOKEN_KEY = 'app_refresh_token';

const persistTokens = (accessToken: string | null, refreshToken: string | null): void => {
  try {
    if (accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors (e.g., private mode)
  }
};

const loadTokenFromStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const authFetch = async <T>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<T> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (accessToken) {
    headers.Authorization = `Bearer undefined`;
  }

  const response = await fetch(`undefinedundefined`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('Content-Type');
  const hasJson = contentType && contentType.includes('application/json');
  const data = hasJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      (data && (data.message || data.error)) ||
      response.statusText ||
      'Request failed';
    const error: Error & { status?: number; data?: unknown } = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
};

export const login = createAsyncThunk<AuthResponse, LoginCredentials, { rejectValue: string }>(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await authFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      return data;
    } catch (err) {
      const error = err as Error & { status?: number; data?: any };
      const msg =
        error?.data?.message ||
        error?.message ||
        'Unable to login. Please check your credentials.';
      return rejectWithValue(msg);
    }
  }
);

export const register = createAsyncThunk<AuthResponse, RegisterPayload, { rejectValue: string }>(
  'auth/register',
  async (payload, { rejectWithValue }) => {
    try {
      const data = await authFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return data;
    } catch (err) {
      const error = err as Error & { status?: number; data?: any };
      const msg =
        error?.data?.message ||
        error?.message ||
        'Unable to register. Please try again.';
      return rejectWithValue(msg);
    }
  }
);

export const fetchCurrentUser = createAsyncThunk<AuthUser, void, { state: RootState; rejectValue: string }>(
  'auth/fetchCurrentUser',
  async (_arg, { getState, rejectWithValue }) => {
    const state = getState();
    const token = state.auth.accessToken || loadTokenFromStorage(ACCESS_TOKEN_KEY);

    if (!token) {
      return rejectWithValue('Not authenticated');
    }

    try {
      const data = await authFetch<AuthUser>('/auth/me', { method: 'GET' }, token);
      return data;
    } catch (err) {
      const error = err as Error & { status?: number; data?: any };
      const msg =
        error?.data?.message ||
        error?.message ||
        'Unable to fetch current user.';
      return rejectWithValue(msg);
    }
  }
);

export const logout = createAsyncThunk<void, void, { state: RootState; rejectValue: string }>(
  'auth/logout',
  async (_arg, { getState, rejectWithValue }) => {
    const state = getState();
    const token = state.auth.accessToken || loadTokenFromStorage(ACCESS_TOKEN_KEY);

    try {
      if (token) {
        await authFetch<void>('/auth/logout', { method: 'POST' }, token);
      }
      persistTokens(null, null);
    } catch (err) {
      persistTokens(null, null);
      const error = err as Error & { status?: number; data?: any };
      const msg =
        error?.data?.message ||
        error?.message ||
        'Unable to logout properly.';
      return rejectWithValue(msg);
    }
  }
);

const initialState: AuthState = {
  user: null,
  accessToken: loadTokenFromStorage(ACCESS_TOKEN_KEY),
  refreshToken: loadTokenFromStorage(REFRESH_TOKEN_KEY),
  status: 'idle',
  error: null,
  isInitialized: false,
  isAuthenticating: false,
  lastAuthCheck: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    initializeAuthState(state) {
      state.accessToken = loadTokenFromStorage(ACCESS_TOKEN_KEY);
      state.refreshToken = loadTokenFromStorage(REFRESH_TOKEN_KEY);
      state.isInitialized = true;
      state.status = state.accessToken ? 'authenticated' : 'unauthenticated';
    },
    clearAuthError(state) {
      state.error = null;
      if (state.status === 'error') {
        state.status = state.user ? 'authenticated' : 'idle';
      }
    },
    setTokens(
      state,
      action: PayloadAction<{ accessToken: string | null; refreshToken?: string | null }>
    ) {
      const { accessToken, refreshToken } = action.payload;
      state.accessToken = accessToken;
      if (typeof refreshToken !== 'undefined') {
        state.refreshToken = refreshToken;
      }
      persistTokens(accessToken, typeof refreshToken !== 'undefined' ? refreshToken! : state.refreshToken);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.isAuthenticating = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<AuthResponse>) => {
        state.status = 'authenticated';
        state.isAuthenticating = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken ?? null;
        state.error = null;
        state.isInitialized = true;
        state.lastAuthCheck = Date.now();
        persistTokens(state.accessToken, state.refreshToken);
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'error';
        state.isAuthenticating = false;
        state.error = action.payload || 'Login failed';
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        persistTokens(null, null);
      });

    builder
      .addCase(register.pending, (state) => {
        state.status = 'loading';
        state.isAuthenticating = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action: PayloadAction<AuthResponse>) => {
        state.status = 'authenticated';
        state.isAuthenticating = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken ?? null;
        state.error = null;
        state.isInitialized = true;
        state.lastAuthCheck = Date.now();
        persistTokens(state.accessToken, state.refreshToken);
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'error';
        state.isAuthenticating = false;
        state.error = action.payload || 'Registration failed';
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        persistTokens(null, null);
      });

    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state
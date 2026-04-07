import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialised: boolean;
  login: (params: { user: AuthUser; token: string; remember?: boolean }) => void;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  clear: () => void;
}

const TOKEN_COOKIE_NAME = "auth_token";
const TOKEN_COOKIE_MAX_AGE_DAYS = 7;

const isBrowser = typeof window !== "undefined";

const setCookie = (name: string, value: string, days?: number): void => {
  if (!isBrowser) return;
  let expires = "";
  if (days && Number.isFinite(days)) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = `; expires=undefined`;
  }
  document.cookie = `undefined=undefinedundefined; path=/; SameSite=Lax`;
};

const getCookie = (name: string): string | null => {
  if (!isBrowser) return null;
  const nameEQ = `undefined=`;
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i += 1) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length));
    }
  }
  return null;
};

const eraseCookie = (name: string): void => {
  if (!isBrowser) return;
  document.cookie = `undefined=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
};

const LOCAL_STORAGE_KEY = "auth";

const getInitialToken = (): string | null => {
  if (!isBrowser) return null;
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { state?: { token?: string | null } };
      if (parsed?.state?.token) {
        return parsed.state.token;
      }
    }
  } catch {
    // ignore
  }
  const cookieToken = getCookie(TOKEN_COOKIE_NAME);
  return cookieToken || null;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: getInitialToken(),
      isAuthenticated: !!getInitialToken(),
      isInitialised: false,
      login: ({ user, token, remember = true }) => {
        if (remember) {
          setCookie(TOKEN_COOKIE_NAME, token, TOKEN_COOKIE_MAX_AGE_DAYS);
        } else {
          setCookie(TOKEN_COOKIE_NAME, token);
        }
        set({
          user,
          token,
          isAuthenticated: true,
          isInitialised: true,
        });
      },
      logout: () => {
        eraseCookie(TOKEN_COOKIE_NAME);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isInitialised: true,
        });
      },
      setUser: (user: AuthUser | null) => {
        set((state) => ({
          ...state,
          user,
          isAuthenticated: !!(user && state.token),
        }));
      },
      setToken: (token: string | null) => {
        if (!token) {
          eraseCookie(TOKEN_COOKIE_NAME);
        } else {
          setCookie(TOKEN_COOKIE_NAME, token, TOKEN_COOKIE_MAX_AGE_DAYS);
        }
        set((state) => ({
          ...state,
          token,
          isAuthenticated: !!(state.user && token),
        }));
      },
      clear: () => {
        eraseCookie(TOKEN_COOKIE_NAME);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isInitialised: true,
        });
      },
    }),
    {
      name: LOCAL_STORAGE_KEY,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage:
        () =>
        (state, error): void => {
          if (error || !state) return;
          const tokenFromCookie = getCookie(TOKEN_COOKIE_NAME);
          if (!tokenFromCookie && state.token) {
            setCookie(TOKEN_COOKIE_NAME, state.token, TOKEN_COOKIE_MAX_AGE_DAYS);
          }
          state.isInitialised = true;
        },
    }
  )
);

export const selectAuthUser = (state: AuthState): AuthUser | null => state.user;
export const selectIsAuthenticated = (state: AuthState): boolean =>
  state.isAuthenticated;
export const selectAuthToken = (state: AuthState): string | null => state.token;
export const selectIsAuthInitialised = (state: AuthState): boolean =>
  state.isInitialised;
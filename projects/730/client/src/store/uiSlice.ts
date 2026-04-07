import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UIState {
  globalLoading: boolean;
  toasts: Toast[];
  theme: ThemeMode;
}

const THEME_STORAGE_KEY = 'app_theme_preference';

const loadInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
};

const initialState: UIState = {
  globalLoading: false,
  toasts: [],
  theme: loadInitialTheme(),
};

interface ShowToastPayload {
  message: string;
  type?: ToastType;
  duration?: number;
  id?: string;
}

interface RemoveToastPayload {
  id: string;
}

interface SetThemePayload {
  theme: ThemeMode;
}

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setGlobalLoading(state, action: PayloadAction<boolean>) {
      state.globalLoading = action.payload;
    },
    showToast(state, action: PayloadAction<ShowToastPayload>) {
      const { message, type = 'info', duration = 4000, id } = action.payload;
      const toastId =
        id ||
        `undefined-undefined`;

      const newToast: Toast = {
        id: toastId,
        message,
        type,
        duration,
      };

      state.toasts.push(newToast);
    },
    removeToast(state, action: PayloadAction<RemoveToastPayload>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload.id);
    },
    clearToasts(state) {
      state.toasts = [];
    },
    setTheme(state, action: PayloadAction<SetThemePayload>) {
      const { theme } = action.payload;
      state.theme = theme;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      }
    },
  },
});

export const {
  setGlobalLoading,
  showToast,
  removeToast,
  clearToasts,
  setTheme,
} = uiSlice.actions;

export default uiSlice.reducer;
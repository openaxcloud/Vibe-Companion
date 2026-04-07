import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
  duration?: number;
}

export interface ModalState {
  id: string;
  isOpen: boolean;
  title?: string;
  content?: unknown;
}

export interface UiState {
  isGlobalLoading: boolean;
  toasts: Toast[];
  modals: Record<string, ModalState>;
}

const initialState: UiState = {
  isGlobalLoading: false,
  toasts: [],
  modals: {},
};

interface ShowToastPayload {
  message: string;
  severity?: ToastSeverity;
  duration?: number;
  id?: string;
}

interface RemoveToastPayload {
  id: string;
}

interface ShowModalPayload {
  id: string;
  title?: string;
  content?: unknown;
}

interface HideModalPayload {
  id: string;
}

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setGlobalLoading(state, action: PayloadAction<boolean>) {
      state.isGlobalLoading = action.payload;
    },
    showGlobalLoading(state) {
      state.isGlobalLoading = true;
    },
    hideGlobalLoading(state) {
      state.isGlobalLoading = false;
    },
    showToast(state, action: PayloadAction<ShowToastPayload>) {
      const { message, severity = 'info', duration = 4000, id } = action.payload;
      const toastId = id ?? `undefined-undefined`;
      const toast: Toast = {
        id: toastId,
        message,
        severity,
        duration,
      };
      state.toasts.push(toast);
    },
    removeToast(state, action: PayloadAction<RemoveToastPayload>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload.id);
    },
    clearToasts(state) {
      state.toasts = [];
    },
    showModal(state, action: PayloadAction<ShowModalPayload>) {
      const { id, title, content } = action.payload;
      state.modals[id] = {
        id,
        isOpen: true,
        title,
        content,
      };
    },
    hideModal(state, action: PayloadAction<HideModalPayload>) {
      const { id } = action.payload;
      if (state.modals[id]) {
        state.modals[id].isOpen = false;
      }
    },
    toggleModal(state, action: PayloadAction<HideModalPayload>) {
      const { id } = action.payload;
      const existing = state.modals[id];
      if (existing) {
        existing.isOpen = !existing.isOpen;
      } else {
        state.modals[id] = {
          id,
          isOpen: true,
        };
      }
    },
    resetUiState() {
      return initialState;
    },
  },
});

export const {
  setGlobalLoading,
  showGlobalLoading,
  hideGlobalLoading,
  showToast,
  removeToast,
  clearToasts,
  showModal,
  hideModal,
  toggleModal,
  resetUiState,
} = uiSlice.actions;

export default uiSlice.reducer;
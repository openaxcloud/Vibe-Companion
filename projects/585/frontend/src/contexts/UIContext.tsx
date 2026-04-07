import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

export type NotificationVariant = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  message: string;
  variant?: NotificationVariant;
  duration?: number;
}

type ModalPayload = unknown;

export interface ModalState {
  isOpen: boolean;
  modalType: string | null;
  payload: ModalPayload;
}

interface UIContextValue {
  // Theme
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Modals
  modal: ModalState;
  openModal: (modalType: string, payload?: ModalPayload) => void;
  closeModal: () => void;
  resetModal: () => void;

  // Notifications
  notifications: Notification[];
  showNotification: (
    message: string,
    options?: { variant?: NotificationVariant; duration?: number }
  ) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "ui.theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined" || typeof window.matchMedia === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!stored) return "system";
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "system";
  } catch {
    return "system";
  }
}

function persistTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function applyThemeToDocument(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

interface UIProviderProps {
  children: ReactNode;
}

export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(getSystemTheme);
  const resolvedTheme: "light" | "dark" =
    theme === "system" ? systemTheme : theme;

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    modalType: null,
    payload: undefined,
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Theme: watch system preference
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia === "undefined") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    // Initial sync in case it changed between render and effect
    setSystemTheme(media.matches ? "dark" : "light");

    media.addEventListener("change", listener);
    return () => {
      media.removeEventListener("change", listener);
    };
  }, []);

  // Theme: apply to document & persist preference
  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    persistTheme(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      if (current === "system") {
        // Toggle based on currently resolved theme and move away from system
        return resolvedTheme === "dark" ? "light" : "dark";
      }
      return current === "dark" ? "light" : "dark";
    });
  }, [resolvedTheme]);

  const openModal = useCallback((modalType: string, payload?: ModalPayload) => {
    setModal({
      isOpen: true,
      modalType,
      payload,
    });
  }, []);

  const closeModal = useCallback(() => {
    setModal((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const resetModal = useCallback(() => {
    setModal({
      isOpen: false,
      modalType: null,
      payload: undefined,
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const showNotification = useCallback(
    (
      message: string,
      options?: {
        variant?: NotificationVariant;
        duration?: number;
      }
    ) => {
      const id = `undefined-undefined`;

      const notification: Notification = {
        id,
        message,
        variant: options?.variant ?? "info",
        duration: options?.duration ?? 5000,
      };

      setNotifications((prev) => [...prev, notification]);

      if (notification.duration && notification.duration > 0) {
        window.setTimeout(() => {
          dismissNotification(id);
        }, notification.duration);
      }
    },
    [dismissNotification]
  );

  const value = useMemo<UIContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      modal,
      openModal,
      closeModal,
      resetModal,
      notifications,
      showNotification,
      dismissNotification,
      clearNotifications,
    }),
    [
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      modal,
      openModal,
      closeModal,
      resetModal,
      notifications,
      showNotification,
      dismissNotification,
      clearNotifications,
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return ctx;
}
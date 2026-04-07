import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "app-theme";

const LIGHT_THEME_VARS: Record<string, string> = {
  "--color-bg": "#ffffff",
  "--color-bg-alt": "#f5f5f5",
  "--color-text": "#111827",
  "--color-text-muted": "#6b7280",
  "--color-border": "#e5e7eb",
  "--color-primary": "#2563eb",
  "--color-primary-hover": "#1d4ed8",
  "--color-primary-soft": "#dbeafe",
  "--shadow-soft": "0 10px 30px rgba(15, 23, 42, 0.06)",
  "--transition-fast": "150ms ease-out",
};

const DARK_THEME_VARS: Record<string, string> = {
  "--color-bg": "#020617",
  "--color-bg-alt": "#0f172a",
  "--color-text": "#e5e7eb",
  "--color-text-muted": "#9ca3af",
  "--color-border": "#1f2937",
  "--color-primary": "#60a5fa",
  "--color-primary-hover": "#3b82f6",
  "--color-primary-soft": "#0b1220",
  "--shadow-soft": "0 10px 30px rgba(15, 23, 42, 0.7)",
  "--transition-fast": "150ms ease-out",
};

const applyThemeToDocument = (mode: ThemeMode): void => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const vars = mode === "light" ? LIGHT_THEME_VARS : DARK_THEME_VARS;

  root.setAttribute("data-theme", mode);
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
};

const getSystemPrefersDark = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
};

const readInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // ignore storage errors
  }

  return getSystemPrefersDark() ? "dark" : "light";
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => readInitialTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (event: MediaQueryListEvent) => {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (!stored) {
        setThemeState(event.matches ? "dark" : "light");
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      // Safari < 14
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      setTheme,
    }),
    [theme, toggleTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
};
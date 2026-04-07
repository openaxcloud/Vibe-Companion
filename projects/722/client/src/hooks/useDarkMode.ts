import { useCallback, useEffect, useState } from "react";

type DarkModePreference = "dark" | "light";

const STORAGE_KEY = "theme";

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

const getSystemPreference = (): DarkModePreference => {
  if (!isBrowser || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getStoredPreference = (): DarkModePreference | null => {
  if (!isBrowser) return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return null;
  } catch {
    return null;
  }
};

const applyThemeClass = (mode: DarkModePreference): void => {
  if (!isBrowser) return;
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

const storePreference = (mode: DarkModePreference): void => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors (e.g. private mode)
  }
};

export const useDarkMode = (): {
  isDarkMode: boolean;
  mode: DarkModePreference;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean | DarkModePreference) => void;
} => {
  const [mode, setModeState] = useState<DarkModePreference>(() => {
    const stored = getStoredPreference();
    return stored ?? getSystemPreference();
  });

  useEffect(() => {
    applyThemeClass(mode);
    storePreference(mode);
  }, [mode]);

  useEffect(() => {
    if (!isBrowser || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (event: MediaQueryListEvent) => {
      const stored = getStoredPreference();
      if (stored === null) {
        setModeState(event.matches ? "dark" : "light");
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      // Fallback for older browsers
      // @ts-ignore
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        // @ts-ignore
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const setDarkMode = useCallback((value: boolean | DarkModePreference) => {
    setModeState((prev) => {
      let next: DarkModePreference;
      if (typeof value === "boolean") {
        next = value ? "dark" : "light";
      } else {
        next = value;
      }
      return next === prev ? prev : next;
    });
  }, []);

  const toggleDarkMode = useCallback(() => {
    setModeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return {
    isDarkMode: mode === "dark",
    mode,
    toggleDarkMode,
    setDarkMode,
  };
};

export default useDarkMode;
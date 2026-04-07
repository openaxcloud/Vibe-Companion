import React, { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "preferred-theme";
const DATA_ATTRIBUTE = "data-theme";

const getPreferredTheme = (): Theme => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
};

const applyTheme = (theme: Theme): void => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(DATA_ATTRIBUTE, theme);
};

const DarkModeToggle: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return getPreferredTheme();
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors (e.g., private mode)
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemChange = (event: MediaQueryListEvent) => {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark") {
        return;
      }
      const newTheme: Theme = event.matches ? "dark" : "light";
      setTheme(newTheme);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemChange);
    } else {
      // Fallback for older browsers
      // @ts-expect-error - older API
      mediaQuery.addListener(handleSystemChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemChange);
      } else {
        // Fallback for older browsers
        // @ts-expect-error - older API
        mediaQuery.removeListener(handleSystemChange);
      }
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      style={{
        border: "none",
        background: "none",
        padding: 0,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 20,
          borderRadius: 9999,
          backgroundColor: isDark ? "#1f2933" : "#e5e7eb",
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          padding: 2,
          boxSizing: "border-box",
          transition: "background-color 0.2s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: isDark ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            backgroundColor: isDark ? "#f9fafb" : "#111827",
            transition: "left 0.2s ease, background-color 0.2s ease",
          }}
        />
      </span>
    </button>
  );
};

export default DarkModeToggle;
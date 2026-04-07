import React, { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

const getPreferredTheme = (): Theme => {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

const applyThemeClass = (theme: Theme) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;

  if (theme === "dark") {
    root.classList.add("dark");
    body.classList.add("dark");
  } else {
    root.classList.remove("dark");
    body.classList.remove("dark");
  }
};

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => getPreferredTheme());

  useEffect(() => {
    applyThemeClass(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) return;

    const handler = (event: MediaQueryListEvent) => {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark") return;
      const newTheme: Theme = event.matches ? "dark" : "light";
      setTheme(newTheme);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={`Activate undefined mode`}
      aria-pressed={isDark}
      onClick={toggleTheme}
      style={{
        cursor: "pointer",
        borderRadius: "9999px",
        border: "1px solid currentColor",
        padding: "0.25rem 0.75rem",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        background: "transparent",
        font: "inherit",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "1.1rem",
          height: "1.1rem",
          borderRadius: "9999px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {isDark ? (
          <span
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "9999px",
              boxShadow: "0 0 0 1px currentColor inset",
              transform: "translate(1px, -1px)",
              backgroundColor: "currentColor",
            }}
          />
        ) : (
          <span
            style={{
              width: "70%",
              height: "70%",
              borderRadius: "9999px",
              backgroundColor: "currentColor",
            }}
          />
        )}
      </span>
      <span>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
};

export default ThemeToggle;
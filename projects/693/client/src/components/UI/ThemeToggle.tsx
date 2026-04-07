import React, { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "app-theme";

const applyThemeToDocument = (theme: Theme) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Example root variables; adjust as needed to match your design system
  if (theme === "dark") {
    root.style.setProperty("--color-bg", "#0f172a");
    root.style.setProperty("--color-bg-elevated", "#111827");
    root.style.setProperty("--color-text", "#f9fafb");
    root.style.setProperty("--color-border", "#1f2937");
    root.style.setProperty("--color-primary", "#3b82f6");
    root.style.setProperty("--color-primary-soft", "#1d4ed8");
    root.style.setProperty("--shadow-elevated", "0 10px 25px rgba(15,23,42,0.75)");
    root.classList.add("theme-dark");
    root.classList.remove("theme-light");
  } else {
    root.style.setProperty("--color-bg", "#f9fafb");
    root.style.setProperty("--color-bg-elevated", "#ffffff");
    root.style.setProperty("--color-text", "#020617");
    root.style.setProperty("--color-border", "#e5e7eb");
    root.style.setProperty("--color-primary", "#2563eb");
    root.style.setProperty("--color-primary-soft", "#1d4ed8");
    root.style.setProperty("--shadow-elevated", "0 10px 25px rgba(15,23,42,0.08)");
    root.classList.add("theme-light");
    root.classList.remove("theme-dark");
  }

  root.setAttribute("data-theme", theme);
};

const getSystemPreference = (): Theme => {
  if (typeof window === "undefined") return "light";
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // ignore storage errors and fall back
  }

  return getSystemPreference();
};

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const isDark = theme === "dark";

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      // Only auto-update if user hasn't explicitly chosen a theme
      if (stored !== "light" && stored !== "dark") {
        setTheme(event.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Activate undefined mode`}
      aria-pressed={isDark}
      className="inline-flex items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-1 py-0.5 transition-colors duration-200 hover:border-[color:var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
    >
      <span
        className={`relative flex h-6 w-11 items-center rounded-full bg-slate-200 transition-colors duration-200 dark:bg-slate-700`}
      >
        <span
          className={`absolute h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 undefined`}
        />
        <span className="pointer-events-none flex w-full items-center justify-between px-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          <span className={!isDark ? "text-slate-900" : ""}>L</span>
          <span className={isDark ? "text-slate-100" : ""}>D</span>
        </span>
      </span>
      <span className="ml-2 text-xs font-medium text-[color:var(--color-text)]">
        {isDark ? "Dark" : "Light"}
      </span>
    </button>
  );
};

export default ThemeToggle;
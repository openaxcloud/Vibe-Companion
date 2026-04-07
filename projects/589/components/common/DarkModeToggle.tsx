import React, { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface DarkModeToggleProps {
  className?: string;
  /**
   * Optional controlled theme value.
   * If provided, component becomes controlled and ignores internal state.
   */
  theme?: Theme;
  /**
   * Called when the theme changes.
   */
  onThemeChange?: (theme: Theme) => void;
  /**
   * Whether to respect system preference on initial load.
   * Defaults to true.
   */
  respectSystemPreference?: boolean;
  /**
   * Optional accessible label for screen readers.
   */
  "aria-label"?: string;
}

const STORAGE_KEY = "theme";

const isBrowser = typeof window !== "undefined";

const getSystemPreference = (): Theme => {
  if (!isBrowser || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const getInitialTheme = (respectSystemPreference: boolean): Theme => {
  if (!isBrowser) return "light";

  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  if (respectSystemPreference) {
    return getSystemPreference();
  }

  return "light";
};

const applyThemeClass = (theme: Theme) => {
  if (!isBrowser) return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

const DarkModeToggle: React.FC<DarkModeToggleProps> = ({
  className,
  theme: controlledTheme,
  onThemeChange,
  respectSystemPreference = true,
  "aria-label": ariaLabel = "Toggle dark mode",
}) => {
  const [uncontrolledTheme, setUncontrolledTheme] = useState<Theme>(() =>
    getInitialTheme(respectSystemPreference)
  );

  const theme = controlledTheme ?? uncontrolledTheme;

  // Apply theme on mount and when changed
  useEffect(() => {
    applyThemeClass(theme);
    if (isBrowser) {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme]);

  // Listen for system preference changes when no explicit user preference stored
  useEffect(() => {
    if (!respectSystemPreference || !isBrowser || !window.matchMedia) return;

    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") {
      return; // user preference overrides system
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      const newTheme: Theme = event.matches ? "dark" : "light";
      if (controlledTheme == null) {
        setUncontrolledTheme(newTheme);
      }
      onThemeChange?.(newTheme);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      // Safari < 14
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
  }, [controlledTheme, onThemeChange, respectSystemPreference]);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    if (controlledTheme == null) {
      setUncontrolledTheme(nextTheme);
    }
    onThemeChange?.(nextTheme);
  }, [theme, controlledTheme, onThemeChange]);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={ariaLabel}
      aria-pressed={isDark}
      className={
        [
          "inline-flex items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600",
          "w-12 h-6 px-1 transition-colors duration-200 ease-out",
          isDark
            ? "bg-neutral-800"
            : "bg-neutral-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:ring-offset-background",
          "relative",
          className,
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      <span
        aria-hidden="true"
        className={[
          "inline-flex h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-out",
          isDark ? "translate-x-6" : "translate-x-0",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <span className="sr-only">{isDark ? "Switch to light mode" : "Switch to dark mode"}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-between px-1 text-[10px] font-medium"
      >
        <span
          className={[
            "transition-opacity duration-150",
            isDark ? "opacity-0" : "opacity-100",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          ☀️
        </span>
        <span
          className={[
            "transition-opacity duration-150",
            isDark ? "opacity-100" : "opacity-0",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          🌙
        </span>
      </span>
    </button>
  );
};

export default DarkModeToggle;
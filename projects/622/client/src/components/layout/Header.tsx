import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

type Theme = "light" | "dark" | "system";

interface HeaderProps {
  cartItemCount?: number;
  isAuthenticated?: boolean;
  userName?: string | null;
  onLogout?: () => void;
  onThemeChange?: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = "app-theme";

const navLinks: Array<{ label: string; to: string }> = [
  { label: "Home", to: "/" },
  { label: "Shop", to: "/shop" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

const getSystemTheme = (): Theme => {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
};

const applyThemeToDocument = (theme: Theme) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

const Header: React.FC<HeaderProps> = ({
  cartItemCount = 0,
  isAuthenticated = false,
  userName = null,
  onLogout,
  onThemeChange,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  const navigate = useNavigate();

  const resolvedTheme: Theme = useMemo(
    () => (theme === "system" ? getSystemTheme() : theme),
    [theme]
  );

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
    if (onThemeChange) {
      onThemeChange(theme);
    }
  }, [theme, onThemeChange]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyThemeToDocument("system");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  const handleThemeToggle = useCallback(() => {
    setTheme((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  }, []);

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const query = String(formData.get("q") || "").trim();
      if (query.length === 0) return;
      navigate(`/search?q=undefined`);
      if (mobileMenuOpen) setMobileMenuOpen(false);
    },
    [navigate, mobileMenuOpen]
  );

  const handleLogout = useCallback(() => {
    if (onLogout) onLogout();
    setProfileMenuOpen(false);
  }, [onLogout]);

  const currentThemeLabel = useMemo(() => {
    if (theme === "system") return "System";
    if (theme === "dark") return "Dark";
    return "Light";
  }, [theme]);

  const renderThemeIcon = () => {
    if (resolvedTheme === "dark") {
      return (
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79Z"
          />
        </svg>
      );
    }
    return (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1.05a1 1 0 1 1 2 0V21a1 1 0 0 1-1 1Zm0-18a1 1 0 0 1-1-1V2.05a1 1 0 1 1 2 0V3a1 1 0 0 1-1 1Zm8 7h-1.05a1 1 0 1 1 0-2H20a1 1 0 1 1 0 2Zm-14 0H5a1 1 0 1 1 0-2h1.05a1 1 0 1 1 0 2ZM17.66 18.66a1 1 0 0 1-.71-1.71l.74-.74a1 1 0 1 1 1.41 1.41l-.74.74a1 1 0 0 1-.7.3Zm-12-12a1 1 0 0 1-.71-1.71l.74-.74A1 1 0 1 1 7.1 3.62l-.74.74a1 1 0 0 1-.7.3Zm12 0a1 1 0 0 1-.7-.3l-.74-.74A1 1 0 0 1 17.63 2l.74.74a1 1 0 0 1-.71 1.71Zm-12 12a1 1 0 0 1-.7-.3l-.74-.74a1 1 0 0 1 1.41-1.41l.74.74a1 1 0 0 1-.71 1.71Z"
        />
      </svg>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus:ring-offset-slate-950 lg:hidden"
            aria-label="Toggle main navigation"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? (
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.17 12l6.71-7.71 1.42 1.42ZM7.71 5.71 1.41 12l6.3 6.29L9.13 16.87 4.27 12l4.86-4.87L7.71 5.71Z"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                viewBox="0
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type User = {
  id: string;
  name: string;
  email: string;
};

type HeaderProps = {
  logoText?: string;
  initialDarkMode?: boolean;
  cartCount?: number;
  onSearch?: (query: string) => void;
};

const STORAGE_KEYS = {
  DARK_MODE: "app:darkMode",
  USER: "app:user",
};

const Header: React.FC<HeaderProps> = ({
  logoText = "MyStore",
  initialDarkMode,
  cartCount = 0,
  onSearch,
}) => {
  const navigate = useNavigate();

  const [query, setQuery] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    initialDarkMode ?? false
  );
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (initialDarkMode === undefined) {
      const storedDark = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
      if (storedDark !== null) {
        setIsDarkMode(storedDark === "true");
        return;
      }
      const prefersDark = window.matchMedia?.(
        "(prefers-color-scheme: dark)"
      ).matches;
      setIsDarkMode(prefersDark);
    } else {
      setIsDarkMode(initialDarkMode);
    }
  }, [initialDarkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DARK_MODE, String(isDarkMode));
    } catch {
      // ignore storage errors
    }
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (onSearch) {
      onSearch(query.trim());
    } else {
      navigate(`/search?q=undefined`);
    }
  };

  const handleLogin = () => {
    navigate("/login");
  };

  const handleProfile = () => {
    navigate("/profile");
    setIsUserMenuOpen(false);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch {
      // ignore
    }
    setUser(null);
    setIsUserMenuOpen(false);
    navigate("/");
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleLogoClick = () => {
    navigate("/");
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen((open) => !open);
  };

  const closeUserMenu = () => {
    setIsUserMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.getElementById("header-user-menu");
      const button = document.getElementById("header-user-button");
      if (
        menu &&
        !menu.contains(event.target as Node) &&
        button &&
        !button.contains(event.target as Node)
      ) {
        closeUserMenu();
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  return (
    <header className="w-full border-b border-gray-200 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-800">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo */}
        <div className="flex flex-1 items-center">
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center space-x-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
            aria-label={`undefined home`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white font-bold">
              {logoText.charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-lg font-semibold sm:inline">
              {logoText}
            </span>
          </button>
        </div>

        {/* Center: Search */}
        <div className="flex flex-1 justify-center px-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex w-full max-w-lg items-center rounded-full border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
          >
            <svg
              className="h-4 w-4 text-gray-400 dark:text-gray-500"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M10.5 4a6.5 6.5 0 0 1 5.122 10.548l3.915 3.915a1 1 0 0 1-1.414 1.414l-3.915-3.915A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
                fill="currentColor"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products"
              className="ml-2 w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none dark:text-gray-100"
              aria-label="Search products"
            />
          </form>
        </div>

        {/* Right: Cart, User, Dark mode */}
        <div className="flex flex-1 items-center justify-end space-x-2 sm:space-x-4">
          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M12 4a1 1 0 0 1 1 1v1.05a1 1 0 0 1-2 0V5a1 1 0 0 1 1-1Zm0 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3a1 1 0 0 1 1 1 1 1 0 0 1-1 1h-1.05a1 1 0 0 1 0-2H19ZM7.05 11a1 1 0 0 1 0 2H6a1 1 0 0 1-1-1 1 1 0 0 1 1-1h1.05Zm9.192 4.95a1 1 0 0 1 1.414 0L18.9 17.19a1 1 0 0 1-
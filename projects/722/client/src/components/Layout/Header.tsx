import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

type Theme = "light" | "dark";

interface HeaderProps {
  cartItemCount?: number;
  onSearch?: (query: string) => void;
  initialSearchQuery?: string;
  logoText?: string;
  userName?: string | null;
  onLogout?: () => void;
}

const THEME_KEY = "app-theme";

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

const Header: React.FC<HeaderProps> = ({
  cartItemCount = 0,
  onSearch,
  initialSearchQuery = "",
  logoText = "ShopX",
  userName = null,
  onLogout,
}) => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      if (onSearch) {
        onSearch(trimmed);
      } else {
        navigate(`/search?q=undefined`);
      }
    },
    [navigate, onSearch, searchQuery]
  );

  const handleCartClick = useCallback(() => {
    navigate("/cart");
  }, [navigate]);

  const handleUserMenuToggle = useCallback(() => {
    setIsUserMenuOpen((prev) => !prev);
  }, []);

  const handleMobileMenuToggle = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const handleLogoutClick = useCallback(() => {
    if (onLogout) onLogout();
    setIsUserMenuOpen(false);
  }, [onLogout]);

  const isAuthenticated = useMemo(() => Boolean(userName), [userName]);

  const activeNavClassName = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 undefined`;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Left section: Logo + mobile menu button */}
        <div className="flex items-center">
          <button
            type="button"
            className="mr-2 inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:hidden dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            onClick={handleMobileMenuToggle}
          >
            <svg
              className={`h-6 w-6 undefined`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden={!isMobileMenuOpen}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg
              className={`h-6 w-6 undefined`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden={isMobileMenuOpen}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <Link to="/" className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm dark:bg-indigo-500">
              <span className="text-lg font-bold">S</span>
            </div>
            <span className="hidden text-xl font-semibold tracking-tight text-gray-900 sm:inline dark:text-white">
              {logoText}
            </span>
          </Link>
        </div>

        {/* Center: Search bar */}
        <div className="mx-4 hidden flex-1 sm:block">
          <form onSubmit={handleSearchSubmit} className="relative">
            <label htmlFor="header-search" className="sr-only">
              Search products
            </label>
            <input
              id="header-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products"
              className="block w-full rounded-full border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
                />
              </svg>
            </div>
          </form>
        </div>

        {/* Right section: nav + actions */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Desktop nav */}
          <nav className="hidden items-center space-x-2 sm:flex">
            <NavLink to="/shop" className={activeNavClassName}>
              Shop
            </NavLink>
            <NavLink to="/deals" className={activeNavClassName}>
              Deals
            </NavLink>
            <NavLink to="/about" className={activeNavClassName}>
              About
            </NavLink>
          </nav>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            aria-label="Toggle dark mode"
          >
            {theme === "light" ? (
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
              >
                <path d="M10 2.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V3.25A.
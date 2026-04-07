import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

type HeaderProps = {
  cartItemCount?: number;
  isAuthenticated?: boolean;
  userName?: string | null;
  onLogout?: () => void;
  onSearch?: (query: string) => void;
  categories?: { id: string; name: string; path: string }[];
};

type Theme = "light" | "dark";

const DEFAULT_CATEGORIES: { id: string; name: string; path: string }[] = [
  { id: "all", name: "All", path: "/products" },
  { id: "electronics", name: "Electronics", path: "/category/electronics" },
  { id: "fashion", name: "Fashion", path: "/category/fashion" },
  { id: "home", name: "Home & Living", path: "/category/home" },
  { id: "sports", name: "Sports", path: "/category/sports" },
];

const STORAGE_THEME_KEY = "marketplace_theme";

const Header: React.FC<HeaderProps> = ({
  cartItemCount = 0,
  isAuthenticated = false,
  userName = null,
  onLogout,
  onSearch,
  categories,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [theme, setTheme] = useState<Theme>("light");

  const navigate = useNavigate();

  const navCategories = useMemo(
    () => (categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES),
    [categories]
  );

  useEffect(() => {
    const root = document.documentElement;
    const storedTheme = (localStorage.getItem(STORAGE_THEME_KEY) as Theme | null) || "light";
    setTheme(storedTheme);
    if (storedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      const root = document.documentElement;
      if (next === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      localStorage.setItem(STORAGE_THEME_KEY, next);
      return next;
    });
  }, []);

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      if (onSearch) {
        onSearch(trimmed);
      } else {
        navigate(`/search?q=undefined`);
      }
      setMobileMenuOpen(false);
    },
    [navigate, onSearch, searchQuery]
  );

  const handleLogout = useCallback(() => {
    if (onLogout) onLogout();
    setProfileMenuOpen(false);
  }, [onLogout]);

  const handleNavLinkClick = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Left: Logo + Desktop Categories */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-900 hover:opacity-80 dark:text-slate-50"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
              <span className="text-lg font-bold">M</span>
            </div>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold tracking-tight">Marketplace</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Discover &amp; shop</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-4 text-sm font-medium text-slate-600 sm:flex dark:text-slate-300">
            {navCategories.map((cat) => (
              <NavLink
                key={cat.id}
                to={cat.path}
                onClick={handleNavLinkClick}
                className={({ isActive }) =>
                  [
                    "rounded-full px-3 py-1 transition-colors",
                    isActive
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                      : "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50",
                  ].join(" ")
                }
              >
                {cat.name}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Center: Search */}
        <div className="hidden flex-1 items-center justify-center px-4 md:flex">
          <form
            onSubmit={handleSearchSubmit}
            className="flex w-full max-w-xl items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm shadow-sm focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-900/60"
          >
            <span className="mr-2 text-slate-400 dark:text-slate-500">
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M15.5 15.5L18 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle
                  cx="9.5"
                  cy="9.5"
                  r="5.75"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, brands, categories..."
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </form>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile search icon */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus:ring-offset-slate-950 md:hidden"
            onClick={() => {
              const searchInput = document.querySelector<HTMLInputElement>("input[type='search']");
              if (searchInput) {
                searchInput.focus();
              }
              setMobileMenuOpen((prev) => !prev);
            }}
            aria-label="Toggle navigation menu"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 5H17M3 10H17M3 15H17"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100 dark:focus:ring-offset-slate-950"
            aria-label="Toggle dark mode"
          >
            {theme === "dark" ? (
              <svg
                className="h-4 w-4"
                viewBox="0 0 20
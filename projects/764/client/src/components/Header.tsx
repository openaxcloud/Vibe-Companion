import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

type HeaderProps = {
  logoSrc?: string;
  logoAlt?: string;
  cartCount?: number;
  onSearch?: (query: string) => void;
  isAuthenticated?: boolean;
  userName?: string | null;
  onLogin?: () => void;
  onLogout?: () => void;
};

type Theme = "light" | "dark";

const navLinks: { label: string; to: string }[] = [
  { label: "Home", to: "/" },
  { label: "Shop", to: "/shop" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

const Header: React.FC<HeaderProps> = ({
  logoSrc = "/logo.svg",
  logoAlt = "Logo",
  cartCount = 0,
  onSearch,
  isAuthenticated = false,
  userName = null,
  onLogin,
  onLogout,
}) => {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (onSearch) onSearch(trimmed);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const toggleMobileNav = () => {
    setMobileNavOpen((prev) => !prev);
  };

  const activeNavClass = ({ isActive }: { isActive: boolean }) =>
    [
      "inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors",
      isActive
        ? "border-indigo-500 text-gray-900 dark:text-gray-100"
        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100",
    ].join(" ");

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex flex-1 items-center">
            <div className="flex flex-shrink-0 items-center">
              <Link to="/" className="flex items-center gap-2">
                <img
                  className="h-8 w-auto"
                  src={logoSrc}
                  alt={logoAlt}
                  loading="lazy"
                />
                <span className="hidden text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:inline">
                  Storefront
                </span>
              </Link>
            </div>
            <nav className="hidden md:ml-8 md:flex md:space-x-4 lg:space-x-6">
              {navLinks.map((link) => (
                <NavLink key={link.to} to={link.to} className={activeNavClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Center: Search */}
          <div className="hidden flex-1 px-4 sm:flex sm:items-center">
            <form
              className="relative w-full max-w-md"
              onSubmit={handleSearchSubmit}
              role="search"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-4 w-4 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M9 3.5a5.5 5.5 0 0 1 4.357 8.79l2.677 2.677a.75.75 0 1 1-1.06 1.06l-2.677-2.676A5.5 5.5 0 1 1 9 3.5Zm0 1.5a4 4 0 1 0 0 8.001A4 4 0 0 0 9 5Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <input
                type="search"
                name="search"
                className="block w-full rounded-full border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
                placeholder="Search products"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </form>
          </div>

          {/* Right: Actions */}
          <div className="ml-4 flex flex-1 items-center justify-end gap-2 sm:gap-4">
            {/* Mobile Search Icon */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 sm:hidden"
              aria-label="Search"
              onClick={() => {
                const el = document.querySelector<HTMLInputElement>(
                  'input[name="search"]'
                );
                el?.focus();
              }}
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 3.5a5.5 5.5 0 0 1 4.357 8.79l2.677 2.677a.75.75 0 1 1-1.06 1.06l-2.677-2.676A5.5 5.5 0 1 1 9 3.5Zm0 1.5a4 4 0 1 0 0 8.001A4 4 0 0 0 9 5Z"
                  fill="currentColor"
                />
              </svg>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center justify-center rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M10 3.5a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0V4.25A.75.75 0 0 1 10 3.5Zm0 9a2.5 2.5 0 1 0 0-5.001A2.5 2.5 0 0 0 10 12.5Zm5.657-6.157a.75.75 0 0 0-1.06-1.06l-.884.883a.75.75 0 1 0 1.06 1.061l.884-.884Zm-
import React, { FC, useCallback, useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

type NavbarProps = {
  cartItemCount?: number;
  userName?: string | null;
  onLogout?: () => void;
  onSearch?: (query: string) => void;
};

const Navbar: FC<NavbarProps> = ({
  cartItemCount = 0,
  userName = null,
  onLogout,
  onSearch,
}) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? true
      : false;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      window.localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      window.localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-user-menu]")) {
        setIsUserMenuOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      if (onSearch) {
        onSearch(trimmed);
      } else {
        navigate(`/search?q=undefined`);
      }
      setIsMobileMenuOpen(false);
    },
    [navigate, onSearch, searchQuery]
  );

  const handleToggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleLogoutClick = () => {
    if (onLogout) onLogout();
    setIsUserMenuOpen(false);
  };

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-sm font-medium rounded-md transition-colors undefined`;

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur shadow-sm dark:bg-gray-900/90">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Left: Logo + Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2"
            onClick={() => {
              navigate("/");
              setIsMobileMenuOpen(false);
            }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-white dark:bg-blue-500">
              <span className="text-lg font-extrabold">S</span>
            </div>
            <span className="hidden text-lg font-semibold tracking-tight text-gray-900 dark:text-white sm:inline">
              ShopSphere
            </span>
          </button>
        </div>

        {/* Center: Search (desktop) */}
        <div className="hidden flex-1 items-center justify-center px-4 md:flex">
          <form
            onSubmit={handleSearchSubmit}
            className="flex w-full max-w-md items-center rounded-full border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
          >
            <input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mr-2 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
            />
            <button
              type="submit"
              className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Search
            </button>
          </form>
        </div>

        {/* Right: Nav links + actions (desktop) */}
        <div className="hidden items-center gap-4 md:flex">
          <NavLink to="/catalog" className={navLinkClassName}>
            Catalog
          </NavLink>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={handleToggleDarkMode}
            aria-label="Toggle dark mode"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {isDarkMode ? (
              <span className="text-sm" aria-hidden="true">
                ☾
              </span>
            ) : (
              <span className="text-sm" aria-hidden="true">
                ☀
              </span>
            )}
          </button>

          {/* Cart */}
          <Link
            to="/cart"
            className="relative inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-gray-700 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <span className="mr-1 text-sm" aria-hidden="true">
              🛒
            </span>
            <span className="text-sm font-medium">Cart</span>
            {cartItemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-semibold text-white">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            )}
          </Link>

          {/* User menu */}
          <div className="relative" data-user-menu>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsUserMenuOpen((prev) => !prev);
              }}
              className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white dark:bg-blue-500">
                {userName ? userName.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="hidden sm:inline">
                {userName ? `Hi, undefined` : "Account"}
              </span>
              <span className="text-xs" aria-hidden="true">
                ▾
              </span>
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {userName ? (
                  <>
                    <Link
                      to="/account"
                      className="block px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      My Account
                    </Link>
                    <Link
                      to="/orders"
                      className="block px-3
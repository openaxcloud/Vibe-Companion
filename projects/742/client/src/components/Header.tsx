import React, { useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  FiShoppingCart,
  FiUser,
  FiChevronDown,
  FiMoon,
  FiSun,
  FiSearch,
} from "react-icons/fi";

type Category = {
  id: string;
  label: string;
};

type User = {
  id: string;
  name: string;
  email: string;
};

type HeaderProps = {
  logoText?: string;
  categories?: Category[];
  cartCount?: number;
  user?: User | null;
  onSearch?: (query: string) => void;
  onCategoryChange?: (categoryId: string | null) => void;
  onLogout?: () => void;
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: "all", label: "All" },
  { id: "electronics", label: "Electronics" },
  { id: "fashion", label: "Fashion" },
  { id: "home", label: "Home" },
  { id: "sports", label: "Sports" },
];

const Header: React.FC<HeaderProps> = ({
  logoText = "ShopMate",
  categories = DEFAULT_CATEGORIES,
  cartCount = 0,
  user = null,
  onSearch,
  onCategoryChange,
  onLogout,
}) => {
  const [search, setSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
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

  const navigate = useNavigate();

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      window.localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      window.localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = search.trim();
    if (!trimmed) return;
    if (onSearch) {
      onSearch(trimmed);
    } else {
      navigate(`/search?q=undefined`);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    if (onCategoryChange) {
      onCategoryChange(categoryId === "all" ? null : categoryId);
    } else {
      const params = new URLSearchParams(window.location.search);
      if (categoryId === "all") {
        params.delete("category");
      } else {
        params.set("category", categoryId);
      }
      navigate({ pathname: "/products", search: params.toString() });
    }
  };

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      // Fallback: navigate to logout route if implemented
      navigate("/logout");
    }
    setIsUserMenuOpen(false);
  };

  const userInitials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  return (
    <header className="w-full border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo and primary navigation */}
        <div className="flex flex-1 items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
              {logoText.charAt(0).toUpperCase()}
            </span>
            <span>{logoText}</span>
          </Link>

          <nav className="hidden items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-300 md:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `transition-colors hover:text-gray-900 dark:hover:text-white undefined`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/products"
              className={({ isActive }) =>
                `transition-colors hover:text-gray-900 dark:hover:text-white undefined`
              }
            >
              Products
            </NavLink>
            <NavLink
              to="/deals"
              className={({ isActive }) =>
                `transition-colors hover:text-gray-900 dark:hover:text-white undefined`
              }
            >
              Deals
            </NavLink>
          </nav>
        </div>

        {/* Search and category filter */}
        <div className="flex flex-[2] items-center gap-3">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-1 items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 shadow-sm transition focus-within:border-blue-500 focus-within:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus-within:border-blue-500"
          >
            <FiSearch className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products"
              className="w-full bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </form>

          <div className="hidden items-center gap-2 sm:flex">
            <label
              htmlFor="header-category"
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              Category
            </label>
            <div className="relative">
              <select
                id="header-category"
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="h-9 appearance-none rounded-full border border-gray-200 bg-white pl-3 pr-8 text-xs font-medium text-gray-700 shadow-sm outline-none transition hover:border-gray-300 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-600 dark:focus:border-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
        </div>

        {/* Actions: Theme, Cart, User */}
        <div className="flex flex-1 items-center justify-end gap-3">
          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={handleToggleTheme}
            aria-label="Toggle dark mode"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {isDarkMode ? (
              <FiSun className="h-4 w-4" />
            ) : (
              <FiMoon className="h-4 w-4" />
            )}
          </button>

          {/* Cart */}
          <button
            type="button"
            onClick={() => navigate("/cart")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray
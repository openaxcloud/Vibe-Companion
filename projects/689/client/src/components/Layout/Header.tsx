import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { fetchCategories } from "../../store/categorySlice";
import { selectCartItemsCount } from "../../store/cartSlice";
import { setTheme, selectTheme } from "../../store/themeSlice";

type Category = {
  id: string | number;
  name: string;
  slug: string;
};

const THEME_STORAGE_KEY = "app-theme";

const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delay]);

  return debounced;
};

const Header: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const cartCount = useSelector(selectCartItemsCount);
  const categories = useSelector(
    (state: RootState) => state.categories.items as Category[]
  );
  const categoriesLoading = useSelector(
    (state: RootState) => state.categories.loading
  );
  const theme = useSelector(selectTheme);

  const initialSearch = searchParams.get("q") ?? "";
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 400);

  const initialCategory = searchParams.get("category") ?? "";
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory
  );

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as
      | "light"
      | "dark"
      | null;

    if (stored && stored !== theme) {
      dispatch(setTheme(stored));
    } else if (!stored) {
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const resolvedTheme: "light" | "dark" = prefersDark ? "dark" : "light";
      dispatch(setTheme(resolvedTheme));
      window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
    }
  }, [dispatch, theme]);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    const current = new URLSearchParams(searchParams.toString());
    if (debouncedSearchTerm) {
      current.set("q", debouncedSearchTerm);
    } else {
      current.delete("q");
    }

    if (selectedCategory) {
      current.set("category", selectedCategory);
    } else {
      current.delete("category");
    }

    setSearchParams(current, { replace: true });
  }, [debouncedSearchTerm, selectedCategory, searchParams, setSearchParams]);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
    },
    []
  );

  const handleCategoryChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setSelectedCategory(value);
    },
    []
  );

  const handleThemeToggle = useCallback(() => {
    const nextTheme: "light" | "dark" = theme === "light" ? "dark" : "light";
    dispatch(setTheme(nextTheme));
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, [dispatch, theme]);

  const handleLogoClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      setSearchTerm("");
      setSelectedCategory("");
      setSearchParams({});
      navigate("/");
    },
    [navigate, setSearchParams]
  );

  const hasCartItems = cartCount > 0;

  const renderedCategories = useMemo(
    () =>
      categories.map((category) => (
        <option key={category.id} value={category.slug}>
          {category.name}
        </option>
      )),
    [categories]
  );

  return (
    <header className="w-full border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            onClick={handleLogoClick}
            className="flex items-center gap-2 text-gray-900 dark:text-gray-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
              S
            </span>
            <span className="hidden text-lg font-semibold sm:inline">
              ShopFront
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search products..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12.9 14.32a7 7 0 111.414-1.414l3.387 3.387a1 1 0 01-1.414 1.414l-3.387-3.387zM8 13a5 5 0 100-10 5 5 0 000 10z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>

          <div className="min-w-[150px]">
            <select
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              disabled={categoriesLoading}
            >
              <option value="">{categoriesLoading ? "Loading..." : "All categories"}</option>
              {renderedCategories}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleThemeToggle}
            aria-label="Toggle theme"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {theme === "dark" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707 8.001 8.001 0 1017.293 13.293z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.
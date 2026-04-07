import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
  ChangeEvent,
  MouseEvent,
} from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

type Category = {
  id: string;
  label: string;
};

type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

type HeaderProps = {
  brandName?: string;
  logoSrc?: string;
  categories?: Category[];
  cartCount?: number;
  user?: User | null;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  onSearch?: (query: string, categoryId?: string) => void;
  onCategoryChange?: (categoryId: string | undefined) => void;
  enableDarkModeToggle?: boolean;
  defaultDarkMode?: boolean;
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: "all", label: "All" },
  { id: "electronics", label: "Electronics" },
  { id: "fashion", label: "Fashion" },
  { id: "home", label: "Home" },
];

const STORAGE_DARK_MODE_KEY = "app_theme_dark";

const Header: FC<HeaderProps> = ({
  brandName = "MyStore",
  logoSrc,
  categories = DEFAULT_CATEGORIES,
  cartCount = 0,
  user,
  onLoginClick,
  onLogoutClick,
  onSearch,
  onCategoryChange,
  enableDarkModeToggle = true,
  defaultDarkMode = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isDarkMode, setIsDarkMode] = useState<boolean>(defaultDarkMode);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    categories[0]?.id ?? "all"
  );
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  // Dark mode initialization
  useEffect(() => {
    if (!enableDarkModeToggle) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_DARK_MODE_KEY);
      if (stored !== null) {
        const enabled = stored === "true";
        setIsDarkMode(enabled);
        document.documentElement.classList.toggle("dark", enabled);
        return;
      }
    } catch {
      // ignore storage errors
    }
    document.documentElement.classList.toggle("dark", defaultDarkMode);
  }, [enableDarkModeToggle, defaultDarkMode]);

  const persistDarkMode = (value: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_DARK_MODE_KEY, value ? "true" : "false");
    } catch {
      // ignore
    }
  };

  const handleToggleDarkMode = useCallback(() => {
    if (!enableDarkModeToggle) return;
    setIsDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      persistDarkMode(next);
      return next;
    });
  }, [enableDarkModeToggle]);

  const handleSearchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed && !selectedCategoryId) return;
    if (onSearch) {
      onSearch(trimmed, selectedCategoryId);
    } else {
      const params = new URLSearchParams(location.search);
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      if (selectedCategoryId && selectedCategoryId !== "all") {
        params.set("category", selectedCategoryId);
      } else {
        params.delete("category");
      }
      navigate(`/search?undefined`);
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearchSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleCategoryChangeInternal = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    setSelectedCategoryId(value);
    if (onCategoryChange) {
      onCategoryChange(value);
    }
  };

  const handleCartClick = () => {
    navigate("/cart");
  };

  const handleBrandClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigate("/");
  };

  const handleDocumentClick = useCallback((event: MouseEvent | globalThis.MouseEvent) => {
    const target = event.target as Node | null;

    if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
      setIsProfileMenuOpen(false);
    }

    if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
      setIsMobileMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [handleDocumentClick]);

  const toggleProfileMenu = () => {
    setIsProfileMenuOpen((prev) => !prev);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const isLoggedIn = useMemo(() => !!user, [user]);

  const initials = useMemo(() => {
    if (!user?.name) return "";
    const parts = user.name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `undefinedundefined`.toUpperCase();
  }, [user]);

  return (
    <header className="w-full border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Left section: Brand and mobile menu button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white dark:focus:ring-offset-gray-900 sm:hidden"
            aria-label="Toggle navigation menu"
            onClick={toggleMobileMenu}
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <Link
            to="/"
            onClick={handleBrandClick}
            className="flex items-center gap-2 text-xl font-semibold tracking-tight text-gray-900 dark:text-white"
          >
            {logoSrc ? (
              <img src={logoSrc} alt={brandName} className="h-8 w-8 rounded-md object-contain" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white">
                {brandName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden sm:inline">{brandName}</span>
          </Link>
        </div>

        {/* Center: Search & Category (desktop) */}
        <div className="mx-4 hidden flex-1 items-center justify-center sm:flex">
          <form
            className="flex w-full max-w-2xl items-stretch gap-2"
            onSubmit={handleSearchSubmit}
            role="search"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-gray-500">
                <svg
                  className="h
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type Theme = "light" | "dark";

interface NavLink {
  label: string;
  href: string;
}

interface HeaderProps {
  navLinks?: NavLink[];
  cartItemCount?: number;
  isAuthenticated?: boolean;
  userName?: string | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const Header: React.FC<HeaderProps> = ({
  navLinks = DEFAULT_NAV_LINKS,
  cartItemCount = 0,
  isAuthenticated = false,
  userName = null,
  onSignIn,
  onSignOut,
}) => {
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [isClient, setIsClient] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
    if (typeof window === "undefined") return;

    const storedTheme = window.localStorage.getItem("theme") as Theme | null;
    const prefersDark = window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const initialTheme: Theme = storedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const nextTheme: Theme = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") {
        window.localStorage.setItem("theme", nextTheme);
      }
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", nextTheme === "dark");
      }
      return nextTheme;
    });
  }, []);

  const handleSignInClick = useCallback(() => {
    if (onSignIn) {
      onSignIn();
      return;
    }
    router.push("/auth/signin").catch(() => {});
  }, [onSignIn, router]);

  const handleSignOutClick = useCallback(() => {
    if (onSignOut) {
      onSignOut();
      return;
    }
    router.push("/auth/signout").catch(() => {});
  }, [onSignOut, router]);

  const isActive = useCallback(
    (href: string): boolean => {
      if (!router || !router.pathname) return false;
      if (href === "/") return router.pathname === "/";
      return router.pathname.startsWith(href);
    },
    [router]
  );

  const toggleMobileNav = useCallback(() => {
    setIsMobileNavOpen(prev => !prev);
  }, []);

  const closeMobileNav = useCallback(() => {
    setIsMobileNavOpen(false);
  }, []);

  const renderThemeIcon = () => {
    if (!isClient) return null;
    if (theme === "dark") {
      return (
        <svg
          className="h-5 w-5 text-yellow-300"
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M21.64 13.65a1 1 0 0 0-1.05-.14 8.05 8.05 0 0 1-3.37.73 8.15 8.15 0 0 1-8.14-8.1 8 8 0 0 1 .81-3.53 1 1 0 0 0-.13-1.09A1 1 0 0 0 8.3 1.2 10.14 10.14 0 1 0 22 14.7a1 1 0 0 0-.36-1.05ZM12.1 21.14A8.14 8.14 0 0 1 6.86 6.4a10.14 10.14 0 0 0 11 11 8.11 8.11 0 0 1-5.76-2.26Z" />
        </svg>
      );
    }
    return (
      <svg
        className="h-5 w-5 text-yellow-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 18a1 1 0 0 1 1 1v1.38a1.62 1.62 0 0 1-3.24 0V19a1 1 0 0 1 1-1Zm0-12a1 1 0 0 0 1-1V3.62a1.62 1.62 0 0 0-3.24 0V5a1 1 0 0 0 1 1Zm7 5h1.38a1.62 1.62 0 0 0 0-3.24H19a1 1 0 0 0-1 1v1.24a1 1 0 0 0 1 1Zm-12 0a1 1 0 0 0 1-1V7.76A1 1 0 0 0 7 6.76H5.62a1.62 1.62 0 0 0 0 3.24ZM17.66 7.05a1 1 0 0 0 .71-.29l.88-.88a1.62 1.62 0 0 0-2.29-2.29l-.88.88a1 1 0 0 0 0 1.41 1 1 0 0 0 .71.29Zm-11.32 0a1 1 0 0 0 .71-.29 1 1 0 0 0 0-1.41l-.88-.88a1.62 1.62 0 0 0-2.29 2.29l.88.88a1 1 0 0 0 .71.29ZM17.66 16.95a1 1 0 0 0-.71.29 1 1 0 0 0 0 1.41l.88.88a1.62 1.62 0 1 0 2.29-2.29l-.88-.88a1 1 0 0 0-.71-.29Zm-11.32 0-1 .29-.88.88a1.62 1.62 0 0 0 2.29 2.29l.88-.88a1 1 0 0 0 0-1.41 1 1 0 0 0-.71-.29ZM12 8.5A3.5 3.5 0 1 0 15.5 12 3.5 3.5 0 0 0 12 8.5Z" />
      </svg>
    );
  };

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white sm:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileNavOpen}
            onClick={toggleMobileNav}
          >
            <svg
              className="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {isMobileNavOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="
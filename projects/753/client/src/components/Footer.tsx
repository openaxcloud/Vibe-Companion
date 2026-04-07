import React from "react";
import { Link, useLocation } from "react-router-dom";

type Theme = "light" | "dark" | "system";

interface FooterProps {
  showThemeToggle?: boolean;
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  className?: string;
}

const year = new Date().getFullYear();

const Footer: React.FC<FooterProps> = ({
  showThemeToggle = false,
  theme = "system",
  onThemeChange,
  className = "",
}) => {
  const location = useLocation();

  const handleThemeClick = (nextTheme: Theme) => {
    if (!onThemeChange) return;
    onThemeChange(nextTheme);
  };

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <footer
      className={`w-full border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm text-sm text-gray-600 dark:text-gray-400 undefined`}
      aria-label="Footer"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Application
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500">
            © {year} Your Company. All rights reserved.
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <nav
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm"
            aria-label="Footer navigation"
          >
            <Link
              to="/"
              className={`transition-colors hover:text-gray-900 dark:hover:text-gray-100 undefined`}
            >
              Home
            </Link>
            <Link
              to="/about"
              className={`transition-colors hover:text-gray-900 dark:hover:text-gray-100 undefined`}
            >
              About
            </Link>
            <Link
              to="/privacy"
              className={`transition-colors hover:text-gray-900 dark:hover:text-gray-100 undefined`}
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className={`transition-colors hover:text-gray-900 dark:hover:text-gray-100 undefined`}
            >
              Terms
            </Link>
            <a
              href="mailto:support@example.com"
              className="transition-colors hover:text-gray-900 dark:hover:text-gray-100"
            >
              Contact
            </a>
          </nav>

          {showThemeToggle && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-500">
                Theme:
              </span>
              <div
                className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                role="radiogroup"
                aria-label="Theme selection"
              >
                <button
                  type="button"
                  onClick={() => handleThemeClick("light")}
                  className={`rounded-full px-2 py-1 transition-colors undefined`}
                  aria-pressed={theme === "light"}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeClick("dark")}
                  className={`rounded-full px-2 py-1 transition-colors undefined`}
                  aria-pressed={theme === "dark"}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeClick("system")}
                  className={`rounded-full px-2 py-1 transition-colors undefined`}
                  aria-pressed={theme === "system"}
                >
                  System
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
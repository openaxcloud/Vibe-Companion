import React, { FC, useCallback, useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";

interface HeaderProps {
  initialTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

const STORAGE_KEY = "app-theme";

const prefersDark = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const getInitialTheme = (initialTheme?: Theme): Theme => {
  if (initialTheme) return initialTheme;
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark() ? "dark" : "light";
};

const applyThemeToDocument = (theme: Theme) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
};

const Header: FC<HeaderProps> = ({ initialTheme, onThemeChange }) => {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme(initialTheme));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
    if (onThemeChange) onThemeChange(theme);
  }, [theme, onThemeChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const firstFocusable = mobileMenuRef.current?.querySelector<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
  }, [isMobileMenuOpen]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const handleToggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const handleBlurCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!isMobileMenuOpen) return;
    const currentTarget = event.currentTarget;
    requestAnimationFrame(() => {
      if (!currentTarget.contains(document.activeElement)) {
        setIsMobileMenuOpen(false);
      }
    });
  };

  return (
    <header className="header">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="header-inner">
        <div className="header-left">
          <a href="/" className="header-logo" aria-label="Home">
            <span className="header-logo-mark" aria-hidden="true">
              ●
            </span>
            <span className="header-logo-text">MyApp</span>
          </a>
        </div>

        <nav
          className="header-nav header-nav-desktop"
          aria-label="Primary navigation"
        >
          <a href="/features" className="header-nav-link">
            Features
          </a>
          <a href="/pricing" className="header-nav-link">
            Pricing
          </a>
          <a href="/about" className="header-nav-link">
            About
          </a>
          <a href="/contact" className="header-nav-link">
            Contact
          </a>
        </nav>

        <div className="header-actions">
          <button
            type="button"
            onClick={handleToggleTheme}
            className="icon-button theme-toggle-button"
            aria-label={
              theme === "light" ? "Switch to dark theme" : "Switch to light theme"
            }
          >
            <span
              aria-hidden="true"
              className="theme-toggle-icon theme-toggle-icon-light"
            >
              ☀️
            </span>
            <span
              aria-hidden="true"
              className="theme-toggle-icon theme-toggle-icon-dark"
            >
              🌙
            </span>
          </button>

          <button
            type="button"
            ref={mobileMenuButtonRef}
            className="icon-button header-menu-button"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="primary-navigation-mobile"
            onClick={handleToggleMobileMenu}
          >
            <span className="sr-only">
              {isMobileMenuOpen ? "Close menu" : "Open menu"}
            </span>
            <span aria-hidden="true" className="menu-icon">
              <span className="menu-icon-line" />
              <span className="menu-icon-line" />
              <span className="menu-icon-line" />
            </span>
          </button>
        </div>
      </div>

      <div
        className={`header-nav-mobile-wrapper undefined`}
        onBlurCapture={handleBlurCapture}
      >
        <div
          id="primary-navigation-mobile"
          ref={mobileMenuRef}
          className="header-nav-mobile"
          role="dialog"
          aria-modal="true"
          aria-label="Primary navigation"
        >
          <nav>
            <a href="/features" className="header-nav-link-mobile">
              Features
            </a>
            <a href="/pricing" className="header-nav-link-mobile">
              Pricing
            </a>
            <a href="/about" className="header-nav-link-mobile">
              About
            </a>
            <a href="/contact" className="header-nav-link-mobile">
              Contact
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
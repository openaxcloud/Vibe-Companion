import React, { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";

type LayoutProps = {
  children: ReactNode;
};

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "app-theme";

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
};

const useTheme = (): [Theme, (theme: Theme) => void, () => void] => {
  const [theme, setThemeState] = React.useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  return [theme, setTheme, toggleTheme];
};

const ScrollToTopOnRouteChange: React.FC = () => {
  const location = useLocation();
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  }, [location.pathname]);
  return null;
};

const Header: React.FC<{
  theme: Theme;
  onToggleTheme: () => void;
}> = ({ theme, onToggleTheme }) => {
  return (
    <header
      className="
        w-full border-b border-gray-200 bg-white/80 text-gray-900
        dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-50
        backdrop-blur
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-7xl
          px-4
          sm:px-6
          lg:px-8
          flex
          items-center
          justify-between
          h-16
        "
      >
        <div className="flex items-center space-x-2">
          <span
            className="
              inline-flex h-8 w-8 items-center justify-center rounded-full
              bg-blue-600 text-white text-sm font-semibold
              dark:bg-blue-500
            "
          >
            A
          </span>
          <span className="text-base font-semibold tracking-tight">
            App Layout
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="
              inline-flex items-center justify-center rounded-full
              border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium
              text-gray-700 shadow-sm transition
              hover:bg-gray-50 hover:text-gray-900
              dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100
              dark:hover:bg-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
              dark:focus:ring-offset-gray-900
            "
            aria-label="Toggle dark mode"
          >
            <span className="mr-1.5">
              {theme === "dark" ? "Light" : "Dark"} mode
            </span>
            <span aria-hidden="true">
              {theme === "dark" ? "☀️" : "🌙"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

const Footer: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer
      className="
        w-full border-t border-gray-200 bg-white/80 text-gray-500
        dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-400
        text-xs
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-7xl
          px-4
          sm:px-6
          lg:px-8
          py-4
          flex flex-col items-center justify-between gap-2
          sm:flex-row
        "
      >
        <p className="leading-none">&copy; {year} Your Company. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <a
            href="#"
            className="
              hover:text-gray-700
              dark:hover:text-gray-200
              transition-colors
            "
          >
            Privacy
          </a>
          <a
            href="#"
            className="
              hover:text-gray-700
              dark:hover:text-gray-200
              transition-colors
            "
          >
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [theme, , toggleTheme] = useTheme();

  return (
    <div
      className={`
        flex min-h-screen flex-col
        bg-gray-50 text-gray-900
        dark:bg-gray-950 dark:text-gray-50
      `}
    >
      <ScrollToTopOnRouteChange />
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <main
        className="
          flex-1
          w-full
        "
      >
        <div
          className="
            mx-auto
            w-full
            max-w-7xl
            px-4
            sm:px-6
            lg:px-8
            py-6
            sm:py-8
            lg:py-10
          "
        >
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
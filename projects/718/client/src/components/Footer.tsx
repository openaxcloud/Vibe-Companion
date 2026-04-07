import React, { useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface FooterProps {
  /**
   * Current theme value. Used to set the selected state on controls.
   */
  theme: Theme;
  /**
   * Change handler for theme switch. Must be accessible (keyboard and screen reader).
   */
  onThemeChange: (theme: Theme) => void;
  /**
   * Optional className to customize layout in different pages.
   */
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ theme, onThemeChange, className }) => {
  const handleThemeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value as Theme;
      if (value !== theme) {
        onThemeChange(value);
      }
    },
    [onThemeChange, theme]
  );

  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`w-full border-t border-neutral-200 bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/80 backdrop-blur-sm undefined`}
      aria-label="Site footer"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 text-sm text-neutral-600 dark:text-neutral-300 sm:flex-row sm:items-center sm:justify-between sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            &copy; {currentYear} Your Company. All rights reserved.
          </p>
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
              <li>
                <a
                  href="/privacy"
                  className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
                >
                  Privacy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
                >
                  Terms
                </a>
              </li>
              <li>
                <a
                  href="/accessibility"
                  className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
                >
                  Accessibility
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
                >
                  Contact
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <fieldset
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
          aria-label="Theme selection"
        >
          <legend className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Theme
          </legend>
          <div
            className="inline-flex overflow-hidden rounded-full border border-neutral-200 bg-neutral-50 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            role="radiogroup"
            aria-label="Color theme"
          >
            <label className="relative cursor-pointer px-3 py-1.5 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-transparent">
              <input
                type="radio"
                name="theme"
                value="light"
                className="sr-only"
                checked={theme === "light"}
                onChange={handleThemeChange}
                aria-label="Use light theme"
              />
              <span
                className={`inline-flex items-center gap-1.5 undefined`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full undefined`}
                />
                Light
              </span>
            </label>
            <span className="mx-0.5 h-5 self-center border-l border-neutral-200 dark:border-neutral-700" />
            <label className="relative cursor-pointer px-3 py-1.5 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-transparent">
              <input
                type="radio"
                name="theme"
                value="dark"
                className="sr-only"
                checked={theme === "dark"}
                onChange={handleThemeChange}
                aria-label="Use dark theme"
              />
              <span
                className={`inline-flex items-center gap-1.5 undefined`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full undefined`}
                />
                Dark
              </span>
            </label>
            <span className="mx-0.5 h-5 self-center border-l border-neutral-200 dark:border-neutral-700" />
            <label className="relative cursor-pointer px-3 py-1.5 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-transparent">
              <input
                type="radio"
                name="theme"
                value="system"
                className="sr-only"
                checked={theme === "system"}
                onChange={handleThemeChange}
                aria-label="Match system theme"
              />
              <span
                className={`inline-flex items-center gap-1.5 undefined`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full undefined`}
                />
                System
              </span>
            </label>
          </div>
        </fieldset>
      </div>
    </footer>
  );
};

export default Footer;
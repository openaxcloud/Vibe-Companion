import React from "react";
import { Link } from "react-router-dom";

type FooterProps = {
  className?: string;
};

const Footer: React.FC<FooterProps> = ({ className }) => {
  const year = new Date().getFullYear();

  return (
    <footer
      className={`w-full border-t border-neutral-200 bg-white/90 text-neutral-700 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 dark:text-neutral-300 undefined`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:py-4">
        <div className="flex flex-col gap-1">
          <div className="font-medium text-neutral-900 dark:text-neutral-100">
            YourSiteName
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            © {year} YourSiteName. All rights reserved.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:justify-end">
          <Link
            to="/"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Home
          </Link>
          <Link
            to="/about"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            About
          </Link>
          <Link
            to="/contact"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Contact
          </Link>
          <span className="hidden h-3 w-px bg-neutral-200 dark:bg-neutral-700 sm:inline-block" />
          <Link
            to="/privacy"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Terms of Service
          </Link>
          <Link
            to="/cookies"
            className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Cookie Policy
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
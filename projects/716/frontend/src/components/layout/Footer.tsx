import React from "react";
import { Link } from "react-router-dom";

type FooterLink = {
  label: string;
  to?: string;
  href?: string;
};

const links: FooterLink[] = [
  { label: "About", to: "/about" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Contact", to: "/contact" },
];

const currentYear = new Date().getFullYear();

const Footer: React.FC = () => {
  return (
    <footer
      className="w-full border-t border-neutral-200 bg-white/80 text-sm text-neutral-600 backdrop-blur-sm
                 dark:border-neutral-800 dark:bg-neutral-950/80 dark:text-neutral-400"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            © {currentYear}
          </span>
          <span className="text-neutral-700 dark:text-neutral-300">
            Your Company Name
          </span>
          <span className="hidden text-neutral-300 dark:text-neutral-700 sm:inline">
            ·
          </span>
          <span className="text-neutral-500 dark:text-neutral-500">
            All rights reserved.
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
          {links.map((link) =>
            link.to ? (
              <Link
                key={link.label}
                to={link.to}
                className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                {link.label}
              </Link>
            ) : link.href ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                {link.label}
              </a>
            ) : null
          )}
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
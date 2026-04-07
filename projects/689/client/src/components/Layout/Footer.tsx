import React from "react";
import { Link } from "react-router-dom";

type FooterLink = {
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
};

type FooterSection = {
  title: string;
  links: FooterLink[];
};

const footerSections: FooterSection[] = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "Pricing", to: "/pricing" },
      { label: "Docs", to: "/docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Blog", to: "/blog" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/legal/privacy" },
      { label: "Terms of Service", to: "/legal/terms" },
    ],
  },
];

const currentYear = new Date().getFullYear();

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white/80 text-slate-600 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-slate-900 no-underline hover:text-slate-700 dark:text-slate-50 dark:hover:text-slate-200"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                LOGO
              </span>
              <span className="text-lg font-semibold tracking-tight">
                Acme App
              </span>
            </Link>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              A modern application with a clean, theme-aware interface. Built
              with performance, accessibility, and clarity in mind.
            </p>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-6 text-sm sm:grid-cols-3 md:justify-end">
            {footerSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {section.title}
                </h3>
                <ul className="mt-3 space-y-2">
                  {section.links.map((link) => {
                    if (link.href || link.external) {
                      return (
                        <li key={link.label}>
                          <a
                            href={link.href}
                            target={link.external ? "_blank" : undefined}
                            rel={link.external ? "noopener noreferrer" : undefined}
                            className="text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
                          >
                            {link.label}
                          </a>
                        </li>
                      );
                    }

                    return (
                      <li key={link.label}>
                        <Link
                          to={link.to || "#"}
                          className="text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center">
          <p>
            © {currentYear} Acme Inc. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              System theme aware
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <p>
              Built with{" "}
              <a
                href="https://react.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-slate-700 dark:hover:text-slate-200"
              >
                React
              </a>{" "}
              and{" "}
              <a
                href="https://tailwindcss.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-slate-700 dark:hover:text-slate-200"
              >
                Tailwind CSS
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
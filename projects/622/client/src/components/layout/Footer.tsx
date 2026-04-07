import React from "react";
import { Link } from "react-router-dom";

interface FooterLink {
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
}

const brandName = "YourApp";
const currentYear = new Date().getFullYear();

const productLinks: FooterLink[] = [
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "FAQ", to: "/faq" },
];

const companyLinks: FooterLink[] = [
  { label: "About", to: "/about" },
  { label: "Blog", to: "/blog" },
  { label: "Contact", to: "/contact" },
];

const legalLinks: FooterLink[] = [
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Service", to: "/terms" },
];

const externalLinks: FooterLink[] = [
  {
    label: "GitHub",
    href: "https://github.com/your-org/your-app",
    external: true,
  },
  {
    label: "Status",
    href: "https://status.yourapp.com",
    external: true,
  },
];

const Footer: React.FC = () => {
  const renderLink = (link: FooterLink) => {
    const baseClass =
      "text-sm text-gray-400 hover:text-gray-200 transition-colors duration-150";

    if (link.to) {
      return (
        <Link key={link.label} to={link.to} className={baseClass}>
          {link.label}
        </Link>
      );
    }

    if (link.href) {
      return (
        <a
          key={link.label}
          href={link.href}
          target={link.external ? "_blank" : "_self"}
          rel={link.external ? "noopener noreferrer" : undefined}
          className={baseClass}
        >
          {link.label}
        </a>
      );
    }

    return null;
  };

  return (
    <footer className="border-t border-gray-800 bg-gray-950/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-sm font-semibold text-white shadow-sm">
                {brandName[0]}
              </span>
              <span className="text-base font-semibold tracking-tight text-white">
                {brandName}
              </span>
            </Link>
            <p className="max-w-sm text-sm text-gray-400">
              Build, ship, and scale modern web experiences with a clean,
              minimal interface and a developer-friendly workflow.
            </p>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-6 text-left sm:grid-cols-3 md:justify-end md:text-right">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                Product
              </h3>
              <div className="flex flex-col gap-2">
                {productLinks.map(renderLink)}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                Company
              </h3>
              <div className="flex flex-col gap-2">
                {companyLinks.map(renderLink)}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                Resources
              </h3>
              <div className="flex flex-col gap-2">
                {legalLinks.map(renderLink)}
                {externalLinks.map(renderLink)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-gray-800 pt-4 text-xs text-gray-500 sm:flex-row sm:items-center">
          <p className="order-2 text-left sm:order-1">
            &copy; {currentYear} {brandName}. All rights reserved.
          </p>
          <div className="order-1 flex flex-wrap items-center gap-3 sm:order-2 sm:justify-end">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-400">
              Operational • Updated just now
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
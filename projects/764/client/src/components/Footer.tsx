import React from "react";
import { Link } from "react-router-dom";

type FooterLink = {
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
};

const footerLinksLeft: FooterLink[] = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

const footerLinksRight: FooterLink[] = [
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "GitHub", href: "https://github.com", external: true },
];

const currentYear = new Date().getFullYear();

const FooterLinkItem: React.FC<{ link: FooterLink }> = ({ link }) => {
  const baseClass =
    "text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors";

  if (link.to) {
    return (
      <Link to={link.to} className={baseClass}>
        {link.label}
      </Link>
    );
  }

  if (link.href) {
    return (
      <a
        href={link.href}
        className={baseClass}
        target={link.external ? "_blank" : "_self"}
        rel={link.external ? "noopener noreferrer" : undefined}
      >
        {link.label}
      </a>
    );
  }

  return <span className={baseClass}>{link.label}</span>;
};

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-gray-200 bg-white/90 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
            © {currentYear} Your Company. All rights reserved.
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Built with care. Responsive and supports system dark mode.
          </div>
        </div>

        <div className="flex flex-col gap-2 text-left text-sm sm:flex-row sm:items-center sm:gap-8 sm:text-right">
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            {footerLinksLeft.map((link) => (
              <FooterLinkItem key={link.label} link={link} />
            ))}
          </nav>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 sm:justify-end">
            {footerLinksRight.map((link) => (
              <FooterLinkItem key={link.label} link={link} />
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
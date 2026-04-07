import React from "react";
import Link from "next/link";

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

const footerLinks: FooterLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

const currentYear = new Date().getFullYear();

const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-neutral-200 bg-white text-sm text-neutral-600">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:gap-2">
        <p className="text-center sm:text-left">
          © {currentYear} Your Company Name. All rights reserved.
        </p>
        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {footerLinks.map((link) => {
              const { label, href, external } = link;
              if (external) {
                return (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-neutral-900"
                    >
                      {label}
                    </a>
                  </li>
                );
              }
              return (
                <li key={label}>
                  <Link
                    href={href}
                    className="transition-colors hover:text-neutral-900"
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
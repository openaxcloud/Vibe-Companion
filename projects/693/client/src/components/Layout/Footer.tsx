import React from "react";
import { Link } from "react-router-dom";

interface FooterLink {
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
}

const footerLinks: FooterLink[] = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Service", to: "/terms" },
];

const currentYear = new Date().getFullYear();

const Footer: React.FC = () => {
  return (
    <footer
      style={{
        marginTop: "auto",
        borderTop: "1px solid #e5e7eb",
        backgroundColor: "#ffffff",
      }}
    >
      <div
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "1rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <nav
          aria-label="Footer navigation"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            rowGap: "0.35rem",
            fontSize: "0.875rem",
          }}
        >
          {footerLinks.map((link) => {
            const commonStyle: React.CSSProperties = {
              color: "#6b7280",
              textDecoration: "none",
              transition: "color 150ms ease, text-decoration-color 150ms ease",
            };

            const handleMouseEnter = (
              event: React.MouseEvent<HTMLAnchorElement>
            ) => {
              event.currentTarget.style.color = "#111827";
              event.currentTarget.style.textDecoration = "underline";
              event.currentTarget.style.textDecorationColor = "#d1d5db";
            };

            const handleMouseLeave = (
              event: React.MouseEvent<HTMLAnchorElement>
            ) => {
              event.currentTarget.style.color = "#6b7280";
              event.currentTarget.style.textDecoration = "none";
            };

            if (link.external && link.href) {
              return (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={commonStyle}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  {link.label}
                </a>
              );
            }

            if (link.to) {
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  style={commonStyle}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  {link.label}
                </Link>
              );
            }

            return null;
          })}
        </nav>

        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            color: "#9ca3af",
          }}
        >
          © {currentYear} Acme Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
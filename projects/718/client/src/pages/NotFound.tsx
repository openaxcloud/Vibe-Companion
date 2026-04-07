import React from "react";
import { Link } from "react-router-dom";

const NotFound: React.FC = () => {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        backgroundColor: "#0f172a",
        color: "#e5e7eb",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, system-ui, -system-ui, sans-serif",
      }}
    >
      <section
        aria-labelledby="not-found-title"
        style={{
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "0.875rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#64748b",
            marginBottom: "0.75rem",
          }}
        >
          Error 404
        </p>
        <h1
          id="not-found-title"
          style={{
            fontSize: "2.25rem",
            lineHeight: 1.1,
            fontWeight: 700,
            marginBottom: "0.75rem",
            color: "#f9fafb",
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontSize: "0.975rem",
            color: "#9ca3af",
            marginBottom: "1.75rem",
          }}
        >
          The page you’re looking for doesn’t exist or has been moved. Use the
          links below to continue browsing.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            justifyContent: "center",
          }}
        >
          <Link
            to="/"
            style={{
              padding: "0.7rem 1.4rem",
              borderRadius: "999px",
              border: "1px solid transparent",
              background:
                "linear-gradient(135deg, #4f46e5 0%, #6366f1 40%, #22c55e 100%)",
              color: "#f9fafb",
              fontSize: "0.95rem",
              fontWeight: 500,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
              boxShadow:
                "0 14px 35px rgba(15, 23, 42, 0.75), 0 0 0 1px rgba(148, 163, 184, 0.15)",
              transition:
                "transform 120ms ease-out, box-shadow 120ms ease-out, filter 120ms ease-out",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.transform =
                "translateY(-1px)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                "0 18px 45px rgba(15, 23, 42, 0.85), 0 0 0 1px rgba(148, 163, 184, 0.25)";
              (e.currentTarget as HTMLAnchorElement).style.filter =
                "brightness(1.03)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.transform =
                "translateY(0)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                "0 14px 35px rgba(15, 23, 42, 0.75), 0 0 0 1px rgba(148, 163, 184, 0.15)";
              (e.currentTarget as HTMLAnchorElement).style.filter = "none";
            }}
          >
            <span>Back to home</span>
          </Link>

          <Link
            to="/catalog"
            style={{
              padding: "0.7rem 1.35rem",
              borderRadius: "999px",
              border: "1px solid rgba(148, 163, 184, 0.5)",
              backgroundColor: "rgba(15, 23, 42, 0.7)",
              color: "#e5e7eb",
              fontSize: "0.95rem",
              fontWeight: 500,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
              backdropFilter: "blur(12px)",
              boxShadow: "0 10px 25px rgba(15, 23, 42, 0.9)",
              transition:
                "transform 120ms ease-out, box-shadow 120ms ease-out, border-color 120ms ease-out, background-color 120ms ease-out",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.transform =
                "translateY(-1px)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                "0 16px 40px rgba(15, 23, 42, 0.95)";
              (e.currentTarget as HTMLAnchorElement).style.borderColor =
                "rgba(129, 140, 248, 0.9)";
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                "rgba(15, 23, 42, 0.95)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.transform =
                "translateY(0)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                "0 10px 25px rgba(15, 23, 42, 0.9)";
              (e.currentTarget as HTMLAnchorElement).style.borderColor =
                "rgba(148, 163, 184, 0.5)";
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                "rgba(15, 23, 42, 0.7)";
            }}
          >
            <span>Browse catalog</span>
          </Link>
        </div>

        <p
          style={{
            marginTop: "1.75rem",
            fontSize: "0.8rem",
            color: "#6b7280",
          }}
        >
          If you believe this is an error, double-check the URL or try again
          from the home page.
        </p>
      </section>
    </main>
  );
};

export default NotFound;
import React, { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";

export interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /**
   * Optional flag to enable scroll restoration to top on route change.
   * Defaults to true.
   */
  restoreScrollOnRouteChange?: boolean;
  /**
   * Optional flag to disable horizontal padding.
   * Useful for full-bleed layouts.
   */
  disableHorizontalPadding?: boolean;
  /**
   * Optional flag to use a full-width layout instead of constrained max-width.
   */
  fullWidth?: boolean;
  /**
   * Optional aria-label for main content landmark.
   */
  "aria-label"?: string;
}

const MAX_WIDTH = 1200;

const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = "",
  restoreScrollOnRouteChange = true,
  disableHorizontalPadding = false,
  fullWidth = false,
  "aria-label": ariaLabel,
}) => {
  const location = useLocation();

  useEffect(() => {
    if (!restoreScrollOnRouteChange) return;
    if (typeof window === "undefined") return;

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant" in window ? ("instant" as ScrollBehavior) : "auto",
    });
  }, [location.pathname, restoreScrollOnRouteChange]);

  const baseStyles: React.CSSProperties = {
    minHeight: "100vh",
    backgroundColor: "var(--color-page-background, #f5f5f5)",
  };

  const innerStyles: React.CSSProperties = {
    margin: "0 auto",
    maxWidth: fullWidth ? "100%" : `undefinedpx`,
    paddingTop: "var(--spacing-page-vertical, 24px)",
    paddingBottom: "var(--spacing-page-vertical, 24px)",
    paddingLeft: disableHorizontalPadding
      ? 0
      : "var(--spacing-page-horizontal, 16px)",
    paddingRight: disableHorizontalPadding
      ? 0
      : "var(--spacing-page-horizontal, 16px)",
    boxSizing: "border-box",
  };

  const composedClassName = ["page-container", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div style={baseStyles}>
      <main
        className={composedClassName}
        style={innerStyles}
        aria-label={ariaLabel}
      >
        {children}
      </main>
    </div>
  );
};

export default PageContainer;
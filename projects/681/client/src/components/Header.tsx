import React, { FC, useState } from "react";

export interface HeaderProps {
  title?: string;
  showThemeToggle?: boolean;
  onToggleTheme?: (isDarkMode: boolean) => void;
  initialIsDarkMode?: boolean;
}

const headerContainerStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.75rem 1.25rem",
  boxSizing: "border-box",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  backgroundColor: "#ffffff",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.25rem",
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: "#111827",
};

const rightSectionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const toggleButtonStyle: React.CSSProperties = {
  position: "relative",
  width: "48px",
  height: "26px",
  borderRadius: "999px",
  border: "1px solid rgba(0,0,0,0.2)",
  backgroundColor: "#111827",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  padding: "2px",
  boxSizing: "border-box",
  transition: "background-color 150ms ease-out, border-color 150ms ease-out",
};

const toggleKnobBaseStyle: React.CSSProperties = {
  position: "relative",
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
  transform: "translateX(0)",
  transition: "transform 150ms ease-out",
};

const Header: FC<HeaderProps> = ({
  title = "My App",
  showThemeToggle = true,
  onToggleTheme,
  initialIsDarkMode = false,
}) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(initialIsDarkMode);

  const handleToggleClick = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (onToggleTheme) {
      onToggleTheme(next);
    }
  };

  const resolvedToggleButtonStyle: React.CSSProperties = {
    ...toggleButtonStyle,
    backgroundColor: isDarkMode ? "#111827" : "#e5e7eb",
    borderColor: isDarkMode ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.2)",
  };

  const resolvedKnobStyle: React.CSSProperties = {
    ...toggleKnobBaseStyle,
    transform: isDarkMode ? "translateX(22px)" : "translateX(0)",
  };

  const themeLabelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    color: "#4b5563",
    userSelect: "none",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  };

  return (
    <header style={headerContainerStyle}>
      <h1 style={titleStyle}>{title}</h1>
      {showThemeToggle && (
        <div style={rightSectionStyle}>
          <span style={themeLabelStyle}>
            {isDarkMode ? "Dark mode" : "Light mode"}
          </span>
          <button
            type="button"
            onClick={handleToggleClick}
            style={resolvedToggleButtonStyle}
            aria-label="Toggle theme (placeholder)"
            aria-pressed={isDarkMode}
          >
            <span style={resolvedKnobStyle} />
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
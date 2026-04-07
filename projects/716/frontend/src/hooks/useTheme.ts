import { useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  isDarkMode: boolean;
  isSystem: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};

export default useTheme;
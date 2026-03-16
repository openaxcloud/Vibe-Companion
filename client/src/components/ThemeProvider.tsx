import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Theme, GlobalColors, SyntaxColors } from "@shared/schema";
import {
  DEFAULT_DARK_GLOBAL_COLORS,
  DEFAULT_LIGHT_GLOBAL_COLORS,
  DEFAULT_DARK_SYNTAX_COLORS,
  DEFAULT_LIGHT_SYNTAX_COLORS,
} from "@shared/schema";

export type BaseScheme = "light" | "dark";

export interface ThemeData {
  id: string | null;
  title: string;
  baseScheme: BaseScheme;
  globalColors: GlobalColors;
  syntaxColors: SyntaxColors;
}

const BUILTIN_DARK: ThemeData = {
  id: null,
  title: "Replit Dark",
  baseScheme: "dark",
  globalColors: DEFAULT_DARK_GLOBAL_COLORS,
  syntaxColors: DEFAULT_DARK_SYNTAX_COLORS,
};

const BUILTIN_LIGHT: ThemeData = {
  id: null,
  title: "Replit Light",
  baseScheme: "light",
  globalColors: DEFAULT_LIGHT_GLOBAL_COLORS,
  syntaxColors: DEFAULT_LIGHT_SYNTAX_COLORS,
};

interface ThemeContextType {
  theme: BaseScheme;
  activeTheme: ThemeData;
  setTheme: (theme: BaseScheme) => void;
  toggleTheme: () => void;
  setActiveTheme: (themeData: ThemeData) => void;
  activateThemeById: (themeId: string | null) => void;
  installedThemes: Theme[];
  userThemes: Theme[];
  isLoadingThemes: boolean;
  refreshThemes: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyGlobalColors(colors: GlobalColors, baseScheme: BaseScheme) {
  const root = document.documentElement;

  if (baseScheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  root.style.setProperty("--ide-bg", colors.background);
  root.style.setProperty("--ide-border", colors.outline);
  root.style.setProperty("--ide-separator", colors.outline);
  root.style.setProperty("--ide-text", colors.foreground);

  const bgHex = colors.background;
  const fgHex = colors.foreground;
  const outlineHex = colors.outline;

  root.style.setProperty("--ide-panel", blendColor(bgHex, fgHex, 0.06));
  root.style.setProperty("--ide-surface", blendColor(bgHex, fgHex, 0.12));
  root.style.setProperty("--ide-hover", blendColor(bgHex, fgHex, 0.16));
  root.style.setProperty("--ide-input", blendColor(bgHex, fgHex, 0.03));
  root.style.setProperty("--ide-text-secondary", blendColor(fgHex, bgHex, 0.35));
  root.style.setProperty("--ide-text-muted", blendColor(fgHex, bgHex, 0.55));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function blendColor(base: string, blend: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(base);
  const [r2, g2, b2] = hexToRgb(blend);
  return rgbToHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
}

function themeFromDbTheme(t: Theme): ThemeData {
  return {
    id: t.id,
    title: t.title,
    baseScheme: t.baseScheme as BaseScheme,
    globalColors: t.globalColors,
    syntaxColors: t.syntaxColors,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [activeTheme, setActiveThemeState] = useState<ThemeData>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("activeTheme");
      if (stored) {
        try { return JSON.parse(stored); } catch {}
      }
      const storedScheme = localStorage.getItem("theme") as BaseScheme | null;
      if (storedScheme === "light") return BUILTIN_LIGHT;
      if (storedScheme === "dark") return BUILTIN_DARK;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? BUILTIN_DARK : BUILTIN_LIGHT;
    }
    return BUILTIN_DARK;
  });

  const { data: installedThemes = [], isLoading: isLoadingInstalled } = useQuery<Theme[]>({
    queryKey: ["/api/themes/installed"],
    staleTime: 60000,
    retry: false,
  });

  const { data: userThemes = [], isLoading: isLoadingUser } = useQuery<Theme[]>({
    queryKey: ["/api/themes"],
    staleTime: 60000,
    retry: false,
  });

  const [prefsLoaded, setPrefsLoaded] = useState(false);
  useEffect(() => {
    if (prefsLoaded || isLoadingInstalled || isLoadingUser) return;
    fetch("/api/user/preferences", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (!prefs?.activeThemeId) return;
        const all = [...(userThemes || []), ...(installedThemes || [])];
        const found = all.find(t => t.id === prefs.activeThemeId);
        if (found) {
          setActiveThemeState(themeFromDbTheme(found));
        }
      })
      .catch(() => {})
      .finally(() => setPrefsLoaded(true));
  }, [prefsLoaded, isLoadingInstalled, isLoadingUser, userThemes, installedThemes]);

  useEffect(() => {
    applyGlobalColors(activeTheme.globalColors, activeTheme.baseScheme);
    localStorage.setItem("activeTheme", JSON.stringify(activeTheme));
    localStorage.setItem("theme", activeTheme.baseScheme);
  }, [activeTheme]);

  const persistThemePreference = useCallback((themeId: string | null, scheme: string) => {
    apiRequest("PUT", "/api/user/preferences", { activeThemeId: themeId, theme: scheme }).catch(() => {});
  }, []);

  const setActiveTheme = useCallback((themeData: ThemeData) => {
    setActiveThemeState(themeData);
    persistThemePreference(themeData.id, themeData.baseScheme);
  }, [persistThemePreference]);

  const activateThemeById = useCallback((themeId: string | null) => {
    if (!themeId) {
      const builtin = activeTheme.baseScheme === "dark" ? BUILTIN_DARK : BUILTIN_LIGHT;
      setActiveThemeState(builtin);
      persistThemePreference(null, builtin.baseScheme);
      return;
    }
    const all = [...(userThemes || []), ...(installedThemes || [])];
    const found = all.find(t => t.id === themeId);
    if (found) {
      const td = themeFromDbTheme(found);
      setActiveThemeState(td);
      persistThemePreference(td.id, td.baseScheme);
    }
  }, [userThemes, installedThemes, persistThemePreference, activeTheme.baseScheme]);

  const setTheme = useCallback((scheme: BaseScheme) => {
    if (activeTheme.id) return;
    const builtin = scheme === "dark" ? BUILTIN_DARK : BUILTIN_LIGHT;
    setActiveThemeState(builtin);
    persistThemePreference(null, scheme);
  }, [activeTheme.id, persistThemePreference]);

  const toggleTheme = useCallback(() => {
    const next = activeTheme.baseScheme === "dark" ? BUILTIN_LIGHT : BUILTIN_DARK;
    setActiveThemeState(next);
    persistThemePreference(null, next.baseScheme);
  }, [activeTheme, persistThemePreference]);

  const refreshThemes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/themes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/themes/installed"] });
  }, [queryClient]);

  const value = useMemo(() => ({
    theme: activeTheme.baseScheme,
    activeTheme,
    setTheme,
    toggleTheme,
    setActiveTheme,
    activateThemeById,
    installedThemes,
    userThemes,
    isLoadingThemes: isLoadingInstalled || isLoadingUser,
    refreshThemes,
  }), [activeTheme, setTheme, toggleTheme, setActiveTheme, activateThemeById, installedThemes, userThemes, isLoadingInstalled, isLoadingUser, refreshThemes]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

export { BUILTIN_DARK, BUILTIN_LIGHT, themeFromDbTheme };

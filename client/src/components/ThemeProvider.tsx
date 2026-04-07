import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

// Simple theme manager using plain DOM API to avoid React hooks duplicate instance issue
class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme;
  private resolvedTheme: 'light' | 'dark';
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.currentTheme = this.getStoredTheme();
    this.resolvedTheme = this.calculateResolvedTheme(this.currentTheme);
    this.applyTheme();
    this.setupMediaQueryListener();
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  private getStoredTheme(): Theme {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme;
      return stored || 'system';
    }
    return 'system';
  }

  private getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private calculateResolvedTheme(theme: Theme): 'light' | 'dark' {
    return theme === 'system' ? this.getSystemTheme() : theme;
  }

  private applyTheme() {
    if (typeof window === 'undefined') return;
    
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(this.resolvedTheme);
  }

  private setupMediaQueryListener() {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (this.currentTheme === 'system') {
        this.resolvedTheme = this.getSystemTheme();
        this.applyTheme();
        this.notifyListeners();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  getResolvedTheme(): 'light' | 'dark' {
    return this.resolvedTheme;
  }

  setTheme(newTheme: Theme) {
    this.currentTheme = newTheme;
    this.resolvedTheme = this.calculateResolvedTheme(newTheme);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
    
    this.applyTheme();
    this.notifyListeners();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

// Singleton instance getter
const getManager = () => ThemeManager.getInstance();

export function ThemeProvider({ children }: ThemeProviderProps) {
  const manager = getManager();
  
  // Use useState to track theme changes with proper React state updates
  const [themeState, setThemeState] = useState<{ theme: Theme; resolvedTheme: 'light' | 'dark' }>(() => ({
    theme: manager.getTheme(),
    resolvedTheme: manager.getResolvedTheme(),
  }));

  // Subscribe to theme manager changes
  useEffect(() => {
    const unsubscribe = manager.subscribe(() => {
      setThemeState({
        theme: manager.getTheme(),
        resolvedTheme: manager.getResolvedTheme(),
      });
    });
    return unsubscribe;
  }, [manager]);

  // Stable setTheme callback
  const setTheme = useCallback((newTheme: Theme) => {
    manager.setTheme(newTheme);
  }, [manager]);

  const value: ThemeContextValue = {
    theme: themeState.theme,
    setTheme,
    resolvedTheme: themeState.resolvedTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

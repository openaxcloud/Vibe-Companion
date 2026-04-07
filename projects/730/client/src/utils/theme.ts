export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme-preference';

const isWindowDefined = typeof window !== 'undefined';
const isDocumentDefined = typeof document !== 'undefined';

const getMediaQueryList = (): MediaQueryList | null => {
  if (!isWindowDefined || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return null;
  }
};

export const getSystemThemePreference = (): ThemeMode | null => {
  const mql = getMediaQueryList();
  if (!mql) return null;
  return mql.matches ? 'dark' : 'light';
};

export const getStoredThemePreference = (): ThemeMode | null => {
  if (!isWindowDefined) return null;
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') {
      return value;
    }
    return null;
  } catch {
    return null;
  }
};

export const storeThemePreference = (mode: ThemeMode): void => {
  if (!isWindowDefined) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // fail silently (e.g. private mode or disabled storage)
  }
};

export const applyThemeToDocument = (mode: ThemeMode): void => {
  if (!isDocumentDefined) return;
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
};

export const getCurrentDocumentTheme = (): ThemeMode | null => {
  if (!isDocumentDefined) return null;
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') {
    return attr;
  }
  return null;
};

export const resolveInitialTheme = (): ThemeMode => {
  const stored = getStoredThemePreference();
  if (stored) return stored;
  const system = getSystemThemePreference();
  if (system) return system;
  return 'light';
};

export const initializeTheme = (): ThemeMode => {
  const mode = resolveInitialTheme();
  applyThemeToDocument(mode);
  return mode;
};

export const setTheme = (mode: ThemeMode): void => {
  storeThemePreference(mode);
  applyThemeToDocument(mode);
};

export const toggleTheme = (): ThemeMode => {
  const current = getCurrentDocumentTheme() ?? resolveInitialTheme();
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
};

export const subscribeToSystemThemeChanges = (
  callback: (mode: ThemeMode) => void
): (() => void) => {
  const mql = getMediaQueryList();
  if (!mql) {
    return () => {};
  }

  const handler = (event: MediaQueryListEvent) => {
    const mode: ThemeMode = event.matches ? 'dark' : 'light';
    callback(mode);
  };

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
    };
  }

  // Fallback for older browsers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyMql: any = mql;
  legacyMql.addListener(handler);
  return () => {
    legacyMql.removeListener(handler);
  };
};

export const syncThemeWithSystemPreference = (): (() => void) => {
  const stored = getStoredThemePreference();
  if (stored) {
    applyThemeToDocument(stored);
    return () => {};
  }

  const system = getSystemThemePreference();
  if (system) {
    applyThemeToDocument(system);
  }

  return subscribeToSystemThemeChanges((mode) => {
    applyThemeToDocument(mode);
  });
};
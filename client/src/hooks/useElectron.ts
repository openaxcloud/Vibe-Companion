/**
 * E-Code Desktop - Electron Detection and Integration Hook
 * Fortune 500 Quality React Integration
 * 
 * Provides seamless integration between React and Electron desktop features
 */

/// <reference path="../types/electron.d.ts" />

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ElectronAPI, ElectronDialogOptions, ThemeSource } from '../types/electron';
import { safeLocalStorage } from '@/lib/safe-storage';

// Type guard for Electron environment
export function isElectron(): boolean {
  return typeof window !== 'undefined' && 
         window.electronAPI?.isElectron === true;
}

// Get Electron API safely
export function getElectronAPI(): ElectronAPI | null {
  if (isElectron()) {
    return window.electronAPI!;
  }
  return null;
}

// Platform detection
export function getPlatform(): 'web' | 'desktop' {
  return isElectron() ? 'desktop' : 'web';
}

/**
 * Main Electron hook - provides all desktop features
 */
export function useElectron() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [isDev, setIsDev] = useState(false);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('dark');
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api) {
      setIsDesktop(false);
      return;
    }

    setIsDesktop(true);

    // Fetch platform info
    Promise.all([
      api.getPlatform(),
      api.getAppVersion(),
      api.isDev(),
      api.getSystemTheme(),
    ]).then(([plat, version, dev, theme]) => {
      setPlatform(plat);
      setAppVersion(version);
      setIsDev(dev);
      setSystemTheme(theme);
    }).catch(console.error);

    // Listen for theme changes
    const unsubscribe = api.onThemeChange((theme) => {
      setSystemTheme(theme);
    });
    cleanupRef.current.push(unsubscribe);

    return () => {
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current = [];
    };
  }, []);

  // Dialog helpers
  const showSaveDialog = useCallback(async (options: ElectronDialogOptions) => {
    const api = getElectronAPI();
    if (!api) return null;
    return api.showSaveDialog(options);
  }, []);

  const showOpenDialog = useCallback(async (options: ElectronDialogOptions) => {
    const api = getElectronAPI();
    if (!api) return null;
    return api.showOpenDialog(options);
  }, []);

  const showMessageBox = useCallback(async (options: {
    type?: 'info' | 'error' | 'warning' | 'question';
    title?: string;
    message: string;
    detail?: string;
    buttons?: string[];
  }) => {
    const api = getElectronAPI();
    if (!api) return null;
    return api.showMessageBox(options);
  }, []);

  // File system helpers
  const readFile = useCallback(async (filePath: string) => {
    const api = getElectronAPI();
    if (!api) throw new Error('Not running in Electron');
    return api.readFile(filePath);
  }, []);

  const writeFile = useCallback(async (filePath: string, content: string) => {
    const api = getElectronAPI();
    if (!api) throw new Error('Not running in Electron');
    return api.writeFile(filePath, content);
  }, []);

  const fileExists = useCallback(async (filePath: string) => {
    const api = getElectronAPI();
    if (!api) return false;
    return api.fileExists(filePath);
  }, []);

  // Shell helpers
  const openExternal = useCallback(async (url: string) => {
    const api = getElectronAPI();
    if (api) {
      await api.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }, []);

  const showItemInFolder = useCallback((path: string) => {
    const api = getElectronAPI();
    if (api) {
      api.showItemInFolder(path);
    }
  }, []);

  // Window helpers
  const minimizeWindow = useCallback(() => {
    getElectronAPI()?.minimizeWindow();
  }, []);

  const maximizeWindow = useCallback(() => {
    getElectronAPI()?.maximizeWindow();
  }, []);

  const closeWindow = useCallback(() => {
    getElectronAPI()?.closeWindow();
  }, []);

  const setFullscreen = useCallback((flag: boolean) => {
    getElectronAPI()?.setFullscreen(flag);
  }, []);

  // Theme helpers
  const setTheme = useCallback((theme: ThemeSource) => {
    getElectronAPI()?.setThemeSource(theme);
  }, []);

  // Clipboard helpers
  const copyToClipboard = useCallback(async (text: string) => {
    const api = getElectronAPI();
    if (api) {
      await api.clipboardWriteText(text);
    } else {
      await navigator.clipboard.writeText(text);
    }
  }, []);

  const readFromClipboard = useCallback(async () => {
    const api = getElectronAPI();
    if (api) {
      return api.clipboardReadText();
    }
    return navigator.clipboard.readText();
  }, []);

  // Store helpers
  const getStoredValue = useCallback(async <T>(key: string, defaultValue?: T): Promise<T | undefined> => {
    const api = getElectronAPI();
    if (api) {
      return api.storeGet(key, defaultValue);
    }
    const stored = safeLocalStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  }, []);

  const setStoredValue = useCallback(async <T>(key: string, value: T) => {
    const api = getElectronAPI();
    if (api) {
      await api.storeSet(key, value);
    } else {
      safeLocalStorage.setItem(key, JSON.stringify(value));
    }
  }, []);

  return {
    // State
    isDesktop,
    platform,
    appVersion,
    isDev,
    systemTheme,
    
    // API access
    api: getElectronAPI(),
    
    // Dialog methods
    showSaveDialog,
    showOpenDialog,
    showMessageBox,
    
    // File system methods
    readFile,
    writeFile,
    fileExists,
    
    // Shell methods
    openExternal,
    showItemInFolder,
    
    // Window methods
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    setFullscreen,
    
    // Theme methods
    setTheme,
    
    // Clipboard methods
    copyToClipboard,
    readFromClipboard,
    
    // Store methods
    getStoredValue,
    setStoredValue,
  };
}

/**
 * Hook for listening to Electron menu events
 */
export function useElectronMenuEvents(handlers: {
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSave?: () => void;
  onSaveAll?: () => void;
  onPreferences?: () => void;
  onFind?: () => void;
  onFindReplace?: () => void;
  onNewTerminal?: () => void;
  onClearTerminal?: () => void;
  onToggleSidebar?: () => void;
  onToggleTerminal?: () => void;
  onToggleAI?: () => void;
  onQuickOpen?: () => void;
  onGoToLine?: () => void;
  onGoToSymbol?: () => void;
  onGoToDefinition?: () => void;
  onRunCode?: () => void;
  onStopExecution?: () => void;
  onShowShortcuts?: () => void;
}) {
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;

    const cleanups: (() => void)[] = [];

    if (handlers.onNewProject) {
      cleanups.push(api.onMenuNewProject(handlers.onNewProject));
    }
    if (handlers.onOpenProject) {
      cleanups.push(api.onMenuOpenProject(handlers.onOpenProject));
    }
    if (handlers.onSave) {
      cleanups.push(api.onMenuSave(handlers.onSave));
    }
    if (handlers.onSaveAll) {
      cleanups.push(api.onMenuSaveAll(handlers.onSaveAll));
    }
    if (handlers.onPreferences) {
      cleanups.push(api.onMenuPreferences(handlers.onPreferences));
    }
    if (handlers.onFind) {
      cleanups.push(api.onMenuFind(handlers.onFind));
    }
    if (handlers.onFindReplace) {
      cleanups.push(api.onMenuFindReplace(handlers.onFindReplace));
    }
    if (handlers.onNewTerminal) {
      cleanups.push(api.onMenuNewTerminal(handlers.onNewTerminal));
    }
    if (handlers.onClearTerminal) {
      cleanups.push(api.onMenuClearTerminal(handlers.onClearTerminal));
    }
    if (handlers.onToggleSidebar) {
      cleanups.push(api.onMenuToggleSidebar(handlers.onToggleSidebar));
    }
    if (handlers.onToggleTerminal) {
      cleanups.push(api.onMenuToggleTerminal(handlers.onToggleTerminal));
    }
    if (handlers.onToggleAI) {
      cleanups.push(api.onMenuToggleAI(handlers.onToggleAI));
    }
    if (handlers.onQuickOpen) {
      cleanups.push(api.onMenuQuickOpen(handlers.onQuickOpen));
    }
    if (handlers.onGoToLine) {
      cleanups.push(api.onMenuGoToLine(handlers.onGoToLine));
    }
    if (handlers.onGoToSymbol) {
      cleanups.push(api.onMenuGoToSymbol(handlers.onGoToSymbol));
    }
    if (handlers.onGoToDefinition) {
      cleanups.push(api.onMenuGoToDefinition(handlers.onGoToDefinition));
    }
    if (handlers.onRunCode) {
      cleanups.push(api.onMenuRunCode(handlers.onRunCode));
    }
    if (handlers.onStopExecution) {
      cleanups.push(api.onMenuStopExecution(handlers.onStopExecution));
    }
    if (handlers.onShowShortcuts) {
      cleanups.push(api.onMenuShowShortcuts(handlers.onShowShortcuts));
    }

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [handlers]);
}

/**
 * Hook for native file save functionality
 */
export function useNativeFileSave() {
  const { isDesktop, showSaveDialog, writeFile } = useElectron();

  const saveFile = useCallback(async (
    content: string,
    options?: {
      defaultName?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }
  ) => {
    if (!isDesktop) {
      // Web fallback: download as file
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = options?.defaultName || 'file.txt';
      a.click();
      URL.revokeObjectURL(url);
      return true;
    }

    const result = await showSaveDialog({
      defaultPath: options?.defaultName,
      filters: options?.filters || [
        { name: 'All Files', extensions: ['*'] }
      ],
    });

    if (result?.canceled || !result?.filePath) {
      return false;
    }

    await writeFile(result.filePath, content);
    return true;
  }, [isDesktop, showSaveDialog, writeFile]);

  return { saveFile, isDesktop };
}

export default useElectron;

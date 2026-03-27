import { useEffect, useRef } from 'react';

const STORAGE_KEY_PREFIX = 'mobile_terminal_';

/**
 * Hook for persisting terminal history and state to localStorage
 * Useful for maintaining user's terminal session across app reloads
 */
export function useTerminalHistoryPersistence(sessionId: string = 'default') {
  const storageKey = `${STORAGE_KEY_PREFIX}${sessionId}`;

  const saveHistory = (history: string[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save terminal history:', e);
    }
  };

  const loadHistory = (): string[] => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load terminal history:', e);
      return [];
    }
  };

  const clearHistory = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error('Failed to clear terminal history:', e);
    }
  };

  return {
    saveHistory,
    loadHistory,
    clearHistory,
  };
}

/**
 * Hook for persisting mobile UI state (panel positions, open/closed state, etc)
 */
export function useMobileUIPersistence(key: string) {
  const storageKey = `mobile_ui_${key}`;

  const saveState = (state: any) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      console.error(`Failed to save UI state for ${key}:`, e);
    }
  };

  const loadState = (defaultState: any = null) => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : defaultState;
    } catch (e) {
      console.error(`Failed to load UI state for ${key}:`, e);
      return defaultState;
    }
  };

  const clearState = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error(`Failed to clear UI state for ${key}:`, e);
    }
  };

  return {
    saveState,
    loadState,
    clearState,
  };
}

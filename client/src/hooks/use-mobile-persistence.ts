import { useState, useEffect, useCallback } from 'react';

/**
 * Mobile State Persistence Hook
 * 
 * Persists mobile IDE state across sessions using localStorage.
 * Handles tab position, editor scroll, terminal history, and file browser state.
 */

const STORAGE_PREFIX = 'mobile-ide-state';

interface MobileIDEState {
  activeTab?: string;
  selectedFileId?: number;
  expandedFolders?: number[];
  editorScroll?: {
    line: number;
    column: number;
  };
  terminalHistory?: string[];
}

function getStorageKey(projectId: string | number): string {
  return `${STORAGE_PREFIX}-project-${projectId}`;
}

function loadState(projectId: string | number): MobileIDEState {
  try {
    const key = getStorageKey(projectId);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('[Persistence] Failed to load state:', error);
    return {};
  }
}

function saveState(projectId: string | number, state: MobileIDEState): void {
  try {
    const key = getStorageKey(projectId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.warn('[Persistence] Failed to save state:', error);
  }
}

/**
 * Hook to persist mobile IDE state
 */
export function useMobileIDEPersistence(projectId: string | number) {
  const [state, setState] = useState<MobileIDEState>(() => loadState(projectId));

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (projectId) {
      saveState(projectId, state);
    }
  }, [projectId, state]);

  // Update individual state fields
  const setActiveTab = useCallback((tab: string) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const setSelectedFileId = useCallback((fileId: number | undefined) => {
    setState(prev => ({ ...prev, selectedFileId: fileId }));
  }, []);

  const setExpandedFolders = useCallback((folders: number[]) => {
    setState(prev => ({ ...prev, expandedFolders: folders }));
  }, []);

  const setEditorScroll = useCallback((line: number, column: number) => {
    setState(prev => ({ ...prev, editorScroll: { line, column } }));
  }, []);

  const setTerminalHistory = useCallback((history: string[]) => {
    setState(prev => ({ ...prev, terminalHistory: history }));
  }, []);

  // Clear state for project
  const clearState = useCallback(() => {
    setState({});
    try {
      localStorage.removeItem(getStorageKey(projectId));
    } catch (error) {
      console.warn('[Persistence] Failed to clear state:', error);
    }
  }, [projectId]);

  return {
    state,
    setActiveTab,
    setSelectedFileId,
    setExpandedFolders,
    setEditorScroll,
    setTerminalHistory,
    clearState,
  };
}

/**
 * Hook to persist tab position
 * Default: 'deploy' tab for mobile/tablet devices (Replit-style)
 */
export function useTabPersistence(projectId: string | number) {
  const [activeTab, setActiveTabState] = useState<string>(() => {
    const state = loadState(projectId);
    // Default to 'deploy' for mobile/tablet as per user requirement
    return state.activeTab || 'deploy';
  });

  useEffect(() => {
    if (projectId) {
      const state = loadState(projectId);
      saveState(projectId, { ...state, activeTab });
    }
  }, [projectId, activeTab]);

  return [activeTab, setActiveTabState] as const;
}

/**
 * Hook to persist file browser state
 */
export function useFileBrowserPersistence(projectId: string | number) {
  const [expandedFolders, setExpandedFoldersState] = useState<Set<number>>(() => {
    const state = loadState(projectId);
    return new Set(state.expandedFolders || []);
  });

  const [selectedFileId, setSelectedFileIdState] = useState<number | undefined>(() => {
    const state = loadState(projectId);
    return state.selectedFileId;
  });

  // Save expanded folders
  useEffect(() => {
    if (projectId) {
      const state = loadState(projectId);
      saveState(projectId, { 
        ...state, 
        expandedFolders: Array.from(expandedFolders) 
      });
    }
  }, [projectId, expandedFolders]);

  // Save selected file
  useEffect(() => {
    if (projectId) {
      const state = loadState(projectId);
      saveState(projectId, { ...state, selectedFileId });
    }
  }, [projectId, selectedFileId]);

  return {
    expandedFolders,
    setExpandedFolders: setExpandedFoldersState,
    selectedFileId,
    setSelectedFileId: setSelectedFileIdState,
  };
}

/**
 * Hook to persist editor scroll position
 */
export function useEditorScrollPersistence(projectId: string | number, fileId?: number) {
  const storageKey = fileId 
    ? `${getStorageKey(projectId)}-file-${fileId}` 
    : `${getStorageKey(projectId)}-editor`;

  const [scroll, setScrollState] = useState<{ line: number; column: number }>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : { line: 1, column: 1 };
    } catch {
      return { line: 1, column: 1 };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(scroll));
    } catch (error) {
      console.warn('[Persistence] Failed to save scroll position:', error);
    }
  }, [storageKey, scroll]);

  const setScroll = useCallback((line: number, column: number) => {
    setScrollState({ line, column });
  }, []);

  return [scroll, setScroll] as const;
}

/**
 * Hook to persist terminal history
 */
export function useTerminalHistoryPersistence(projectId: string | number, maxHistory = 100) {
  const [history, setHistoryState] = useState<string[]>(() => {
    const state = loadState(projectId);
    return state.terminalHistory || [];
  });

  useEffect(() => {
    if (projectId) {
      const state = loadState(projectId);
      // Keep only last maxHistory items
      const trimmedHistory = history.slice(-maxHistory);
      saveState(projectId, { ...state, terminalHistory: trimmedHistory });
    }
  }, [projectId, history, maxHistory]);

  const addToHistory = useCallback((command: string) => {
    setHistoryState(prev => {
      // Avoid duplicates at the end
      if (prev[prev.length - 1] === command) {
        return prev;
      }
      return [...prev, command].slice(-maxHistory);
    });
  }, [maxHistory]);

  const clearHistory = useCallback(() => {
    setHistoryState([]);
  }, []);

  return {
    history,
    addToHistory,
    clearHistory,
  };
}

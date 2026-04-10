import { useState, useEffect, useCallback } from 'react';
import type { TabletPanel } from '@/components/tablet/TabletIDEView';

/**
 * Tablet State Persistence Hook
 * 
 * Extends Phase 2 mobile persistence with tablet-specific state:
 * - Drawer open/closed state
 * - Panel sizes (resizable panel percentages)
 * - Active right panel (preview/terminal/editor)
 * - Selected file ID
 */

const STORAGE_PREFIX = 'tablet-ide-state';

interface TabletIDEState {
  drawerOpen?: boolean;
  rightPanel?: TabletPanel;
  selectedFileId?: number | null;
  editorPanelSize?: number; // Percentage for editor panel (0-100)
  rightPanelSize?: number; // Percentage for right panel (0-100)
}

function getStorageKey(projectId: string | number): string {
  return `${STORAGE_PREFIX}-project-${projectId}`;
}

function loadState(projectId: string | number): TabletIDEState {
  try {
    const key = getStorageKey(projectId);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('[Tablet Persistence] Failed to load state:', error);
    return {};
  }
}

function saveState(projectId: string | number, state: TabletIDEState): void {
  try {
    const key = getStorageKey(projectId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.warn('[Tablet Persistence] Failed to save state:', error);
  }
}

/**
 * Hook to persist tablet IDE state
 */
export function useTabletIDEPersistence(projectId: string | number) {
  const [state, setState] = useState<TabletIDEState>(() => loadState(projectId));

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (projectId) {
      saveState(projectId, state);
    }
  }, [projectId, state]);

  // Update individual state fields
  const setDrawerOpen = useCallback((open: boolean) => {
    setState(prev => ({ ...prev, drawerOpen: open }));
  }, []);

  const setRightPanel = useCallback((panel: TabletPanel) => {
    setState(prev => ({ ...prev, rightPanel: panel }));
  }, []);

  const setSelectedFileId = useCallback((fileId: number | null) => {
    setState(prev => ({ ...prev, selectedFileId: fileId }));
  }, []);

  const setEditorPanelSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, editorPanelSize: size }));
  }, []);

  const setRightPanelSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, rightPanelSize: size }));
  }, []);

  // Clear state for project
  const clearState = useCallback(() => {
    setState({});
    try {
      localStorage.removeItem(getStorageKey(projectId));
    } catch (error) {
      console.warn('[Tablet Persistence] Failed to clear state:', error);
    }
  }, [projectId]);

  return {
    state,
    setDrawerOpen,
    setRightPanel,
    setSelectedFileId,
    setEditorPanelSize,
    setRightPanelSize,
    clearState,
  };
}

/**
 * Hook to persist drawer state
 */
export function useDrawerPersistence(projectId: string | number) {
  const [drawerOpen, setDrawerOpenState] = useState<boolean>(() => {
    const state = loadState(projectId);
    // Default to true (open) on tablets since they have more space
    return state.drawerOpen !== undefined ? state.drawerOpen : true;
  });

  useEffect(() => {
    if (projectId) {
      const state = loadState(projectId);
      saveState(projectId, { ...state, drawerOpen });
    }
  }, [projectId, drawerOpen]);

  return [drawerOpen, setDrawerOpenState] as const;
}

/**
 * Hook to persist active panel selection
 */
export function usePanelPersistence(projectId: string | number, canSplitView: boolean) {
  const [rightPanel, setRightPanelState] = useState<TabletPanel>(() => {
    const state = loadState(projectId);
    // Default to deploy for tablet/mobile as per IDE Tab Defaults (replit.md)
    return state.rightPanel || 'deploy';
  });

  useEffect(() => {
    if (projectId) {
      const state = loadState(projectId);
      saveState(projectId, { ...state, rightPanel });
    }
  }, [projectId, rightPanel]);

  return [rightPanel, setRightPanelState] as const;
}

/**
 * Hook to persist panel sizes (resizable panels)
 */
export function usePanelSizesPersistence(projectId: string | number) {
  const [editorPanelSize, setEditorPanelSizeState] = useState<number>(() => {
    const state = loadState(projectId);
    // Default to 60% for editor panel
    return state.editorPanelSize || 60;
  });

  const [rightPanelSize, setRightPanelSizeState] = useState<number>(() => {
    const state = loadState(projectId);
    // Default to 40% for right panel
    return state.rightPanelSize || 40;
  });

  // Save editor panel size
  useEffect(() => {
    if (projectId) {
      const state = loadState(projectId);
      saveState(projectId, { ...state, editorPanelSize });
    }
  }, [projectId, editorPanelSize]);

  // Save right panel size
  useEffect(() => {
    if (projectId) {
      const state = loadState(projectId);
      saveState(projectId, { ...state, rightPanelSize });
    }
  }, [projectId, rightPanelSize]);

  return {
    editorPanelSize,
    setEditorPanelSize: setEditorPanelSizeState,
    rightPanelSize,
    setRightPanelSize: setRightPanelSizeState,
  };
}

/**
 * Hook to persist selected file across tablet sessions
 */
export function useTabletFilePersistence(projectId: string | number) {
  const [selectedFileId, setSelectedFileIdState] = useState<number | null>(() => {
    const state = loadState(projectId);
    return state.selectedFileId || null;
  });

  useEffect(() => {
    if (projectId) {
      const state = loadState(projectId);
      saveState(projectId, { ...state, selectedFileId });
    }
  }, [projectId, selectedFileId]);

  return [selectedFileId, setSelectedFileIdState] as const;
}

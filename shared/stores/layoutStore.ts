/**
 * Layout Store - Cross-Platform State Management
 * Zustand store for responsive layout state with persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DeviceType } from '../responsive-config';
import { getDeviceType } from '../responsive-config';

export interface LayoutState {
  // Device state
  deviceType: DeviceType;
  isKeyboardMode: boolean; // Tablet keyboard connected
  
  // Panel visibility
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  
  // Active tool in left panel
  activeTool: string; // 'files' | 'search' | 'ai-agent' | 'git' | 'debugger' | 'settings'
  
  // Editor state
  activeFileId?: number;
  openTabs: number[];
  pinnedTabs: number[]; // Pinned tabs stay on the left and can't be accidentally closed
  splitMode: 'single' | 'vertical' | 'horizontal' | 'grid';
  minimapEnabled: boolean; // Monaco editor minimap visibility
  
  // Terminal state
  terminalVisible: boolean;
  terminalHeight: number; // pixels or percentage
  
  // Mobile-specific state
  bottomSheetOpen: boolean;
  fabVisible: boolean;
  
  // Actions
  setDeviceType: (type: DeviceType) => void;
  setKeyboardMode: (enabled: boolean) => void;
  togglePanel: (panel: 'left' | 'right' | 'bottom') => void;
  setActiveTool: (tool: string) => void;
  openFile: (fileId: number) => void;
  closeFile: (fileId: number) => void;
  closeOtherTabs: (fileId: number) => void;
  closeTabsToRight: (fileId: number) => void;
  togglePinTab: (fileId: number) => void;
  reorderTabs: (newOrder: number[]) => void;
  setSplitMode: (mode: 'single' | 'vertical' | 'horizontal' | 'grid') => void;
  toggleMinimap: () => void;
  toggleTerminal: () => void;
  setTerminalHeight: (height: number) => void;
  toggleBottomSheet: () => void;
  toggleFab: () => void;
  reset: () => void;
}

const initialState = {
  deviceType: getDeviceType(),
  isKeyboardMode: false,
  leftPanelOpen: true,
  rightPanelOpen: true,
  bottomPanelOpen: false,
  activeTool: 'files',
  openTabs: [],
  pinnedTabs: [],
  splitMode: 'single' as const,
  minimapEnabled: true,
  terminalVisible: false,
  terminalHeight: 300,
  bottomSheetOpen: false,
  fabVisible: true,
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setDeviceType: (type) => set({ deviceType: type }),
      
      setKeyboardMode: (enabled) => set({ isKeyboardMode: enabled }),
      
      togglePanel: (panel) => set((state) => ({
        [`${panel}PanelOpen`]: !state[`${panel}PanelOpen` as keyof LayoutState],
      })),
      
      setActiveTool: (tool) => set({ activeTool: tool }),
      
      openFile: (fileId) => set((state) => {
        if (state.openTabs.includes(fileId)) {
          return { activeFileId: fileId };
        }
        return {
          openTabs: [...state.openTabs, fileId],
          activeFileId: fileId,
        };
      }),
      
      closeFile: (fileId) => set((state) => {
        const newTabs = state.openTabs.filter(id => id !== fileId);
        const newPinned = state.pinnedTabs.filter(id => id !== fileId);
        const newActiveFile = state.activeFileId === fileId
          ? newTabs[newTabs.length - 1]
          : state.activeFileId;
        
        return {
          openTabs: newTabs,
          pinnedTabs: newPinned,
          activeFileId: newActiveFile,
        };
      }),
      
      closeOtherTabs: (fileId) => set((state) => {
        // Preserve all pinned tabs + the selected tab
        const pinnedSet = new Set(state.pinnedTabs);
        const newTabs = [fileId, ...state.pinnedTabs.filter(id => id !== fileId)];
        
        return {
          openTabs: newTabs,
          activeFileId: fileId,
        };
      }),
      
      closeTabsToRight: (fileId) => set((state) => {
        const currentIndex = state.openTabs.indexOf(fileId);
        if (currentIndex === -1) return state;
        
        // Keep tabs to the left + current tab + all pinned tabs
        const tabsToLeft = state.openTabs.slice(0, currentIndex + 1);
        const tabsToRight = state.openTabs.slice(currentIndex + 1);
        
        // Only close non-pinned tabs to the right
        const unpinnedToRight = tabsToRight.filter(id => !state.pinnedTabs.includes(id));
        const newTabs = state.openTabs.filter(id => !unpinnedToRight.includes(id));
        
        return {
          openTabs: newTabs,
          activeFileId: state.activeFileId && newTabs.includes(state.activeFileId)
            ? state.activeFileId
            : fileId,
        };
      }),
      
      togglePinTab: (fileId) => set((state) => {
        const isPinned = state.pinnedTabs.includes(fileId);
        let newPinnedTabs: number[];
        let newOpenTabs = [...state.openTabs];
        
        if (isPinned) {
          // Unpinning - just remove from pinnedTabs array
          newPinnedTabs = state.pinnedTabs.filter(id => id !== fileId);
        } else {
          // Pinning - add to pinnedTabs and move tab to front
          newPinnedTabs = [...state.pinnedTabs, fileId];
          
          // Move pinned tab to the left (with other pinned tabs)
          const currentIndex = newOpenTabs.indexOf(fileId);
          if (currentIndex > -1) {
            newOpenTabs.splice(currentIndex, 1);
            newOpenTabs.unshift(fileId);
          }
        }
        
        return {
          pinnedTabs: newPinnedTabs,
          openTabs: newOpenTabs,
        };
      }),
      
      reorderTabs: (newOrder) => set({ openTabs: newOrder }),
      
      setSplitMode: (mode) => set({ splitMode: mode }),
      
      toggleMinimap: () => set((state) => ({
        minimapEnabled: !state.minimapEnabled,
      })),
      
      toggleTerminal: () => set((state) => ({
        terminalVisible: !state.terminalVisible,
      })),
      
      setTerminalHeight: (height) => set({ terminalHeight: height }),
      
      toggleBottomSheet: () => set((state) => ({
        bottomSheetOpen: !state.bottomSheetOpen,
      })),
      
      toggleFab: () => set((state) => ({
        fabVisible: !state.fabVisible,
      })),
      
      reset: () => set(initialState),
    }),
    {
      name: 'ecode-layout-storage',
      // Only persist user preferences, not runtime state
      partialize: (state) => ({
        activeTool: state.activeTool,
        leftPanelOpen: state.leftPanelOpen,
        rightPanelOpen: state.rightPanelOpen,
        splitMode: state.splitMode,
        minimapEnabled: state.minimapEnabled,
        terminalHeight: state.terminalHeight,
      }),
    }
  )
);

// Selectors
export const selectDeviceType = (state: LayoutState) => state.deviceType;
export const selectIsMobile = (state: LayoutState) => state.deviceType === 'mobile';
export const selectIsTablet = (state: LayoutState) => state.deviceType === 'tablet';
export const selectIsDesktop = (state: LayoutState) => 
  state.deviceType === 'desktop' || state.deviceType === 'laptop';
export const selectActiveTool = (state: LayoutState) => state.activeTool;
export const selectOpenTabs = (state: LayoutState) => state.openTabs;
export const selectActiveFileId = (state: LayoutState) => state.activeFileId;

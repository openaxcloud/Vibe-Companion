import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface UIFilters {
  assigneeIds: string[]; // empty => no filter
  sprintIds: string[]; // empty => no filter
  searchQuery: string;
  labels: string[];
  onlyMyIssues: boolean;
}

export interface UIState {
  isSidebarOpen: boolean;
  selectedProjectId: string | null;
  selectedBoardId: string | null;
  themePreference: ThemePreference;
  filters: UIFilters;

  // Sidebar
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;

  // Selection
  setSelectedProjectId: (projectId: string | null) => void;
  setSelectedBoardId: (boardId: string | null) => void;
  clearSelection: () => void;

  // Theme
  setThemePreference: (theme: ThemePreference) => void;

  // Filters
  setAssigneeFilter: (assigneeIds: string[]) => void;
  setSprintFilter: (sprintIds: string[]) => void;
  setSearchQuery: (query: string) => void;
  setLabelFilter: (labels: string[]) => void;
  setOnlyMyIssues: (onlyMine: boolean) => void;
  resetFilters: () => void;
  setFilters: (filters: Partial<UIFilters>) => void;
}

const defaultFilters: UIFilters = {
  assigneeIds: [],
  sprintIds: [],
  searchQuery: '',
  labels: [],
  onlyMyIssues: false,
};

const STORAGE_KEY = 'ui-store';

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      isSidebarOpen: true,
      selectedProjectId: null,
      selectedBoardId: null,
      themePreference: 'system',
      filters: { ...defaultFilters },

      // Sidebar
      toggleSidebar: () =>
        set((state) => ({
          isSidebarOpen: !state.isSidebarOpen,
        })),
      openSidebar: () =>
        set(() => ({
          isSidebarOpen: true,
        })),
      closeSidebar: () =>
        set(() => ({
          isSidebarOpen: false,
        })),

      // Selection
      setSelectedProjectId: (projectId) =>
        set((state) => ({
          selectedProjectId: projectId,
          // Optionally clear board if project changes
          selectedBoardId:
            projectId === state.selectedProjectId ? state.selectedBoardId : null,
        })),
      setSelectedBoardId: (boardId) =>
        set(() => ({
          selectedBoardId: boardId,
        })),
      clearSelection: () =>
        set(() => ({
          selectedProjectId: null,
          selectedBoardId: null,
        })),

      // Theme
      setThemePreference: (theme) =>
        set(() => ({
          themePreference: theme,
        })),

      // Filters
      setAssigneeFilter: (assigneeIds) =>
        set((state) => ({
          filters: {
            ...state.filters,
            assigneeIds,
          },
        })),
      setSprintFilter: (sprintIds) =>
        set((state) => ({
          filters: {
            ...state.filters,
            sprintIds,
          },
        })),
      setSearchQuery: (query) =>
        set((state) => ({
          filters: {
            ...state.filters,
            searchQuery: query,
          },
        })),
      setLabelFilter: (labels) =>
        set((state) => ({
          filters: {
            ...state.filters,
            labels,
          },
        })),
      setOnlyMyIssues: (onlyMine) =>
        set((state) => ({
          filters: {
            ...state.filters,
            onlyMyIssues: onlyMine,
          },
        })),
      resetFilters: () =>
        set(() => ({
          filters: { ...defaultFilters },
        })),
      setFilters: (partialFilters) =>
        set((state) => ({
          filters: {
            ...state.filters,
            ...partialFilters,
          },
        })),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        selectedProjectId: state.selectedProjectId,
        selectedBoardId: state.selectedBoardId,
        themePreference: state.themePreference,
      }),
    }
  )
);

// Selectors

export const selectIsSidebarOpen = (state: UIState) => state.isSidebarOpen;
export const selectSelectedProjectId = (state: UIState) => state.selectedProjectId;
export const selectSelectedBoardId = (state: UIState) => state.selectedBoardId;
export const selectThemePreference = (state: UIState) => state.themePreference;
export const selectUIFilters = (state: UIState) => state.filters;
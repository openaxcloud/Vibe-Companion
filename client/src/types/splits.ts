/**
 * Core type definitions for the Splits layout system
 * Based on Replit's flexible panel management system
 */

export type PaneType = 'editor' | 'terminal' | 'preview' | 'console' | 'files' | 'git' | 'database' | 'custom';

export interface TabInfo {
  id: string;
  title: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  type: PaneType;
  filePath?: string;
  isDirty?: boolean;
  canClose?: boolean;
}

export interface PaneGroup {
  id: string;
  tabs: TabInfo[];
  activeTabIndex: number;
  percent: number;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean; // If true, shows collapse/expand button in header
  collapsed?: boolean; // Current collapsed state (driven from percent, not set manually)
  previousPercent?: number; // Saved size before collapse (for restore)
  parentSplitId?: string; // ID of parent split (for toggleCollapse calls)
  isFloating?: boolean;
  floatingPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Split {
  id: string;
  direction: 'horizontal' | 'vertical';
  children: (Split | PaneGroup)[];
  percent?: number;
}

export type LayoutNode = Split | PaneGroup;

export interface FloatingPane {
  id: string;
  paneGroup: PaneGroup;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zIndex: number;
  isMinimized?: boolean;
  isMaximized?: boolean;
  previousPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type DropZone = 'top' | 'right' | 'bottom' | 'left' | 'center' | 'header';

export interface DragItem {
  type: 'tab' | 'pane' | 'file';
  source: 'layout' | 'file-tree' | 'floating';
  id: string;
  paneId?: string;
  tabInfo?: TabInfo;
  filePath?: string;
  fileName?: string;
}

export interface DropTarget {
  targetId: string;
  zone: DropZone;
  isActive: boolean;
  preview?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DragState {
  isDragging: boolean;
  draggedItem: DragItem | null;
  dropTarget: DropTarget | null;
  dragPosition: { x: number; y: number } | null;
  dragOffset: { x: number; y: number } | null;
  isValidDrop: boolean;
}

export interface ResizeState {
  isResizing: boolean;
  resizingId: string | null;
  direction: 'horizontal' | 'vertical' | null;
  startPosition: number;
  currentPosition: number;
  startSizes: number[];
}

export interface LayoutState {
  root: LayoutNode | null;
  floatingPanes: FloatingPane[];
  activePane: string | null;
  maximizedPane: string | null;
  dragState: DragState;
  resizeState: ResizeState;
  layoutHistory: LayoutNode[];
  historyIndex: number;
}

export interface SplitsContextMenu {
  paneId: string;
  x: number;
  y: number;
  options: {
    canSplitHorizontal: boolean;
    canSplitVertical: boolean;
    canFloat: boolean;
    canMaximize: boolean;
    canClose: boolean;
  };
}

// Helper type guards
export function isSplit(node: LayoutNode): node is Split {
  return 'children' in node && 'direction' in node;
}

export function isPaneGroup(node: LayoutNode): node is PaneGroup {
  return 'tabs' in node && 'activeTabIndex' in node;
}

// Layout operations
export interface LayoutOperations {
  splitPane: (paneId: string, direction: 'horizontal' | 'vertical', newPane?: PaneGroup) => void;
  mergePane: (sourcePaneId: string, targetPaneId: string) => void;
  moveTab: (tabId: string, sourcePaneId: string, targetPaneId: string, targetIndex?: number) => void;
  closeTab: (tabId: string, paneId: string) => void;
  addTab: (paneId: string, tab: TabInfo, makeActive?: boolean) => void;
  floatPane: (paneId: string) => void;
  unfloatPane: (floatingPaneId: string, dropTarget?: DropTarget) => void;
  maximizePane: (paneId: string) => void;
  restorePane: (paneId: string) => void;
  resizeSplit: (splitId: string, sizes: number[]) => void;
  saveLayout: () => void;
  loadLayout: (layout: LayoutNode) => void;
  resetLayout: () => void;
  undo: () => void;
  redo: () => void;
}

// Default layouts
export const DEFAULT_LAYOUT: Split = {
  id: 'root',
  direction: 'horizontal',
  children: [
    {
      id: 'left-pane',
      tabs: [
        {
          id: 'files-tab',
          title: 'Files',
          type: 'files',
          content: null,
          canClose: false,
        }
      ],
      activeTabIndex: 0,
      percent: 20,
      minSize: 150,
    },
    {
      id: 'center-split',
      direction: 'vertical',
      children: [
        {
          id: 'editor-pane',
          tabs: [],
          activeTabIndex: 0,
          percent: 70,
          minSize: 200,
        },
        {
          id: 'bottom-pane',
          tabs: [
            {
              id: 'terminal-tab',
              title: 'Terminal',
              type: 'terminal',
              content: null,
            },
            {
              id: 'console-tab',
              title: 'Console',
              type: 'console',
              content: null,
            }
          ],
          activeTabIndex: 0,
          percent: 30,
          minSize: 100,
        }
      ],
      percent: 60,
    },
    {
      id: 'right-pane',
      tabs: [
        {
          id: 'preview-tab',
          title: 'Preview',
          type: 'preview',
          content: null,
        }
      ],
      activeTabIndex: 0,
      percent: 20,
      minSize: 150,
    }
  ],
};
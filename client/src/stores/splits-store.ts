// @ts-nocheck
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  LayoutNode,
  Split,
  PaneGroup,
  FloatingPane,
  TabInfo,
  DragState,
  ResizeState,
  DropTarget,
  DragItem,
  isSplit,
  isPaneGroup,
  DEFAULT_LAYOUT,
  DropZone,
} from '@/types/splits';

// Replit-style bottom panel constants (Fortune 500-grade absolute pixels)
const MIN_BOTTOM_PANEL_PX = 216; // Minimum absolute height (216px @ 1080p = 20% viewport)
const MIN_TOP_BUFFER_PX = 100; // Minimum space for top editor header/content (100px preserves usability)
const DEFAULT_BOTTOM_PANEL_PERCENT = 30; // Default expanded height (30% of parent)

/**
 * Calculate minimum percent for bottom panel based on ACTUAL measured container height
 * Enforces absolute 216px minimum while preserving 100px top editor buffer
 * Fortune 500-grade: Dynamic calculation prevents both artificial caps AND editor hiding
 */
function getMinimumBottomPanelPercent(centerStackHeight: number | null): number {
  // Use measured height or fallback to viewport heuristic
  const workspaceHeight = centerStackHeight || (typeof window !== 'undefined' 
    ? (window.innerHeight * 0.67) // Fallback heuristic (720px @ 1080p)
    : 720); // SSR fallback
  
  // Required percent for 216px bottom
  const minPercent = (MIN_BOTTOM_PANEL_PX / workspaceHeight) * 100;
  
  // Maximum percent that preserves 100px top editor buffer
  const topBufferPercent = (MIN_TOP_BUFFER_PX / workspaceHeight) * 100;
  const maxPercent = 100 - topBufferPercent;
  
  // CRITICAL ARCHITECT-APPROVED LOGIC:
  // - If workspace >= 316px (216 + 100): Both constraints satisfied → minPercent wins
  // - If workspace < 316px: Physical conflict → maxPercent wins (preserve editor)
  // - Always floor at 20% for extreme edge cases
  // This ensures 216px minimum for ALL realistic containers while preventing 100% takeover
  return Math.max(20, Math.min(maxPercent, minPercent));
}

/**
 * Normalize layout to enforce Replit-style minimum heights (Fortune 500-grade)
 * Uses absolute pixels (216px) instead of relative percent for viewport-independent minimum
 */
function normalizeLayout(root: LayoutNode | null, centerStackHeight: number | null): void {
  if (!root) return;
  
  function walkAndNormalize(node: LayoutNode, parentSplit: Split | null = null): void {
    if (isSplit(node) && Array.isArray(node.children)) {
      // Check if this split contains center-bottom panel
      node.children.forEach((child, index) => {
        if (isPaneGroup(child) && child.id === 'center-bottom') {
          const minPercent = getMinimumBottomPanelPercent(centerStackHeight);
          const currentPercent = child.percent || DEFAULT_BOTTOM_PANEL_PERCENT;
          
          // Enforce absolute minimum (216px translated to percent)
          if (currentPercent < minPercent) {
            const clampedPercent = Math.min(90, minPercent); // Cap at 90%
            child.percent = clampedPercent;
            child.collapsed = false; // Clear stale collapsed flag
            
            // Rebalance sibling to maintain 100% total
            const siblingIndex = index === 0 ? 1 : 0;
            if (node.children[siblingIndex]) {
              node.children[siblingIndex].percent = 100 - clampedPercent;
            }
          }
        }
        
        // Recurse into child splits
        walkAndNormalize(child, node);
      });
    }
  }
  
  walkAndNormalize(root);
}

interface SplitsStore {
  // State
  root: LayoutNode | null;
  floatingPanes: Map<string, FloatingPane>;
  activePane: string | null;
  maximizedPane: string | null;
  dragState: DragState;
  resizeState: ResizeState;
  layoutHistory: LayoutNode[];
  historyIndex: number;
  nextFloatingZIndex: number;
  
  // Layout Dimensions (for accurate minimum height calculation - Fortune 500)
  centerStackHeight: number | null; // Actual center-stack container height in pixels

  // Actions
  initializeLayout: (layout?: LayoutNode) => void;
  splitPane: (paneId: string, direction: 'horizontal' | 'vertical', newPane?: PaneGroup) => void;
  mergePane: (sourcePaneId: string, targetPaneId: string) => void;
  moveTab: (tabId: string, sourcePaneId: string, targetPaneId: string, targetIndex?: number) => void;
  closeTab: (tabId: string, paneId: string) => void;
  addTab: (paneId: string, tab: TabInfo, makeActive?: boolean) => void;
  floatPane: (paneId: string) => void;
  unfloatPane: (floatingPaneId: string, dropTarget?: DropTarget) => void;
  maximizePane: (paneId: string) => void;
  restorePane: () => void;
  resizeSplit: (splitId: string, sizes: number[]) => void;
  setPaneSize: (paneId: string, percent: number) => void;
  toggleMinimize: (paneId: string) => void;
  setActivePane: (paneId: string) => void;
  setActiveTab: (paneId: string, tabIndexOrId: number | string) => void;
  toggleCollapse: (splitId: string, childIndex: number) => void;
  updateFloatingPosition: (paneId: string, position: { x: number; y: number; width?: number; height?: number }) => void;
  bringFloatingToFront: (paneId: string) => void;
  
  // Drag & Drop
  startDrag: (item: DragItem, position: { x: number; y: number }, offset?: { x: number; y: number }) => void;
  updateDrag: (position: { x: number; y: number }, dropTarget?: DropTarget | null) => void;
  endDrag: () => void;
  
  // Resize
  startResize: (splitId: string, direction: 'horizontal' | 'vertical', startPosition: number) => void;
  updateResize: (currentPosition: number) => void;
  endResize: () => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  
  // Persistence
  saveLayout: () => void;
  loadLayout: (layout?: string) => void;
  resetLayout: () => void;
  
  // Utilities
  findNode: (nodeId: string, node?: LayoutNode) => LayoutNode | null;
  findParentSplit: (nodeId: string, node?: LayoutNode) => Split | null;
  generatePaneId: () => string;
  generateTabId: () => string;
  calculateDropZone: (paneId: string, position: { x: number; y: number }) => DropZone | null;
  
  // Layout Dimensions Actions
  setCenterStackHeight: (height: number) => void;
}

// Utility functions

// Hydrate parent metadata for all panes in the tree
// Ensures parentSplitId and collapsible flags are set correctly after layout load/init
const hydrateParentMetadata = (node: LayoutNode | null, parentId: string | null = null): void => {
  if (!node) return;
  
  if (isSplit(node)) {
    // Recursively hydrate children with this split as parent
    for (const child of node.children) {
      if (isPaneGroup(child)) {
        // Attach parent reference
        child.parentSplitId = node.id;
        
        // Preserve collapsible flag if already set, otherwise default to false
        if (child.collapsible === undefined) {
          child.collapsible = false;
        }
        
        // Preserve collapsed flag if already set, otherwise default to false
        if (child.collapsed === undefined) {
          child.collapsed = false;
        }
      }
      
      // Recursively hydrate nested splits
      hydrateParentMetadata(child, node.id);
    }
  }
};

const findNodeRecursive = (nodeId: string, node: LayoutNode | null): LayoutNode | null => {
  if (!node) return null;
  if (node.id === nodeId) return node;
  
  if (isSplit(node) && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNodeRecursive(nodeId, child);
      if (found) return found;
    }
  }
  
  return null;
};

const findParentSplitRecursive = (nodeId: string, node: LayoutNode | null, parent: Split | null = null): Split | null => {
  if (!node) return null;
  if (node.id === nodeId) return parent;
  
  if (isSplit(node) && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findParentSplitRecursive(nodeId, child, node);
      if (found) return found;
    }
  }
  
  return null;
};

const removeNodeFromTree = (nodeId: string, node: LayoutNode | null): LayoutNode | null => {
  if (!node) return null;
  
  if (isSplit(node) && Array.isArray(node.children)) {
    const newChildren = node.children.filter(child => child.id !== nodeId);
    
    if (newChildren.length !== node.children.length) {
      // Node was removed
      if (newChildren.length === 1) {
        // If only one child left, promote it
        return newChildren[0];
      }
      return {
        ...node,
        children: newChildren,
      };
    }
    
    // Recursively check children
    return {
      ...node,
      children: node.children.map(child => removeNodeFromTree(nodeId, child)).filter(Boolean) as LayoutNode[],
    };
  }
  
  return node;
};

const useSplitsStore = create<SplitsStore>()(
  immer((set, get) => ({
    // Initial state
    root: null,
    floatingPanes: new Map(),
    activePane: null,
    maximizedPane: null,
    centerStackHeight: null, // Measured by SplitsEditorLayoutV2 ResizeObserver
    dragState: {
      isDragging: false,
      draggedItem: null,
      dropTarget: null,
      dragPosition: null,
      dragOffset: null,
      isValidDrop: false,
    },
    resizeState: {
      isResizing: false,
      resizingId: null,
      direction: null,
      startPosition: 0,
      currentPosition: 0,
      startSizes: [],
    },
    layoutHistory: [],
    historyIndex: -1,
    nextFloatingZIndex: 1000,

    // Initialize layout
    initializeLayout: (layout) => {
      set((state) => {
        state.root = layout || DEFAULT_LAYOUT;
        
        // Hydrate parent metadata to ensure parentSplitId and collapsible flags are set
        hydrateParentMetadata(state.root);
        
        // Normalize layout to enforce Replit-style minimums (Fortune 500-grade)
        normalizeLayout(state.root, state.centerStackHeight);
        
        state.floatingPanes = new Map();
        state.activePane = null;
        state.maximizedPane = null;
        state.layoutHistory = [state.root];
        state.historyIndex = 0;
      });
    },

    // Split a pane
    splitPane: (paneId, direction, newPane) => {
      set((state) => {
        const targetPane = findNodeRecursive(paneId, state.root);
        if (!targetPane || !isPaneGroup(targetPane)) return;

        const parent = findParentSplitRecursive(paneId, state.root);
        const newPaneGroup = newPane || {
          id: get().generatePaneId(),
          tabs: [],
          activeTabIndex: 0,
          percent: 50,
        };

        if (parent && Array.isArray(parent.children)) {
          // Replace the pane with a new split
          const targetIndex = parent.children.findIndex(child => child.id === paneId);
          if (targetIndex !== -1) {
            const newSplit: Split = {
              id: get().generatePaneId(),
              direction,
              children: [
                { ...targetPane, percent: 50 },
                newPaneGroup,
              ],
            };
            parent.children[targetIndex] = newSplit;
          }
        } else if (state.root?.id === paneId) {
          // Root is the pane, wrap it in a split
          state.root = {
            id: 'root',
            direction,
            children: [
              { ...targetPane, percent: 50 },
              newPaneGroup,
            ],
          };
        }
        
        get().saveToHistory();
      });
    },

    // Move a tab between panes
    moveTab: (tabId, sourcePaneId, targetPaneId, targetIndex) => {
      set((state) => {
        const sourcePane = findNodeRecursive(sourcePaneId, state.root) as PaneGroup;
        const targetPane = findNodeRecursive(targetPaneId, state.root) as PaneGroup;
        
        if (!sourcePane || !targetPane || !isPaneGroup(sourcePane) || !isPaneGroup(targetPane)) return;
        if (!Array.isArray(sourcePane.tabs) || !Array.isArray(targetPane.tabs)) return;
        
        const tabIndex = sourcePane.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;
        
        const tab = sourcePane.tabs[tabIndex];
        
        // Remove from source
        sourcePane.tabs.splice(tabIndex, 1);
        if (sourcePane.activeTabIndex >= sourcePane.tabs.length) {
          sourcePane.activeTabIndex = Math.max(0, sourcePane.tabs.length - 1);
        }
        
        // Add to target
        const insertIndex = targetIndex ?? targetPane.tabs.length;
        targetPane.tabs.splice(insertIndex, 0, tab);
        targetPane.activeTabIndex = insertIndex;
        
        // Remove empty panes
        if (sourcePane.tabs.length === 0 && sourcePaneId !== targetPaneId) {
          state.root = removeNodeFromTree(sourcePaneId, state.root);
        }
      });
    },

    // Close a tab
    closeTab: (tabId, paneId) => {
      set((state) => {
        const pane = findNodeRecursive(paneId, state.root) as PaneGroup;
        if (!pane || !isPaneGroup(pane) || !Array.isArray(pane.tabs)) return;
        
        const tabIndex = pane.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;
        
        pane.tabs.splice(tabIndex, 1);
        
        if (pane.activeTabIndex >= pane.tabs.length) {
          pane.activeTabIndex = Math.max(0, pane.tabs.length - 1);
        }
        
        // Remove pane if no tabs left
        if (pane.tabs.length === 0) {
          state.root = removeNodeFromTree(paneId, state.root);
        }
      });
    },

    // Add a tab to a pane
    addTab: (paneId, tab, makeActive = true) => {
      set((state) => {
        const pane = findNodeRecursive(paneId, state.root) as PaneGroup;
        if (!pane || !isPaneGroup(pane) || !Array.isArray(pane.tabs)) return;
        
        // Check if tab already exists
        const existingIndex = pane.tabs.findIndex(t => t.id === tab.id);
        if (existingIndex !== -1) {
          if (makeActive) {
            pane.activeTabIndex = existingIndex;
          }
          return;
        }
        
        pane.tabs.push(tab);
        if (makeActive) {
          pane.activeTabIndex = pane.tabs.length - 1;
        }
      });
    },

    // Float a pane
    floatPane: (paneId) => {
      set((state) => {
        const pane = findNodeRecursive(paneId, state.root) as PaneGroup;
        if (!pane || !isPaneGroup(pane)) return;
        
        // Remove from layout
        state.root = removeNodeFromTree(paneId, state.root);
        
        // Add to floating panes
        const floatingPane: FloatingPane = {
          id: paneId,
          paneGroup: pane,
          position: {
            x: window.innerWidth / 2 - 400,
            y: window.innerHeight / 2 - 300,
            width: 800,
            height: 600,
          },
          zIndex: state.nextFloatingZIndex++,
        };
        
        state.floatingPanes.set(paneId, floatingPane);
      });
    },

    // Unfloat a pane
    unfloatPane: (floatingPaneId, dropTarget) => {
      set((state) => {
        const floatingPane = state.floatingPanes.get(floatingPaneId);
        if (!floatingPane) return;
        
        state.floatingPanes.delete(floatingPaneId);
        
        if (dropTarget) {
          // Add back to layout at drop target
          const targetNode = findNodeRecursive(dropTarget.targetId, state.root);
          if (targetNode && dropTarget.zone !== 'center') {
            // Split the target
            const direction = dropTarget.zone === 'top' || dropTarget.zone === 'bottom' ? 'vertical' : 'horizontal';
            get().splitPane(dropTarget.targetId, direction, floatingPane.paneGroup);
          } else if (targetNode && isPaneGroup(targetNode) && dropTarget.zone === 'center') {
            // Merge tabs
            if (Array.isArray(floatingPane.paneGroup.tabs)) {
              floatingPane.paneGroup.tabs.forEach(tab => {
                get().addTab(dropTarget.targetId, tab, true);
              });
            }
          }
        } else {
          // Add back as a new pane
          if (!state.root) {
            state.root = floatingPane.paneGroup;
          } else {
            // Add to right side by default
            get().splitPane('root', 'horizontal', floatingPane.paneGroup);
          }
        }
      });
    },

    // Maximize/restore pane
    maximizePane: (paneId) => {
      set((state) => {
        state.maximizedPane = paneId;
      });
    },
    
    restorePane: () => {
      set((state) => {
        state.maximizedPane = null;
      });
    },

    // Resize split
    resizeSplit: (splitId, sizes) => {
      set((state) => {
        const split = findNodeRecursive(splitId, state.root) as Split;
        if (!split || !isSplit(split) || !Array.isArray(split.children)) return;
        
        split.children.forEach((child, index) => {
          if (index < sizes.length) {
            child.percent = sizes[index];
          }
        });
      });
    },

    // Set pane size (Replit-style with minimum enforcement - absolute pixels)
    setPaneSize: (paneId, percent) => {
      set((state) => {
        const pane = findNodeRecursive(paneId, state.root) as PaneGroup;
        if (!pane || !isPaneGroup(pane)) return;
        
        // Enforce minimum height for bottom panel (216px absolute)
        const minPercent = paneId === 'center-bottom' ? getMinimumBottomPanelPercent(state.centerStackHeight) : 10;
        const clampedPercent = Math.max(minPercent, Math.min(100, percent));
        pane.percent = clampedPercent;
        
        // Update parent split siblings
        const parent = get().findParentSplit(paneId);
        if (!parent || !Array.isArray(parent.children)) return;
        
        const childIndex = parent.children.findIndex(child => child.id === paneId);
        if (childIndex === -1) return;
        
        // Adjust sibling to maintain 100% total
        const siblingIndex = childIndex === 0 ? 1 : 0;
        parent.children[siblingIndex].percent = 100 - clampedPercent;
      });
    },

    // Toggle minimize (Replit-style: minimum ↔ last expanded height - absolute pixels)
    toggleMinimize: (paneId) => {
      set((state) => {
        const pane = findNodeRecursive(paneId, state.root) as PaneGroup;
        if (!pane || !isPaneGroup(pane)) return;
        
        const minPercent = getMinimumBottomPanelPercent(state.centerStackHeight);
        const currentPercent = pane.percent || DEFAULT_BOTTOM_PANEL_PERCENT;
        const isMinimized = currentPercent <= minPercent + 2; // +2% tolerance
        
        if (isMinimized) {
          // Restore: Use saved size or default
          const savedPercent = pane.previousPercent || DEFAULT_BOTTOM_PANEL_PERCENT;
          pane.percent = savedPercent;
          pane.collapsed = false;
          
          // Update sibling
          const parent = get().findParentSplit(paneId);
          if (parent && Array.isArray(parent.children)) {
            const childIndex = parent.children.findIndex(child => child.id === paneId);
            if (childIndex !== -1) {
              const siblingIndex = childIndex === 0 ? 1 : 0;
              parent.children[siblingIndex].percent = 100 - savedPercent;
            }
          }
        } else {
          // Minimize: Save current size and go to minimum (216px absolute)
          pane.previousPercent = currentPercent;
          pane.percent = minPercent;
          pane.collapsed = false; // Not fully collapsed, just minimized
          
          // Update sibling
          const parent = get().findParentSplit(paneId);
          if (parent && Array.isArray(parent.children)) {
            const childIndex = parent.children.findIndex(child => child.id === paneId);
            if (childIndex !== -1) {
              const siblingIndex = childIndex === 0 ? 1 : 0;
              parent.children[siblingIndex].percent = 100 - minPercent;
            }
          }
        }
      });
    },

    // Set active pane
    setActivePane: (paneId) => {
      set((state) => {
        state.activePane = paneId;
      });
    },

    // Set active tab in a pane
    setActiveTab: (paneId, tabIndexOrId) => {
      set((state) => {
        const pane = findNodeRecursive(paneId, state.root) as PaneGroup;
        if (!pane || !isPaneGroup(pane)) return;
        
        if (typeof tabIndexOrId === 'number') {
          // Set by index
          if (tabIndexOrId >= 0 && tabIndexOrId < pane.tabs.length) {
            pane.activeTabIndex = tabIndexOrId;
          }
        } else {
          // Set by tab ID
          const tabIndex = pane.tabs.findIndex(t => t.id === tabIndexOrId);
          if (tabIndex >= 0) {
            pane.activeTabIndex = tabIndex;
          }
        }
      });
    },

    // Toggle collapse/minimize (Replit-style: absolute pixels 216px minimum)
    // DEPRECATED: Use toggleMinimize instead for Replit-style behavior
    toggleCollapse: (splitId, childIndex) => {
      set((state) => {
        const split = findNodeRecursive(splitId, state.root) as Split;
        if (!split || !isSplit(split) || childIndex >= split.children.length) return;
        
        const child = split.children[childIndex] as PaneGroup;
        if (!isPaneGroup(child) || !child.collapsible) return;
        
        // Replit-style: Use absolute pixels (216px) instead of 0%
        const minPercent = getMinimumBottomPanelPercent(state.centerStackHeight);
        const currentPercent = child.percent || DEFAULT_BOTTOM_PANEL_PERCENT;
        const isMinimized = currentPercent <= minPercent + 2; // +2% tolerance
        
        if (isMinimized) {
          // Expand: Restore to saved size or default (30%)
          const savedPercent = child.previousPercent || DEFAULT_BOTTOM_PANEL_PERCENT;
          child.percent = savedPercent;
          child.collapsed = false;
          
          // Adjust sibling
          if (childIndex === 0) {
            split.children[1].percent = 100 - savedPercent;
          } else {
            split.children[0].percent = 100 - savedPercent;
          }
        } else {
          // Minimize: Save current size and go to minimum (216px absolute)
          child.previousPercent = currentPercent;
          child.percent = minPercent;
          child.collapsed = false; // Not fully collapsed
          
          // Adjust sibling
          if (childIndex === 0) {
            split.children[1].percent = 100 - minPercent;
          } else {
            split.children[0].percent = 100 - minPercent;
          }
        }
      });
    },

    // Update floating pane position
    updateFloatingPosition: (paneId, position) => {
      set((state) => {
        const floatingPane = state.floatingPanes.get(paneId);
        if (floatingPane) {
          floatingPane.position = {
            ...floatingPane.position,
            ...position,
          };
        }
      });
    },

    // Bring floating pane to front
    bringFloatingToFront: (paneId) => {
      set((state) => {
        const floatingPane = state.floatingPanes.get(paneId);
        if (floatingPane) {
          floatingPane.zIndex = state.nextFloatingZIndex++;
        }
      });
    },

    // Drag & Drop
    startDrag: (item, position, offset) => {
      set((state) => {
        state.dragState = {
          isDragging: true,
          draggedItem: item,
          dropTarget: null,
          dragPosition: position,
          dragOffset: offset || { x: 0, y: 0 },
          isValidDrop: false,
        };
      });
    },

    updateDrag: (position, dropTarget) => {
      set((state) => {
        state.dragState.dragPosition = position;
        state.dragState.dropTarget = dropTarget || null;
        state.dragState.isValidDrop = dropTarget !== null;
      });
    },

    endDrag: () => {
      const { dragState } = get();
      
      if (dragState.isValidDrop && dragState.dropTarget && dragState.draggedItem) {
        const { dropTarget, draggedItem } = dragState;
        
        if (draggedItem.type === 'tab' && draggedItem.paneId) {
          // Moving a tab
          if (dropTarget.zone === 'header' || dropTarget.zone === 'center') {
            // Merge tabs
            get().moveTab(
              draggedItem.id,
              draggedItem.paneId,
              dropTarget.targetId
            );
          } else {
            // Split and move
            const direction = dropTarget.zone === 'top' || dropTarget.zone === 'bottom' ? 'vertical' : 'horizontal';
            const newPaneId = get().generatePaneId();
            const newPane: PaneGroup = {
              id: newPaneId,
              tabs: [],
              activeTabIndex: 0,
              percent: 50,
            };
            
            get().splitPane(dropTarget.targetId, direction, newPane);
            get().moveTab(draggedItem.id, draggedItem.paneId, newPaneId);
          }
        } else if (draggedItem.type === 'file') {
          // Opening a file from file tree
          const tab: TabInfo = {
            id: get().generateTabId(),
            title: draggedItem.fileName || 'New File',
            type: 'editor',
            content: null,
            filePath: draggedItem.filePath,
          };
          
          if (dropTarget.zone === 'header' || dropTarget.zone === 'center') {
            get().addTab(dropTarget.targetId, tab, true);
          } else {
            const direction = dropTarget.zone === 'top' || dropTarget.zone === 'bottom' ? 'vertical' : 'horizontal';
            const newPaneId = get().generatePaneId();
            const newPane: PaneGroup = {
              id: newPaneId,
              tabs: [tab],
              activeTabIndex: 0,
              percent: 50,
            };
            
            get().splitPane(dropTarget.targetId, direction, newPane);
          }
        }
      }
      
      set((state) => {
        state.dragState = {
          isDragging: false,
          draggedItem: null,
          dropTarget: null,
          dragPosition: null,
          dragOffset: null,
          isValidDrop: false,
        };
      });
    },

    // Resize
    startResize: (splitId, direction, startPosition) => {
      const split = get().findNode(splitId, get().root) as Split;
      if (!split || !isSplit(split) || !Array.isArray(split.children)) return;
      
      set((state) => {
        state.resizeState = {
          isResizing: true,
          resizingId: splitId,
          direction,
          startPosition,
          currentPosition: startPosition,
          startSizes: split.children.map(child => child.percent || 0),
        };
      });
    },

    updateResize: (currentPosition) => {
      set((state) => {
        state.resizeState.currentPosition = currentPosition;
        
        if (state.resizeState.resizingId) {
          const split = findNodeRecursive(state.resizeState.resizingId, state.root) as Split;
          if (!split || !isSplit(split) || !Array.isArray(split.children)) return;
          
          const delta = currentPosition - state.resizeState.startPosition;
          const totalSize = state.resizeState.direction === 'horizontal' ? window.innerWidth : window.innerHeight;
          const deltaPercent = (delta / totalSize) * 100;
          
          // Check if bottom panel is involved (Replit-style minimum - absolute pixels)
          const hasBottomPanel = split.children.some(child => child.id === 'center-bottom');
          const minPercent = hasBottomPanel ? getMinimumBottomPanelPercent(state.centerStackHeight) : 10;
          
          // Update sizes with Replit-style minimums (216px for bottom)
          split.children.forEach((child, index) => {
            const startSize = state.resizeState.startSizes[index];
            let newPercent: number;
            
            if (index === 0) {
              newPercent = startSize + deltaPercent;
            } else {
              newPercent = startSize - deltaPercent;
            }
            
            // Enforce minimum for bottom panel (216px absolute)
            if (hasBottomPanel && child.id === 'center-bottom') {
              child.percent = Math.max(minPercent, Math.min(90, newPercent));
            } else {
              child.percent = Math.max(10, Math.min(90, newPercent));
            }
          });
        }
      });
    },

    endResize: () => {
      set((state) => {
        state.resizeState = {
          isResizing: false,
          resizingId: null,
          direction: null,
          startPosition: 0,
          currentPosition: 0,
          startSizes: [],
        };
      });
      get().saveToHistory();
    },

    // History
    undo: () => {
      set((state) => {
        if (state.historyIndex > 0) {
          state.historyIndex--;
          state.root = state.layoutHistory[state.historyIndex];
        }
      });
    },

    redo: () => {
      set((state) => {
        if (state.historyIndex < state.layoutHistory.length - 1) {
          state.historyIndex++;
          state.root = state.layoutHistory[state.historyIndex];
        }
      });
    },

    saveToHistory: () => {
      set((state) => {
        const currentLayout = JSON.parse(JSON.stringify(state.root));
        state.layoutHistory = state.layoutHistory.slice(0, state.historyIndex + 1);
        state.layoutHistory.push(currentLayout);
        state.historyIndex++;
        
        // Limit history size
        if (state.layoutHistory.length > 50) {
          state.layoutHistory.shift();
          state.historyIndex--;
        }
      });
    },

    // Persistence
    saveLayout: () => {
      const state = get();
      const layoutData = {
        root: state.root,
        floatingPanes: Array.from(state.floatingPanes.entries()),
        activePane: state.activePane,
        maximizedPane: state.maximizedPane,
      };
      localStorage.setItem('splits-layout', JSON.stringify(layoutData));
    },

    loadLayout: (layoutStr) => {
      try {
        const layoutData = layoutStr 
          ? JSON.parse(layoutStr)
          : JSON.parse(localStorage.getItem('splits-layout') || '{}');
        
        set((state) => {
          state.root = layoutData.root || DEFAULT_LAYOUT;
          
          // Hydrate parent metadata after loading from storage
          hydrateParentMetadata(state.root);
          
          // Normalize layout to enforce Replit-style minimums (Fortune 500-grade)
          // This ensures old localStorage layouts with invalid percents are fixed
          normalizeLayout(state.root, state.centerStackHeight);
          
          state.floatingPanes = new Map(layoutData.floatingPanes || []);
          state.activePane = layoutData.activePane || null;
          state.maximizedPane = layoutData.maximizedPane || null;
          state.layoutHistory = [state.root];
          state.historyIndex = 0;
        });
      } catch (error) {
        console.error('Failed to load layout:', error);
        get().resetLayout();
      }
    },

    resetLayout: () => {
      get().initializeLayout(DEFAULT_LAYOUT);
    },

    // Utilities
    findNode: (nodeId, node) => {
      return findNodeRecursive(nodeId, node || get().root);
    },

    findParentSplit: (nodeId, node) => {
      return findParentSplitRecursive(nodeId, node || get().root);
    },

    generatePaneId: () => {
      return `pane-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    generateTabId: () => {
      return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    calculateDropZone: (paneId, position) => {
      // This would calculate which drop zone based on position relative to pane
      // For now, return a simple zone based on quadrants
      const element = document.getElementById(paneId);
      if (!element) return null;
      
      const rect = element.getBoundingClientRect();
      const x = position.x - rect.left;
      const y = position.y - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Check if in header area (top 40px)
      if (y < 40) return 'header';
      
      // Check distance from center
      const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const minRadius = 50; // 50px minimum drag radius
      
      if (distFromCenter < minRadius) return 'center';
      
      // Calculate angle to determine zone
      const angle = Math.atan2(y - centerY, x - centerX);
      const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
      
      // Use conical sections for ergonomic zones
      if (normalizedAngle < Math.PI / 4 || normalizedAngle > 7 * Math.PI / 4) {
        return 'right';
      } else if (normalizedAngle < 3 * Math.PI / 4) {
        return 'bottom';
      } else if (normalizedAngle < 5 * Math.PI / 4) {
        return 'left';
      } else {
        return 'top';
      }
    },
    
    // Layout Dimensions Actions (Fortune 500-grade: re-normalize on measurement)
    setCenterStackHeight: (height) => {
      set((state) => {
        const previousHeight = state.centerStackHeight;
        state.centerStackHeight = height;
        
        // CRITICAL: Re-normalize layout with actual measured height
        // This ensures 216px minimum is enforced with REAL container height, not heuristic
        if (state.root && height !== previousHeight) {
          normalizeLayout(state.root, height);
        }
      });
      
      // Persist the updated layout to localStorage
      get().saveLayout();
    },
  }))
);

export default useSplitsStore;
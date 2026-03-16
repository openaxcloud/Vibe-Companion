import React, { useState, useCallback, useRef, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import {
  X, Columns, Rows, Maximize2, Minimize2, Move, ExternalLink,
  MoreVertical, GripHorizontal,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface PaneNode {
  id: string;
  type: "leaf" | "split";
  direction?: "horizontal" | "vertical";
  children?: PaneNode[];
  sizes?: number[];
  tabs?: string[];
  activeTab?: string | null;
}

export interface FloatingPane {
  id: string;
  tabs: string[];
  activeTab: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface PaneLayoutState {
  root: PaneNode;
  floatingPanes: FloatingPane[];
  maximizedPaneId: string | null;
  activePaneId: string;
}

const MAX_PANE_COUNT = 4;

let paneIdCounter = 0;
export function generatePaneId(): string {
  return `pane-${Date.now()}-${++paneIdCounter}`;
}

export function createDefaultLayout(tabs: string[], activeTab: string | null): PaneLayoutState {
  const id = generatePaneId();
  return {
    root: { id, type: "leaf", tabs: [...tabs], activeTab },
    floatingPanes: [],
    maximizedPaneId: null,
    activePaneId: id,
  };
}

function findPaneById(node: PaneNode, id: string): PaneNode | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findPaneById(child, id);
      if (found) return found;
    }
  }
  return null;
}

function findParent(node: PaneNode, id: string): { parent: PaneNode; index: number } | null {
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      if (node.children[i].id === id) return { parent: node, index: i };
      const found = findParent(node.children[i], id);
      if (found) return found;
    }
  }
  return null;
}

export function getAllLayoutTabs(node: PaneNode, result: string[] = []): string[] {
  if (node.type === "leaf") {
    (node.tabs || []).forEach(t => result.push(t));
  } else if (node.children) {
    node.children.forEach(c => getAllLayoutTabs(c, result));
  }
  return result;
}

export function getAllLeafPanes(node: PaneNode): PaneNode[] {
  if (node.type === "leaf") return [node];
  return (node.children || []).flatMap(getAllLeafPanes);
}

function cloneNode(node: PaneNode): PaneNode {
  return JSON.parse(JSON.stringify(node));
}

function cleanupTree(node: PaneNode): PaneNode {
  if (node.type === "leaf") return node;
  let children = (node.children || []).map(cleanupTree);
  children = children.filter(c => {
    if (c.type === "leaf") return true;
    return (c.children || []).length > 0;
  });
  if (children.length === 0) {
    return { id: node.id, type: "leaf", tabs: [], activeTab: null };
  }
  if (children.length === 1) {
    return children[0];
  }
  const sizes = node.sizes || children.map(() => 100 / children.length);
  const adjustedSizes = children.map((_, i) => sizes[i] || 100 / children.length);
  const total = adjustedSizes.reduce((a, b) => a + b, 0);
  return { ...node, children, sizes: adjustedSizes.map(s => (s / total) * 100) };
}

export function usePaneLayout(initialTabs: string[], initialActiveTab: string | null) {
  const [layout, setLayout] = useState<PaneLayoutState>(() =>
    createDefaultLayout(initialTabs, initialActiveTab)
  );
  const nextZIndex = useRef(100);

  const syncTabsToLayout = useCallback((openTabs: string[], activeFileId: string | null) => {
    setLayout(prev => {
      const allLayoutTabs = new Set<string>();
      getAllLeafPanes(prev.root).forEach(l => (l.tabs || []).forEach(t => allLayoutTabs.add(t)));
      prev.floatingPanes.forEach(fp => fp.tabs.forEach(t => allLayoutTabs.add(t)));

      const newTabs = openTabs.filter(t => !allLayoutTabs.has(t));
      const removedTabs = Array.from(allLayoutTabs).filter(t => !openTabs.includes(t));

      if (newTabs.length === 0 && removedTabs.length === 0) {
        const activePane = findPaneById(prev.root, prev.activePaneId);
        if (activePane && activeFileId && activePane.activeTab !== activeFileId) {
          if (activePane.tabs?.includes(activeFileId)) {
            const root = cloneNode(prev.root);
            const clonedPane = findPaneById(root, prev.activePaneId);
            if (clonedPane) clonedPane.activeTab = activeFileId;
            return { ...prev, root };
          }
        }
        return prev;
      }

      const root = cloneNode(prev.root);
      const leaves = getAllLeafPanes(root);

      for (const leaf of leaves) {
        leaf.tabs = (leaf.tabs || []).filter(t => !removedTabs.includes(t));
        if (leaf.activeTab && removedTabs.includes(leaf.activeTab)) {
          leaf.activeTab = leaf.tabs.length > 0 ? leaf.tabs[0] : null;
        }
      }
      const updatedFloating = prev.floatingPanes.map(fp => {
        const filtered = fp.tabs.filter(t => !removedTabs.includes(t));
        return { ...fp, tabs: filtered, activeTab: filtered.includes(fp.activeTab!) ? fp.activeTab : filtered[0] || null };
      }).filter(fp => fp.tabs.length > 0);

      if (newTabs.length > 0) {
        const activePane = findPaneById(root, prev.activePaneId);
        const targetLeaf = activePane?.type === "leaf" ? activePane : leaves[0];
        if (targetLeaf) {
          targetLeaf.tabs = [...(targetLeaf.tabs || []), ...newTabs];
          if (activeFileId && newTabs.includes(activeFileId)) {
            targetLeaf.activeTab = activeFileId;
          }
        }
      }

      if (activeFileId) {
        for (const leaf of getAllLeafPanes(root)) {
          if (leaf.tabs?.includes(activeFileId)) {
            leaf.activeTab = activeFileId;
            break;
          }
        }
      }

      const cleaned = cleanupTree(root);
      return { ...prev, root: cleaned, floatingPanes: updatedFloating };
    });
  }, []);

  const splitPane = useCallback((paneId: string, direction: "horizontal" | "vertical", tabId?: string) => {
    setLayout(prev => {
      const root = cloneNode(prev.root);
      const currentLeaves = getAllLeafPanes(root);
      if (currentLeaves.length >= MAX_PANE_COUNT) return prev;
      const pane = findPaneById(root, paneId);
      if (!pane || pane.type !== "leaf") return prev;

      const newPaneId = generatePaneId();
      const tabForNew = tabId || pane.activeTab;
      const newPaneTabs = tabForNew ? [tabForNew] : [];

      const originalTabs = tabId ? (pane.tabs || []).filter(t => t !== tabId) : [...(pane.tabs || [])];
      const originalActiveTab = tabId && pane.activeTab === tabId
        ? (originalTabs[0] || null)
        : pane.activeTab;

      const existingLeaf: PaneNode = {
        id: generatePaneId(),
        type: "leaf",
        tabs: originalTabs,
        activeTab: originalActiveTab,
      };
      const newLeaf: PaneNode = {
        id: newPaneId,
        type: "leaf",
        tabs: newPaneTabs,
        activeTab: newPaneTabs[0] || null,
      };

      pane.type = "split";
      pane.direction = direction;
      pane.children = [existingLeaf, newLeaf];
      pane.sizes = [50, 50];
      pane.tabs = undefined;
      pane.activeTab = undefined;

      const cleaned = cleanupTree(root);
      return { ...prev, root: cleaned, activePaneId: newPaneId };
    });
  }, []);

  const closePane = useCallback((paneId: string) => {
    setLayout(prev => {
      const root = cloneNode(prev.root);
      const leaves = getAllLeafPanes(root);
      if (leaves.length <= 1) return prev;

      const parentInfo = findParent(root, paneId);
      if (!parentInfo) return prev;

      parentInfo.parent.children!.splice(parentInfo.index, 1);
      if (parentInfo.parent.sizes) {
        parentInfo.parent.sizes.splice(parentInfo.index, 1);
        const total = parentInfo.parent.sizes.reduce((a, b) => a + b, 0);
        parentInfo.parent.sizes = parentInfo.parent.sizes.map(s => (s / total) * 100);
      }

      const cleaned = cleanupTree(root);
      const newLeaves = getAllLeafPanes(cleaned);
      const newActiveId = newLeaves[0]?.id || prev.activePaneId;
      return {
        ...prev,
        root: cleaned,
        activePaneId: newActiveId,
        maximizedPaneId: prev.maximizedPaneId === paneId ? null : prev.maximizedPaneId,
      };
    });
  }, []);

  const maximizePane = useCallback((paneId: string | null) => {
    setLayout(prev => ({
      ...prev,
      maximizedPaneId: prev.maximizedPaneId === paneId ? null : paneId,
    }));
  }, []);

  const toggleFloating = useCallback((paneId: string) => {
    setLayout(prev => {
      const root = cloneNode(prev.root);
      const pane = findPaneById(root, paneId);
      if (!pane || pane.type !== "leaf") return prev;

      const floatingPane: FloatingPane = {
        id: generatePaneId(),
        tabs: [...(pane.tabs || [])],
        activeTab: pane.activeTab || null,
        x: 100 + prev.floatingPanes.length * 30,
        y: 100 + prev.floatingPanes.length * 30,
        width: 500,
        height: 400,
        zIndex: ++nextZIndex.current,
      };

      pane.tabs = [];
      pane.activeTab = null;

      const cleaned = cleanupTree(root);
      const newLeaves = getAllLeafPanes(cleaned);
      return {
        ...prev,
        root: cleaned,
        floatingPanes: [...prev.floatingPanes, floatingPane],
        activePaneId: newLeaves[0]?.id || prev.activePaneId,
      };
    });
  }, []);

  const dockFloatingPane = useCallback((floatingId: string) => {
    setLayout(prev => {
      const fp = prev.floatingPanes.find(f => f.id === floatingId);
      if (!fp) return prev;

      const root = cloneNode(prev.root);
      const leaves = getAllLeafPanes(root);
      const target = leaves[0];
      if (target) {
        target.tabs = [...(target.tabs || []), ...fp.tabs];
        if (!target.activeTab) target.activeTab = fp.activeTab;
      }

      return {
        ...prev,
        root,
        floatingPanes: prev.floatingPanes.filter(f => f.id !== floatingId),
      };
    });
  }, []);

  const moveTabToPane = useCallback((tabId: string, fromPaneId: string, toPaneId: string) => {
    setLayout(prev => {
      const root = cloneNode(prev.root);
      const fromPane = findPaneById(root, fromPaneId);
      const toPane = findPaneById(root, toPaneId);
      if (!fromPane || !toPane || fromPane.type !== "leaf" || toPane.type !== "leaf") return prev;

      fromPane.tabs = (fromPane.tabs || []).filter(t => t !== tabId);
      if (fromPane.activeTab === tabId) {
        fromPane.activeTab = fromPane.tabs[0] || null;
      }

      toPane.tabs = [...(toPane.tabs || []), tabId];
      toPane.activeTab = tabId;

      const cleaned = cleanupTree(root);
      return { ...prev, root: cleaned, activePaneId: toPaneId };
    });
  }, []);

  const setActivePaneId = useCallback((paneId: string) => {
    setLayout(prev => ({ ...prev, activePaneId: paneId }));
  }, []);

  const setActiveTabInPane = useCallback((paneId: string, tabId: string) => {
    setLayout(prev => {
      const root = cloneNode(prev.root);
      const pane = findPaneById(root, paneId);
      if (pane && pane.type === "leaf") {
        pane.activeTab = tabId;
      }
      return { ...prev, root, activePaneId: paneId };
    });
  }, []);

  const updateFloatingPosition = useCallback((id: string, x: number, y: number) => {
    setLayout(prev => ({
      ...prev,
      floatingPanes: prev.floatingPanes.map(fp =>
        fp.id === id ? { ...fp, x, y, zIndex: ++nextZIndex.current } : fp
      ),
    }));
  }, []);

  const updateFloatingSize = useCallback((id: string, width: number, height: number) => {
    setLayout(prev => ({
      ...prev,
      floatingPanes: prev.floatingPanes.map(fp =>
        fp.id === id ? { ...fp, width, height } : fp
      ),
    }));
  }, []);

  const bringFloatingToFront = useCallback((id: string) => {
    setLayout(prev => ({
      ...prev,
      floatingPanes: prev.floatingPanes.map(fp =>
        fp.id === id ? { ...fp, zIndex: ++nextZIndex.current } : fp
      ),
    }));
  }, []);

  const updateSplitSizes = useCallback((splitId: string, sizes: number[]) => {
    setLayout(prev => {
      const root = cloneNode(prev.root);
      const node = findPaneById(root, splitId);
      if (node && node.type === "split") {
        node.sizes = sizes;
      }
      return { ...prev, root };
    });
  }, []);

  const closeTabInPane = useCallback((paneId: string, tabId: string) => {
    setLayout(prev => {
      const root = cloneNode(prev.root);
      const pane = findPaneById(root, paneId);
      if (!pane || pane.type !== "leaf") return prev;
      pane.tabs = (pane.tabs || []).filter(t => t !== tabId);
      if (pane.activeTab === tabId) {
        pane.activeTab = pane.tabs[0] || null;
      }
      const cleaned = cleanupTree(root);
      return { ...prev, root: cleaned };
    });
  }, []);

  const closeOtherTabsInPane = useCallback((paneId: string, keepTabId: string) => {
    setLayout(prev => {
      const root = cloneNode(prev.root);
      const pane = findPaneById(root, paneId);
      if (!pane || pane.type !== "leaf") return prev;
      pane.tabs = (pane.tabs || []).filter(t => t === keepTabId);
      pane.activeTab = keepTabId;
      return { ...prev, root };
    });
  }, []);

  return {
    layout,
    setLayout,
    splitPane,
    closePane,
    maximizePane,
    toggleFloating,
    dockFloatingPane,
    moveTabToPane,
    setActivePaneId,
    setActiveTabInPane,
    updateFloatingPosition,
    updateFloatingSize,
    bringFloatingToFront,
    updateSplitSizes,
    syncTabsToLayout,
    closeTabInPane,
    closeOtherTabsInPane,
  };
}

interface PaneOptionsMenuProps {
  paneId: string;
  activeTab: string | null;
  tabs: string[];
  otherPaneIds: string[];
  isMaximized: boolean;
  isMultiPane: boolean;
  onSplitRight: () => void;
  onSplitDown: () => void;
  onMaximize: () => void;
  onToggleFloat: () => void;
  onMoveTab: (toPaneId: string) => void;
  onCloseTab: () => void;
  onCloseOtherTabs: () => void;
  onClosePane: () => void;
  onOpenNewWindow: () => void;
}

export function PaneOptionsMenu({
  paneId,
  activeTab,
  tabs,
  otherPaneIds,
  isMaximized,
  isMultiPane,
  onSplitRight,
  onSplitDown,
  onMaximize,
  onToggleFloat,
  onMoveTab,
  onCloseTab,
  onCloseOtherTabs,
  onClosePane,
  onOpenNewWindow,
}: PaneOptionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors shrink-0"
          data-testid={`button-pane-options-${paneId}`}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-52 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-2xl"
        align="end"
      >
        <DropdownMenuItem
          className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
          onClick={onSplitRight}
          data-testid={`menu-split-right-${paneId}`}
        >
          <Columns className="w-3.5 h-3.5" /> Split Right
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
          onClick={onSplitDown}
          data-testid={`menu-split-down-${paneId}`}
        >
          <Rows className="w-3.5 h-3.5" /> Split Down
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[var(--ide-border)]" />
        <DropdownMenuItem
          className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
          onClick={onMaximize}
          data-testid={`menu-maximize-${paneId}`}
        >
          {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {isMaximized ? "Restore Pane" : "Maximize Pane"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
          onClick={onToggleFloat}
          data-testid={`menu-toggle-float-${paneId}`}
        >
          <Move className="w-3.5 h-3.5" /> Float Pane
        </DropdownMenuItem>
        {otherPaneIds.length > 0 && activeTab && (
          <>
            <DropdownMenuSeparator className="bg-[var(--ide-border)]" />
            {otherPaneIds.map((otherId, idx) => (
              <DropdownMenuItem
                key={otherId}
                className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
                onClick={() => onMoveTab(otherId)}
                data-testid={`menu-move-tab-${paneId}-to-${otherId}`}
              >
                <GripHorizontal className="w-3.5 h-3.5" /> Move Tab to Pane {idx + 1}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator className="bg-[var(--ide-border)]" />
        {activeTab && (
          <DropdownMenuItem
            className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
            onClick={onCloseTab}
            data-testid={`menu-close-tab-${paneId}`}
          >
            <X className="w-3.5 h-3.5" /> Close Tab
          </DropdownMenuItem>
        )}
        {tabs.length > 1 && (
          <DropdownMenuItem
            className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
            onClick={onCloseOtherTabs}
            data-testid={`menu-close-other-tabs-${paneId}`}
          >
            Close Other Tabs
          </DropdownMenuItem>
        )}
        {isMultiPane && (
          <DropdownMenuItem
            className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
            onClick={onClosePane}
            data-testid={`menu-close-pane-${paneId}`}
          >
            Close Pane
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-[var(--ide-border)]" />
        <DropdownMenuItem
          className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
          onClick={onOpenNewWindow}
          data-testid={`menu-open-new-window-${paneId}`}
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open in New Window
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ResizeHandleProps {
  direction: "horizontal" | "vertical";
  splitId: string;
  index: number;
  sizes: number[];
  onResize: (splitId: string, newSizes: number[]) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function ResizeHandle({ direction, splitId, index, sizes, onResize }: ResizeHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startPos = direction === "horizontal" ? e.clientX : e.clientY;
    const startSizes = [...sizes];
    const container = handleRef.current?.parentElement;
    if (!container) return;

    const totalDim = direction === "horizontal" ? container.clientWidth : container.clientHeight;

    const onMove = (ev: MouseEvent) => {
      const currentPos = direction === "horizontal" ? ev.clientX : ev.clientY;
      const delta = currentPos - startPos;
      const deltaPct = (delta / totalDim) * 100;

      const newSizes = [...startSizes];
      const leftIdx = index;
      const rightIdx = index + 1;
      newSizes[leftIdx] = Math.max(10, startSizes[leftIdx] + deltaPct);
      newSizes[rightIdx] = Math.max(10, startSizes[rightIdx] - deltaPct);

      const total = newSizes.reduce((a, b) => a + b, 0);
      const normalized = newSizes.map(s => (s / total) * 100);
      onResize(splitId, normalized);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [direction, splitId, index, sizes, onResize]);

  return (
    <div
      ref={handleRef}
      className={`${direction === "horizontal" ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"} flex items-center justify-center shrink-0 hover:bg-[#0079F2]/30 transition-colors bg-[var(--ide-surface)]/50`}
      onMouseDown={handleMouseDown}
      data-testid={`resize-handle-${splitId}-${index}`}
    >
      <div className={direction === "horizontal" ? "w-[2px] h-8 rounded-full bg-[var(--ide-surface)]" : "h-[2px] w-8 rounded-full bg-[var(--ide-surface)]"} />
    </div>
  );
}

interface FloatingPaneWrapperProps {
  pane: FloatingPane;
  onPositionChange: (id: string, x: number, y: number) => void;
  onBringToFront: (id: string) => void;
  onDock: (id: string) => void;
  onClose: (paneId: string, tabId: string) => void;
  children: React.ReactNode;
}

export function FloatingPaneWrapper({
  pane,
  onPositionChange,
  onBringToFront,
  onDock,
  onClose,
  children,
}: FloatingPaneWrapperProps) {
  const dragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onBringToFront(pane.id);
    dragStartRef.current = { x: e.clientX, y: e.clientY, px: pane.x, py: pane.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      onPositionChange(pane.id, dragStartRef.current.px + dx, dragStartRef.current.py + dy);
    };

    const onUp = () => {
      dragStartRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [pane.id, pane.x, pane.y, onPositionChange, onBringToFront]);

  return (
    <div
      className="absolute rounded-lg border border-[var(--ide-border)] bg-[var(--ide-panel)] shadow-2xl overflow-hidden flex flex-col"
      style={{
        left: pane.x,
        top: pane.y,
        width: pane.width,
        height: pane.height,
        zIndex: pane.zIndex,
      }}
      onClick={() => onBringToFront(pane.id)}
      data-testid={`floating-pane-${pane.id}`}
    >
      <div
        className="flex items-center h-7 px-2 bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <GripHorizontal className="w-3 h-3 text-[var(--ide-text-muted)] mr-1.5 shrink-0" />
        <span className="text-[10px] text-[var(--ide-text-secondary)] truncate flex-1">
          Floating Pane
        </span>
        <button
          className="p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors shrink-0 mr-1"
          onClick={(e) => { e.stopPropagation(); onDock(pane.id); }}
          title="Dock pane"
          data-testid={`button-dock-floating-${pane.id}`}
        >
          <Minimize2 className="w-3 h-3" />
        </button>
        <button
          className="p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-red-400 transition-colors shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            if (pane.activeTab) onClose(pane.id, pane.activeTab);
          }}
          data-testid={`button-close-floating-${pane.id}`}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

const BROADCAST_CHANNEL_NAME = "replit-workspace-sync";

export type PaneBroadcastMessage =
  | { type: "tab-opened"; tabId: string }
  | { type: "tab-closed"; tabId: string }
  | { type: "layout-sync"; layout: PaneLayoutState };

export function useWorkspaceBroadcast(projectId: string | undefined) {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!projectId) return;
    try {
      channelRef.current = new BroadcastChannel(`${BROADCAST_CHANNEL_NAME}-${projectId}`);
    } catch (err) {
      console.warn("[pane-broadcast] Failed to create BroadcastChannel:", err);
    }
    return () => {
      channelRef.current?.close();
    };
  }, [projectId]);

  const broadcast = useCallback((data: PaneBroadcastMessage) => {
    try {
      channelRef.current?.postMessage(data);
    } catch (err) {
      console.warn("[pane-broadcast] Failed to send message:", err);
    }
  }, []);

  const onMessage = useCallback((handler: (data: PaneBroadcastMessage) => void) => {
    if (!channelRef.current) return () => {};
    const listener = (e: MessageEvent) => handler(e.data as PaneBroadcastMessage);
    channelRef.current.addEventListener("message", listener);
    return () => channelRef.current?.removeEventListener("message", listener);
  }, []);

  const openInNewWindow = useCallback(() => {
    if (!projectId) return;
    const url = `${window.location.origin}/project/${projectId}`;
    window.open(url, `workspace-${projectId}-${Date.now()}`, "width=1200,height=800,menubar=no,toolbar=no");
  }, [projectId]);

  return { broadcast, onMessage, openInNewWindow };
}

export function savePaneLayout(projectId: string, layout: PaneLayoutState) {
  try {
    localStorage.setItem(`pane-layout-${projectId}`, JSON.stringify(layout));
  } catch (err) {
    console.warn("[pane-layout] Failed to save to localStorage:", err);
  }
}

export function loadPaneLayout(projectId: string): PaneLayoutState | null {
  try {
    const stored = localStorage.getItem(`pane-layout-${projectId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.root) return parsed;
    }
  } catch (err) {
    console.warn("[pane-layout] Failed to load from localStorage:", err);
  }
  return null;
}

export async function savePaneLayoutToServer(projectId: string, layout: PaneLayoutState): Promise<void> {
  try {
    await apiRequest("PUT", `/api/user/pane-layout/${projectId}`, layout);
  } catch (err) {
    console.warn("[pane-layout] Failed to save layout to server:", err);
  }
}

export async function loadPaneLayoutFromServer(projectId: string): Promise<PaneLayoutState | null> {
  try {
    const res = await fetch(`/api/user/pane-layout/${projectId}`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.root) return data as PaneLayoutState;
  } catch {
  }
  return null;
}

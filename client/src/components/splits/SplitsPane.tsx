// @ts-nocheck
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useDraggable, useDroppable, DndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { useSpring, useNativeMotionValue as useMotionValue } from '@/lib/native-motion';
import { cn } from '@/lib/utils';
import { PaneGroup, TabInfo, DragItem, DropZone } from '@/types/splits';
import useSplitsStore from '@/stores/splits-store';
import { X, Maximize2, Minimize2, MoreVertical, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface SplitsPaneProps {
  paneGroup: PaneGroup;
  isMaximized?: boolean;
  className?: string;
  onTabClose?: (tabId: string) => void;
  onTabSelect?: (tabId: string) => void;
}

export function SplitsPane({ 
  paneGroup, 
  isMaximized = false,
  className,
  onTabClose,
  onTabSelect 
}: SplitsPaneProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [isDraggingTab, setIsDraggingTab] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const [showDropPreview, setShowDropPreview] = useState(false);
  
  const {
    activePane,
    setActivePane,
    addTab,
    closeTab,
    moveTab,
    splitPane,
    floatPane,
    maximizePane,
    restorePane,
    startDrag,
    updateDrag,
    endDrag,
    calculateDropZone,
  } = useSplitsStore();

  const isActive = activePane === paneGroup.id;

  // Handle pane focus
  const handlePaneClick = useCallback(() => {
    setActivePane(paneGroup.id);
  }, [paneGroup.id, setActivePane]);

  // Handle tab selection
  const handleTabSelect = useCallback((tabId: string, index: number) => {
    paneGroup.activeTabIndex = index;
    onTabSelect?.(tabId);
    setActivePane(paneGroup.id);
  }, [paneGroup, onTabSelect, setActivePane]);

  // Handle tab close
  const handleTabClose = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId, paneGroup.id);
    onTabClose?.(tabId);
  }, [closeTab, paneGroup.id, onTabClose]);

  // Handle tab drag start
  const handleTabDragStart = useCallback((tabId: string, e: React.DragEvent) => {
    setIsDraggingTab(true);
    setDraggedTabId(tabId);
    
    const tab = paneGroup.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const dragItem: DragItem = {
      type: 'tab',
      source: 'layout',
      id: tabId,
      paneId: paneGroup.id,
      tabInfo: tab,
    };
    
    startDrag(dragItem, { x: e.clientX, y: e.clientY });
    
    // Set drag image
    const dragImage = new Image();
    dragImage.src = 'data:image/svg+xml,%3Csvg width="1" height="1" xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
    e.dataTransfer.setDragImage(dragImage, 0, 0);
  }, [paneGroup, startDrag]);

  // Handle tab drag end
  const handleTabDragEnd = useCallback(() => {
    setIsDraggingTab(false);
    setDraggedTabId(null);
    setDropZone(null);
    setShowDropPreview(false);
    endDrag();
  }, [endDrag]);

  // Handle drag over for drop zones
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    const zone = calculateDropZone(paneGroup.id, { x: e.clientX, y: e.clientY });
    
    if (zone !== dropZone) {
      setDropZone(zone);
      setShowDropPreview(zone !== null);
    }
    
    updateDrag(
      { x: e.clientX, y: e.clientY },
      zone ? { targetId: paneGroup.id, zone, isActive: true } : null
    );
  }, [paneGroup.id, dropZone, calculateDropZone, updateDrag]);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDropZone(null);
    setShowDropPreview(false);
    updateDrag({ x: 0, y: 0 }, null);
  }, [updateDrag]);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropZone(null);
    setShowDropPreview(false);
    endDrag();
  }, [endDrag]);

  // Context menu actions
  const handleSplitHorizontal = () => splitPane(paneGroup.id, 'horizontal');
  const handleSplitVertical = () => splitPane(paneGroup.id, 'vertical');
  const handleFloat = () => floatPane(paneGroup.id);
  const handleMaximize = () => maximizePane(paneGroup.id);
  const handleRestore = () => restorePane();

  return (
    <ContextMenuTrigger>
      <LazyMotionDiv
        ref={paneRef}
        className={cn(
          "flex flex-col h-full bg-[var(--ecode-surface)] border border-[var(--ecode-border)] rounded-md overflow-hidden",
          isActive && "ring-2 ring-blue-500 ring-opacity-50",
          isDraggingTab && "opacity-80",
          className
        )}
        onClick={handlePaneClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        layout
        layoutId={paneGroup.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          type: "spring",
          damping: 20,
          stiffness: 300,
        }}
      >
        {/* Tab Bar */}
        <div className="flex items-center h-9 bg-[var(--ecode-background)] border-b border-[var(--ecode-border)]">
          <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
            {paneGroup.tabs.map((tab, index) => (
              <LazyMotionDiv
                key={tab.id}
                className={cn(
                  "group flex items-center gap-1 px-3 h-9 cursor-pointer border-r border-[var(--ecode-border)] hover:bg-[var(--ecode-hover)]",
                  paneGroup.activeTabIndex === index && "bg-[var(--ecode-surface)]",
                  draggedTabId === tab.id && "opacity-50"
                )}
                onClick={() => handleTabSelect(tab.id, index)}
                draggable
                onDragStart={(e) => handleTabDragStart(tab.id, e)}
                onDragEnd={handleTabDragEnd}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {tab.icon && <span className="text-[11px]">{tab.icon}</span>}
                <span className="text-[11px] truncate max-w-[120px]">{tab.title}</span>
                {tab.isDirty && <span className="text-[11px] text-yellow-500">●</span>}
                {tab.canClose !== false && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => handleTabClose(e, tab.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </LazyMotionDiv>
            ))}
          </div>
          
          {/* Pane Controls */}
          <div className="flex items-center gap-1 px-2">
            {isMaximized ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={handleRestore}
                title="Restore"
                data-testid={`button-restore-${paneGroup.id}`}
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={handleMaximize}
                title="Maximize"
                data-testid={`button-maximize-${paneGroup.id}`}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleSplitHorizontal}>
                  Split Horizontal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSplitVertical}>
                  Split Vertical
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleFloat}>
                  Float Pane
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMaximize}>
                  Maximize
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {paneGroup.tabs.length > 0 && paneGroup.tabs[paneGroup.activeTabIndex] ? (
            <div className="w-full h-full">
              {paneGroup.tabs[paneGroup.activeTabIndex].content}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-[13px] mb-2">No tabs open</p>
                <p className="text-[11px]">Drag a file here or use the file tree</p>
              </div>
            </div>
          )}

          {/* Drop Zone Indicators */}
          <LazyAnimatePresence>
            {showDropPreview && dropZone && (
              <LazyMotionDiv
                className={cn(
                  "absolute pointer-events-none bg-blue-500 bg-opacity-20 border-2 border-blue-500 border-dashed rounded",
                  dropZone === 'center' && "inset-4",
                  dropZone === 'top' && "inset-x-0 top-0 h-1/2",
                  dropZone === 'bottom' && "inset-x-0 bottom-0 h-1/2",
                  dropZone === 'left' && "inset-y-0 left-0 w-1/2",
                  dropZone === 'right' && "inset-y-0 right-0 w-1/2",
                  dropZone === 'header' && "inset-x-0 top-0 h-9"
                )}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
              />
            )}
          </LazyAnimatePresence>
        </div>
      </LazyMotionDiv>

      {/* Context Menu */}
      <ContextMenuContent>
        <ContextMenuItem onClick={handleSplitHorizontal}>
          Split Horizontal
        </ContextMenuItem>
        <ContextMenuItem onClick={handleSplitVertical}>
          Split Vertical
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleFloat}>
          Float Pane
        </ContextMenuItem>
        <ContextMenuItem onClick={handleMaximize}>
          Maximize
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => closeTab(paneGroup.tabs[paneGroup.activeTabIndex]?.id, paneGroup.id)}>
          Close Current Tab
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuTrigger>
  );
}
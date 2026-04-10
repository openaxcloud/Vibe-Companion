import React, { useEffect, useCallback, useState } from 'react';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useSplitsStore from '@/stores/splits-store';
import { LayoutNode, Split, PaneGroup, isSplit, isPaneGroup } from '@/types/splits';
import { SplitsPane } from './SplitsPane';
import { SplitsResizeHandle } from './SplitsResizeHandle';
import { FloatingPane } from './FloatingPane';
import { DragOverlayContent } from './DragOverlayContent';

interface SplitsLayoutProps {
  className?: string;
  onLayoutChange?: (layout: LayoutNode) => void;
  defaultLayout?: LayoutNode;
}

export function SplitsLayout({ className, onLayoutChange, defaultLayout }: SplitsLayoutProps) {
  const {
    root,
    floatingPanes,
    maximizedPane,
    dragState,
    initializeLayout,
    loadLayout,
    saveLayout,
    startDrag,
    updateDrag,
    endDrag,
  } = useSplitsStore();

  const [isDragging, setIsDragging] = useState(false);

  // Initialize layout on mount
  useEffect(() => {
    if (defaultLayout) {
      initializeLayout(defaultLayout);
    } else {
      // Try to load from localStorage
      loadLayout();
    }
  }, [defaultLayout, initializeLayout, loadLayout]);

  // Save layout periodically and on changes
  useEffect(() => {
    const saveTimer = setInterval(() => {
      saveLayout();
    }, 5000); // Save every 5 seconds

    return () => clearInterval(saveTimer);
  }, [saveLayout]);

  // Notify parent of layout changes
  useEffect(() => {
    if (root && onLayoutChange) {
      onLayoutChange(root);
    }
  }, [root, onLayoutChange]);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    })
  );

  // Handle drag start
  const handleDragStart = useCallback((event: any) => {
    setIsDragging(true);
    const { active } = event;
    
    if (active) {
      startDrag(
        active.data.current,
        { x: event.activatorEvent.clientX, y: event.activatorEvent.clientY }
      );
    }
  }, [startDrag]);

  // Handle drag move
  const handleDragMove = useCallback((event: any) => {
    const { active, over } = event;
    
    if (active && over) {
      updateDrag(
        { x: event.activatorEvent.clientX, y: event.activatorEvent.clientY },
        over ? { targetId: over.id, zone: over.data.current?.zone, isActive: true } : null
      );
    }
  }, [updateDrag]);

  // Handle drag end
  const handleDragEnd = useCallback((event: any) => {
    setIsDragging(false);
    endDrag();
  }, [endDrag]);

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    endDrag();
  }, [endDrag]);

  // Render a layout node recursively
  const renderNode = useCallback((node: LayoutNode, parentDirection?: 'horizontal' | 'vertical'): React.ReactNode => {
    if (!node) return null;

    // Check if this pane is maximized
    if (maximizedPane && node.id !== maximizedPane) {
      return null;
    }

    if (isSplit(node)) {
      return (
        <div
          key={node.id}
          className={cn(
            "flex h-full w-full",
            node.direction === 'horizontal' ? "flex-row" : "flex-col"
          )}
        >
          {node.children.map((child, index) => (
            <React.Fragment key={child.id}>
              <LazyMotionDiv
                className={cn(
                  "overflow-hidden",
                  node.direction === 'horizontal' ? "h-full" : "w-full"
                )}
                style={{
                  [node.direction === 'horizontal' ? 'width' : 'height']: `${child.percent}%`,
                }}
                layout
                transition={{
                  type: "spring",
                  damping: 30,
                  stiffness: 300,
                }}
              >
                {renderNode(child, node.direction)}
              </LazyMotionDiv>
              
              {/* Resize handle between children */}
              {index < node.children.length - 1 && (
                <SplitsResizeHandle
                  splitId={node.id}
                  direction={node.direction}
                  index={index}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      );
    }

    if (isPaneGroup(node)) {
      return (
        <SplitsPane
          key={node.id}
          paneGroup={node}
          isMaximized={maximizedPane === node.id}
        />
      );
    }

    return null;
  }, [maximizedPane]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={cn("relative w-full h-full overflow-hidden bg-[var(--ecode-background)]", className)}>
        {/* Main layout */}
        <div className="w-full h-full">
          {root ? renderNode(root) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-[15px] mb-2">No layout configured</p>
                <p className="text-[13px]">Start by opening a file or creating a new pane</p>
              </div>
            </div>
          )}
        </div>

        {/* Floating panes */}
        <LazyAnimatePresence>
          {Array.from(floatingPanes.values()).map((floatingPane) => (
            <FloatingPane
              key={floatingPane.id}
              floatingPane={floatingPane}
            />
          ))}
        </LazyAnimatePresence>

        {/* Drag overlay */}
        <DragOverlay>
          {isDragging && dragState.draggedItem && (
            <DragOverlayContent item={dragState.draggedItem} />
          )}
        </DragOverlay>

        {/* Global drop zone indicator */}
        <LazyAnimatePresence>
          {isDragging && dragState.dropTarget && (
            <LazyMotionDiv
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="relative w-full h-full">
                {/* Visual feedback for drop zones */}
                <svg
                  className="absolute inset-0 w-full h-full"
                  style={{ zIndex: 9999 }}
                >
                  {/* Draw conical sections for drop zones */}
                  <defs>
                    <radialGradient id="dropGradient">
                      <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
                      <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                    </radialGradient>
                  </defs>
                  
                  {dragState.dragPosition && (
                    <circle
                      cx={dragState.dragPosition.x}
                      cy={dragState.dragPosition.y}
                      r="50"
                      fill="url(#dropGradient)"
                      className="animate-pulse"
                    />
                  )}
                </svg>
              </div>
            </LazyMotionDiv>
          )}
        </LazyAnimatePresence>
      </div>
    </DndContext>
  );
}
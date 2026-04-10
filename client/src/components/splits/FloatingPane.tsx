import React, { useCallback, useState, useRef } from 'react';
import { LazyMotionDiv, useDragControls } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { FloatingPane as FloatingPaneType } from '@/types/splits';
import useSplitsStore from '@/stores/splits-store';
import { SplitsPane } from './SplitsPane';
import { X, Maximize2, Minimize2, Minus, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FloatingPaneProps {
  floatingPane: FloatingPaneType;
  className?: string;
}

export function FloatingPane({ floatingPane, className }: FloatingPaneProps) {
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(floatingPane.isMinimized || false);
  const [isMaximized, setIsMaximized] = useState(floatingPane.isMaximized || false);
  
  const {
    unfloatPane,
    updateFloatingPosition,
    bringFloatingToFront,
  } = useSplitsStore();

  const handleDrag = useCallback((event: any, info: any) => {
    updateFloatingPosition(floatingPane.id, {
      x: info.point.x - floatingPane.position.width / 2,
      y: info.point.y - 40, // Account for title bar
    });
  }, [floatingPane, updateFloatingPosition]);

  const handleResize = useCallback((direction: 'se' | 'sw' | 'ne' | 'nw', event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = floatingPane.position.width;
    const startHeight = floatingPane.position.height;
    const startLeft = floatingPane.position.x;
    const startTop = floatingPane.position.y;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startLeft;
      let newY = startTop;

      switch (direction) {
        case 'se':
          newWidth = Math.max(200, startWidth + deltaX);
          newHeight = Math.max(150, startHeight + deltaY);
          break;
        case 'sw':
          newWidth = Math.max(200, startWidth - deltaX);
          newHeight = Math.max(150, startHeight + deltaY);
          newX = startLeft + deltaX;
          break;
        case 'ne':
          newWidth = Math.max(200, startWidth + deltaX);
          newHeight = Math.max(150, startHeight - deltaY);
          newY = startTop + deltaY;
          break;
        case 'nw':
          newWidth = Math.max(200, startWidth - deltaX);
          newHeight = Math.max(150, startHeight - deltaY);
          newX = startLeft + deltaX;
          newY = startTop + deltaY;
          break;
      }

      updateFloatingPosition(floatingPane.id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [floatingPane, updateFloatingPosition]);

  const handleClose = useCallback(() => {
    unfloatPane(floatingPane.id);
  }, [floatingPane.id, unfloatPane]);

  const handleMinimize = useCallback(() => {
    setIsMinimized(!isMinimized);
  }, [isMinimized]);

  const handleMaximize = useCallback(() => {
    if (!isMaximized) {
      // Store current position
      floatingPane.previousPosition = { ...floatingPane.position };
      updateFloatingPosition(floatingPane.id, {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      });
    } else if (floatingPane.previousPosition) {
      // Restore previous position
      updateFloatingPosition(floatingPane.id, floatingPane.previousPosition);
    }
    setIsMaximized(!isMaximized);
  }, [isMaximized, floatingPane, updateFloatingPosition]);

  const handleFocus = useCallback(() => {
    bringFloatingToFront(floatingPane.id);
  }, [floatingPane.id, bringFloatingToFront]);

  return (
    <>
      {/* Constraints container */}
      <div
        ref={constraintsRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: floatingPane.zIndex - 1 }}
      />

      <LazyMotionDiv
        className={cn(
          "fixed shadow-2xl rounded-lg overflow-hidden bg-[var(--ecode-surface)] border border-[var(--ecode-border)]",
          isMinimized && "h-10",
          className
        )}
        style={{
          zIndex: floatingPane.zIndex,
          width: isMaximized ? '100vw' : floatingPane.position.width,
          height: isMaximized ? '100vh' : (isMinimized ? 40 : floatingPane.position.height),
          x: isMaximized ? 0 : floatingPane.position.x,
          y: isMaximized ? 0 : floatingPane.position.y,
        }}
        drag={!isMaximized}
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        dragElastic={0}
        dragMomentum={false}
        onDrag={handleDrag}
        onMouseDown={handleFocus}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{
          type: "spring",
          damping: 20,
          stiffness: 300,
        }}
      >
        {/* Title Bar */}
        <div
          className="h-10 bg-[var(--ecode-background)] border-b border-[var(--ecode-border)] flex items-center justify-between px-3 cursor-move"
          onPointerDown={(e) => !isMaximized && dragControls.start(e)}
        >
          <div className="flex items-center gap-2">
            <Pin className="h-3 w-3 text-gray-500" />
            <span className="text-[13px] font-medium">
              {floatingPane.paneGroup.tabs[floatingPane.paneGroup.activeTabIndex]?.title || 'Floating Pane'}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleMinimize}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleMaximize}
            >
              {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClose}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="flex-1 h-[calc(100%-40px)]">
            <SplitsPane paneGroup={floatingPane.paneGroup} />
          </div>
        )}

        {/* Resize handles */}
        {!isMaximized && !isMinimized && (
          <>
            {/* Corner resize handles */}
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              onMouseDown={(e) => handleResize('se', e)}
            />
            <div
              className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize"
              onMouseDown={(e) => handleResize('sw', e)}
            />
            <div
              className="absolute top-10 right-0 w-4 h-4 cursor-ne-resize"
              onMouseDown={(e) => handleResize('ne', e)}
            />
            <div
              className="absolute top-10 left-0 w-4 h-4 cursor-nw-resize"
              onMouseDown={(e) => handleResize('nw', e)}
            />
          </>
        )}
      </LazyMotionDiv>
    </>
  );
}
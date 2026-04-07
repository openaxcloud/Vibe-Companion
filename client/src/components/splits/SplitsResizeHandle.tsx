import React, { useCallback, useState } from 'react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useSplitsStore from '@/stores/splits-store';

interface SplitsResizeHandleProps {
  splitId: string;
  direction: 'horizontal' | 'vertical';
  index: number;
  className?: string;
}

export function SplitsResizeHandle({ 
  splitId, 
  direction, 
  index,
  className 
}: SplitsResizeHandleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const {
    startResize,
    updateResize,
    endResize,
    findNode,
    toggleMinimize,
  } = useSplitsStore();

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const startPosition = direction === 'horizontal' ? e.clientX : e.clientY;
    startResize(splitId, direction, startPosition);
    
    const handleMouseMove = (e: MouseEvent) => {
      const currentPosition = direction === 'horizontal' ? e.clientX : e.clientY;
      updateResize(currentPosition);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      endResize();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [splitId, direction, startResize, updateResize, endResize]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const touch = e.touches[0];
    const startPosition = direction === 'horizontal' ? touch.clientX : touch.clientY;
    startResize(splitId, direction, startPosition);
    
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const currentPosition = direction === 'horizontal' ? touch.clientX : touch.clientY;
      updateResize(currentPosition);
    };
    
    const handleTouchEnd = () => {
      setIsDragging(false);
      endResize();
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  }, [splitId, direction, startResize, updateResize, endResize]);

  // Replit-style double-click to toggle minimize/restore
  const handleDoubleClick = useCallback(() => {
    // Find the split and check if it contains center-bottom panel
    const split = findNode(splitId);
    if (!split) return;
    
    // Only apply to bottom panel for now
    const bottomChild = (split as any).children?.find((c: any) => c.id === 'center-bottom');
    if (bottomChild) {
      toggleMinimize('center-bottom');
    }
  }, [splitId, findNode, toggleMinimize]);

  return (
    <LazyMotionDiv
      className={cn(
        "relative group",
        direction === 'horizontal' ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
      whileHover={{ scale: direction === 'horizontal' ? [1, 1.5, 1] : [1, 1, 1.5] }}
      transition={{ duration: 0.2 }}
    >
      {/* Visible resize bar */}
      <div
        className={cn(
          "absolute bg-[var(--ecode-border)] transition-all",
          direction === 'horizontal' 
            ? "top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] hover:w-[3px]" 
            : "left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] hover:h-[3px]",
          (isHovered || isDragging) && "bg-blue-500",
          isDragging && (direction === 'horizontal' ? "w-[3px]" : "h-[3px]")
        )}
      />

      {/* Larger hit area for easier grabbing */}
      <div
        className={cn(
          "absolute",
          direction === 'horizontal' 
            ? "top-0 bottom-0 left-1/2 -translate-x-1/2 w-[9px]" 
            : "left-0 right-0 top-1/2 -translate-y-1/2 h-[9px]"
        )}
      />

      {/* Handle indicator dots */}
      <LazyAnimatePresence>
        {(isHovered || isDragging) && (
          <LazyMotionDiv
            className={cn(
              "absolute flex items-center justify-center",
              direction === 'horizontal'
                ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            )}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <div
              className={cn(
                "flex gap-0.5",
                direction === 'horizontal' ? "flex-col" : "flex-row"
              )}
            >
              <div className="w-1 h-1 bg-blue-500 rounded-full" />
              <div className="w-1 h-1 bg-blue-500 rounded-full" />
              <div className="w-1 h-1 bg-blue-500 rounded-full" />
            </div>
          </LazyMotionDiv>
        )}
      </LazyAnimatePresence>
    </LazyMotionDiv>
  );
}
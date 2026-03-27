/**
 * MobileCodeJoystick - Replit-style Joystick Navigation Control
 * Provides drag navigation for mobile code editing:
 * - Drag up/down to scroll through code quickly
 * - Swipe left/right or tap arrows to nudge cursor
 * - Multi-tap selection: tap (token) → tap (line) → tap (expand)
 * 
 * Matches Replit mobile app joystick control exactly
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  MousePointer2, Type, Rows3, Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileCodeJoystickProps {
  onScroll?: (direction: 'up' | 'down', velocity: number) => void;
  onCursorMove?: (direction: 'left' | 'right' | 'up' | 'down') => void;
  onSelect?: (mode: 'token' | 'line' | 'block') => void;
  onToggle?: () => void;
  isVisible?: boolean;
  className?: string;
}

type SelectionMode = 'none' | 'token' | 'line' | 'block';

const SCROLL_INTERVAL = 50;
const MOMENTUM_DECAY = 0.92;
const MIN_VELOCITY = 0.05;

export function MobileCodeJoystick({
  onScroll,
  onCursorMove,
  onSelect,
  onToggle,
  isVisible = true,
  className
}: MobileCodeJoystickProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [tapCount, setTapCount] = useState(0);
  const lastTapTimeRef = useRef(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const momentumRef = useRef<{ velocity: number; direction: 'up' | 'down' } | null>(null);
  const momentumIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sustained scrolling while held
  useEffect(() => {
    if (isDragging && Math.abs(dragOffset.y) > 10) {
      const direction = dragOffset.y < 0 ? 'up' : 'down';
      const velocity = Math.abs(dragOffset.y) / 30;
      
      scrollIntervalRef.current = setInterval(() => {
        onScroll?.(direction, velocity);
      }, SCROLL_INTERVAL);
      
      momentumRef.current = { velocity, direction };
    } else {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    }
    
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [isDragging, dragOffset.y, onScroll]);

  // Momentum decay after release
  useEffect(() => {
    if (!isDragging && momentumRef.current && momentumRef.current.velocity > MIN_VELOCITY) {
      momentumIntervalRef.current = setInterval(() => {
        if (momentumRef.current && momentumRef.current.velocity > MIN_VELOCITY) {
          onScroll?.(momentumRef.current.direction, momentumRef.current.velocity);
          momentumRef.current.velocity *= MOMENTUM_DECAY;
        } else {
          if (momentumIntervalRef.current) {
            clearInterval(momentumIntervalRef.current);
            momentumIntervalRef.current = null;
          }
          momentumRef.current = null;
        }
      }, SCROLL_INTERVAL);
    }
    
    return () => {
      if (momentumIntervalRef.current) {
        clearInterval(momentumIntervalRef.current);
      }
    };
  }, [isDragging, onScroll]);

  // Handle multi-tap selection
  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    if (timeSinceLastTap < 300) {
      const nextTap = tapCount + 1;
      setTapCount(nextTap);
      
      if (nextTap === 1) {
        setSelectionMode('token');
        onSelect?.('token');
      } else if (nextTap === 2) {
        setSelectionMode('line');
        onSelect?.('line');
      } else if (nextTap >= 3) {
        setSelectionMode('block');
        onSelect?.('block');
        setTapCount(0);
      }
    } else {
      setTapCount(1);
      setSelectionMode('token');
      onSelect?.('token');
    }

    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
      setSelectionMode('none');
    }, 500);
  }, [tapCount, onSelect]);

  // Handle touch/drag start
  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    momentumRef.current = null;
    if (momentumIntervalRef.current) {
      clearInterval(momentumIntervalRef.current);
      momentumIntervalRef.current = null;
    }
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  // Handle touch/drag move
  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;

    const touch = 'touches' in e ? e.touches[0] : e;
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const offsetX = Math.max(-30, Math.min(30, touch.clientX - centerX));
    const offsetY = Math.max(-30, Math.min(30, touch.clientY - centerY));
    
    setDragOffset({ x: offsetX, y: offsetY });
  }, [isDragging]);

  // Handle touch/drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  // Arrow button handlers
  const handleArrowPress = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    onCursorMove?.(direction);
  }, [onCursorMove]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      if (momentumIntervalRef.current) clearInterval(momentumIntervalRef.current);
    };
  }, []);

  if (!isVisible) return null;

  const selectionIcons = {
    none: MousePointer2,
    token: Type,
    line: Rows3,
    block: Square
  };
  const SelectionIcon = selectionIcons[selectionMode];

  return (
    <div 
      className={cn(
        "fixed bottom-24 right-4 z-50 flex flex-col items-center gap-2",
        className
      )}
      data-testid="mobile-code-joystick"
    >
      {/* Selection mode indicator */}
      {selectionMode !== 'none' && (
        <div className="bg-surface-tertiary-solid text-primary px-2 py-1 rounded-full text-[10px] font-medium flex items-center gap-1">
          <SelectionIcon className="w-3 h-3" />
          {selectionMode}
        </div>
      )}

      {/* Up arrow */}
      <Button
        variant="ghost"
        size="icon"
        className="w-10 h-10 rounded-full bg-surface-solid border shadow-lg"
        onTouchStart={() => handleArrowPress('up')}
        onClick={() => handleArrowPress('up')}
        data-testid="joystick-up"
      >
        <ChevronUp className="w-5 h-5" />
      </Button>

      {/* Middle row: Left - Joystick - Right */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-full bg-surface-solid border shadow-lg"
          onTouchStart={() => handleArrowPress('left')}
          onClick={() => handleArrowPress('left')}
          data-testid="joystick-left"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Main joystick */}
        <div
          ref={joystickRef}
          className={cn(
            "w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10",
            "border-2 border-primary/30 shadow-xl",
            "flex items-center justify-center cursor-grab active:cursor-grabbing",
            "touch-none select-none",
            isDragging && "border-primary"
          )}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onClick={handleTap}
          data-testid="joystick-center"
        >
          {/* Inner joystick nub */}
          <div
            className={cn(
              "w-8 h-8 rounded-full bg-surface-tertiary-solid shadow-inner",
              "transition-transform duration-75 ease-out",
              isDragging && "bg-primary"
            )}
            style={{
              transform: `translate(${dragOffset.x / 2}px, ${dragOffset.y / 2}px)`
            }}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-full bg-surface-solid border shadow-lg"
          onTouchStart={() => handleArrowPress('right')}
          onClick={() => handleArrowPress('right')}
          data-testid="joystick-right"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Down arrow */}
      <Button
        variant="ghost"
        size="icon"
        className="w-10 h-10 rounded-full bg-surface-solid border shadow-lg"
        onTouchStart={() => handleArrowPress('down')}
        onClick={() => handleArrowPress('down')}
        data-testid="joystick-down"
      >
        <ChevronDown className="w-5 h-5" />
      </Button>

      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="text-[10px] text-muted-foreground"
        data-testid="joystick-toggle"
      >
        Hide
      </Button>
    </div>
  );
}

export default MobileCodeJoystick;

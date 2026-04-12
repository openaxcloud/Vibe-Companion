import React, { useState } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyMotionSpan, LazyAnimatePresence, PanInfo } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface SwipeableCardProps {
  children: React.ReactNode;
  className?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function SwipeableCard({
  children,
  className,
  onSwipeLeft,
  onSwipeRight,
  threshold = 100
}: SwipeableCardProps) {
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.x < -threshold && onSwipeLeft) {
      setExitDirection('left');
      setTimeout(() => {
        onSwipeLeft();
        setExitDirection(null);
      }, 300);
    } else if (info.offset.x > threshold && onSwipeRight) {
      setExitDirection('right');
      setTimeout(() => {
        onSwipeRight();
        setExitDirection(null);
      }, 300);
    }
  };

  const exitVariants = {
    left: { x: -window.innerWidth, opacity: 0, rotate: -20 },
    right: { x: window.innerWidth, opacity: 0, rotate: 20 }
  };

  return (
    <LazyAnimatePresence mode="wait">
      {!exitDirection && (
        <LazyMotionDiv
          className={cn('touch-none', className)}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          onDragEnd={handleDragEnd}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          exit={exitDirection ? exitVariants[exitDirection] : undefined}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          whileDrag={{ scale: 1.05 }}
          style={{ touchAction: 'pan-y' }}
        >
          {children}
        </LazyMotionDiv>
      )}
    </LazyAnimatePresence>
  );
}

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  snapPoints?: number[];
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  className,
  title,
  snapPoints = [0.5, 1]
}: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const [currentSnapPoint, setCurrentSnapPoint] = useState(0);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 50;
    const velocity = info.velocity.y;
    
    if (velocity > 500 || info.offset.y > threshold) {
      onClose();
    } else {
      // Snap to nearest point
      const windowHeight = window.innerHeight;
      const currentY = info.offset.y;
      
      let nearestSnapIndex = 0;
      let minDistance = Infinity;
      
      snapPoints.forEach((point, index) => {
        const snapY = windowHeight * (1 - point);
        const distance = Math.abs(currentY - snapY);
        if (distance < minDistance) {
          minDistance = distance;
          nearestSnapIndex = index;
        }
      });
      
      setCurrentSnapPoint(nearestSnapIndex);
    }
  };

  return (
    <LazyAnimatePresence>
      {isOpen && (
        <>
          <LazyMotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40 lg:hidden"
            onClick={onClose}
          />
          
          <LazyMotionDiv
            className={cn(
              'fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl z-50 lg:hidden',
              className
            )}
            initial={{ y: '100%' }}
            animate={{ 
              y: `${(1 - snapPoints[currentSnapPoint]) * 100}%`
            }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 500 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{ touchAction: 'none' }}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
            </div>
            
            {/* Title */}
            {title && (
              <div className="px-4 pb-2 border-b border-gray-200 dark:border-gray-800">
                <h3 className="font-semibold text-lg">{title}</h3>
              </div>
            )}
            
            {/* Content */}
            <div className="px-4 pb-safe">
              {children}
            </div>
          </LazyMotionDiv>
        </>
      )}
    </LazyAnimatePresence>
  );
}

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({
  onRefresh,
  children,
  className
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const threshold = 80;

  const handleDragEnd = async (event: any, info: PanInfo) => {
    if (info.offset.y > threshold && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
      setPullDistance(0);
    } else {
      setPullDistance(0);
    }
  };

  const handleDrag = (event: any, info: PanInfo) => {
    if (info.offset.y > 0) {
      setPullDistance(Math.min(info.offset.y, threshold * 1.5));
    }
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Pull indicator */}
      <LazyMotionDiv
        className="absolute top-0 left-0 right-0 flex justify-center items-center h-20 z-10"
        style={{
          translateY: pullDistance - 80
        }}
      >
        <LazyMotionDiv
          animate={{ rotate: isRefreshing ? 360 : pullDistance * 3 }}
          transition={{ 
            duration: isRefreshing ? 1 : 0,
            repeat: isRefreshing ? Infinity : 0,
            ease: 'linear'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" className="text-primary">
            <path 
              fill="currentColor" 
              d="M12 2v6l4-4-4-4M12 22v-6l-4 4 4 4M2 12h6l-4-4-4 4M22 12h-6l4 4 4-4"
            />
          </svg>
        </LazyMotionDiv>
      </LazyMotionDiv>

      {/* Content */}
      <LazyMotionDiv
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.5}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={{ y: isRefreshing ? threshold : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{ touchAction: 'pan-x' }}
      >
        {children}
      </LazyMotionDiv>
    </div>
  );
}

interface HapticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  hapticStyle?: 'light' | 'medium' | 'heavy';
  children: React.ReactNode;
}

export function HapticButton({
  hapticStyle = 'medium',
  children,
  className,
  onClick,
  ...props
}: HapticButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Simulate haptic feedback with animation
    const button = e.currentTarget;
    button.classList.add('haptic-feedback');
    
    // Trigger native haptic feedback if available
    if ('vibrate' in navigator) {
      const duration = hapticStyle === 'light' ? 10 : hapticStyle === 'heavy' ? 30 : 20;
      navigator.vibrate(duration);
    }
    
    setTimeout(() => {
      button.classList.remove('haptic-feedback');
    }, 200);
    
    onClick?.(e);
  };

  return (
    <>
      <LazyMotionButton
        className={cn('relative overflow-hidden', className)}
        onClick={handleClick}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      >
        {children}
      </LazyMotionButton>
      <style>{`
        @keyframes haptic-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(0.97); }
          100% { transform: scale(1); }
        }
        
        .haptic-feedback {
          animation: haptic-pulse 0.2s ease-out;
        }
      `}</style>
    </>
  );
}

interface TouchRippleProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
}

export function TouchRipple({
  children,
  className,
  color = 'rgba(242, 98, 7, 0.3)'
}: TouchRippleProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleTouch = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
    const newRipple = { x, y, id: Date.now() };
    setRipples(prev => [...prev, newRipple]);
    
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 600);
  };

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onTouchStart={handleTouch}
      onMouseDown={handleTouch}
    >
      {children}
      <LazyAnimatePresence>
        {ripples.map(ripple => (
          <LazyMotionSpan
            key={ripple.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              backgroundColor: color
            }}
            initial={{ width: 0, height: 0, x: 0, y: 0 }}
            animate={{ 
              width: 200, 
              height: 200, 
              x: -100, 
              y: -100,
              opacity: 0
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        ))}
      </LazyAnimatePresence>
    </div>
  );
}

// Enhanced SwipeGesture with velocity tracking and momentum
interface SwipeGestureProps {
  children: React.ReactNode;
  className?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  velocityThreshold?: number;
  enableRubberband?: boolean;
  enableMomentum?: boolean;
}

export function SwipeGesture({
  children,
  className,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  velocityThreshold = 0.3,
  enableRubberband = true,
  enableMomentum = true
}: SwipeGestureProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleDragEnd = (event: any, info: PanInfo) => {
    const { offset, velocity } = info;
    const absX = Math.abs(offset.x);
    const absY = Math.abs(offset.y);
    const velocityX = Math.abs(velocity.x);
    const velocityY = Math.abs(velocity.y);

    // Velocity-based swipe detection
    const isVelocitySwipe = velocityX > velocityThreshold || velocityY > velocityThreshold;

    // Horizontal swipe
    if (absX > absY && (absX > threshold || (isVelocitySwipe && velocityX > velocityY))) {
      if (offset.x > 0) {
        onSwipeRight?.();
        if ('vibrate' in navigator) navigator.vibrate(10);
      } else {
        onSwipeLeft?.();
        if ('vibrate' in navigator) navigator.vibrate(10);
      }
    }
    // Vertical swipe
    else if (absY > threshold || (isVelocitySwipe && velocityY > velocityX)) {
      if (offset.y > 0) {
        onSwipeDown?.();
        if ('vibrate' in navigator) navigator.vibrate(10);
      } else {
        onSwipeUp?.();
        if ('vibrate' in navigator) navigator.vibrate(10);
      }
    }

    // Reset offset
    setOffset({ x: 0, y: 0 });
  };

  const handleDrag = (event: any, info: PanInfo) => {
    if (enableRubberband) {
      const maxOffset = 100;
      const rubberbandX = info.offset.x > maxOffset 
        ? maxOffset + (info.offset.x - maxOffset) * 0.2 
        : info.offset.x < -maxOffset 
          ? -maxOffset + (info.offset.x + maxOffset) * 0.2
          : info.offset.x;
      
      const rubberbandY = info.offset.y > maxOffset 
        ? maxOffset + (info.offset.y - maxOffset) * 0.2 
        : info.offset.y < -maxOffset 
          ? -maxOffset + (info.offset.y + maxOffset) * 0.2
          : info.offset.y;

      setOffset({ x: rubberbandX, y: rubberbandY });
    }
  };

  return (
    <LazyMotionDiv
      className={className}
      drag
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={enableRubberband ? 0.2 : 0}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      animate={{ x: offset.x, y: offset.y }}
      transition={
        enableMomentum 
          ? { type: 'spring', stiffness: 200, damping: 20 }
          : { type: 'tween', duration: 0.3 }
      }
    >
      {children}
    </LazyMotionDiv>
  );
}

// Long press detector
interface LongPressProps {
  children: React.ReactNode;
  className?: string;
  onLongPress: () => void;
  threshold?: number;
}

export function LongPress({
  children,
  className,
  onLongPress,
  threshold = 500
}: LongPressProps) {
  const [isPressed, setIsPressed] = useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handlePressStart = () => {
    setIsPressed(true);
    timeoutRef.current = setTimeout(() => {
      onLongPress();
      if ('vibrate' in navigator) navigator.vibrate([20, 10, 20]);
    }, threshold);
  };

  const handlePressEnd = () => {
    setIsPressed(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  return (
    <LazyMotionDiv
      className={className}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      animate={{ scale: isPressed ? 0.95 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {children}
    </LazyMotionDiv>
  );
}

// Pinch to zoom gesture
interface PinchToZoomProps {
  children: React.ReactNode;
  className?: string;
  minScale?: number;
  maxScale?: number;
}

export function PinchToZoom({
  children,
  className,
  minScale = 1,
  maxScale = 3
}: PinchToZoomProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const initialDistance = React.useRef<number | null>(null);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      if (initialDistance.current === null) {
        initialDistance.current = distance;
      } else {
        const newScale = Math.min(
          maxScale,
          Math.max(minScale, scale * (distance / initialDistance.current))
        );
        setScale(newScale);
      }
    }
  };

  const handleTouchEnd = () => {
    initialDistance.current = null;
  };

  const handleDoubleClick = () => {
    setScale(scale === 1 ? 2 : 1);
    setPosition({ x: 0, y: 0 });
    if ('vibrate' in navigator) navigator.vibrate(5);
  };

  return (
    <LazyMotionDiv
      className={cn('overflow-hidden', className)}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      <LazyMotionDiv
        drag={scale > 1}
        dragConstraints={{
          top: -(scale - 1) * 100,
          right: (scale - 1) * 100,
          bottom: (scale - 1) * 100,
          left: -(scale - 1) * 100
        }}
        animate={{ scale, x: position.x, y: position.y }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ touchAction: 'none' }}
      >
        {children}
      </LazyMotionDiv>
    </LazyMotionDiv>
  );
}
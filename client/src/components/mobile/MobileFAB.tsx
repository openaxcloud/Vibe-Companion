// @ts-nocheck
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import { Play, Square, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileFABProps {
  projectId: string | number; // Support both UUID strings and numeric IDs
  className?: string;
  isRunning?: boolean;
  onPlayStop?: () => void;
  isLoading?: boolean;
}

export function MobileFAB({
  projectId,
  className,
  isRunning = false,
  onPlayStop,
  isLoading = false
}: MobileFABProps) {
  const [showPulse, setShowPulse] = useState(false);
  const isMobile = useIsMobile();

  // Haptic feedback helper
  const triggerHaptic = (pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  // Handle FAB click
  const handleClick = async () => {
    // Prevent duplicate mutations while pending
    if (isLoading) {
      return;
    }

    triggerHaptic(10);

    if (isRunning || onPlayStop) {
      onPlayStop?.();
      triggerHaptic([10, 50, 10]);
    } else {
      onPlayStop?.();
      triggerHaptic([10, 50, 10]);
    }
  };

  // Show pulse animation when transitioning to running
  useEffect(() => {
    if (isRunning && !showPulse) {
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 2000);
    }
  }, [isRunning]);

  // Early return for non-mobile devices (must be after all hooks)
  if (!isMobile) {
    return null;
  }

  // Determine FAB appearance based on state
  const getButtonState = () => {
    if (isLoading) {
      return {
        icon: Loader2,
        bgColor: 'bg-blue-500',
        label: 'Starting',
        ariaLabel: 'Runtime starting',
        animate: true,
      };
    }

    if (isRunning) {
      return {
        icon: Square,
        bgColor: 'bg-red-500 hover:bg-red-600 active:bg-red-700',
        label: 'Stop',
        ariaLabel: 'Stop runtime',
      };
    }

    return {
      icon: Play,
      bgColor: 'bg-primary hover:bg-primary/90 active:bg-primary/80',
      label: 'Run',
      ariaLabel: 'Run project',
    };
  };

  const buttonState = getButtonState();
  const Icon = buttonState.icon;

  return (
    <LazyMotionDiv
      className={cn(
        'fixed z-40',
        // Position: bottom-right with safe area padding, above 64px bottom tab bar
        'bottom-20 right-4',
        className
      )}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      {/* Pulse animation for running state */}
      <LazyAnimatePresence>
        {showPulse && isRunning && (
          <LazyMotionDiv
            className="absolute inset-0 rounded-full bg-primary"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        )}
      </LazyAnimatePresence>

      {/* FAB Button */}
      <LazyMotionButton
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          // Size: 56x56px (minimum touch target)
          'w-14 h-14 rounded-full',
          'flex items-center justify-center',
          'shadow-2xl',
          'transition-all duration-200',
          'focus:outline-none focus:ring-4 focus:ring-primary/50',
          'touch-manipulation',
          // Disable interaction during loading
          isLoading && 'cursor-not-allowed',
          buttonState.bgColor
        )}
        whileTap={!isLoading ? { scale: 0.9 } : undefined}
        aria-label={buttonState.ariaLabel}
        data-testid="mobile-fab"
      >
        <Icon 
          className={cn(
            'h-6 w-6 text-white',
            buttonState.animate && 'animate-spin'
          )} 
        />
      </LazyMotionButton>

      {/* Label tooltip (appears on long press or briefly on state change) */}
      <LazyAnimatePresence>
        {showPulse && (
          <LazyMotionDiv
            className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-background text-white text-[11px] font-medium rounded-lg whitespace-nowrap pointer-events-none"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            {buttonState.label}
          </LazyMotionDiv>
        )}
      </LazyAnimatePresence>
    </LazyMotionDiv>
  );
}

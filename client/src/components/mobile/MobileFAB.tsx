import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import { Play, Square, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileFABProps {
  projectId: string | number; // Support both UUID strings and numeric IDs
  className?: string;
}

interface RuntimeStatus {
  isRunning: boolean;
  status: 'starting' | 'running' | 'stopped' | 'error';
  url?: string;
}

export function MobileFAB({ projectId, className }: MobileFABProps) {
  const { toast } = useToast();
  const [showPulse, setShowPulse] = useState(false);
  const [localExecutionId, setLocalExecutionId] = useState<string | undefined>();
  const isMobile = useIsMobile();

  // Poll runtime status from backend - supports both UUID and numeric IDs
  const { data: runtimeStatus } = useQuery<RuntimeStatus>({
    queryKey: [`/api/runtime/${projectId}`],
    refetchInterval: (_data, _query) => {
      const data = _data;
      // Poll more frequently when starting, less when running/stopped
      if (data?.status === 'starting') return 1000;
      if (data?.status === 'running') return 5000;
      return false; // Don't poll when stopped/error
    },
    enabled: !!projectId,
  });

  const status: RuntimeStatus['status'] = runtimeStatus?.status || 'stopped';
  const isRunning = runtimeStatus?.isRunning || false;

  // Start project execution mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      // apiRequest already returns parsed JSON and throws on error
      return await apiRequest('POST', `/api/runtime/start`, {
        projectId,
        mainFile: undefined,
        timeout: 30000
      });
    },
    onSuccess: async (data) => {
      const execId = data.executionId || `exec-${Date.now()}`;
      setLocalExecutionId(execId);
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/runtime/${projectId}`] 
      });
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 2000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to start',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Stop project execution mutation
  const stopMutation = useMutation({
    mutationFn: async () => {
      // apiRequest already returns parsed JSON and throws on error
      return await apiRequest('POST', `/api/runtime/stop`, {
        projectId,
        executionId: localExecutionId
      });
    },
    onSuccess: async () => {
      setLocalExecutionId(undefined);
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/runtime/${projectId}`] 
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to stop',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const isLoading = startMutation.isPending || stopMutation.isPending || status === 'starting';

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

    if (isRunning) {
      stopMutation.mutate(undefined);
      triggerHaptic([10, 50, 10]);
    } else {
      startMutation.mutate(undefined);
      triggerHaptic([10, 50, 10]);
    }
  };

  // Show pulse animation when transitioning to running
  useEffect(() => {
    if (status === 'running' && !showPulse) {
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 2000);
    }
  }, [status]);

  // Early return for non-mobile devices (must be after all hooks)
  if (!isMobile) {
    return null;
  }

  // Determine FAB appearance based on state
  const getButtonState = () => {
    // Check status directly to avoid type narrowing issues
    const currentStatus = status as string;
    
    if (currentStatus === 'error') {
      return {
        icon: AlertCircle,
        bgColor: 'bg-red-500 hover:bg-red-600 active:bg-red-700',
        label: 'Error',
        ariaLabel: 'Runtime error - tap to retry',
      };
    }
    
    if (isLoading || currentStatus === 'starting') {
      return {
        icon: Loader2,
        bgColor: 'bg-blue-500',
        label: 'Starting',
        ariaLabel: 'Runtime starting',
        animate: true,
      };
    }
    
    if (isRunning || currentStatus === 'running') {
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

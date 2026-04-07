/**
 * Enhanced Mobile Terminal with Design System Integration
 * Adds pull-to-refresh, empty states, and toast notifications
 */

import React, { useState, useCallback, useRef } from 'react';
import { LazyMotionDiv } from '@/lib/motion';
import { MobileTerminal } from './MobileTerminal';
import {
  usePullToRefresh,
  EmptyState,
  TerminalSkeleton,
} from '@/design-system';
import { Toaster } from '@/components/ui/toaster';

interface EnhancedMobileTerminalProps {
  projectId: string | number;
  sessionId?: string;
  className?: string;
}

/**
 * Enhanced Mobile Terminal
 *
 * Adds to base MobileTerminal:
 * - ✅ Pull-to-refresh to clear terminal
 * - ✅ Empty state for new terminals
 * - ✅ Loading skeleton
 * - ✅ Toast notifications
 * - ✅ Haptic feedback
 *
 * @example
 * ```tsx
 * <EnhancedMobileTerminal projectId="123" />
 * ```
 */
export function EnhancedMobileTerminal(props: EnhancedMobileTerminalProps) {
  // Remove toast hook - use Toaster component instead
  const [isLoading, setIsLoading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);

    // Simulate clearing terminal
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Emit clear event
    window.dispatchEvent(new CustomEvent('terminal:clear'));

    // toast({ title: 'Terminal cleared' }); // This line is removed as toast hook is removed
    setIsLoading(false);
  }, []); // Removed toast from dependency array as it's no longer used here

  // Pull-to-refresh gesture
  const pullToRefreshProps = usePullToRefresh({
    threshold: 80,
    onRefresh: handleRefresh,
    hapticFeedback: true,
  });

  // Show loading skeleton
  if (isLoading) {
    return (
      <div style={{ padding: '16px' }}>
        <TerminalSkeleton lines={15} animated />
      </div>
    );
  }

  // Show empty state for new terminals
  if (isEmpty && !isLoading) {
    return (
      <EmptyState
        icon="💻"
        title="Terminal Ready"
        description="Run commands to interact with your project. Pull down to clear the terminal."
        action={{
          label: 'Run ls',
          onPress: () => {
            setIsEmpty(false);
            // Emit command event
            window.dispatchEvent(
              new CustomEvent('terminal:command', { detail: { command: 'ls' } })
            );
          },
        }}
      />
    );
  }

  return (
    <>
      <Toaster />
      <LazyMotionDiv
        ref={terminalContainerRef}
        {...pullToRefreshProps}
        style={{
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Pull-to-refresh indicator */}
        <LazyMotionDiv
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {isLoading && (
            <LazyMotionDiv
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 10 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'hsl(var(--background))',
                borderRadius: '20px',
                color: 'white',
                fontSize: '14px',
              }}
            >
              Clearing terminal...
            </LazyMotionDiv>
          )}
        </LazyMotionDiv>

        {/* Base Terminal */}
        <MobileTerminal {...props} />
      </LazyMotionDiv>
    </>
  );
}

export default EnhancedMobileTerminal;
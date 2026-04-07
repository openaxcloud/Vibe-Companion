/**
 * Streaming Skeleton Loader
 * Replit-style skeleton placeholders for messages being streamed
 */

import { cn } from '@/lib/utils';

interface StreamingSkeletonProps {
  className?: string;
  lines?: number;
  variant?: 'message' | 'code' | 'action';
}

export function StreamingSkeleton({
  className,
  lines = 3,
  variant = 'message'
}: StreamingSkeletonProps) {
  const widths = ['w-3/4', 'w-1/2', 'w-5/6', 'w-2/3', 'w-4/5'];

  if (variant === 'code') {
    return (
      <div className={cn("space-y-2 font-mono", className)} data-testid="streaming-skeleton-code">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 rounded skeleton-shimmer",
              widths[i % widths.length]
            )}
          />
        ))}
      </div>
    );
  }

  if (variant === 'action') {
    return (
      <div className={cn("space-y-3", className)} data-testid="streaming-skeleton-action">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded skeleton-pulse bg-violet-500/20" />
          <div className="h-4 w-32 rounded skeleton-shimmer" />
        </div>
        <div className="ml-7 space-y-2">
          <div className="h-3 w-3/4 rounded skeleton-shimmer" />
          <div className="h-3 w-1/2 rounded skeleton-shimmer" />
        </div>
      </div>
    );
  }

  // Default: message variant
  return (
    <div className={cn("space-y-2", className)} data-testid="streaming-skeleton-message">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 rounded skeleton-shimmer",
            widths[i % widths.length]
          )}
        />
      ))}

      {/* Typing indicator dots */}
      <div className="flex items-center gap-1 mt-3">
        <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce opacity-70" style={{ animationDelay: '-0.32s', animationDuration: '1.4s' }} />
        <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce opacity-80" style={{ animationDelay: '-0.16s', animationDuration: '1.4s' }} />
        <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce opacity-90" style={{ animationDuration: '1.4s' }} />
      </div>
    </div>
  );
}

/**
 * Streaming Skeleton for entire message block (with avatar)
 */
export function StreamingMessageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-3 px-4 py-4 border-b border-[var(--ecode-border)]", className)}>
      {/* Avatar skeleton */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full skeleton-pulse bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20" />

      {/* Content skeleton */}
      <div className="flex-1 min-w-0">
        <StreamingSkeleton lines={3} />
      </div>
    </div>
  );
}

/**
 * Streaming Skeleton for thinking process
 */
export function StreamingThinkingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-violet-200 dark:border-violet-800 p-3 space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded thinking-spinner border-2 border-violet-500 border-t-transparent" />
        <div className="h-3 w-24 rounded skeleton-shimmer" />
      </div>
      <div className="ml-6 space-y-1.5">
        <div className="h-2.5 w-full rounded skeleton-shimmer" />
        <div className="h-2.5 w-4/5 rounded skeleton-shimmer" />
        <div className="h-2.5 w-3/5 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}
